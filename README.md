> **Author / Rights Holder:** 전북대학교 생물산업기계공학과 유동수 (ryudongsoo@jbnu.ac.kr)

# 🐓 KokioTalk & 🥛 Antigravity 2.0+ Personal AI Secretary (`KokioTalk-Starter-Kit`)

> **🌐 Multi-Language Support**: **English (Default)** | **🇰🇷 한국어** | **🇯🇵 日本語** | **🇨🇳 中文**  
> **Turnkey Personal AI Chief Secretary & Multi-Language Mobile/PC Messenger for Google Antigravity 2.0+**

---

## ✨ Key Features

1. **0) Native Google Antigravity 2.0+ Integration**
   - Automatically connects to your local **Google Antigravity 2.0+ Desktop App** (`Antigravity.exe` & `language_server.exe`) and streams real-time reasoning, tool execution progress, and responses.
   - Includes **Auto-Wakeup** to automatically wake the local Antigravity engine when a message arrives from your smartphone.
2. **1) Turnkey Personal AI Secretary Client System ("Ooyoo 🥛" Architecture)**
   - Automatically provisions your AI Secretary's identity & rules (`GEMINI.md`, `AGENTS.md`), continuous long-term memory (`MEMORY.md`, `memory/YYYY-MM-DD.md`), and a native **Antigravity 2.0 Plugin** (`~/.gemini/config/plugins/kokio-assistant/`).
3. **2) KokioTalk Messenger & 3-Layer External Security Gateway**
   - **Multi-Language UI (`🌐 EN` Default / `🇰🇷 한국어` / `🇯🇵 日本語` / `🇨🇳 中文`)**: Instant 1-click language switching across the Lock Screen, QR Dashboard, and Messenger UI.
   - **6-Digit Security PIN Lock & Temporary PC Auto-Wipe**:
     - **Localhost Bypass**: Opens immediately on your host PC (`http://localhost:8081`).
     - **📱 My Device Mode**: Remembers authentication on your personal smartphone.
     - **💻 Temp PC Access Mode (Default on External PCs)**: Blocks browser *"Save password?"* prompts and **automatically destroys the session in both browser (`sessionStorage`) and server memory within 2.5 seconds of closing the tab or window**.
   - **Full Productivity Suite**: Continuous Voice STT (`🎤`) & TTS (`🔊`), Live Simultaneous Interpreter (`🌐`), iPhone `.heic` photo auto-conversion, clipboard image/file paste (`Ctrl+V`), Calendar sync (`📅`), and Live Remote PC Screen Control (`🖥️`).
4. **3) 3-Minute Interactive Setup Wizard**
   - Run `1_install_wizard.bat` to configure your name, honorific, AI secretary name/emoji, and 6-digit PIN in 3 minutes.

---

## 📂 Repository Index & Documentation Links

| File / Directory | Description |
| :--- | :--- |
| [INSTALL_GUIDE.md](./INSTALL_GUIDE.md) | Complete Step-by-Step Installation & Usage Guide (English / 한국어 / 日本語 / 中文) |
| [setup-wizard.js](./setup-wizard.js) | Interactive Multi-Language CLI Setup Wizard (Step 0 ~ Step 3 automation) |
| [kokio.config.template.json](./kokio.config.template.json) | Customizable user, AI secretary, security PIN, and network configuration template |
| [1_install_wizard.bat](./1_install_wizard.bat) | One-click interactive installer & desktop shortcut generator |
| [2_start_kokiotalk.bat](./2_start_kokiotalk.bat) | One-click launcher for KokioTalk (`8082`), Security Gateway (`8081`), and Cloudflare Tunnel |
| [3_mobile_qr_connect.bat](./3_mobile_qr_connect.bat) | Opens the Mobile Connection QR Code Dashboard (`http://localhost:8081/qr`) |
| [4_stop_server.bat](./4_stop_server.bat) | Cleanly stops all background KokioTalk and tunnel processes |
| [gateway-server/server.js](./gateway-server/server.js) | Port `8081` Security Gateway, 6-Digit PIN Lock, Temp Session Auto-Wipe & Tunnel Manager |
| [server/src/index.ts](./server/src/index.ts) | Port `8082` KokioTalk Messenger Backend, SQLite Engine & Live Interpreter API |
| [client/public/index.html](./client/public/index.html) | KokioTalk Multi-Language Web & Mobile PWA Frontend |

---

## 🚀 Quick Start (3 Minutes)

```bash
# 1. Clone the repository
git clone https://github.com/ryu-dongsoo/kokiotalk.git
cd kokiotalk

# 2. Run the Interactive Setup Wizard (Windows)
1_install_wizard.bat
```

1. **Step 1 (`1_install_wizard.bat`)**: Select your language (`1: English`, `2: 한국어`, `3: 日本語`, `4: 中文`), enter your name/honorific, AI Secretary name, and a 6-digit Security PIN.
2. **Step 2 (`2_start_kokiotalk.bat`)**: Automatically starts the local servers and external tunnel, and opens the PC app.
3. **Step 3 (`3_mobile_qr_connect.bat`)**: Scan the QR code at `http://localhost:8081/qr` with your smartphone camera to connect and install the mobile app!

For detailed instructions in **English, Korean (한국어), Japanese (日本語), and Chinese (中文)**, please see [INSTALL_GUIDE.md](./INSTALL_GUIDE.md).

---

## 📝 변경 이력 (Changelog)

- **2026-10-26 11:56:00** [[유동수](mailto:ryudongsoo@jbnu.ac.kr)] feat: initial public release of KokioTalk & Antigravity 2.0+ Personal AI Secretary Starter Kit (multi-language EN/KO/JA/ZH, 6-digit PIN lock, temp PC auto-wipe, QR mobile onboarding)
