# Signal Only

Signal Only 是一个多模态信息去重和认知减负助手，帮助产品经理、Founder 和 Web3 Builder 判断一条信息是否值得继续看。

已部署的 Vercel 长期公开网址：

https://signal-only.vercel.app

## 本地运行

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

不填写 `OPENAI_API_KEY` 时，文本、文件和网页会使用本地启发式分析；图片 OCR 和音频转写需要 OpenAI Key。

## 功能

- 文本输入分析
- 图片上传 OCR 分析
- PDF / TXT / DOCX / Markdown 文件正文提取
- URL 正文抓取
- 微信 / 视频入口与权限限制降级提示
- 音频上传转写接口
- 最近 20 条历史记录
- 复制结果
- 暗色模式
- PWA
