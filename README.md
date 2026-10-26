> **Author / Rights Holder:** Dongsoo Ryu, Dept. of Bio-Industrial Machinery Engineering, Jeonbuk National University (ryudongsoo@jbnu.ac.kr)

# 🐓 KokioTalk & 🤖 Antigravity 2.0+ Personal AI Agent

> **🌐 Multi-Language Support**: **English (Default)** | **Korean (KO)** | **Japanese (JA)** | **Chinese (ZH)**  
> **Turnkey Personal AI Agent & Multi-Language Mobile/Desktop Messenger for Google Antigravity 2.0+**

---

## 📦 Download Standalone Desktop Installers (Windows & macOS)

No Node.js or terminal setup required — download and install the standalone desktop application directly from **GitHub Releases**:

| Platform | Installer Package | Direct Download Link |
| :--- | :--- | :--- |
| **🪟 Windows (10 / 11 x64)** | `KokioTalk-Setup-Windows-x64.exe` | [**📥 Download for Windows (`.exe`)**](https://github.com/ryu-dongsoo/kokiotalk/releases/latest/download/KokioTalk-Setup-Windows-x64.exe) |
| **🍎 macOS (Apple Silicon M1–M4)** | `KokioTalk-macOS-arm64.dmg` | [**📥 Download for macOS Apple Silicon (`.dmg`)**](https://github.com/ryu-dongsoo/kokiotalk/releases/latest/download/KokioTalk-macOS-arm64.dmg) |
| **🍎 macOS (Intel x64)** | `KokioTalk-macOS-x64.dmg` | [**📥 Download for macOS Intel (`.dmg`)**](https://github.com/ryu-dongsoo/kokiotalk/releases/latest/download/KokioTalk-macOS-x64.dmg) |
| **📱 Smartphone & Tablet (iOS / Android)** | **QR Code + 1-Click PWA App** | Scan `/qr` from your Desktop App → Tap **`📲 Install`** (or *Add to Home Screen*) |

> **ℹ️ First-Launch OS Gatekeeper Note (Open-Source Unsigned Binary)**:
> - **🪟 Windows SmartScreen**: If *"Windows protected your PC"* appears on first launch, click **`More info` (`추가 정보`)** → **`Run anyway` (`실행`)**.
> - **🍎 macOS Gatekeeper**: On first launch, **Right-click (`Control + Click`)** `KokioTalk.app` → Click **`Open`**.

---

## ✨ Key Features

1. **Native Google Antigravity 2.0+ Integration**
   - Automatically connects to your local **Google Antigravity 2.0+ Desktop App** (Windows `Antigravity.exe` & macOS `Antigravity.app`) and streams real-time reasoning, tool execution progress, and responses.
   - Includes **Auto-Wakeup** to automatically wake the local Antigravity engine when a message arrives from your smartphone or tablet.
2. **Turnkey Personal AI Agent Client System**
   - Automatically provisions your AI Agent's identity & rules (`GEMINI.md`, `AGENTS.md`), continuous long-term memory (`MEMORY.md`, `memory/YYYY-MM-DD.md`), and a native **Antigravity 2.0 Plugin** (`~/.gemini/config/plugins/kokio-assistant/`).
3. **KokioTalk Messenger & 3-Layer External Security Gateway**
   - **Multi-Language UI (`🌐 EN` Default / `KO` / `JA` / `ZH`)**: Instant 1-click language switching across the Setup Wizard (`/setup`), Lock Screen, QR Dashboard (`/qr`), and Messenger UI.
   - **6-Digit Security PIN Lock & Temporary PC Auto-Wipe**:
     - **Localhost Bypass**: Opens immediately on your host PC (`http://localhost:8081`).
     - **📱 My Device Mode**: Remembers authentication on your personal smartphone or tablet.
     - **💻 Temp PC Access Mode (Default on External PCs)**: Blocks browser *"Save password?"* prompts and **automatically destroys the session in both browser (`sessionStorage`) and server memory within 2.5 seconds of closing the tab or window**.
   - **Automatic Update Notification & 1-Click Hot-Update**: Automatically detects new releases on GitHub and displays an in-app update banner (`⚡ Update Now`) to apply patches in seconds while preserving all local chat history and settings.
   - **Full Productivity Suite**: Continuous Voice STT (`🎤`) & TTS (`🔊`), Live Simultaneous Interpreter (`🌐`), iPhone `.heic` photo auto-conversion, clipboard image/file paste (`Ctrl+V`), Calendar sync (`📅`), and Live Remote PC Screen Control (`🖥️`).
4. **Graphical Setup Wizard (`/setup`) & CLI Installer**
   - When launching the Windows `.exe` or macOS `.dmg` app for the first time, the built-in **Graphical Setup Wizard (`/setup`)** lets you configure your name, preferred honorific, AI Agent name/emoji, and 6-digit security PIN in one click, then immediately displays the **Mobile Connection QR Code (`/qr`)**.

---

## 📱 Smartphone & Tablet App Installation (iPhone / iPad / Android / Galaxy Tab)

Because your AI Agent runs on your PC/Mac (Antigravity 2.0+), your smartphone and tablet connect to it securely without needing an App Store / Play Store download:

1. Open **KokioTalk** on your Windows PC or Mac and click **`📱 Mobile QR Code (/qr)`** in the top menu.
2. Scan the **QR Code** with your smartphone or tablet camera.
3. Select **`📱 My Device`** on the Lock Screen and enter your **6-Digit Security PIN**.
4. Install as a native full-screen app icon:
   - **Android / Galaxy Tab (Chrome / Edge)**: Tap the **`📲 Install`** button in the top bar (or browser menu → *Install app*).
   - **iPhone / iPad (Safari)**: Tap the **Share (`⬆️`)** button at the bottom → Tap **`Add to Home Screen`**.

---

## 📂 Repository Index & Documentation Links

| File / Directory | Description |
| :--- | :--- |
| [INSTALL_GUIDE.md](./INSTALL_GUIDE.md) | Complete Step-by-Step Installation & Usage Guide (English / Korean / Japanese / Chinese) |
| [electron-main.cjs](./electron-main.cjs) | Standalone Desktop Application wrapper for Windows (`.exe`) and macOS (`.dmg`) |
| [.github/workflows/release.yml](./.github/workflows/release.yml) | Automated GitHub Actions CI/CD pipeline building Windows `.exe` and macOS `.dmg` releases |
| [setup-wizard.js](./setup-wizard.js) | Interactive Multi-Language CLI Setup Wizard |
| [Start-KokioTalk.bat](./Start-KokioTalk.bat) | Windows 1-click launcher script |
| [Start-KokioTalk.command](./Start-KokioTalk.command) | macOS / Linux 1-click launcher script |
| [1_install_wizard.bat](./1_install_wizard.bat) | One-click interactive CLI installer & desktop shortcut generator |
| [2_start_kokiotalk.bat](./2_start_kokiotalk.bat) | One-click launcher for KokioTalk (`8082`), Security Gateway (`8081`), and Cloudflare Tunnel |
| [3_mobile_qr_connect.bat](./3_mobile_qr_connect.bat) | Opens the Mobile Connection QR Code Dashboard (`http://localhost:8081/qr`) |
| [4_stop_server.bat](./4_stop_server.bat) | Cleanly stops all background KokioTalk and tunnel processes |
| [gateway-server/server.js](./gateway-server/server.js) | Port `8081` Security Gateway, Graphical Setup Wizard (`/setup`), PIN Lock & Tunnel Manager |
| [server/src/index.ts](./server/src/index.ts) | Port `8082` KokioTalk Messenger Backend, SQLite Engine & Live Interpreter API |
| [client/public/index.html](./client/public/index.html) | KokioTalk Multi-Language Web & Mobile PWA Frontend |

---

## 🚀 Developer / Source Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/ryu-dongsoo/kokiotalk.git
cd kokiotalk

# 2. Run on Windows (double-click or run in terminal)
Start-KokioTalk.bat

# Or on macOS / Linux
chmod +x Start-KokioTalk.command
./Start-KokioTalk.command
```

For detailed multi-language instructions, please see [INSTALL_GUIDE.md](./INSTALL_GUIDE.md).

---

## 📝 Changelog

- **2026-10-26 12:41:00** [[Dongsoo Ryu](mailto:ryudongsoo@jbnu.ac.kr)] docs: convert main GitHub README.md to 100% English for global open-source distribution
- **2026-10-26 12:35:00** [[Dongsoo Ryu](mailto:ryudongsoo@jbnu.ac.kr)] feat: add automatic GitHub update notification banner & 1-click hot-update (`/api/system/version` & `/api/system/apply-update`)
- **2026-10-26 12:25:00** [[Dongsoo Ryu](mailto:ryudongsoo@jbnu.ac.kr)] feat: add Electron desktop app packaging for Windows (`.exe`) and macOS (`.dmg`), graphical first-run setup wizard (`/setup`), pre-compiled ESM server bundle, and automated GitHub Releases workflow
- **2026-10-26 12:03:00** [[Dongsoo Ryu](mailto:ryudongsoo@jbnu.ac.kr)] refactor: universalize terminology across docs, installer, and codebase
- **2026-10-26 11:56:00** [[Dongsoo Ryu](mailto:ryudongsoo@jbnu.ac.kr)] feat: initial public release of KokioTalk & Antigravity 2.0+ Personal AI Agent (`v2.0.0`)
