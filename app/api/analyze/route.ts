import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import mammoth from "mammoth";
import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT_CHARS = 60000;
const MAX_UPLOAD_BYTES = 18 * 1024 * 1024;

type AnalyzePayload = {
  sourceType: string;
  title?: string;
  text: string;
  notes?: string[];
};

function jsonError(message: string, status = 400, hint?: string) {
  return NextResponse.json({ error: message, hint }, { status });
}

function normalizeText(text: string) {
  return text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, MAX_TEXT_CHARS);
}

function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("缺少 OPENAI_API_KEY。请在 .env.local 或 Vercel Environment Variables 中填写。");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function splitSentences(text: string) {
  return text.split(/(?<=[。！？.!?；;])\s+|\n+/).map((item) => item.trim()).filter(Boolean);
}

function uniqueTop(items: string[], limit: number) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.slice(0, 28);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function localAnalyze(payload: AnalyzePayload) {
  const text = payload.text;
  const sentences = splitSentences(text);
  const dataSignals = (text.match(/\d+(\.\d+)?%?|\$[0-9,.]+|[0-9,.]+倍|[0-9,.]+万|[0-9,.]+亿/g) || []).length;
  const concreteSignals = sentences.filter((sentence) =>
    /(案例|客户|用户|收入|成本|留存|转化|增长|融资|上线|协议|生态|市场|竞品|数据|指标|实验|风险|pricing|revenue|retention|growth|customer|case|metric)/i.test(sentence)
  );
  const oldNarratives = sentences.filter((sentence) =>
    /(赋能|颠覆|重塑|闭环|生态化|下一代|革命性|无缝|极致体验|降本增效|范式转移|抢占先机|ai native|web3 native|game changer)/i.test(sentence)
  );
  const web3Signals = /(web3|crypto|区块链|链上|token|代币|defi|dao|钱包|协议|staking|rollup|l2)/i.test(text);
  const founderSignals = /(商业模式|增长|用户|收入|成本|留存|竞争|融资|定价|分发|获客|founder|startup)/i.test(text);
  const score = Math.max(12, Math.min(88, 28 + Math.min(42, dataSignals * 6) + Math.min(34, concreteSignals.length * 7) - Math.min(28, oldNarratives.length * 6)));
  const valueLabel = score >= 76 ? "值得精读" : score >= 62 ? "新信息" : score >= 45 ? "部分重复" : score >= 30 ? "高度重复" : "低价值噪音";
  const readingAdvice = score >= 76 ? "值得精读" : score >= 58 ? "快速扫过" : score >= 42 ? "只看结论" : score >= 30 ? "存档备用" : "直接跳过";

  return {
    valueLabel,
    densityScore: score,
    newSignals: uniqueTop(concreteSignals, 6).length ? uniqueTop(concreteSignals, 6) : ["未检测到足够具体的新事实、数据或案例；更像观点性表达，需要人工补充上下文后再判断。"],
    repeatedNarratives: uniqueTop(oldNarratives, 5).length ? uniqueTop(oldNarratives, 5) : ["没有明显高频包装词，但当前无模型模式只能做启发式判断，建议重点看是否有真实数据和可验证案例。"],
    builderMeaning: {
      productJudgment: score >= 58 ? "可以提取少量产品判断线索，重点看它是否说明了真实用户场景、使用频率和替代方案。" : "对产品判断的帮助有限，缺少足够具体的用户行为或问题约束。",
      userDemand: concreteSignals.length > 0 ? "存在一些需求相关描述，但仍需要验证是否来自真实用户而非概念包装。" : "用户需求信号偏弱。",
      businessModel: /收入|定价|商业模式|付费|revenue|pricing/i.test(text) ? "提到了商业化相关内容，值得进一步核对定价、成本和可持续性。" : "商业模式信息不足。",
      growthStrategy: /增长|获客|分发|渠道|社区|growth|distribution/i.test(text) ? "有增长或分发线索，可继续看是否包含渠道效率和复用机制。" : "增长策略信号不明显。",
      competition: /竞品|竞争|市场|替代|benchmark|competitor/i.test(text) ? "包含竞争或市场对比线索，建议核对差异是否可防守。" : "竞争格局信息不足。",
      web3Ecosystem: web3Signals ? "包含 Web3 相关信号，重点看链上行为、协议激励和真实留存，而不是叙事热度。" : "Web3 生态相关性不强。",
      founderDecision: founderSignals ? "可以作为快速筛选材料，但不建议仅凭这条内容做创业判断。" : "对 Founder 决策的直接价值有限。",
      informationGap: score >= 62 ? "可能存在局部信息差，值得追原始数据或一手来源。" : "信息差价值偏低，更像常见观点的再表达。"
    },
    readingAdvice,
    oneLineConclusion: score >= 62 ? "这条内容有一定新增信号，值得快速扫过并追一手来源。" : score >= 42 ? "核心观点并不新，只建议看结论，不值得完整阅读。" : "这更像旧叙事的新包装，可以直接跳过。",
    timeSavedMinutes: Math.max(2, Math.round((text.length / 650) * (1 - score / 130))),
    sourceDigest: sentences.slice(0, 2).join(" ").slice(0, 180) || "当前内容较短，缺少可稳定概括的正文。"
  };
}

async function extractPdf(buffer: Buffer) {
  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(buffer);
  return parsed.text || "";
}

async function extractDocx(buffer: Buffer) {
  const parsed = await mammoth.extractRawText({ buffer });
  return parsed.value || "";
}

async function extractFile(file: File): Promise<AnalyzePayload> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("文件过大。当前 MVP 建议单个文件不超过 18MB。");
  const name = file.name || "uploaded-file";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const buffer = Buffer.from(await file.arrayBuffer());
  if (["txt", "md", "markdown"].includes(ext) || file.type.startsWith("text/")) return { sourceType: "file", title: name, text: normalizeText(buffer.toString("utf8")) };
  if (ext === "pdf" || file.type === "application/pdf") return { sourceType: "file", title: name, text: normalizeText(await extractPdf(buffer)) };
  if (ext === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return { sourceType: "file", title: name, text: normalizeText(await extractDocx(buffer)) };
  throw new Error("暂不支持这个文件格式。请上传 PDF、TXT、DOCX 或 Markdown。");
}

async function extractUrl(url: string): Promise<AnalyzePayload> {
  const parsed = new URL(url);
  if (/(^|\.)weixin\.qq\.com$|(^|\.)wechat\.com$|channels\.weixin\.qq\.com/.test(parsed.hostname)) {
    throw new Error("这个微信内容可能无法直接读取，你可以上传视频文件、截图，或者粘贴转写文字，我会继续帮你判断信息价值。");
  }
  const res = await fetch(parsed.toString(), { headers: { "user-agent": "Mozilla/5.0 (compatible; SignalOnly/1.0)" } });
  if (!res.ok) throw new Error("链接抓取失败。你可以手动粘贴正文，我会继续分析。");
  const html = await res.text();
  const dom = new JSDOM(html, { url: parsed.toString() });
  const article = new Readability(dom.window.document).parse();
  const $ = cheerio.load(html);
  const text = normalizeText(article?.textContent || $("main").text() || $("article").text() || $("body").text());
  if (text.length < 120) throw new Error("没有抓到足够正文。你可以手动粘贴正文，我会继续分析。");
  return { sourceType: "url", title: article?.title || $("title").first().text() || parsed.hostname, text };
}

async function extractImage(file: File): Promise<AnalyzePayload> {
  const client = getClient();
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("图片过大。当前 MVP 建议单张图片不超过 18MB。");
  const dataUrl = `data:${file.type || "image/png"};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: "你是一个严谨的 OCR 助手。只提取图片中可见文字，保留段落结构。不要补充不存在的信息。" },
      { role: "user", content: [{ type: "text", text: "请识别这张图片中的所有文字。" }, { type: "image_url", image_url: { url: dataUrl } }] }
    ]
  });
  return { sourceType: "image", title: file.name || "image", text: normalizeText(response.choices[0]?.message?.content || ""), notes: ["图片文字已通过 OCR 提取。"] };
}

async function extractAudio(file: File): Promise<AnalyzePayload> {
  const client = getClient();
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("音频过大。当前 MVP 建议单个音频不超过 18MB。");
  const audioFile = await toFile(Buffer.from(await file.arrayBuffer()), file.name || "audio.mp3", { type: file.type || "audio/mpeg" });
  const transcript = await client.audio.transcriptions.create({ file: audioFile, model: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe" });
  return { sourceType: "audio", title: file.name || "audio", text: normalizeText(transcript.text || ""), notes: ["音频已转写为文字后进入分析。"] };
}

async function aiAnalyze(payload: AnalyzePayload) {
  if (!payload.text || payload.text.length < 20) throw new Error("可分析的正文太少。请补充更多文字、截图或文件内容。");
  if (!hasOpenAIKey()) return localAnalyze(payload);
  const client = getClient();
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_ANALYSIS_MODEL || "gpt-4o-mini",
    temperature: 0.25,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "你只输出可以 JSON.parse 的 JSON。你擅长识别重复叙事、低价值包装和真正的新信号。" },
      { role: "user", content: `你是 Signal Only，一个服务产品经理、Founder、Web3 Builder 的多模态信息去重与认知减负助手。严格输出 JSON，字段包括 valueLabel, densityScore, newSignals, repeatedNarratives, builderMeaning, readingAdvice, oneLineConclusion, timeSavedMinutes, sourceDigest。\n\n来源类型：${payload.sourceType}\n标题：${payload.title || "未提供"}\n正文：\n${payload.text}` }
    ]
  });
  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const mode = String(form.get("mode") || "text");
    let payload: AnalyzePayload;
    if (mode === "text") payload = { sourceType: "text", title: "pasted-text", text: normalizeText(String(form.get("text") || "")) };
    else if (mode === "url") payload = await extractUrl(String(form.get("url") || ""));
    else if (mode === "file") {
      const file = form.get("file");
      if (!(file instanceof File)) return jsonError("没有收到文件。");
      payload = await extractFile(file);
    } else if (mode === "image") {
      const file = form.get("file");
      if (!(file instanceof File)) return jsonError("没有收到图片。");
      payload = await extractImage(file);
    } else if (mode === "audio") {
      const file = form.get("file");
      if (!(file instanceof File)) return jsonError("没有收到音频。");
      payload = await extractAudio(file);
    } else if (mode === "video") {
      return jsonError("视频解析功能已预留，当前版本建议先上传截图或粘贴转写文字。", 422, "微信视频 / 视频解析受平台权限限制，建议上传视频文件、截图或粘贴转写文字。");
    } else return jsonError("未知输入类型。");
    const result = await aiAnalyze(payload);
    return NextResponse.json({ result, extracted: { sourceType: payload.sourceType, title: payload.title, length: payload.text.length, notes: payload.notes || [] } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "分析失败。", 500);
  }
}
