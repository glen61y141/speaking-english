# SpeakUp — AI 英文口說學習 App

一個純前端的 AI 英文口說學習應用，可部署至 GitHub Pages，支援 iPhone / Android / PC 瀏覽器。

## ✨ 功能

- 🎙️ **語音錄製** — 瀏覽器原生 MediaRecorder API，支援 iOS/Android/PC
- 📝 **語音轉文字** — Groq Whisper Large V3（自動語言偵測）
- 🤖 **AI 對話** — Qwen3-32B 智能英文教練
- 🔊 **文字轉語音** — 瀏覽器內建 Web Speech API (SpeechSynthesis)
- 🌏 **中英雙語** — 遇到中文或困惑自動切換中文解說

## 📁 專案結構

```
english-speaking-app/
├── index.html   # 主頁面
├── styles.css   # 樣式
├── app.js       # 應用邏輯
└── README.md    # 說明文件
```

## 🚀 部署到 GitHub Pages

1. 在 GitHub 建立新 Repository
2. 上傳所有檔案（index.html、styles.css、app.js）
3. 進入 Settings → Pages → Source 選 `main` branch
4. 儲存後等待約 1 分鐘，即可透過 `https://你的帳號.github.io/repo名稱` 存取

## 🔧 本機執行

直接在瀏覽器開啟 `index.html` 即可（需要 HTTPS 或 localhost 才能使用麥克風）。

## 🔑 取得 Groq API Key

1. 前往 [https://console.groq.com/keys](https://console.groq.com/keys)
2. 建立新的 API Key（免費方案即可）
3. 在 App 的「設定」頁面輸入並儲存

## 🤖 使用的 AI 模型

| 功能 | 模型 |
|------|------|
| 語音辨識 (STT) | `whisper-large-v3` |
| 對話 (LLM) | `qwen/qwen3-32b` |

## 📱 練習情境

| 情況 | AI 行為 |
|------|---------|
| 英文正確 | 直接繼續對話 |
| 英文有錯 | 溫和指出並給正確說法 |
| 說中文 | 教英文說法，請你試試看 |
| 表示不懂 | 用中文解釋，重複問題 |
| 回答偏離 | 中文引導回到話題 |
| API 超限 | 結束對話並提示 |

## 🔒 隱私說明

API Key 僅儲存於你的瀏覽器本機（localStorage / Cookie），不會傳送至任何第三方伺服器。音檔直接從瀏覽器送至 Groq API。
