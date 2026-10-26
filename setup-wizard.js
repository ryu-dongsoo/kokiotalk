#!/usr/bin/env node
/**
 * 🐓 KokioTalk & 🥛 Antigravity 2.0+ Personal AI Secretary Setup Wizard
 * - Multi-Language Support: English (Default), 한국어 (Korean), 日本語 (Japanese), 中文 (Chinese)
 * - Step 0: Verify Antigravity 2.0+ & Node.js runtime environment
 * - Step 1: Build Personal AI Secretary Workspace (GEMINI.md, AGENTS.md, MEMORY.md, Antigravity 2.0 Plugin)
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
    bannerTitle: ' 🐓 KokioTalk & 🥛 Antigravity 2.0+ Personal AI Secretary Setup Wizard',
    step0Title: '🔍 [Step 0] Checking Antigravity 2.0+ & System Environment...',
    nodeOk: '  ✅ Node.js Runtime Verified:',
    agyOk: '  ✅ Google Antigravity 2.0+ Verified:',
    agyWarn: '  ⚠️ [Notice] Antigravity.exe not found in default path.\n     Please make sure Google Antigravity 2.0+ is installed and signed in.',
    qHeader: '📝 [Questions 1–5] Configure your Personal AI Secretary & Security PIN.\n',
    q1: '1️⃣ Enter your name (or title + name)',
    q1Def: 'Dr. User',
    q2: '2️⃣ How should your AI Secretary address you? (e.g., Doctor, Boss, Professor)',
    q2Def: 'Doctor',
    q3: '3️⃣ Name your AI Secretary',
    q3Def: 'Ooyoo',
    q3Avatar: '   Choose an icon (emoji) for your AI Secretary',
    q3AvatarDef: '🥛',
    q4: '4️⃣ Set a 6-digit numeric Security PIN for external (mobile/shared PC) access',
    q4Err: '   ⚠️ Security PIN must be exactly 6 digits (e.g., 000000, 123456)!',
    q5: '5️⃣ Confirm the Workspace folder path for your AI Secretary',
    step1Title: '🛠️ [Step 1] Building Personal AI Secretary Client System...',
    step2Title: '⚙️ [Step 2] Configuring KokioTalk Messenger & Security Gateway...',
    npmInstalling: '  📦 Installing Node.js dependencies (takes ~10-20s)...',
    step3Title: '🖥️ [Step 3] Creating [🐓 KokioTalk] Desktop App Shortcut...',
    doneTitle: ' 🎉 Setup Complete! Your Personal AI Secretary & KokioTalk are ready!',
    localUrl: '  • Local PC App URL        : http://localhost:8081',
    qrUrl: '  • Mobile QR Connect URL   : http://localhost:8081/qr',
    pinInfo: '  • External 6-Digit PIN    :'
  },
  ko: {
    bannerTitle: ' 🐓 꼬끼오톡(KokioTalk) & 🥛 Antigravity 2.0+ 나만의 AI 비서 설치 마법사',
    step0Title: '🔍 [0단계] Antigravity 2.0+ 및 시스템 환경을 점검합니다...',
    nodeOk: '  ✅ Node.js 런타임 확인 완료:',
    agyOk: '  ✅ Google Antigravity 2.0+ 설치 확인 완료:',
    agyWarn: '  ⚠️ [안내] 기본 경로에서 Antigravity.exe를 찾지 못했습니다.\n     Google Antigravity 2.0 이상 버전을 설치하고 로그인해 주세요.',
    qHeader: '📝 [질문 1~5] 나만의 AI 비서와 꼬끼오톡 보안 설정을 입력해 주세요.\n',
    q1: '1️⃣ 사용하시는 분의 성함(또는 직함 포함 이름)을 입력해 주세요',
    q1Def: '유동수 박사님',
    q2: '2️⃣ AI 비서가 당신을 부를 호칭을 입력해 주세요 (예: 박사님, 대표님, 선생님)',
    q2Def: '박사님',
    q3: '3️⃣ 나만의 AI 비서 이름을 지어주세요',
    q3Def: '우유',
    q3Avatar: '   AI 비서 아이콘(이모지)을 선택해 주세요',
    q3AvatarDef: '🥛',
    q4: '4️⃣ 외부(스마트폰/다른 PC) 접속용 6자리 숫자 암호(PIN)를 설정해 주세요',
    q4Err: '   ⚠️ 보안 암호는 반드시 숫자 6자리(예: 000000, 123456)로 입력해 주세요!',
    q5: '5️⃣ AI 비서가 사용할 홈 폴더(워크스페이스) 경로를 확인해 주세요',
    step1Title: '🛠️ [1단계] 나만의 AI 비서 클라이언트 시스템을 구축합니다...',
    step2Title: '⚙️ [2단계] 꼬끼오톡 메신저 및 외부 접속 보안 게이트웨이를 구성합니다...',
    npmInstalling: '  📦 필요한 Node.js 패키지를 설치하고 있습니다 (약 10~20초 소요)...',
    step3Title: '🖥️ [3단계] PC 바탕화면에 [🐓 KokioTalk] 전용 앱 아이콘을 생성합니다...',
    doneTitle: ' 🎉 축하합니다! 나만의 AI 비서 & 꼬끼오톡 구축이 완료되었습니다!',
    localUrl: '  • PC 로컬 접속 주소      : http://localhost:8081',
    qrUrl: '  • 내 폰 연결 QR코드 주소 : http://localhost:8081/qr',
    pinInfo: '  • 외부 접속 6자리 PIN    :'
  },
  ja: {
    bannerTitle: ' 🐓 KokioTalk & 🥛 Antigravity 2.0+ パーソナルAI秘書セットアップウィザード',
    step0Title: '🔍 [Step 0] Antigravity 2.0+ およびシステム環境を確認しています...',
    nodeOk: '  ✅ Node.js ランタイム確認完了:',
    agyOk: '  ✅ Google Antigravity 2.0+ 確認完了:',
    agyWarn: '  ⚠️ [案内] デフォルトパスに Antigravity.exe が見つかりませんでした。',
    qHeader: '📝 [質問 1〜5] AI秘書とセキュリティPINを設定してください。\n',
    q1: '1️⃣ お名前（または肩書き＋お名前）を入力してください',
    q1Def: 'User 博士',
    q2: '2️⃣ AI秘書からの呼び方を入力してください（例: 博士、先生、オーナー）',
    q2Def: '博士',
    q3: '3️⃣ AI秘書の名前を入力してください',
    q3Def: 'Ooyoo',
    q3Avatar: '   AI秘書のアイコン（絵文字）を選択してください',
    q3AvatarDef: '🥛',
    q4: '4️⃣ 外部（スマホ・共有PC）アクセス用の6桁数字PINを設定してください',
    q4Err: '   ⚠️ PINコードは必ず6桁の数字（例: 000000, 123456）で入力してください！',
    q5: '5️⃣ AI秘書のワークスペースフォルダパスを確認してください',
    step1Title: '🛠️ [Step 1] AI秘書クライアントシステムを構築しています...',
    step2Title: '⚙️ [Step 2] KokioTalkメッセンジャーとセキュリティゲートウェイを構成しています...',
    npmInstalling: '  📦 Node.js パッケージをインストールしています...',
    step3Title: '🖥️ [Step 3] デスクトップに [🐓 KokioTalk] ショートカットを作成しています...',
    doneTitle: ' 🎉 セットアップ完了！AI秘書とKokioTalkの準備が整いました！',
    localUrl: '  • PCローカルURL          : http://localhost:8081',
    qrUrl: '  • スマホ接続QRコードURL  : http://localhost:8081/qr',
    pinInfo: '  • 外部アクセス6桁PIN     :'
  },
  zh: {
    bannerTitle: ' 🐓 KokioTalk & 🥛 Antigravity 2.0+ 专属 AI 秘书安装向导',
    step0Title: '🔍 [步骤 0] 正在检查 Antigravity 2.0+ 与系统环境...',
    nodeOk: '  ✅ Node.js 运行环境已确认:',
    agyOk: '  ✅ Google Antigravity 2.0+ 已确认:',
    agyWarn: '  ⚠️ [提示] 默认路径下未找到 Antigravity.exe，请确保已安装并登录 Antigravity 2.0+。',
    qHeader: '📝 [问题 1~5] 请配置您的专属 AI 秘书与安全 PIN 码。\n',
    q1: '1️⃣ 请输入您的姓名或称谓',
    q1Def: 'User 博士',
    q2: '2️⃣ AI 秘书该如何称呼您？（例如：博士、老师、老板）',
    q2Def: '博士',
    q3: '3️⃣ 请为您的 AI 秘书起个名字',
    q3Def: 'Ooyoo',
    q3Avatar: '   请选择 AI 秘书的图标（Emoji）',
    q3AvatarDef: '🥛',
    q4: '4️⃣ 请设置用于外部（手机/其他电脑）访问的6位数字安全 PIN 码',
    q4Err: '   ⚠️ 安全 PIN 码必须是6位数字（例如：000000、123456）！',
    q5: '5️⃣ 请确认 AI 秘书的工作区文件夹路径',
    step1Title: '🛠️ [步骤 1] 正在构建专属 AI 秘书客户端系统...',
    step2Title: '⚙️ [步骤 2] 正在配置 KokioTalk 与外部安全网关...',
    npmInstalling: '  📦 正在安装 Node.js 依赖包...',
    step3Title: '🖥️ [步骤 3] 正在桌面创建 [🐓 KokioTalk] 快捷方式...',
    doneTitle: ' 🎉 安装完成！您的专属 AI 秘书与 KokioTalk 已准备就绪！',
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

  const geminiMd = `# ${asstAvatar} Personal AI Secretary Configuration & Memory (${asstFullName})

## 1. Identity & Role
- **AI Secretary Name**: **${asstFullName}**
- **Role**: Chief Personal AI Secretary & Research/Work Coordinator for **${ownerName}**
- **Home Workspace**: \`${workspaceDir}\`
- **Runtime Environment**: ${ownerName}'s PC (Gateway Port \`8081\`, KokioTalk Port \`8082\`)
- **Communication Style**:
  - Always address the user respectfully as **"${honorific}"**.
  - Support multiple languages (English, 한국어, 日本語, 中文) naturally according to ${honorific}'s preference.
- **Core Integrity Rule**:
  - Never fabricate or report mock/simulated data as real facts, schedules, papers, or experiments.

## 2. 🗣️ Speaker Identification & Peer Relay Protocol
1. **Standard Messages**:
   - The speaker is **${ownerName}** ("${honorific}"). Assist warmly and accurately.
2. **Incoming Remote Peer Messages (starting with \`[🔗 ...]\`)**:
   - Sent by a family member's or colleague's peer AI assistant. Distinguish the sender clearly and reply directly in text without triggering a reverse peer call loop.
`;

  const agentsMd = `# AGENTS.md - ${asstFullName} Workspace Rules

This folder is the official home workspace for **${ownerName}** and Personal AI Secretary **${asstFullName}**.

## Session Startup & Continuity
- **Long-Term Memory**: \`MEMORY.md\` — Curated long-term decisions, preferences, and project context.
- **Daily Logs**: \`memory/YYYY-MM-DD.md\` — Daily activity logs and notes.

## Red Lines
- **Zero-Tolerance for Fake Data**: Report only verified facts; explicitly label any sample data as \`[Sample]\`.
- **Domain Separation**: Keep work/research files in \`${workspaceDir}\` separate from private personal documents unless explicitly requested by ${honorific}.
`;

  const memoryFile = path.join(workspaceDir, 'MEMORY.md');
  if (!fs.existsSync(memoryFile)) {
    const memoryMd = `# 🧠 MEMORY.md - ${asstFullName} Long-Term Memory

## ${asstAvatar} ${ownerName}'s Personal AI Secretary: ${asstFullName}
- **Owner Name & Honorific**: ${ownerName} (Address as: **"${honorific}"**)
- **Secretary Name**: ${asstFullName}
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
      `# 📅 ${todayStr} Daily Memory Log\n\n- Initialized **${asstFullName}** & **KokioTalk 🐓** Personal AI Secretary System.\n`,
      'utf-8'
    );
  }

  fs.writeFileSync(path.join(workspaceDir, 'GEMINI.md'), geminiMd, 'utf-8');
  fs.writeFileSync(path.join(workspaceDir, 'AGENTS.md'), agentsMd, 'utf-8');

  // Install Antigravity 2.0+ Global Plugin (~/.gemini/config/plugins/kokio-assistant)
  const pluginDir = path.join(HOME_DIR, '.gemini', 'config', 'plugins', 'kokio-assistant');
  const pluginRulesDir = path.join(pluginDir, 'rules');
  const pluginSkillDir = path.join(pluginDir, 'skills', 'kokio-secretary');
  fs.mkdirSync(pluginRulesDir, { recursive: true });
  fs.mkdirSync(pluginSkillDir, { recursive: true });

  const pluginJson = {
    name: 'kokio-assistant',
    displayName: `${asstAvatar} ${asstShortName} & KokioTalk AI Secretary`,
    version: '2.0.0',
    description: `Personal AI Secretary (${asstFullName}) & KokioTalk Mobile/PC Messenger Integration Plugin for ${ownerName}`,
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
    `---\nname: kokio-secretary\ndescription: Core skill managing ${ownerName}'s personal AI secretary (${asstFullName}), long-term memory (MEMORY.md), and KokioTalk messenger integration.\n---\n\n# ${asstFullName} Secretary Skill\n\n1. Always address the user as **"${honorific}"**.\n2. Persist important user preferences and records in \`${workspaceDir}\\MEMORY.md\`.\n`,
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
    accessPin = await ask(L.q4, '000000');
    if (!/^\d{6}$/.test(accessPin)) {
      console.log(L.q4Err);
    }
  }

  const defaultWorkspace = fs.existsSync(path.join(HOME_DIR, 'OneDrive', 'RyuVault'))
    ? path.join(HOME_DIR, 'OneDrive', 'RyuVault')
    : path.join(HOME_DIR, 'AI-Secretary-Vault');
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
      avatar: '👨‍🏫',
      statusMessage: `${ownerName}'s Antigravity 2.0 AI Workspace`
    },
    assistant: {
      id: 'ooyoo',
      name: asstFullName,
      shortName: asstShortName,
      avatar: asstAvatar,
      persona: `Personal AI Secretary for ${ownerName}`,
      defaultModel: 'argon',
      defaultLevel: 'medium',
      mentionKeywords: [`@${asstShortName}`, `${asstShortName}`, '@ooyoo', '우유야', '비서야']
    },
    peerAssistant: {
      enabled: false,
      id: 'ea',
      name: 'Peer AI Assistant (🤖)',
      shortName: 'PeerAI',
      avatar: '🤖',
      ownerName: 'Partner',
      endpoint: '',
      mentionKeywords: ['@peer', '@ea', '에아야']
    },
    security: {
      accessPin,
      allowLocalhostBypass: true,
      tempSessionTimeoutSec: 18
    },
    profiles: [
      { id: 'owner', label: `👨‍🏫 ${honorific}`, name: ownerName, avatar: '👨‍🏫', category: 'me' }
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
