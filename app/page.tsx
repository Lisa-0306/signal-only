"use client";

import { Archive, Clipboard, FileText, Image as ImageIcon, Link2, Loader2, Mic, Moon, PlaySquare, Sparkles, Sun, Trash2, Upload, Wand2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Mode = "text" | "image" | "file" | "url" | "audio" | "video";
type Result = {
  valueLabel: string;
  densityScore: number;
  newSignals: string[];
  repeatedNarratives: string[];
  builderMeaning: Record<string, string>;
  readingAdvice: string;
  oneLineConclusion: string;
  timeSavedMinutes: number;
  sourceDigest: string;
};
type HistoryItem = { id: string; createdAt: string; title: string; mode: Mode; result: Result };

const modes: Array<{ id: Mode; label: string; icon: React.ComponentType<{ className?: string }>; accept?: string }> = [
  { id: "text", label: "文本", icon: FileText },
  { id: "image", label: "图片 OCR", icon: ImageIcon, accept: "image/png,image/jpeg,image/jpg,image/webp" },
  { id: "file", label: "文件", icon: Upload, accept: ".pdf,.txt,.docx,.md,.markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { id: "url", label: "网址", icon: Link2 },
  { id: "audio", label: "音频", icon: Mic, accept: "audio/mp3,audio/mpeg,audio/m4a,audio/wav,audio/x-m4a" },
  { id: "video", label: "视频 / 微信", icon: PlaySquare, accept: "video/mp4,video/quicktime,video/x-m4v" }
];

const storageKey = "signal-only-history-v1";

function cnMode(mode: Mode) {
  return modes.find((item) => item.id === mode)?.label || mode;
}

function resultText(result: Result) {
  const meaning = result.builderMeaning || {};
  return [
    `一、信息价值判断：${result.valueLabel}`,
    `二、信息密度评分：${result.densityScore}/100`,
    "",
    "三、新增信息点",
    ...(result.newSignals || []).map((item) => `- ${item}`),
    "",
    "四、重复叙事识别",
    ...(result.repeatedNarratives || []).map((item) => `- ${item}`),
    "",
    "五、对产品经理 / Founder / Web3 Builder 的意义",
    `- 产品判断：${meaning.productJudgment || ""}`,
    `- 用户需求：${meaning.userDemand || ""}`,
    `- 商业模式：${meaning.businessModel || ""}`,
    `- 增长策略：${meaning.growthStrategy || ""}`,
    `- 竞争格局：${meaning.competition || ""}`,
    `- Web3 生态：${meaning.web3Ecosystem || ""}`,
    `- 创业决策：${meaning.founderDecision || ""}`,
    `- 信息差价值：${meaning.informationGap || ""}`,
    "",
    `六、阅读建议：${result.readingAdvice}`,
    `七、一句话结论：${result.oneLineConclusion}`,
    `八、节省时间估算：这次大约帮你节省了 ${result.timeSavedMinutes} 分钟无效阅读时间。`
  ].join("\n");
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [copied, setCopied] = useState(false);
  const [easterOpen, setEasterOpen] = useState(false);
  const logoClicks = useRef<number[]>([]);
  const activeMode = useMemo(() => modes.find((item) => item.id === mode) || modes[0], [mode]);
  const ActiveModeIcon = activeMode.icon;

  useEffect(() => {
    const savedTheme = localStorage.getItem("signal-only-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setDark(savedTheme === "dark");
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("signal-only-theme", dark ? "dark" : "light");
  }, [dark]);

  function saveHistory(next: HistoryItem[]) {
    setHistory(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function remember(item: HistoryItem) {
    saveHistory([item, ...history.filter((existing) => existing.id !== item.id)].slice(0, 20));
  }

  function titleForHistory() {
    if (mode === "url") return url || "URL";
    if (file) return file.name;
    return text.trim().split("\n")[0].slice(0, 48) || cnMode(mode);
  }

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const form = new FormData();
      form.set("mode", mode);
      if (mode === "text") {
        if (text.trim().length < 20) throw new Error("请粘贴至少 20 个字，再开始判断。");
        form.set("text", text);
      } else if (mode === "url") {
        if (!url.trim()) throw new Error("请先粘贴一个链接。");
        form.set("url", url.trim());
      } else if (mode === "video" && !file) {
        form.set("mode", "video");
      } else {
        if (!file) throw new Error("请先选择要分析的文件。");
        form.set("file", file);
      }
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.hint || data.error || "分析失败。");
      setResult(data.result);
      remember({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), title: data.extracted?.title || titleForHistory(), mode, result: data.result });
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败。");
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(resultText(result));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function onLogoClick() {
    const now = Date.now();
    logoClicks.current = [...logoClicks.current.filter((time) => now - time < 1600), now];
    if (logoClicks.current.length >= 5) {
      logoClicks.current = [];
      setEasterOpen(true);
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 text-[var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <button type="button" onClick={onLogoClick} className="focus-ring group flex items-center gap-3 rounded-lg px-1 py-1 text-left" aria-label="Signal Only">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] bg-[var(--solid)] shadow-sm">
              <Sparkles className="h-4 w-4 text-violet-500" />
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight">Signal Only</span>
              <span className="block text-xs text-[var(--muted)]">少看一点重复信息</span>
            </span>
          </button>
          <button type="button" onClick={() => setDark((value) => !value)} className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] bg-[var(--solid)] text-[var(--muted)]" aria-label="切换暗色模式">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>

        <section className="grid gap-5 lg:grid-cols-[0.96fr_1.04fr]">
          <div className="glass rounded-xl p-5 sm:p-6">
            <div className="mb-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">Multimodal signal filter</p>
              <h1 className="max-w-2xl text-4xl font-semibold leading-[1.04] sm:text-5xl">Stop reading the same thing twice.</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--muted)]">把重复信息挡在外面，只留下真正值得看的信号。</p>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {modes.map((item) => {
                const Icon = item.icon;
                const active = item.id === mode;
                return (
                  <button key={item.id} type="button" onClick={() => { setMode(item.id); setError(""); setFile(null); }} className={`focus-ring flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-xs transition ${active ? "border-violet-400/60 bg-violet-500/10 text-[var(--fg)]" : "border-[var(--line)] bg-[var(--soft)] text-[var(--muted)] hover:text-[var(--fg)]"}`}>
                    <Icon className="h-4 w-4" />
                    <span className="text-center leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="solid-panel rounded-xl p-3">
              {mode === "text" && <textarea value={text} onChange={(event) => setText(event.target.value)} className="focus-ring min-h-72 w-full resize-y rounded-lg border border-transparent bg-transparent p-3 text-sm leading-6 outline-none placeholder:text-[var(--muted)]" placeholder="粘贴文章、推文、项目介绍、会议纪要、观点内容。" />}
              {mode === "url" && (
                <div className="space-y-3 p-3">
                  <label className="text-xs font-medium text-[var(--muted)]">网页链接</label>
                  <input value={url} onChange={(event) => setUrl(event.target.value)} className="focus-ring h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--soft)] px-3 text-sm outline-none" placeholder="https://mirror.xyz/... 或 Medium / Notion / 项目官网" />
                  <p className="text-xs leading-5 text-[var(--muted)]">如果网页限制抓取，会提示你手动粘贴正文。</p>
                </div>
              )}
              {mode !== "text" && mode !== "url" && (
                <div className="space-y-4 p-3">
                  <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[var(--line)] bg-[var(--soft)] px-4 py-8 text-center">
                    <ActiveModeIcon className="mb-3 h-6 w-6 text-violet-500" />
                    <span className="text-sm font-medium">{file ? file.name : `选择${activeMode.label}`}</span>
                    <span className="mt-2 max-w-md text-xs leading-5 text-[var(--muted)]">
                      {mode === "image" && "支持 PNG、JPG、JPEG、WebP。"}
                      {mode === "file" && "支持 PDF、TXT、DOCX、Markdown。"}
                      {mode === "audio" && "支持 MP3、M4A、WAV，上传后会先转写为文字。"}
                      {mode === "video" && "微信视频 / 视频解析受平台权限限制，建议上传视频文件、截图或粘贴转写文字。"}
                    </span>
                    <input type="file" className="hidden" accept={activeMode.accept} onChange={(event) => setFile(event.target.files?.[0] || null)} />
                  </label>
                  {mode === "video" && <input value={url} onChange={(event) => setUrl(event.target.value)} className="focus-ring h-12 w-full rounded-lg border border-[var(--line)] bg-[var(--soft)] px-3 text-sm outline-none" placeholder="也可以粘贴微信视频链接，若无法读取会提示替代方式" />}
                </div>
              )}
            </div>

            {error && <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm leading-5 text-red-600 dark:text-red-300">{error}</div>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={submit} disabled={loading} className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--fg)] px-4 text-sm font-medium text-[var(--bg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {loading ? "正在判断信息价值" : "开始分析"}
              </button>
              <button type="button" onClick={() => { setText(""); setUrl(""); setFile(null); setError(""); }} className="focus-ring inline-flex h-11 items-center justify-center rounded-lg border border-[var(--line)] px-4 text-sm text-[var(--muted)] hover:text-[var(--fg)]">清空输入</button>
            </div>
          </div>

          <section className="glass rounded-xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">Result</p>
                <h2 className="mt-1 text-xl font-semibold">判断结果</h2>
              </div>
              <button type="button" onClick={copyResult} disabled={!result} className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--muted)] transition hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-45">
                <Clipboard className="h-3.5 w-3.5" />
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            {!result && (
              <div className="grid min-h-[520px] place-items-center rounded-xl border border-[var(--line)] bg-[var(--soft)] px-6 text-center">
                <div>
                  <Archive className="mx-auto mb-4 h-7 w-7 text-[var(--muted)]" />
                  <p className="text-sm font-medium">把内容放进左侧，Signal Only 会给出是否值得看的判断。</p>
                  <p className="mt-2 max-w-sm text-xs leading-5 text-[var(--muted)]">输出会聚焦新信息、重复叙事、实际启发和阅读建议。</p>
                </div>
              </div>
            )}
            {result && <ResultView result={result} />}
          </section>
        </section>

        <section className="glass rounded-xl p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">History</p>
              <h2 className="mt-1 text-xl font-semibold">最近 20 条</h2>
            </div>
            <button type="button" onClick={() => saveHistory([])} disabled={history.length === 0} className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--muted)] transition hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-45">
              <Trash2 className="h-3.5 w-3.5" />
              清空
            </button>
          </div>
          {history.length === 0 ? <p className="rounded-lg border border-[var(--line)] bg-[var(--soft)] px-4 py-5 text-sm text-[var(--muted)]">暂无历史记录。分析完成后会自动保存到本机浏览器。</p> : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {history.map((item) => (
                <button key={item.id} type="button" onClick={() => setResult(item.result)} className="focus-ring rounded-lg border border-[var(--line)] bg-[var(--soft)] p-4 text-left transition hover:bg-violet-500/10">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{cnMode(item.mode)} · {new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })}</p>
                    </div>
                    <span className="shrink-0 rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)]">{item.result.densityScore}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-5 text-[var(--muted)]">{item.result.oneLineConclusion}</p>
                  <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); saveHistory(history.filter((existing) => existing.id !== item.id)); }} className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--muted)] opacity-80 hover:text-red-500">
                    <X className="h-3 w-3" />
                    删除
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <footer className="pb-3 text-center text-[11px] text-[var(--muted)]">希望你每天少被重复信息困住一点。</footer>
      </div>

      {easterOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="solid-panel w-full max-w-md rounded-xl p-5 shadow-calm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Signal Only</p>
              <button type="button" onClick={() => setEasterOpen(false)} className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--soft)]" aria-label="关闭"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm leading-7 text-[var(--muted)]">这个工具不是想给你更多信息，而是想帮你省下一点注意力。你的时间很贵，应该多留给真正重要的事。</p>
          </div>
        </div>
      )}
    </main>
  );
}

function ResultView({ result }: { result: Result }) {
  const score = Math.max(0, Math.min(100, Number(result.densityScore || 0)));
  const meaning = result.builderMeaning || {};
  const meaningItems = [
    ["产品判断", meaning.productJudgment],
    ["用户需求", meaning.userDemand],
    ["商业模式", meaning.businessModel],
    ["增长策略", meaning.growthStrategy],
    ["竞争格局", meaning.competition],
    ["Web3 生态", meaning.web3Ecosystem],
    ["创业决策", meaning.founderDecision],
    ["信息差价值", meaning.informationGap]
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--soft)] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-[var(--muted)]">一、信息价值判断</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-[var(--fg)] px-3 py-1.5 text-sm font-medium text-[var(--bg)]">{result.valueLabel}</span>
              <span className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--muted)]">{result.readingAdvice}</span>
            </div>
          </div>
          <div className="min-w-40">
            <p className="mb-2 text-xs text-[var(--muted)]">二、信息密度评分</p>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500" style={{ width: `${score}%` }} /></div>
              <span className="w-10 text-right text-sm font-semibold">{score}</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6">{result.oneLineConclusion}</p>
      </div>
      <Block title="三、新增信息点" items={result.newSignals} empty="没有识别到明显新增信号。" />
      <Block title="四、重复叙事识别" items={result.repeatedNarratives} empty="没有明显重复叙事。" />
      <div className="rounded-xl border border-[var(--line)] bg-[var(--soft)] p-4">
        <h3 className="mb-3 text-sm font-semibold">五、对产品经理 / Founder / Web3 Builder 的意义</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {meaningItems.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
              <p className="mb-1 text-xs font-medium text-[var(--muted)]">{label}</p>
              <p className="text-sm leading-6">{value || "无明确增量。"}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--soft)] p-4">
          <p className="mb-2 text-xs text-[var(--muted)]">六、阅读建议</p>
          <p className="text-lg font-semibold">{result.readingAdvice}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--soft)] p-4">
          <p className="mb-2 text-xs text-[var(--muted)]">八、节省时间估算</p>
          <p className="text-lg font-semibold">这次大约帮你节省了 {result.timeSavedMinutes || 0} 分钟无效阅读时间。</p>
        </div>
      </div>
    </div>
  );
}

function Block({ title, items, empty }: { title: string; items?: string[]; empty: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--soft)] p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {items && items.length > 0 ? <ul className="space-y-2">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-sm leading-6"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" /><span>{item}</span></li>)}</ul> : <p className="text-sm text-[var(--muted)]">{empty}</p>}
    </div>
  );
}
