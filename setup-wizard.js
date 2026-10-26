#!/usr/bin/env node
/**
 * 🐓 KokioTalk & 🤖 Antigravity 2.0+ Personal AI Agent Setup Wizard
 * - Multi-Language Support: English (Default), 한국어 (Korean), 日本語 (Japanese), 中文 (Chinese)
 * - Step 0: Verify Antigravity 2.0+ & Node.js runtime environment
 * - Step 1: Build Personal AI Agent Workspace (GEMINI.md, AGENTS.md, MEMORY.md, Antigravity 2.0 Plugin)
 * - Step 2: Configure KokioTalk Messenger (8082) + Security Gateway (8081, 6-Digit PIN & Temp PC Auto-Wipe)
 * - Step 3: Create Desktop App Shortcut & Launch Mobile QR Connection Dashboard
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const readline = require('node:readline');
const { execSync } = require('node:child_process');

const HOME_DIR = os.homedir();
const ROOT_DIR = __dirname;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question, defaultVal = '') {
  return new Promise((resolve) => {
    const suffix = defaultVal ? ` [Default: ${defaultVal}]` : '';
    rl.question(`${question}${suffix}\n👉 `, (answer) => {
      const trimmed = String(answer || '').trim();
      resolve(trimmed || defaultVal);
    });
  });
}

const WIZ_I18N = {
  en: {
    bannerTitle: ' 🐓 KokioTalk & 🤖 Antigravity 2.0+ Personal AI Agent Setup Wizard',
    step0Title: '🔍 [Step 0] Checking Antigravity 2.0+ & System Environment...',
    nodeOk: '  ✅ Node.js Runtime Verified:',
    agyOk: '  ✅ Google Antigravity 2.0+ Verified:',
    agyWarn: '  ⚠️ [Notice] Antigravity.exe not found in default path.\n     Please make sure Google Antigravity 2.0+ is installed and signed in.',
    qHeader: '📝 [Questions 1–5] Configure your Personal AI Agent & Security PIN.\n',
    q1: '1️⃣ Enter your name or nickname',
    q1Def: 'Alex',
    q2: '2️⃣ How should your AI Agent address you? (e.g., Alex, Boss, Captain)',
    q2Def: 'Alex',
    q3: '3️⃣ Name your AI Agent',
    q3Def: 'Kokio AI',
    q3Avatar: '   Choose an icon (emoji) for your AI Agent',
    q3AvatarDef: '🤖',
    q4: '4️⃣ Set a 6-digit numeric Security PIN for external (mobile/shared PC) access',
    q4Err: '   ⚠️ Security PIN must be exactly 6 digits (e.g., 123456)!',
    q5: '5️⃣ Confirm the Workspace folder path for your AI Agent',
    step1Title: '🛠️ [Step 1] Building Personal AI Agent Client System...',
    step2Title: '⚙️ [Step 2] Configuring KokioTalk Messenger & Security Gateway...',
    npmInstalling: '  📦 Installing Node.js dependencies (takes ~10-20s)...',
    step3Title: '🖥️ [Step 3] Creating [🐓 KokioTalk] Desktop App Shortcut...',
    doneTitle: ' 🎉 Setup Complete! Your Personal AI Agent & KokioTalk are ready!',
    localUrl: '  • Local PC App URL        : http://localhost:8081',
    qrUrl: '  • Mobile QR Connect URL   : http://localhost:8081/qr',
    pinInfo: '  • External 6-Digit PIN    :'
  },
  ko: {
    bannerTitle: ' 🐓 꼬끼오톡(KokioTalk) & 🤖 Antigravity 2.0+ 나만의 AI 에이전트 설치 마법사',
    step0Title: '🔍 [0단계] Antigravity 2.0+ 및 시스템 환경을 점검합니다...',
    nodeOk: '  ✅ Node.js 런타임 확인 완료:',
    agyOk: '  ✅ Google Antigravity 2.0+ 설치 확인 완료:',
    agyWarn: '  ⚠️ [안내] 기본 경로에서 Antigravity.exe를 찾지 못했습니다.\n     Google Antigravity 2.0 이상 버전을 설치하고 로그인해 주세요.',
    qHeader: '📝 [질문 1~5] 나만의 AI 에이전트와 꼬끼오톡 보안 설정을 입력해 주세요.\n',
    q1: '1️⃣ 사용자님의 이름(또는 닉네임)을 입력해 주세요',
    q1Def: '홍길동',
    q2: '2️⃣ AI 에이전트가 당신을 부를 호칭을 입력해 주세요 (예: 길동님, 대표님, 선생님)',
    q2Def: '사용자님',
    q3: '3️⃣ 나만의 AI 에이전트 이름을 지어주세요',
    q3Def: '코끼오 AI',
    q3Avatar: '   AI 에이전트 아이콘(이모지)을 선택해 주세요',
    q3AvatarDef: '🤖',
    q4: '4️⃣ 외부(스마트폰/다른 PC) 접속용 6자리 숫자 암호(PIN)를 설정해 주세요',
    q4Err: '   ⚠️ 보안 암호는 반드시 숫자 6자리(예: 123456)로 입력해 주세요!',
    q5: '5️⃣ AI 에이전트가 사용할 홈 폴더(워크스페이스) 경로를 확인해 주세요',
    step1Title: '🛠️ [1단계] 나만의 AI 에이전트 클라이언트 시스템을 구축합니다...',
    step2Title: '⚙️ [2단계] 꼬끼오톡 메신저 및 외부 접속 보안 게이트웨이를 구성합니다...',
    npmInstalling: '  📦 필요한 Node.js 패키지를 설치하고 있습니다 (약 10~20초 소요)...',
    step3Title: '🖥️ [3단계] PC 바탕화면에 [🐓 KokioTalk] 전용 앱 아이콘을 생성합니다...',
    doneTitle: ' 🎉 축하합니다! 나만의 AI 에이전트 & 꼬끼오톡 구축이 완료되었습니다!',
    localUrl: '  • PC 로컬 접속 주소      : http://localhost:8081',
    qrUrl: '  • 내 폰 연결 QR코드 주소 : http://localhost:8081/qr',
    pinInfo: '  • 외부 접속 6자리 PIN    :'
  },
  ja: {
    bannerTitle: ' 🐓 KokioTalk & 🤖 Antigravity 2.0+ パーソナルAIエージェント セットアップ',
    step0Title: '🔍 [Step 0] Antigravity 2.0+ およびシステム環境を確認しています...',
    nodeOk: '  ✅ Node.js ランタイム確認完了:',
    agyOk: '  ✅ Google Antigravity 2.0+ 確認完了:',
    agyWarn: '  ⚠️ [案内] デフォルトパスに Antigravity.exe が見つかりませんでした。',
    qHeader: '📝 [質問 1〜5] AIエージェントとセキュリティPINを設定してください。\n',
    q1: '1️⃣ お名前（またはニックネーム）を入力してください',
    q1Def: 'User',
    q2: '2️⃣ AIエージェントからの呼び方を入力してください（例: さん、先生、オーナー）',
    q2Def: 'オーナー',
    q3: '3️⃣ AIエージェントの名前を入力してください',
    q3Def: 'Kokio AI',
    q3Avatar: '   AIエージェントのアイコン（絵文字）を選択してください',
    q3AvatarDef: '🤖',
    q4: '4️⃣ 外部（スマホ・共有PC）アクセス用の6桁数字PINを設定してください',
    q4Err: '   ⚠️ PINコードは必ず6桁の数字（例: 123456）で入力してください！',
    q5: '5️⃣ AIエージェントのワークスペースフォルダパスを確認してください',
    step1Title: '🛠️ [Step 1] AIエージェント クライアントシステムを構築しています...',
    step2Title: '⚙️ [Step 2] KokioTalkメッセンジャーとセキュリティゲートウェイを構成しています...',
    npmInstalling: '  📦 Node.js パッケージをインストールしています...',
    step3Title: '🖥️ [Step 3] デスクトップに [🐓 KokioTalk] ショートカットを作成しています...',
    doneTitle: ' 🎉 セットアップ完了！AIエージェントとKokioTalkの準備が整いました！',
    localUrl: '  • PCローカルURL          : http://localhost:8081',
    qrUrl: '  • スマホ接続QRコードURL  : http://localhost:8081/qr',
    pinInfo: '  • 外部アクセス6桁PIN     :'
  },
  zh: {
    bannerTitle: ' 🐓 KokioTalk & 🤖 Antigravity 2.0+ 个人 AI 智能体安装向导',
    step0Title: '🔍 [步骤 0] 正在检查 Antigravity 2.0+ 与系统环境...',
    nodeOk: '  ✅ Node.js 运行环境已确认:',
    agyOk: '  ✅ Google Antigravity 2.0+ 已确认:',
    agyWarn: '  ⚠️ [提示] 默认路径下未找到 Antigravity.exe，请确保已安装并登录 Antigravity 2.0+。',
    qHeader: '📝 [问题 1~5] 请配置您的个人 AI 智能体与安全 PIN 码。\n',
    q1: '1️⃣ 请输入您的姓名或昵称',
    q1Def: 'User',
    q2: '2️⃣ AI 智能体该如何称呼您？（例如：先生、女士、老板）',
    q2Def: '主人',
    q3: '3️⃣ 请为您的 AI 智能体起个名字',
    q3Def: 'Kokio AI',
    q3Avatar: '   请选择 AI 智能体的图标（Emoji）',
    q3AvatarDef: '🤖',
    q4: '4️⃣ 请设置用于外部（手机/其他电脑）访问的6位数字安全 PIN 码',
    q4Err: '   ⚠️ 安全 PIN 码必须是6位数字（例如：123456）！',
    q5: '5️⃣ 请确认 AI 智能体的工作区文件夹路径',
    step1Title: '🛠️ [步骤 1] 正在构建个人 AI 智能体客户端系统...',
    step2Title: '⚙️ [步骤 2] 正在配置 KokioTalk 与外部安全网关...',
    npmInstalling: '  📦 正在安装 Node.js 依赖包...',
    step3Title: '🖥️ [步骤 3] 正在桌面创建 [🐓 KokioTalk] 快捷方式...',
    doneTitle: ' 🎉 安装完成！您的个人 AI 智能体与 KokioTalk 已准备就绪！',
    localUrl: '  • 本地电脑访问地址       : http://localhost:8081',
    qrUrl: '  • 手机扫码连接地址       : http://localhost:8081/qr',
    pinInfo: '  • 外部访问6位安全 PIN    :'
  }
};

function buildWorkspaceFiles({ lang, workspaceDir, ownerName, honorific, asstShortName, asstFullName, asstAvatar, accessPin }) {
  const L = WIZ_I18N[lang] || WIZ_I18N.en;
  console.log(`\n${L.step1Title}`);
  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }
  const memoryDir = path.join(workspaceDir, 'memory');
  if (!fs.existsSync(memoryDir)) {
    fs.mkdirSync(memoryDir, { recursive: true });
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const geminiMd = `# ${asstAvatar} Personal AI Agent Configuration & Memory (${asstFullName})

## 1. Identity & Role
- **AI Agent Name**: **${asstFullName}**
- **Role**: Dedicated Personal AI Assistant & Work/Research Partner for **${ownerName}**
- **Home Workspace**: \`${workspaceDir}\`
- **Runtime Environment**: ${ownerName}'s PC (Gateway Port \`8081\`, KokioTalk Port \`8082\`)
- **Communication Style**:
  - Address the user respectfully as **"${honorific}"**.
  - Support multiple languages (English, 한국어, 日本語, 中文) naturally according to ${honorific}'s preference.
- **Core Integrity Rule**:
  - Never fabricate or report mock/simulated data as real facts, schedules, or documents.

## 2. 🗣️ Speaker Identification & Peer Relay Protocol
1. **Standard Messages**:
   - The speaker is **${ownerName}** ("${honorific}"). Assist accurately and helpfully.
2. **Incoming Remote Peer Messages (starting with \`[🔗 ...]\`)**:
   - Sent by an external peer AI agent. Distinguish the sender clearly and reply directly in text without triggering a reverse peer call loop.
`;

  const agentsMd = `# AGENTS.md - ${asstFullName} Workspace Rules

This folder is the home workspace for **${ownerName}** and Personal AI Agent **${asstFullName}**.

## Session Startup & Continuity
- **Long-Term Memory**: \`MEMORY.md\` — Curated long-term decisions, preferences, and project context.
- **Daily Logs**: \`memory/YYYY-MM-DD.md\` — Daily activity logs and notes.

## Red Lines
- **Zero-Tolerance for Fake Data**: Report only verified facts; explicitly label any sample data as \`[Sample]\`.
- **Domain Separation**: Keep work files in \`${workspaceDir}\` separate from private personal documents unless explicitly requested by ${honorific}.
`;

  const memoryFile = path.join(workspaceDir, 'MEMORY.md');
  if (!fs.existsSync(memoryFile)) {
    const memoryMd = `# 🧠 MEMORY.md - ${asstFullName} Long-Term Memory

## ${asstAvatar} ${ownerName}'s Personal AI Agent: ${asstFullName}
- **Owner Name & Honorific**: ${ownerName} (Address as: **"${honorific}"**)
- **AI Agent Name**: ${asstFullName}
- **Default UI Language**: \`${lang}\` (Multi-language enabled: English, 한국어, 日本語, 中文)
- **KokioTalk Gateway**: Port \`8081\` (Messenger Server \`8082\`)
- **External 6-Digit Security PIN**: \`${accessPin}\` (Localhost auto-bypass / External PIN required / Temp PC mode auto-wipes on tab close)
`;
    fs.writeFileSync(memoryFile, memoryMd, 'utf-8');
  }

  const dailyFile = path.join(memoryDir, `${todayStr}.md`);
  if (!fs.existsSync(dailyFile)) {
    fs.writeFileSync(
      dailyFile,
      `# 📅 ${todayStr} Daily Memory Log\n\n- Initialized **${asstFullName}** & **KokioTalk 🐓** Personal AI Agent System.\n`,
      'utf-8'
    );
  }

  fs.writeFileSync(path.join(workspaceDir, 'GEMINI.md'), geminiMd, 'utf-8');
  fs.writeFileSync(path.join(workspaceDir, 'AGENTS.md'), agentsMd, 'utf-8');

  // Install Antigravity 2.0+ Global Plugin (~/.gemini/config/plugins/kokio-assistant)
  const pluginDir = path.join(HOME_DIR, '.gemini', 'config', 'plugins', 'kokio-assistant');
  const pluginRulesDir = path.join(pluginDir, 'rules');
  const pluginSkillDir = path.join(pluginDir, 'skills', 'kokio-agent');
  fs.mkdirSync(pluginRulesDir, { recursive: true });
  fs.mkdirSync(pluginSkillDir, { recursive: true });

  const pluginJson = {
    name: 'kokio-assistant',
    displayName: `${asstAvatar} ${asstShortName} & KokioTalk AI Agent`,
    version: '2.0.0',
    description: `Personal AI Agent (${asstFullName}) & KokioTalk Mobile/PC Messenger Integration Plugin for ${ownerName}`,
    suggestedPrompts: [
      `Summarize my schedule and key tasks for today`,
      `Analyze the photos and documents I just sent via KokioTalk`,
      `Save these important notes to my long-term MEMORY.md`
    ]
  };
  fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(pluginJson, null, 2), 'utf-8');
  fs.writeFileSync(path.join(pluginRulesDir, 'AGENTS.md'), geminiMd, 'utf-8');
  fs.writeFileSync(
    path.join(pluginSkillDir, 'SKILL.md'),
    `---\nname: kokio-agent\ndescription: Core skill managing ${ownerName}'s personal AI agent (${asstFullName}), long-term memory (MEMORY.md), and KokioTalk messenger integration.\n---\n\n# ${asstFullName} AI Agent Skill\n\n1. Address the user as **"${honorific}"**.\n2. Persist important user preferences and records in \`${workspaceDir}\\MEMORY.md\`.\n`,
    'utf-8'
  );

  console.log(`  ✅ Workspace Rules Created : ${path.join(workspaceDir, 'GEMINI.md')}`);
  console.log(`  ✅ Long-Term Memory Ready  : ${memoryFile}`);
  console.log(`  ✅ Antigravity 2.0 Plugin  : ${pluginDir}`);
}

async function main() {
  console.log('\n======================================================================');
  console.log(' 🌐 Select Installer & Default UI Language / 설치 및 기본 언어를 선택하세요');
  console.log('======================================================================');
  console.log('  [1] English (Default)');
  console.log('  [2] 한국어 (Korean)');
  console.log('  [3] 日本語 (Japanese)');
  console.log('  [4] 中文 (Chinese)');
  const langChoice = await ask('Select language number (1-4)', '1');
  const langMap = { '1': 'en', '2': 'ko', '3': 'ja', '4': 'zh', en: 'en', ko: 'ko', ja: 'ja', zh: 'zh' };
  const lang = langMap[langChoice.toLowerCase()] || 'en';
  const L = WIZ_I18N[lang];

  console.log('\n======================================================================');
  console.log(L.bannerTitle);
  console.log('======================================================================\n');

  console.log(L.step0Title);
  console.log(`${L.nodeOk} ${process.version}`);
  const agyGuiPath = path.join(HOME_DIR, 'AppData', 'Local', 'Programs', 'antigravity', 'Antigravity.exe');
  const agyLsPath = path.join(HOME_DIR, 'AppData', 'Local', 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe');
  if (fs.existsSync(agyGuiPath) || fs.existsSync(agyLsPath)) {
    console.log(`${L.agyOk} ${agyGuiPath}`);
  } else {
    console.log(L.agyWarn);
  }
  console.log('');

  console.log(L.qHeader);
  const ownerName = await ask(L.q1, L.q1Def);
  const honorific = await ask(L.q2, L.q2Def);
  const asstShortName = await ask(L.q3, L.q3Def);
  const asstAvatar = await ask(L.q3Avatar, L.q3AvatarDef);

  let accessPin = '';
  while (!/^\d{6}$/.test(accessPin)) {
    accessPin = await ask(L.q4, '123456');
    if (!/^\d{6}$/.test(accessPin)) {
      console.log(L.q4Err);
    }
  }

  const defaultWorkspace = path.join(HOME_DIR, 'KokioVault');
  const workspaceDir = await ask(L.q5, defaultWorkspace);

  const asstFullName = `${asstShortName} (${asstAvatar})`;

  buildWorkspaceFiles({
    lang,
    workspaceDir,
    ownerName,
    honorific,
    asstShortName,
    asstFullName,
    asstAvatar,
    accessPin
  });

  console.log(`\n${L.step2Title}`);
  const configObj = {
    language: lang,
    owner: {
      id: 'owner',
      name: ownerName,
      honorific,
      avatar: '🙂',
      statusMessage: `${ownerName}'s Antigravity 2.0+ AI Workspace`
    },
    assistant: {
      id: 'kokio_ai',
      name: asstFullName,
      shortName: asstShortName,
      avatar: asstAvatar,
      persona: `Personal AI Agent for ${ownerName}`,
      defaultModel: 'argon',
      defaultLevel: 'medium',
      mentionKeywords: [`@${asstShortName}`, `${asstShortName}`, '@ai', 'AI야', '비서야']
    },
    peerAssistant: {
      enabled: false,
      id: 'peer_ai',
      name: 'Peer AI (🔗)',
      shortName: 'PeerAI',
      avatar: '🔗',
      ownerName: 'Partner',
      endpoint: '',
      mentionKeywords: ['@peer', 'peer']
    },
    security: {
      accessPin,
      allowLocalhostBypass: true,
      tempSessionTimeoutSec: 18
    },
    profiles: [
      { id: 'owner', label: `🙂 ${honorific}`, name: ownerName, avatar: '🙂', category: 'me' }
    ],
    network: {
      gatewayPort: 8081,
      kokioPort: 8082,
      portalUrl: '',
      fixedTunnelUrl: ''
    },
    workspacePath: workspaceDir
  };

  const configPath = path.join(ROOT_DIR, 'kokio.config.json');
  fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2), 'utf-8');
  const gatewayDir = path.join(ROOT_DIR, 'gateway-server');
  if (fs.existsSync(gatewayDir)) {
    fs.writeFileSync(path.join(gatewayDir, 'kokio.config.json'), JSON.stringify(configObj, null, 2), 'utf-8');
  }
  console.log(`  ✅ Config Saved: ${configPath}`);

  const nodeModulesDir = path.join(ROOT_DIR, 'node_modules');
  if (!fs.existsSync(nodeModulesDir)) {
    console.log(L.npmInstalling);
    try {
      execSync('npm install --no-audit --no-fund', { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch (e) {}
  }

  console.log(`\n${L.step3Title}`);
  const icoPath = path.join(ROOT_DIR, 'client', 'public', 'kokiotalk.ico');
  const vbsPath = path.join(ROOT_DIR, 'launch_kokiotalk_pc_app.vbs');
  try {
    const psScript = `
      $WshShell = New-Object -ComObject WScript.Shell
      $Desktop = [Environment]::GetFolderPath('Desktop')
      $Shortcut = $WshShell.CreateShortcut((Join-Path $Desktop 'KokioTalk.lnk'))
      $Shortcut.TargetPath = 'wscript.exe'
      $Shortcut.Arguments = '"${vbsPath}"'
      $Shortcut.WorkingDirectory = '${ROOT_DIR}'
      if (Test-Path '${icoPath}') { $Shortcut.IconLocation = '${icoPath},0' }
      $Shortcut.Description = 'KokioTalk & ${asstFullName}'
      $Shortcut.Save()
    `;
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/\r?\n/g, '; ')}"`);
    console.log('  ✅ Desktop Shortcut [🐓 KokioTalk.lnk] Created!');
  } catch (e) {}

  console.log('\n======================================================================');
  console.log(L.doneTitle);
  console.log('======================================================================');
  console.log(L.localUrl);
  console.log(L.qrUrl);
  console.log(`${L.pinInfo} ${accessPin}`);
  console.log('======================================================================\n');

  rl.close();
}

main().catch((err) => {
  console.error('Setup Error:', err);
  rl.close();
});
