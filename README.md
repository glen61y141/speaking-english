# SpeakUp — AI 英文口說學習 App

一個純前端的 AI 英文口說學習應用，可部署至 GitHub Pages，支援 iPhone / Android / PC 瀏覽器。

## ✨ 功能

- 🎙️ **語音錄製** — 瀏覽器原生 MediaRecorder API，支援 iOS/Android/PC
- 📝 **語音轉文字** — Groq Whisper Large V3（支援 EN/中 手動切換）
- 🤖 **AI 對話** — Qwen3-32B，帶完整 session 歷史
- 🔊 **文字轉語音** — 瀏覽器內建 Web Speech API（零 API 費用）
- 🌏 **智慧四情境判斷** — 根據使用者當下這句話自動分類回應
- 🎭 **角色情境** — 店員 / 醫生 / 警察，模擬真實對話場景

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

麥克風需要 HTTPS 或 localhost 環境，直接用 file:// 開啟無法使用。

## 🔑 取得 Groq API Key

1. 前往 [https://console.groq.com/keys](https://console.groq.com/keys)
2. 建立新的 API Key（免費方案即可）
3. 在 App 的「設定」頁面輸入並儲存

## 🤖 使用的 AI 模型

| 功能 | 模型 |
|------|------|
| 語音辨識 (STT) | Groq `whisper-large-v3` |
| 對話 (LLM) | Groq `qwen/qwen3-32b` |
| 語音合成 (TTS) | 瀏覽器內建 Web Speech API |

## 🎯 錄音格式優先順序

瀏覽器支援的格式中，依下列優先順序選擇以提升辨識準確度：

| 優先 | 格式 | 說明 |
|------|------|------|
| 1 | WAV | 無損，辨識最佳 |
| 2 | FLAC | 無損壓縮 |
| 3 | OGG/Opus | 高品質有損 |
| 4 | WebM/Opus | 通用 fallback |
| 5 | MP4 | iOS Safari fallback |

## 📱 四種對話情境

| 情境 | 觸發條件 | AI 行為 |
|------|---------|---------|
| **TYPE 1** | 英文正確 | 自然回應 + 追問 |
| **TYPE 2** | 英文有文法錯誤 | 自然回應 + 追問 + ✏️ 正確說法 |
| **TYPE 3** | 說中文 | 教英文說法，請使用者再試一次 |
| **TYPE 4** | 表示聽不懂 | 重複前一句（更簡單）+ 🌐 中文翻譯 |

### Repeat 情境處理

使用者說中文被要求 repeat 後，AI 會記住目標句子。下一輪會根據使用者 repeat 的句子判斷對錯，不受發音偏差或主題不同影響。

## 🎭 練習角色

| 角色 | 情境 | AI 開場 |
|------|------|---------|
| 無 | 自由對話 | 無 |
| 🛍 店員 | 購物 | "Welcome! How can I help you today?" |
| 🩺 醫生 | 看診 | "I'm Dr. Smith. What seems to be the problem?" |
| 👮 警察 | 協助 | "Hello! Is everything alright?" |

## ⚙️ 設定項目

| 項目 | 說明 | 儲存位置 |
|------|------|---------|
| Groq API Key | 必填 | localStorage |
| 練習角色 | 店員/醫生/警察/無 | localStorage |

## 🔒 隱私說明

- API Key 僅儲存於本機 localStorage（Cookie 備用），不會傳送至任何第三方
- 音檔直接從瀏覽器送至 Groq API，不經過其他伺服器
- TTS 完全在瀏覽器本機執行，不需要網路

## 💡 使用技巧

- **EN / 中 切換鈕**：練習英文時建議維持 EN，說中文被 AI 糾正時切換為中以提升辨識準確度
- **清除對話**：重置對話但保留角色設定，AI 會重新開場
- 每個 AI 回應區塊都有獨立播放鈕，可單獨重播英文或中文說明
