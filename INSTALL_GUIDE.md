# 📖 KokioTalk (🐓) & Antigravity 2.0+ Personal AI Agent — Official Setup & Distribution Guide

> **🌐 Multi-Language Support**: **English (Default)** | [🇰🇷 한국어 가이드](#-한국어-설치-및-사용-가이드-korean) | [🇯🇵 日本語ガイド](#-日本語セットアップガイド-japanese) | [🇨🇳 中文安装指南](#-中文安装与使用指南-chinese)

This turnkey distribution package (**`KokioTalk`**) enables anyone running **Google Antigravity 2.0+** to build their own **Personal AI Agent (Assistant)** and connect to it from anywhere via **KokioTalk (🐓)** — a full-featured, KakaoTalk-style AI messenger for Desktop & Mobile with 6-digit Security PIN protection and automatic temporary session wiping.

---

## 🇺🇸 English Guide (Default)

### Prerequisites: Antigravity 2.0+ & Runtime
1. **Google Antigravity 2.0+ Desktop App**
   - Install **Google Antigravity 2.0 or higher** and sign in with your Google account.
   - The installer automatically detects `Antigravity.exe` and `resources\bin\language_server.exe` in your user profile.
2. **Node.js (v20 or v22 LTS+)**
   - Install **Node.js LTS (v22 recommended)** from [nodejs.org](https://nodejs.org/).

### Building Your Personal AI Agent Client System
Unlike a stateless chatbot, this package automatically provisions a persistent **AI Agent Workspace + Long-Term Memory + Antigravity 2.0 Plugin**:
- **`GEMINI.md` & `AGENTS.md`**: Defines your AI Agent's identity, your preferred name/title, zero-tolerance rules against fabricated/mock data, and strict domain separation between work and private folders.
- **`MEMORY.md` & `memory/YYYY-MM-DD.md`**: Continuous long-term memory that survives across sessions and PC reboots.
- **`~/.gemini/config/plugins/kokio-assistant/`**: Automatically installs a native **Antigravity 2.0 Plugin** (`plugin.json`, `SKILL.md`, `rules/AGENTS.md`) visible in Antigravity's **Skills & Customizations** sidebar.

### KokioTalk Messenger & External Security Gateway
- **Port `8081` (Security Gateway & Tunnel Manager)**:
  - **Local PC Auto-Bypass**: Opens immediately without a PIN on your host PC (`http://localhost:8081`).
  - **External 6-Digit Security PIN Lock**: Requires your 6-digit PIN when accessed externally via Mobile or shared PCs.
  - **💻 Temporary PC Access Mode (Auto-Wipe on Close)**: Default mode on external desktop browsers. Blocks browser *"Save password?"* popups and **automatically destroys the session in both browser (`sessionStorage`) and server memory within 2.5 seconds of closing the tab or window**.
- **Port `8082` (KokioTalk Multi-Language Messenger Engine)**:
  - Instant UI language switcher (**`🌐 EN` / `🇰🇷 한국어` / `🇯🇵 日本語` / `🇨🇳 中文`**) in the top header.
  - Voice input (`🎤`) & TTS readout (`🔊`), Simultaneous Live Interpreter (`🌐`), iPhone `.heic` photo auto-conversion, clipboard paste (`Ctrl+V`), Calendar sync (`📅`), and Live Remote PC Control (`🖥️`).

### 3-Minute Turnkey Installation Procedure
Clone the repository or unzip the package, then double-click the batch files in order:
1. **Run `1_install_wizard.bat`**:
   - Select your language (`[1] English (Default)`, `[2] 한국어`, `[3] 日本語`, `[4] 中文`).
   - Enter your Name, Title/Nickname, AI Agent Name/Emoji (default: `Kokio AI 🤖`), and 6-Digit Security PIN (or press `Enter` to accept defaults).
   - Automatically generates your workspace, plugin, `kokio.config.json`, and creates the **`🐓 KokioTalk`** shortcut on your Windows Desktop.
2. **Run `2_start_kokiotalk.bat`**:
   - Starts the KokioTalk Engine (`8082`), Security Gateway (`8081`), and built-in **Cloudflare Instant External Tunnel** (no account required).
3. **Run `3_mobile_qr_connect.bat` (or open `http://localhost:8081/qr`)**:
   - Displays a **QR Code** on your PC screen. Scan it with your smartphone camera, enter your 6-digit PIN under **`[📱 My Device]`**, and tap **`📲 Install`** to add KokioTalk to your phone's home screen!

---

## 🇰🇷 한국어 설치 및 사용 가이드 (Korean)

### 사전 준비: Antigravity 2.0+ 및 기본 환경
1. **Google Antigravity 2.0 이상** 데스크톱 앱 설치 및 로그인
2. **Node.js (v20 또는 v22 LTS 이상)** 설치 ([nodejs.org](https://nodejs.org/))

### 나만의 AI 에이전트(AI 비서) 클라이언트 시스템 구축
`1_install_wizard.bat` (또는 `1_최초설치_마법사.bat`)을 실행하면 다음이 자동 구축됩니다:
- **`GEMINI.md` & `AGENTS.md`**: AI 에이전트 이름(기본: `Kokio AI 🤖`), 사용자 호칭, 허위 데이터 금지 및 개인 문서 보호 규칙 자동 생성
- **`MEMORY.md`**: 대화가 바뀌어도 맥락을 기억하는 장기 기억소 생성
- **Antigravity 2.0 표준 플러그인 (`~/.gemini/config/plugins/kokio-assistant/`)** 자동 등록

### 꼬끼오톡 메신저 & 외부 접속 보안 시스템
- **다국어 메뉴 기본 지원**: 기본 영문(`🌐 EN`)으로 시작하며, 상단 헤더와 잠금 화면 우측 상단에서 언제든 **`🇰🇷 한국어` / `🌐 English` / `🇯🇵 日本語` / `🇨🇳 中文`**로 0.1초 만에 전환됩니다.
- **6자리 PIN 보안 잠금 & 임시 PC 자동 소멸**:
  - 내 본체 PC(`localhost:8081`)에서는 암호 없이 즉시 열립니다.
  - 외부에서 접속 시 6자리 PIN을 요구하며, 다른 사람의 컴퓨터에서 **`[💻 Temp PC Access / 임시 컴퓨터 접속]`** 모드로 접속하면 **창이나 탭을 닫는 즉시(2.5초 내) 암호와 세션이 흔적 없이 삭제**됩니다.

### 3분 원클릭 설치 절차
1. **`1_install_wizard.bat` 실행**: 언어 선택(`1: English`, `2: 한국어` 등) 후 이름·호칭·AI 에이전트 이름·6자리 PIN 입력 ➔ 바탕화면에 **`🐓 KokioTalk`** 아이콘 자동 생성!
2. **`2_start_kokiotalk.bat` 실행**: 백그라운드 서버(`8081`, `8082`) 및 외부 접속 터널 자동 개통!
3. **`3_mobile_qr_connect.bat` 실행**: 화면에 뜬 **QR코드**를 스마트폰 카메라로 찍어 즉시 접속 및 모바일 앱 설치!

---

## 🇯🇵 日本語セットアップガイド (Japanese)

1. **`1_install_wizard.bat` を実行**: 言語（`[3] 日本語` またはデフォルト英語）を選択し、名前・呼称・AIエージェント名・6桁のセキュリティPINを入力します。
2. **`2_start_kokiotalk.bat` を実行**: ゲートウェイ(`8081`)、KokioTalk(`8082`)、および外部接続トンネルが自動起動します。
3. **`3_mobile_qr_connect.bat` を実行**: PC画面に表示されるQRコードをスマートフォンのカメラで読み取り、6桁のPINを入力してモバイルアプリとして追加します（ヘッダーの `🌐 EN / 🇯🇵 日本語` からいつでも言語を切り替えられます）。

---

## 🇨🇳 中文安装与使用指南 (Chinese)

1. **运行 `1_install_wizard.bat`**：选择语言（`[4] 中文` 或默认英文），输入您的姓名、称谓、AI智能体名称以及6位数字安全 PIN 码。
2. **运行 `2_start_kokiotalk.bat`**：自动启动安全网关(`8081`)、KokioTalk(`8082`)及外部安全隧道。
3. **运行 `3_mobile_qr_connect.bat`**：用手机相机扫描电脑屏幕上的二维码，输入6位 PIN 码即可连接并安装到手机桌面（可在顶部菜单 `🌐 EN / 🇨🇳 中文` 随时切换界面语言）。
