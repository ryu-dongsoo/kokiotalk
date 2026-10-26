/**
 * Kokio AI (🤖) 모바일 웹앱 & 중개 서버 (Relay Server) + 실시간 PC 원격 제어 (멀티 PC 무결점 호환 버전)
 * - 어느 PC(메인 PC / 연구실 PC)에서 실행하든 사용자 폴더(os.homedir())와 KokioVault 프로젝트 ID를 자동으로 찾아 연결함
 * - 안티그래비티를 꺼도 독립 프로세스로 항상 살아있으며, 대화 전송 시 안티그래비티를 자동으로 깨움 (Auto-Wakeup)
 */

const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const readline = require('node:readline');
const { RnKakaoBridge } = require('./rn-kakao-bridge');
const rnKakaoBridge = new RnKakaoBridge(__dirname);

const HOME_DIR = os.homedir();
const PORT = Number(process.env.PORT) || 8081;
const KOKIO_PORT = Number(process.env.KOKIO_PORT) || 8082;
const DATA_DIR = process.env.KOKIO_DATA_DIR || __dirname;
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
const KOKIO_DIR = fs.existsSync(path.join(__dirname, '..', 'server', 'src', 'index.ts'))
  ? path.join(__dirname, '..')
  : fs.existsSync(path.join(__dirname, '..', '1. Projects', '연구계획', 'Works', 'KokioTalk', 'server', 'src', 'index.ts'))
    ? path.join(__dirname, '..', '1. Projects', '연구계획', 'Works', 'KokioTalk')
    : path.join(__dirname, '..');
const ANTIGRAVITY_GUI_EXE = process.platform === 'darwin'
  ? '/Applications/Antigravity.app/Contents/MacOS/Antigravity'
  : path.join(HOME_DIR, 'AppData', 'Local', 'Programs', 'antigravity', 'Antigravity.exe');
const AGENTAPI_EXE = process.platform === 'darwin'
  ? '/Applications/Antigravity.app/Contents/Resources/bin/language_server'
  : path.join(HOME_DIR, 'AppData', 'Local', 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe');
const BRAIN_DIR = path.join(HOME_DIR, '.gemini', 'antigravity', 'brain');
const PROJECTS_DIR = path.join(HOME_DIR, '.gemini', 'config', 'projects');

const STATE_FILE = path.join(DATA_DIR, 'sessions.json');
const TUNNEL_FILE = path.join(DATA_DIR, 'tunnel_url.txt');
const NGROK_DOMAIN_FILE = path.join(DATA_DIR, 'ngrok_domain.txt');
const DEFAULT_NGROK_DOMAIN = '';

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[UnhandledRejection]', err && err.message ? err.message : err);
});

function detectProjectId() {
  try {
    if (fs.existsSync(PROJECTS_DIR)) {
      const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
      for (const f of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8'));
          const raw = JSON.stringify(data);
          if (data.name === 'KokioVault' || raw.includes('KokioVault')) {
            return data.id;
          }
        } catch (e) {}
      }
      for (const f of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8'));
          if (data.id) return data.id;
        } catch (e) {}
      }
    }
  } catch (e) {}
  return 'c0018612-5c31-41dc-8023-70c4743bc80a';
}

const PROJECT_ID = detectProjectId();

function getSampleConversationId() {
  try {
    const state = loadSessions();
    if (state && state.activeConversationId) return state.activeConversationId;
    if (fs.existsSync(BRAIN_DIR)) {
      const dirs = fs.readdirSync(BRAIN_DIR, { withFileTypes: true });
      let bestId = null;
      let bestMtime = 0;
      for (const d of dirs) {
        if (d.isDirectory() && d.name !== 'tempmediaStorage' && /^[0-9a-f\-]{36}$/i.test(d.name)) {
          const logPath = path.join(BRAIN_DIR, d.name, '.system_generated', 'logs', 'transcript.jsonl');
          if (fs.existsSync(logPath)) {
            const st = fs.statSync(logPath);
            if (st.mtimeMs > bestMtime) {
              bestMtime = st.mtimeMs;
              bestId = d.name;
            }
          }
        }
      }
      if (bestId) return bestId;
    }
  } catch (e) {}
  return '70ecfee6-5bc3-43fb-b04f-649b486d13fd';
}

const MODEL_MAP = {
  argon: {
    id: 'argon',
    name: '✨ Gemini 4 Argon (아르곤)',
    apiTier: 'pro',
    desc: '차세대 최상위 추론 및 에이전트 코딩 모델'
  },
  pro: {
    id: 'pro',
    name: '🧠 Gemini Pro (프로)',
    apiTier: 'pro',
    desc: '고난도 설계 및 복잡한 다단계 작업용 모델'
  },
  flash: {
    id: 'flash',
    name: '⚡ Gemini Flash (플래시)',
    apiTier: 'flash',
    desc: '빠른 응답 속도와 균형 잡힌 만능 모델'
  },
  flash_lite: {
    id: 'flash_lite',
    name: '🪶 Gemini Flash Lite (라이트)',
    apiTier: 'flash_lite',
    desc: '가장 가볍고 즉각적인 초고속 응답 모델'
  }
};

const PERFORMANCE_MAP = {
  low: {
    label: '⚡ Low (초고속)',
    promptHint: '성능 강도: LOW (빠르고 간결한 핵심 위주 처리)'
  },
  medium: {
    label: '🚀 Medium (균형)',
    promptHint: '성능 강도: MEDIUM (표준 사고 깊이 및 균형 잡힌 실행)'
  },
  high: {
    label: '🧠 High (최고성능)',
    promptHint: '성능 강도: HIGH (최대 깊이의 심층 추론 및 정밀 검증)'
  }
};

let psWorker = null;
let reqSeq = 1;
const pendingReqs = new Map();

function startPsWorker() {
  try {
    const helperPath = fs.existsSync(path.join(__dirname, 'PcHelper-kokio.exe'))
      ? path.join(__dirname, 'PcHelper-kokio.exe')
      : path.join(__dirname, 'PcHelper.exe');
    if (!fs.existsSync(helperPath)) return;
    psWorker = spawn(helperPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    psWorker.on('error', (err) => {
      console.error('[PcHelper Error]', err.message);
      psWorker = null;
    });

    const rl = readline.createInterface({ input: psWorker.stdout });
    rl.on('line', (line) => {
      try {
        const data = JSON.parse(line);
        if (data.id && pendingReqs.has(data.id)) {
          const { resolve, timer } = pendingReqs.get(data.id);
          clearTimeout(timer);
          pendingReqs.delete(data.id);
          resolve(data);
        }
      } catch (e) {}
    });

    psWorker.on('exit', () => {
      psWorker = null;
      setTimeout(startPsWorker, 2000);
    });
  } catch (e) {
    psWorker = null;
  }
}

function sendPsCommand(payload, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    if (!psWorker || psWorker.killed) startPsWorker();
    if (!psWorker || !psWorker.stdin) {
      return reject(new Error('PcHelper 워커 준비 중입니다.'));
    }
    const id = reqSeq++;
    const timer = setTimeout(() => {
      pendingReqs.delete(id);
      reject(new Error('PC 제어 응답 시간 초과'));
    }, timeoutMs);

    pendingReqs.set(id, { resolve, timer });
    try {
      psWorker.stdin.write(JSON.stringify({ id, ...payload }) + '\n');
    } catch (e) {
      clearTimeout(timer);
      pendingReqs.delete(id);
      reject(e);
    }
  });
}

startPsWorker();

function getConfiguredNgrokDomain() {
  try {
    if (fs.existsSync(NGROK_DOMAIN_FILE)) {
      const d = fs.readFileSync(NGROK_DOMAIN_FILE, 'utf-8').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      if (d) return d;
    }
  } catch (e) {}
  return DEFAULT_NGROK_DOMAIN;
}

let syncPortal = async () => {};
let getTailscaleUrl = () => null;
try {
  if (fs.existsSync(path.join(__dirname, 'sync-portal.js'))) {
    const sp = require('./sync-portal');
    if (sp.syncPortal) syncPortal = sp.syncPortal;
    if (sp.getTailscaleUrl) getTailscaleUrl = sp.getTailscaleUrl;
  }
} catch {}

function detectCloudflareUrl() {
  try {
    const cfLog = path.join(__dirname, 'cloudflared-kokio.log');
    if (fs.existsSync(cfLog)) {
      const raw = fs.readFileSync(cfLog, 'utf-8');
      const m = raw.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/g);
      if (m && m.length > 0) return m[m.length - 1];
    }
  } catch (e) {}
  return null;
}

try {
  const tsUrl = getTailscaleUrl();
  const cfUrl = detectCloudflareUrl();
  const bestUrl = tsUrl || cfUrl;
  if (bestUrl) {
    fs.writeFileSync(TUNNEL_FILE, bestUrl, 'utf-8');
  } else if (!fs.existsSync(TUNNEL_FILE) || !fs.readFileSync(TUNNEL_FILE, 'utf-8').trim()) {
    const domain = getConfiguredNgrokDomain();
    fs.writeFileSync(TUNNEL_FILE, `https://${domain}`, 'utf-8');
  }
} catch (e) {}

function discoverAntigravityConnection() {
  try {
    const psCmd = `
      $procs = Get-CimInstance Win32_Process -Filter "Name = 'language_server.exe'";
      foreach ($proc in $procs) {
        $cmd = $proc.CommandLine;
        $csrf = '';
        if ($cmd -match '--csrf_token\\s+([a-f0-9\\-]+)') { $csrf = $matches[1]; }
        $ports = Get-NetTCPConnection -OwningProcess $proc.ProcessId -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort;
        if ($csrf -and $ports) {
          Write-Output "ENTRY=$csrf|$($ports -join ',')";
        }
      }
    `;
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', psCmd], {
      encoding: 'utf-8',
      windowsHide: true
    });
    const lines = out.split(/\r?\n/).map(s => s.trim()).filter(s => s.startsWith('ENTRY='));
    const sampleConvId = getSampleConversationId();

    for (const line of lines) {
      const payload = line.slice('ENTRY='.length);
      const [csrf, portList] = payload.split('|');
      if (!csrf || !portList) continue;
      const ports = portList.split(',').map(s => s.trim()).filter(Boolean);

      for (const p of ports) {
        try {
          const env = {
            ...process.env,
            ANTIGRAVITY_LS_ADDRESS: `127.0.0.1:${p}`,
            ANTIGRAVITY_CSRF_TOKEN: csrf.trim(),
            ANTIGRAVITY_PROJECT_ID: PROJECT_ID
          };
          execFileSync(AGENTAPI_EXE, ['agentapi', 'get-conversation-metadata', sampleConvId], {
            encoding: 'utf-8',
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
          });
          return { address: `127.0.0.1:${p}`, csrf: csrf.trim() };
        } catch (e) {
          const errOut = String((e && e.stdout) || '') + String((e && e.stderr) || '');
          if (errOut.includes('trajectory not found')) {
            return { address: `127.0.0.1:${p}`, csrf: csrf.trim() };
          }
        }
      }
    }
  } catch (err) {}
  return null;
}

let cachedConn = null;
let isLaunchingAntigravity = false;

async function ensureAntigravityBrainReady() {
  if (cachedConn) return cachedConn;
  cachedConn = discoverAntigravityConnection();
  if (cachedConn) return cachedConn;

  if (!isLaunchingAntigravity) {
    isLaunchingAntigravity = true;
    console.log('[Auto-Wakeup] Antigravity가 꺼져 있어 자동으로 실행합니다...');
    try {
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      const child = spawn(ANTIGRAVITY_GUI_EXE, [], {
        detached: true,
        stdio: 'ignore',
        env
      });
      child.on('error', () => {});
      child.unref();
    } catch (e) {
      console.error('[Auto-Wakeup Error]', e.message);
    }
  }

  for (let i = 0; i < 22; i++) {
    await new Promise(r => setTimeout(r, 1000));
    cachedConn = discoverAntigravityConnection();
    if (cachedConn) {
      isLaunchingAntigravity = false;
      return cachedConn;
    }
  }
  isLaunchingAntigravity = false;
  throw new Error('Antigravity를 자동 실행 중입니다. 잠시 후 다시 시도해 주세요!');
}

async function callAgentApiAsync(args) {
  let conn = await ensureAntigravityBrainReady();
  const run = (c) => {
    const env = {
      ...process.env,
      ANTIGRAVITY_LS_ADDRESS: c.address,
      ANTIGRAVITY_CSRF_TOKEN: c.csrf,
      ANTIGRAVITY_PROJECT_ID: PROJECT_ID
    };
    const out = execFileSync(AGENTAPI_EXE, ['agentapi', ...args], {
      encoding: 'utf-8',
      env,
      windowsHide: true
    });
    return out.trim() ? JSON.parse(out) : {};
  };

  try {
    return run(conn);
  } catch (e) {
    cachedConn = null;
    conn = await ensureAntigravityBrainReady();
    return run(conn);
  }
}

function loadSessions() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      return {
        activeModel: s.activeModel || 'argon',
        activeLevel: s.activeLevel || 'medium',
        activeConversationId: s.activeConversationId || null,
        customTitles: s.customTitles || {},
        peerName: s.peerName || 'Peer AI',
        peerUrl: s.peerUrl || '',
        peerConvId: s.peerConvId || null
      };
    }
  } catch (e) {}
  return {
    activeModel: 'argon',
    activeLevel: 'medium',
    activeConversationId: null,
    customTitles: {},
    peerName: 'Peer AI',
    peerUrl: '',
    peerConvId: null
  };
}

function saveSessions(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {}
}

const MY_AGENT_NAME = 'Kokio AI';

function normalizePeerUrl(rawUrl) {
  if (!rawUrl) return '';
  let u = String(rawUrl).trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) {
    u = 'https://' + u;
  }
  return u;
}

function requestPeerJson(peerBaseUrl, apiPath, method = 'GET', bodyObj = null, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const base = normalizePeerUrl(peerBaseUrl);
    if (!base) return reject(new Error('상대 에이전트(Peer AI) 주소가 아직 설정되지 않았습니다.'));

    let target;
    try {
      target = new URL(apiPath, base.endsWith('/') ? base : base + '/');
    } catch (e) {
      return reject(new Error('올바르지 않은 주소 형식입니다: ' + base));
    }

    const isHttps = target.protocol === 'https:';
    const lib = isHttps ? https : http;
    const payload = bodyObj ? Buffer.from(JSON.stringify(bodyObj), 'utf-8') : null;

    const headers = {
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'Ea-Uyu-Bridge/1.0'
    };
    if (payload) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = lib.request(target, { method, headers, timeout: timeoutMs }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = raw.trim() ? JSON.parse(raw) : {};
          resolve(parsed);
        } catch (err) {
          reject(new Error(`상대 에이전트 응답 파싱 실패 (HTTP ${res.statusCode})`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('상대 에이전트 응답 시간 초과'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (payload) req.write(payload);
    req.end();
  });
}

const ALARMS_FILE = path.join(__dirname, 'alarms.json');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) {}
}

function loadAlarms() {
  try {
    if (fs.existsSync(ALARMS_FILE)) {
      const arr = JSON.parse(fs.readFileSync(ALARMS_FILE, 'utf-8'));
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) {}
  return [];
}

function saveAlarms(list) {
  try {
    fs.writeFileSync(ALARMS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {}
}

function formatAlarmTimeLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = d.getSeconds();
  const ampm = hh < 12 ? '오전' : '오후';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const prefix = isToday ? '오늘' : `${d.getMonth() + 1}/${d.getDate()}`;
  return `${prefix} ${ampm} ${h12}:${mm}${ss ? `:${String(ss).padStart(2, '0')}` : ''}`;
}

function createAlarm({ title, triggerAt, repeatDaily = false, source = 'app' }) {
  const alarms = loadAlarms();
  const alarm = {
    id: 'alm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    title: (title || '일정 알림').trim(),
    triggerAt: Number(triggerAt),
    timeLabel: formatAlarmTimeLabel(Number(triggerAt)),
    repeatDaily: Boolean(repeatDaily),
    source,
    status: 'pending',
    firedAt: null,
    createdAt: new Date().toISOString()
  };
  alarms.push(alarm);
  alarms.sort((a, b) => a.triggerAt - b.triggerAt);
  saveAlarms(alarms);
  return alarm;
}

function parseNaturalAlarm(text) {
  if (!text) return null;
  const raw = text.trim();
  const hasAlarmIntent = /(?:알림|알람|알려\s*줘|알려\s*주|깨워\s*줘|타이머|리마인드|기억해\s*줘|울려\s*줘)/.test(raw);
  if (!hasAlarmIntent) return null;

  const now = new Date();
  let triggerAt = null;
  let matchedTimeSpan = '';

  const relRegex = /(?:(\d+)\s*시간\s*(?:(반)|(\d+)\s*분)?|(\d+)\s*분\s*(?:(\d+)\s*초)?|(\d+)\s*초)\s*(?:뒤|후|있다가|이따가|지나서|타이머)/;
  const relMatch = raw.match(relRegex);
  if (relMatch) {
    matchedTimeSpan = relMatch[0];
    let addMs = 0;
    if (relMatch[1]) {
      addMs += parseInt(relMatch[1], 10) * 3600000;
      if (relMatch[2]) addMs += 30 * 60000;
      else if (relMatch[3]) addMs += parseInt(relMatch[3], 10) * 60000;
    } else if (relMatch[4]) {
      addMs += parseInt(relMatch[4], 10) * 60000;
      if (relMatch[5]) addMs += parseInt(relMatch[5], 10) * 1000;
    } else if (relMatch[6]) {
      addMs += parseInt(relMatch[6], 10) * 1000;
    }
    if (addMs > 0) {
      triggerAt = Date.now() + addMs;
    }
  }

  if (!triggerAt) {
    const absRegex = /(내일|모레|오늘)?\s*(오전|아침|새벽|오후|저녁|밤|낮)?\s*(\d{1,2})\s*(?:시|:)\s*(?:(반)|(\d{1,2})\s*분?)?/;
    const absMatch = raw.match(absRegex);
    if (absMatch) {
      matchedTimeSpan = absMatch[0];
      const dayWord = absMatch[1] || '';
      const meridiem = absMatch[2] || '';
      let hour = parseInt(absMatch[3], 10);
      let minute = absMatch[4] ? 30 : (absMatch[5] ? parseInt(absMatch[5], 10) : 0);

      if (hour >= 0 && hour <= 24 && minute >= 0 && minute < 60) {
        const target = new Date(now.getTime());
        target.setSeconds(0, 0);

        if (dayWord === '내일') target.setDate(target.getDate() + 1);
        else if (dayWord === '모레') target.setDate(target.getDate() + 2);

        if (meridiem === '오후' || meridiem === '저녁' || meridiem === '밤') {
          if (hour < 12) hour += 12;
        } else if (meridiem === '오전' || meridiem === '아침' || meridiem === '새벽') {
          if (hour === 12) hour = 0;
        } else if (hour >= 1 && hour <= 11) {
          const candAm = new Date(target.getTime());
          candAm.setHours(hour, minute, 0, 0);
          const candPm = new Date(target.getTime());
          candPm.setHours(hour + 12, minute, 0, 0);
          if (candAm.getTime() > Date.now()) {
            hour = hour;
          } else if (candPm.getTime() > Date.now()) {
            hour = hour + 12;
          } else {
            target.setDate(target.getDate() + 1);
          }
        }

        target.setHours(hour, minute, 0, 0);
        if (target.getTime() <= Date.now()) {
          target.setDate(target.getDate() + 1);
        }
        triggerAt = target.getTime();
      }
    }
  }

  if (!triggerAt) return null;

  let title = raw
    .replace(/^(?:AI야|AI님|Kokio AI)\s*[,]?\s*/i, '')
    .replace(matchedTimeSpan, '')
    .replace(/^[에에서부터까지\s,]+/, '')
    .replace(/(?:이라고|라고|하라고|해달라고|달라고)?\s*(?:일정\s*)?(?:알림|알람|타이머)?\s*(?:좀\s*)?(?:띄워\s*줘|맞춰\s*줘|설정해\s*줘|알려\s*줘|울려\s*줘|깨워\s*줘|걸어\s*줘|해\s*줘).*$/i, '')
    .trim();

  if (!title || title.length < 2) {
    title = '예약된 일정 알림';
  }
  const repeatDaily = /(?:매일|날마다)/.test(raw);
  return { title, triggerAt, repeatDaily };
}

function triggerPcAlarmToast(alarm) {
  try {
    const safeTitle = String(alarm.title).replace(/['"`$]/g, '');
    const safeTime = String(alarm.timeLabel).replace(/['"`$]/g, '');
    const psScript = `
      [console]::beep(880, 180); [console]::beep(1174, 240);
      Add-Type -AssemblyName System.Windows.Forms;
      Add-Type -AssemblyName System.Drawing;
      $notify = New-Object System.Windows.Forms.NotifyIcon;
      $notify.Icon = [System.Drawing.SystemIcons]::Information;
      $notify.BalloonTipIcon = 'Info';
      $notify.BalloonTipTitle = '⏰ Kokio AI(KokioAI 🥛) 스마트 일정 알림';
      $notify.BalloonTipText = "사용자님! 예약하신 알림 시간입니다 (${safeTime})\`r\`n📌 ${safeTitle}";
      $notify.Visible = $true;
      $notify.ShowBalloonTip(8000);
      Start-Sleep -Seconds 9;
      $notify.Dispose();
    `;
    const child = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', psScript], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
  } catch (e) {}
}

setInterval(() => {
  try {
    const alarms = loadAlarms();
    const nowMs = Date.now();
    let changed = false;

    for (const a of alarms) {
      if (a.status === 'pending' && nowMs >= a.triggerAt) {
        a.status = 'fired';
        a.firedAt = nowMs;
        changed = true;
        console.log(`[⏰ Kokio AI 알림 발동!] ${a.title} (${a.timeLabel})`);
        triggerPcAlarmToast(a);

        if (a.repeatDaily) {
          const nextTs = a.triggerAt + 86400000;
          alarms.push({
            id: 'alm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            title: a.title,
            triggerAt: nextTs,
            timeLabel: formatAlarmTimeLabel(nextTs),
            repeatDaily: true,
            source: a.source,
            status: 'pending',
            firedAt: null,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    if (changed) {
      saveAlarms(alarms);
    }
  } catch (e) {}
}, 1000);

function extractAttachmentsFromRaw(raw) {
  const attachments = [];
  const regex = /\[📎 첨부파일:\s*([^|\]]+?)\s*\|\s*URL:\s*([^|\]]+?)\s*\|\s*PC경로:\s*([^\]]+?)\]/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    const fileName = m[1].trim();
    const fileUrl = m[2].trim();
    const absolutePath = m[3].trim();
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName);
    attachments.push({ fileName, fileUrl, absolutePath, isImage });
  }
  return attachments;
}

function cleanUserText(raw) {
  return raw
    .replace(/^\[모바일 원격 명령[^\]]*\]\s*/gm, '')
    .replace(/^\[⚠️[^\]]*\]\s*/gm, '')
    .replace(/^\[🔗[^\]]*\]\s*/gm, '')
    .replace(/^\[⏰[^\]]*\]\s*/gm, '')
    .replace(/^\[📎 첨부파일:[^\]]*\]\s*/gm, '')
    .replace(/^\[📎 Kokio AI 안내:[^\]]*\]\s*/gm, '')
    .replace(/^\[📎 Peer AI 안내:[^\]]*\]\s*/gm, '')
    .replace(/^\[모델:[^\]]*\]\s*/gm, '')
    .replace(/^\[성능 모드:[^\]]*\]\s*/gm, '')
    .replace(/^\[발신자:[^\]]*\]\s*/gm, '')
    .replace(/^\[원격 수신 메시지[^\]]*\]:\s*/gm, '')
    .replace(/^사용자님의 요청:\s*/gm, '')
    .replace(/^파트너님의 요청:\s*/gm, '')
    .trim();
}

function listAllConversations() {
  const state = loadSessions();
  const list = [];
  try {
    const dirs = fs.readdirSync(BRAIN_DIR, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory() || d.name === 'tempmediaStorage') continue;
      const logPath = path.join(BRAIN_DIR, d.name, '.system_generated', 'logs', 'transcript.jsonl');
      if (!fs.existsSync(logPath)) continue;

      const stat = fs.statSync(logPath);
      let title = state.customTitles[d.name] || '';
      if (!title) {
        try {
          const fd = fs.openSync(logPath, 'r');
          const buf = Buffer.alloc(2048);
          const bytes = fs.readSync(fd, buf, 0, 2048, 0);
          fs.closeSync(fd);
          const firstChunk = buf.toString('utf-8', 0, bytes);
          const firstLine = firstChunk.split(/\r?\n/)[0];
          if (firstLine) {
            const step = JSON.parse(firstLine);
            let txt = step.content || '';
            const m = txt.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/);
            if (m) txt = m[1];
            txt = cleanUserText(txt);
            title = txt.split(/\r?\n/)[0].slice(0, 32) || '새 대화';
          }
        } catch (e) {}
      }
      if (!title) title = `대화 (${d.name.slice(0, 6)})`;

      list.push({
        id: d.name,
        title,
        updatedAt: stat.mtime.toISOString(),
        mtimeMs: stat.mtimeMs
      });
    }
  } catch (e) {}

  list.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return list.slice(0, 30);
}

function readTranscriptMessages(conversationId) {
  if (!conversationId) return { messages: [], isThinking: false };
  const logPath = path.join(BRAIN_DIR, conversationId, '.system_generated', 'logs', 'transcript.jsonl');
  if (!fs.existsSync(logPath)) return { messages: [], isThinking: true };

  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    const messages = [];
    let isThinking = false;

    for (const line of lines) {
      let step;
      try { step = JSON.parse(line); } catch (e) { continue; }

      if (step.type === 'USER_INPUT') {
        let text = step.content || '';
        const match = text.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/);
        if (match) text = match[1];
        const attachments = extractAttachmentsFromRaw(text);
        messages.push({ role: 'user', text: cleanUserText(text), attachments, timestamp: step.created_at });
        isThinking = true;
      } else if (step.type === 'SYSTEM_MESSAGE') {
        let text = step.content || '';
        const match = text.match(/content=([\s\S]*?)\s*<\/SYSTEM_MESSAGE>/);
        if (match) {
          let inner = match[1].trim();
          if (!inner.startsWith('Task id "') && !inner.startsWith('[Notice]')) {
            const attachments = extractAttachmentsFromRaw(inner);
            messages.push({ role: 'user', text: cleanUserText(inner), attachments, timestamp: step.created_at });
            isThinking = true;
          }
        }
      } else if (step.type === 'PLANNER_RESPONSE') {
        const tools = (step.tool_calls || []).map(tc => ({
          name: tc.name || 'tool',
          summary: (tc.args && (tc.args.toolAction || tc.args.toolSummary || tc.args.CommandLine)) || tc.name
        }));
        const replyText = (step.content || '').replace(/^>\s*📱\s*\*\*사용자님\s*\(모바일\)\*\*:\s*[^\r\n]+\r?\n*/m, '').trim();
        const thinkingText = (step.thinking || '').trim();

        if (replyText || tools.length > 0) {
          messages.push({
            role: 'kokio',
            text: replyText,
            thinking: thinkingText,
            tools,
            timestamp: step.created_at
          });
        }
        isThinking = (tools.length > 0 && !replyText);
      }
    }

    return { messages, isThinking };
  } catch (err) {
    return { messages: [], isThinking: false, error: err.message };
  }
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    if (/tailscale|loopback|vethernet|wsl/i.test(name)) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.') && !iface.address.startsWith('100.')) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function getTunnelUrl() {
  try {
    const tsUrl = getTailscaleUrl();
    if (tsUrl) return tsUrl;
    const cfUrl = detectCloudflareUrl();
    if (cfUrl) return cfUrl;
    if (fs.existsSync(TUNNEL_FILE)) return fs.readFileSync(TUNNEL_FILE, 'utf-8').trim();
  } catch (e) {}
  return `https://${DEFAULT_NGROK_DOMAIN}`;
}

let isStartingKokio = false;

function ensureKokioTalkRunning() {
  if (isStartingKokio) return;
  const probe = net.createConnection({ host: '127.0.0.1', port: KOKIO_PORT });
  probe.setTimeout(1200);
  probe.on('connect', () => {
    probe.destroy();
  });
  probe.on('timeout', () => {
    probe.destroy();
  });
  probe.on('error', () => {
    probe.destroy();
    const entryMjs = path.join(KOKIO_DIR, 'server', 'dist', 'index.mjs');
    const entryTs = path.join(KOKIO_DIR, 'server', 'src', 'index.ts');
    const hasMjs = fs.existsSync(entryMjs);
    const hasTs = fs.existsSync(entryTs);
    if (!hasMjs && !hasTs) return;
    isStartingKokio = true;
    try {
      const agyNode = path.join(HOME_DIR, '.gemini', 'antigravity', 'bin', 'node.exe');
      const nodeBin = process.execPath && fs.existsSync(process.execPath)
        ? process.execPath
        : (fs.existsSync(agyNode) ? agyNode : 'node');
      const args = hasMjs
        ? ['--no-warnings', entryMjs]
        : ['--experimental-strip-types', '--no-warnings', entryTs];
      console.log(`[KokioTalk Auto-Start] Starting Core Server on port ${KOKIO_PORT}...`);
      const child = spawn(nodeBin, args, {
        cwd: KOKIO_DIR,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          PORT: String(KOKIO_PORT),
          KOKIO_PORT: String(KOKIO_PORT),
          KOKIO_GATEWAY_PORT: String(PORT)
        },
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.on('error', () => {});
      child.unref();
    } catch (e) {}
    setTimeout(() => { isStartingKokio = false; }, 6000);
  });
}

ensureKokioTalkRunning();
setInterval(ensureKokioTalkRunning, 10000);

function proxyToKokioTalk(req, res, targetPath) {
  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: KOKIO_PORT,
      path: targetPath,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${KOKIO_PORT}`
      }
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', (err) => {
    ensureKokioTalkRunning();
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: '꼬끼오톡(8082) 서버 연결 준비 중입니다: ' + err.message }));
    }
  });
  req.pipe(proxyReq);
}

// ============================================================================
// 🔒 꼬끼오톡 · Kokio AI 보안 PIN 잠금 (kokio.config.json 연동) & 임시 컴퓨터 접속 자동 소멸 엔진
// ============================================================================
function loadKokioConfig() {
  const candidates = [
    path.join(DATA_DIR, 'kokio.config.json'),
    path.join(__dirname, 'kokio.config.json'),
    path.join(KOKIO_DIR, 'kokio.config.json'),
    path.join(__dirname, '..', 'kokio.config.json')
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    } catch {}
  }
  return {};
}

function getActivePin() {
  const cfg = loadKokioConfig();
  return String(cfg?.security?.accessPin || '000000').trim();
}

const KOKIO_CONFIG = loadKokioConfig();
const ACCESS_PIN = getActivePin();
const OWNER_HONORIFIC = KOKIO_CONFIG?.owner?.honorific || 'User';
const ASSISTANT_SHORT_NAME = KOKIO_CONFIG?.assistant?.shortName || 'Kokio AI';
const ASSISTANT_AVATAR = KOKIO_CONFIG?.assistant?.avatar || '🤖';
const AUTH_SECRET = crypto.createHash('sha256').update(`kokio-pin-${ACCESS_PIN}-${PROJECT_ID}`).digest('hex');
const PERSISTENT_TOKEN = crypto.createHmac('sha256', AUTH_SECRET).update('kokio-trusted-device').digest('hex');
const tempSessions = new Map(); // tempToken -> { createdAt, lastSeenAt, closingTimer }

setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of tempSessions.entries()) {
    // 임시 접속 탭에서 18초 이상 핑(heartbeat)이 끊기면(브라우저 강제종료/창닫기 등) 서버 메모리에서 즉시 파기
    if (now - sess.lastSeenAt > 18000) {
      if (sess.closingTimer) clearTimeout(sess.closingTimer);
      tempSessions.delete(token);
    }
  }
}, 4000);

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

function isStrictLocalhost(req, cookies) {
  if (cookies && cookies.kokio_locked === '1') return false;
  const remote = req.socket?.remoteAddress || '';
  const isLoopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (!isLoopback) return false;
  const host = String(req.headers.host || '').toLowerCase();
  const isLocalHostHeader = host.startsWith('localhost:') || host.startsWith('127.0.0.1:') || host === 'localhost' || host === '127.0.0.1';
  if (!isLocalHostHeader) return false;
  if (
    req.headers['x-forwarded-for'] ||
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-host'] ||
    req.headers['tailscale-funnel-request'] ||
    req.headers['x-real-ip']
  ) {
    return false;
  }
  return true;
}

function getAuthStatus(req) {
  const cookies = parseCookies(req);
  const authCookie = cookies.kokio_auth || '';

  if (authCookie === PERSISTENT_TOKEN && cookies.kokio_locked !== '1') {
    return { authenticated: true, mode: 'persistent', token: authCookie };
  }

  if (authCookie.startsWith('temp_')) {
    const sess = tempSessions.get(authCookie);
    if (sess) {
      if (sess.closingTimer) {
        clearTimeout(sess.closingTimer);
        sess.closingTimer = null;
      }
      sess.lastSeenAt = Date.now();
      return { authenticated: true, mode: 'temp', token: authCookie };
    }
  }

  if (isStrictLocalhost(req, cookies)) {
    return { authenticated: true, mode: 'local', token: 'local' };
  }

  return { authenticated: false, mode: 'none', token: '' };
}

function renderLockScreenHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#0D1117" />
  <title>KokioTalk · Security Lock</title>
  <link rel="icon" href="/icon-180.png" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      min-height: 100vh;
      background: #0D1117;
      color: #E6EDF3;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Pretendard", "Segoe UI", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }
    .lock-card {
      width: 100%;
      max-width: 400px;
      background: #161B22;
      border: 1px solid #30363D;
      border-radius: 14px;
      padding: 22px 22px 24px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
      text-align: center;
      position: relative;
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .brand-badges {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(59, 130, 246, 0.14);
      color: #58A6FF;
      border: 1px solid rgba(59, 130, 246, 0.35);
      padding: 5px 11px;
      border-radius: 6px;
      font-size: 12.5px;
      font-weight: 600;
    }
    .lang-select {
      background: #0D1117;
      color: #E6EDF3;
      border: 1px solid #30363D;
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    h1 {
      font-size: 18px;
      font-weight: 700;
      color: #E6EDF3;
      margin-bottom: 6px;
      letter-spacing: -0.2px;
    }
    .subtitle {
      font-size: 12.5px;
      color: #8B949E;
      line-height: 1.45;
      margin-bottom: 16px;
    }
    .mode-selector {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 12px;
      background: #0D1117;
      padding: 4px;
      border-radius: 8px;
      border: 1px solid #21262D;
    }
    .mode-option {
      border: none;
      background: transparent;
      color: #8B949E;
      padding: 9px 8px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.15s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .mode-option .mode-sub {
      font-size: 10.5px;
      font-weight: 400;
      opacity: 0.85;
    }
    .mode-option.active.temp-mode,
    .mode-option.active.persist-mode {
      background: #2563EB;
      color: #FFFFFF;
    }
    .mode-desc-banner {
      font-size: 11.5px;
      padding: 8px 11px;
      border-radius: 6px;
      margin-bottom: 14px;
      line-height: 1.4;
      font-weight: 500;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #93C5FD;
    }
    .pin-dots {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin: 10px 0 16px;
    }
    .pin-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1.5px solid #30363D;
      background: transparent;
      transition: all 0.12s ease;
    }
    .pin-dot.filled {
      background: #3B82F6;
      border-color: #3B82F6;
      transform: scale(1.1);
    }
    .pin-dot.error {
      background: #EF4444;
      border-color: #EF4444;
    }
    .error-msg {
      min-height: 18px;
      font-size: 12px;
      color: #F87171;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .keypad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 4px;
    }
    .key-btn {
      height: 50px;
      border-radius: 8px;
      border: 1px solid #30363D;
      background: #0D1117;
      color: #E6EDF3;
      font-size: 19px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.1s;
      user-select: none;
    }
    .key-btn:active {
      background: rgba(59, 130, 246, 0.22);
      border-color: #3B82F6;
    }
    .key-btn.util {
      font-size: 12.5px;
      color: #8B949E;
    }
    .footer-note {
      margin-top: 14px;
      font-size: 11px;
      color: #6E7681;
    }
  </style>
</head>
<body>
  <div class="lock-card">
    <div class="top-bar">
      <div class="brand-badges">KokioTalk · Security</div>
      <select id="lock-lang-select" class="lang-select" aria-label="Language">
        <option value="en">EN · English</option>
        <option value="ko">KO · 한국어</option>
        <option value="ja">JA · 日本語</option>
        <option value="zh">ZH · 中文</option>
      </select>
    </div>

    <h1 id="lock-title">Security PIN Lock</h1>
    <p id="lock-subtitle" class="subtitle">External access protection is active.<br/>Please enter your 6-digit security PIN.</p>

    <div class="mode-selector" role="tablist">
      <button type="button" id="btn-mode-temp" class="mode-option temp-mode">
        <span id="lbl-temp-title">Temp PC Access</span>
        <span id="lbl-temp-sub" class="mode-sub">Auto-wipe when tab closes</span>
      </button>
      <button type="button" id="btn-mode-persist" class="mode-option persist-mode">
        <span id="lbl-persist-title">My Device</span>
        <span id="lbl-persist-sub" class="mode-sub">Remember on this device</span>
      </button>
    </div>

    <div id="mode-banner" class="mode-desc-banner temp"></div>

    <div class="pin-dots" id="pin-dots">
      <div class="pin-dot"></div>
      <div class="pin-dot"></div>
      <div class="pin-dot"></div>
      <div class="pin-dot"></div>
      <div class="pin-dot"></div>
      <div class="pin-dot"></div>
    </div>

    <div id="error-msg" class="error-msg"></div>

    <div class="keypad">
      <button type="button" class="key-btn" data-digit="1">1</button>
      <button type="button" class="key-btn" data-digit="2">2</button>
      <button type="button" class="key-btn" data-digit="3">3</button>
      <button type="button" class="key-btn" data-digit="4">4</button>
      <button type="button" class="key-btn" data-digit="5">5</button>
      <button type="button" class="key-btn" data-digit="6">6</button>
      <button type="button" class="key-btn" data-digit="7">7</button>
      <button type="button" class="key-btn" data-digit="8">8</button>
      <button type="button" class="key-btn" data-digit="9">9</button>
      <button type="button" class="key-btn util" id="btn-clear">Clear</button>
      <button type="button" class="key-btn" data-digit="0">0</button>
      <button type="button" class="key-btn util" id="btn-back">⌫</button>
    </div>

    <div id="lock-footer" class="footer-note">You can also type digits (0–9) directly on your keyboard.</div>
  </div>

  <script>
    (function() {
      const L = {
        en: {
          title: 'Security PIN Lock',
          subtitle: 'External access protection is active.<br/>Please enter your 6-digit security PIN.',
          tempTitle: 'Temp PC Access',
          tempSub: 'Auto-wipe when tab closes',
          persistTitle: 'My Device',
          persistSub: 'Remember on this device',
          tempBanner: '<strong>Temporary Access Mode:</strong> Automatically wipes your session the moment you close the tab or window.',
          persistBanner: '<strong>Remember Device Mode:</strong> Securely remembers authentication on your personal phone or PC.',
          clearBtn: 'Clear',
          footer: 'You can also type digits (0–9) directly on your keyboard.',
          verifying: 'Verifying security PIN...',
          wrongPin: 'Invalid 6-digit PIN.',
          netErr: 'Network error. Please try again.'
        },
        ko: {
          title: '보안 PIN 잠금',
          subtitle: '외부 접속 보안이 활성화되어 있습니다.<br/>6자리 보안 암호를 입력해 주세요.',
          tempTitle: '임시 컴퓨터 접속',
          tempSub: '창 닫으면 암호 즉시 소멸',
          persistTitle: '내 폰 · 내 기기',
          persistSub: '이 기기에서 암호 기억',
          tempBanner: '<strong>임시 접속 모드:</strong> 브라우저에 암호를 저장하지 않으며, 창이나 탭을 닫는 즉시 인증이 자동 해제됩니다.',
          persistBanner: '<strong>내 기기 기억 모드:</strong> 스마트폰·전용 PC에서 매번 암호를 묻지 않도록 안전하게 기억합니다.',
          clearBtn: '전체지움',
          footer: '키보드 숫자키(0~9)로 바로 입력하셔도 됩니다.',
          verifying: '보안 인증 확인 중...',
          wrongPin: '암호가 일치하지 않습니다.',
          netErr: '네트워크 오류가 발생했습니다.'
        },
        ja: {
          title: 'セキュリティPINロック',
          subtitle: '外部アクセス保護が有効です。<br/>6桁のPINコードを入力してください。',
          tempTitle: '一時PCアクセス',
          tempSub: 'タブを閉じると自動消去',
          persistTitle: 'マイデバイス',
          persistSub: 'この端末で記憶する',
          tempBanner: '<strong>一時アクセスモード:</strong> ウィンドウを閉じると認証が即座に消去されます。',
          persistBanner: '<strong>デバイス記憶モード:</strong> 個人のスマートフォンやPCで認証を安全に記憶します。',
          clearBtn: 'クリア',
          footer: 'キーボードの数字キー(0〜9)でも直接入力できます。',
          verifying: '認証を確認中...',
          wrongPin: 'PINコードが正しくありません。',
          netErr: 'ネットワークエラーが発生しました。'
        },
        zh: {
          title: '安全 PIN 锁定',
          subtitle: '外部访问保护已启用。<br/>请输入6位安全 PIN 码。',
          tempTitle: '临时电脑访问',
          tempSub: '关闭窗口即刻自动清除',
          persistTitle: '我的设备',
          persistSub: '在此设备上记住密码',
          tempBanner: '<strong>临时访问模式:</strong> 关闭标签页或窗口后立即销毁会话。',
          persistBanner: '<strong>记住设备模式:</strong> 在您的个人手机或专属电脑上安全记住登录状态。',
          clearBtn: '清空',
          footer: '您也可以直接使用键盘数字键(0~9)输入。',
          verifying: '正在验证安全 PIN...',
          wrongPin: '6位安全密码不正确。',
          netErr: '发生网络错误。'
        }
      };

      const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      let currentMode = isMobileDevice ? 'persistent' : 'temp';
      let currentLang = localStorage.getItem('kokio_ui_lang') || 'en';
      if (!L[currentLang]) currentLang = 'en';

      let pinBuffer = '';
      let isSubmitting = false;

      const langSelect = document.getElementById('lock-lang-select');
      const btnTemp = document.getElementById('btn-mode-temp');
      const btnPersist = document.getElementById('btn-mode-persist');
      const banner = document.getElementById('mode-banner');
      const dots = Array.from(document.querySelectorAll('.pin-dot'));
      const errEl = document.getElementById('error-msg');

      try { sessionStorage.removeItem('kokio_temp_token'); } catch (e) {}

      function applyLang(lang) {
        currentLang = L[lang] ? lang : 'en';
        try { localStorage.setItem('kokio_ui_lang', currentLang); } catch (e) {}
        langSelect.value = currentLang;
        const t = L[currentLang];
        document.getElementById('lock-title').textContent = t.title;
        document.getElementById('lock-subtitle').innerHTML = t.subtitle;
        document.getElementById('lbl-temp-title').textContent = t.tempTitle;
        document.getElementById('lbl-temp-sub').textContent = t.tempSub;
        document.getElementById('lbl-persist-title').textContent = t.persistTitle;
        document.getElementById('lbl-persist-sub').textContent = t.persistSub;
        document.getElementById('btn-clear').textContent = t.clearBtn;
        document.getElementById('lock-footer').textContent = t.footer;
        setMode(currentMode);
      }

      function setMode(mode) {
        currentMode = mode;
        const t = L[currentLang] || L.en;
        btnTemp.classList.toggle('active', mode === 'temp');
        btnPersist.classList.toggle('active', mode === 'persistent');
        if (mode === 'temp') {
          banner.className = 'mode-desc-banner temp';
          banner.innerHTML = t.tempBanner;
        } else {
          banner.className = 'mode-desc-banner persist';
          banner.innerHTML = t.persistBanner;
        }
      }

      langSelect.addEventListener('change', () => applyLang(langSelect.value));
      btnTemp.addEventListener('click', () => setMode('temp'));
      btnPersist.addEventListener('click', () => setMode('persistent'));
      applyLang(currentLang);

      function renderDots(isError) {
        dots.forEach((d, idx) => {
          d.classList.toggle('filled', idx < pinBuffer.length);
          d.classList.toggle('error', Boolean(isError));
        });
      }

      async function submitPin() {
        if (isSubmitting || pinBuffer.length !== 6) return;
        isSubmitting = true;
        const t = L[currentLang] || L.en;
        errEl.textContent = t.verifying;
        const pinToSend = pinBuffer;
        pinBuffer = '';
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pinToSend, mode: currentMode })
          });
          const data = await res.json();
          if (data.ok) {
            if (data.mode === 'temp' && data.tempToken) {
              sessionStorage.setItem('kokio_temp_token', data.tempToken);
            } else {
              sessionStorage.removeItem('kokio_temp_token');
            }
            window.location.replace(window.location.pathname + window.location.search);
            return;
          }
          errEl.textContent = t.wrongPin;
          renderDots(true);
          setTimeout(() => renderDots(false), 450);
        } catch (e) {
          errEl.textContent = t.netErr;
          renderDots(false);
        } finally {
          isSubmitting = false;
        }
      }

      function pushDigit(d) {
        if (isSubmitting || pinBuffer.length >= 6) return;
        errEl.textContent = '';
        pinBuffer += String(d);
        renderDots(false);
        if (pinBuffer.length === 6) {
          submitPin();
        }
      }

      function popDigit() {
        if (isSubmitting || pinBuffer.length === 0) return;
        errEl.textContent = '';
        pinBuffer = pinBuffer.slice(0, -1);
        renderDots(false);
      }

      function clearDigits() {
        if (isSubmitting) return;
        errEl.textContent = '';
        pinBuffer = '';
        renderDots(false);
      }

      document.querySelectorAll('[data-digit]').forEach(btn => {
        btn.addEventListener('click', () => pushDigit(btn.getAttribute('data-digit')));
      });
      document.getElementById('btn-back').addEventListener('click', popDigit);
      document.getElementById('btn-clear').addEventListener('click', clearDigits);

      window.addEventListener('keydown', (ev) => {
        if (ev.key >= '0' && ev.key <= '9') {
          ev.preventDefault();
          pushDigit(ev.key);
        } else if (ev.key === 'Backspace') {
          ev.preventDefault();
          popDigit();
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          clearDigits();
        }
      });
    })();
  </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Kokio-Api-Key, X-KokioAI-Temp-Token, ngrok-skip-browser-warning');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 0. GitHub 고정 포털(https://github.com/ryu-dongsoo/kokiotalk) 상태 확인용 무인증 헬스체크
  if (req.method === 'GET' && url.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, status: 'online' }));
    return;
  }

  // 0.2 Auto-Update Checker & 1-Click Hot-Updater (/api/system/version & /api/system/apply-update)
  if (url.pathname === '/api/system/version' && req.method === 'GET') {
    let currentVersion = '2.0.0';
    try {
      const pkgPath = path.join(KOKIO_DIR, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.version) currentVersion = String(pkg.version).trim();
      }
    } catch {}

    const fetchJson = (targetUrl) => new Promise((resolve) => {
      const reqHttps = https.get(targetUrl, {
        headers: { 'User-Agent': 'KokioTalk-Updater', 'Cache-Control': 'no-cache' },
        timeout: 4500
      }, (resp) => {
        if (resp.statusCode !== 200) { resolve(null); return; }
        let raw = '';
        resp.on('data', c => { raw += c; });
        resp.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve(null); }
        });
      });
      reqHttps.on('error', () => resolve(null));
      reqHttps.on('timeout', () => { reqHttps.destroy(); resolve(null); });
    });

    const compareVersions = (v1, v2) => {
      const a = String(v1 || '0.0.0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
      const b = String(v2 || '0.0.0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < 3; i++) {
        if ((a[i] || 0) > (b[i] || 0)) return 1;
        if ((a[i] || 0) < (b[i] || 0)) return -1;
      }
      return 0;
    };

    const remotePkg = await fetchJson('https://raw.githubusercontent.com/ryu-dongsoo/kokiotalk/main/package.json?t=' + Date.now());
    const latestCommit = await fetchJson('https://api.github.com/repos/ryu-dongsoo/kokiotalk/commits/main');
    const latestVersion = remotePkg?.version ? String(remotePkg.version).trim() : currentVersion;
    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
    const releaseNote = latestCommit?.commit?.message
      ? String(latestCommit.commit.message).split('\n')[0]
      : '';

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      ok: true,
      currentVersion,
      latestVersion,
      updateAvailable,
      releaseNote,
      releaseUrl: 'https://github.com/ryu-dongsoo/kokiotalk/releases/latest'
    }));
    return;
  }

  if (url.pathname === '/api/system/apply-update' && req.method === 'POST') {
    const authForUpd = getAuthStatus(req);
    if (!authForUpd.authenticated) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      return;
    }

    const fetchText = (targetUrl) => new Promise((resolve, reject) => {
      https.get(targetUrl, {
        headers: { 'User-Agent': 'KokioTalk-Updater', 'Cache-Control': 'no-cache' },
        timeout: 10000
      }, (resp) => {
        if (resp.statusCode !== 200) { reject(new Error('HTTP ' + resp.statusCode)); return; }
        let raw = '';
        resp.on('data', c => { raw += c; });
        resp.on('end', () => resolve(raw));
      }).on('error', reject);
    });

    try {
      const filesToSync = [
        'package.json',
        'client/public/index.html',
        'client/public/styles.css',
        'client/public/app.js',
        'server/dist/index.mjs',
        'server/dist/db/database.mjs',
        'server/dist/ai/agentRouter.mjs',
        'server/dist/ai/antigravityBridge.mjs',
        'server/dist/ws/realtime.mjs',
        'server/dist/mcp/mcpHandler.mjs'
      ];
      let updatedCount = 0;
      for (const relPath of filesToSync) {
        try {
          const content = await fetchText('https://raw.githubusercontent.com/ryu-dongsoo/kokiotalk/main/' + relPath + '?t=' + Date.now());
          if (content && content.length > 20) {
            const destPath = path.join(KOKIO_DIR, ...relPath.split('/'));
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.writeFileSync(destPath, content, 'utf-8');
            updatedCount++;
          }
        } catch {}
      }
      const newPkgRaw = fs.existsSync(path.join(KOKIO_DIR, 'package.json'))
        ? JSON.parse(fs.readFileSync(path.join(KOKIO_DIR, 'package.json'), 'utf-8'))
        : {};
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: true,
        updatedFiles: updatedCount,
        version: newPkgRaw.version || '2.0.0'
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // 0.5 내 폰 연결용 QR코드 & 외부 접속 주소 안내 대시보드 (로컬 PC에서 실행 시 즉시 확인 가능)
  if (req.method === 'GET' && url.pathname === '/qr') {
    const authForQr = getAuthStatus(req);
    if (!authForQr.authenticated) {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }
    const cfg = loadKokioConfig();
    const portalUrl = cfg?.network?.portalUrl || '';
    const liveTunnel = getTunnelUrl() || `http://${getLocalIp()}:${PORT}`;
    const primaryUrl = portalUrl || liveTunnel;
    const isLocalView = authForQr.mode === 'local';
    const pinDisplay = isLocalView ? (cfg?.security?.accessPin || ACCESS_PIN) : '•••••• (보안 숨김)';
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(primaryUrl)}`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KokioTalk · Mobile QR Connection Guide</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: #0D1117;
      color: #E6EDF3;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Pretendard", "Segoe UI", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      max-width: 500px;
      width: 100%;
      background: #161B22;
      border: 1px solid #30363D;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      text-align: center;
    }
    .top-bar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
    .lang-select {
      background: #0D1117;
      color: #E6EDF3;
      border: 1px solid #30363D;
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    h1 { color: #E6EDF3; font-size: 18px; margin-bottom: 6px; }
    .sub { color: #8B949E; font-size: 12.5px; margin-bottom: 18px; line-height: 1.5; }
    .qr-box {
      background: #FFFFFF;
      padding: 12px;
      border-radius: 12px;
      display: inline-block;
      margin-bottom: 16px;
      box-shadow: 0 8px 25px rgba(0,0,0,0.35);
    }
    .qr-box img { width: 200px; height: 200px; display: block; }
    .info-row {
      background: #0D1117;
      border: 1px solid #21262D;
      border-radius: 8px;
      padding: 11px 13px;
      margin-bottom: 8px;
      text-align: left;
      font-size: 12.5px;
    }
    .info-label { color: #8B949E; font-size: 11px; margin-bottom: 3px; }
    .info-val { color: #58A6FF; font-weight: 600; word-break: break-all; font-size: 13px; }
    .pin-badge {
      display: inline-block;
      background: rgba(59, 130, 246, 0.14);
      color: #58A6FF;
      border: 1px solid rgba(59, 130, 246, 0.35);
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    .btn-row { display: flex; gap: 8px; margin-top: 16px; }
    .btn {
      flex: 1;
      padding: 11px;
      border-radius: 8px;
      border: 1px solid transparent;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .btn-primary { background: #2563EB; color: #FFFFFF; }
    .btn-secondary { background: #21262D; color: #E6EDF3; border-color: #30363D; }
  </style>
</head>
<body>
  <div class="card">
    <div class="top-bar">
      <select id="qr-lang-select" class="lang-select">
        <option value="en">EN · English</option>
        <option value="ko">KO · 한국어</option>
        <option value="ja">JA · 日本語</option>
        <option value="zh">ZH · 中文</option>
      </select>
    </div>
    <h1 id="qr-title">KokioTalk · Mobile Connection</h1>
    <p id="qr-sub" class="sub">Scan this QR code with your smartphone camera to connect from anywhere.</p>
    <div class="qr-box">
      <img src="${qrApiUrl}" alt="Mobile Connection QR Code" />
    </div>
    <div class="info-row">
      <div id="lbl-primary" class="info-label">Primary External Access URL (Click to copy)</div>
      <div class="info-val" style="cursor:pointer;" onclick="navigator.clipboard.writeText('${primaryUrl}');alert('Copied!');">${primaryUrl}</div>
    </div>
    <div class="info-row">
      <div id="lbl-tunnel" class="info-label">Live Direct Tunnel URL</div>
      <div class="info-val" style="color:#34D399;">${liveTunnel}</div>
    </div>
    <div class="info-row" style="display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div id="lbl-pin" class="info-label">6-Digit External Security PIN</div>
        <div id="lbl-pin-sub" style="font-size:11.5px;color:#8B949E;">Choose <b>[My Device]</b> on your phone, or <b>[Temp PC Access]</b> on shared PCs</div>
      </div>
      <span class="pin-badge">${pinDisplay}</span>
    </div>
    <div class="btn-row">
      <button id="btn-copy-url" class="btn btn-secondary" onclick="navigator.clipboard.writeText('${primaryUrl}');alert('Copied!');">Copy URL</button>
      <a id="btn-open-app" href="/" class="btn btn-primary">Open KokioTalk</a>
    </div>
  </div>
  <script>
    (function() {
      const T = {
        en: {
          title: 'KokioTalk · Mobile Connection',
          sub: 'Scan this QR code with your smartphone camera to connect from anywhere.',
          primary: 'Primary External Access URL (Click to copy)',
          tunnel: 'Live Direct Tunnel URL',
          pin: '6-Digit External Security PIN',
          pinSub: 'Choose <b>[My Device]</b> on your phone, or <b>[Temp PC Access]</b> on shared PCs',
          copy: 'Copy URL',
          open: 'Open KokioTalk'
        },
        ko: {
          title: '꼬끼오톡 · 모바일 QR 연결',
          sub: '스마트폰 카메라로 아래 QR코드를 스캔하면 어디서든 바로 접속됩니다.',
          primary: '대표 외부 접속 주소 (클릭 시 복사)',
          tunnel: '실시간 직통 터널 주소',
          pin: '외부 접속 6자리 보안 PIN 암호',
          pinSub: '내 폰에서는 <b>[내 폰 · 내 기기]</b>, 공용 PC에서는 <b>[임시 컴퓨터 접속]</b> 선택',
          copy: '주소 복사하기',
          open: '꼬끼오톡 열기'
        },
        ja: {
          title: 'KokioTalk · モバイル接続QR',
          sub: 'スマートフォンのカメラでQRコードを読み取るとどこからでも接続できます。',
          primary: '代表外部アクセスURL (クリックでコピー)',
          tunnel: 'リアルタイム直通トンネルURL',
          pin: '外部アクセス用 6桁セキュリティPIN',
          pinSub: '自分のスマホでは<b>[マイデバイス]</b>、共有PCでは<b>[一時PCアクセス]</b>を選択',
          copy: 'URLをコピー',
          open: 'KokioTalkを開く'
        },
        zh: {
          title: 'KokioTalk · 手机扫码连接',
          sub: '使用手机相机扫描下方二维码，即可随时随地连接。',
          primary: '外部访问主地址 (点击复制)',
          tunnel: '实时直连隧道地址',
          pin: '外部访问 6位安全 PIN 码',
          pinSub: '个人手机请选择<b>[我的设备]</b>，公共电脑请选择<b>[临时电脑访问]</b>',
          copy: '复制地址',
          open: '打开 KokioTalk'
        }
      };
      const sel = document.getElementById('qr-lang-select');
      let lang = localStorage.getItem('kokio_ui_lang') || 'en';
      if (!T[lang]) lang = 'en';
      function apply(l) {
        lang = T[l] ? l : 'en';
        try { localStorage.setItem('kokio_ui_lang', lang); } catch(e){}
        sel.value = lang;
        const d = T[lang];
        document.getElementById('qr-title').textContent = d.title;
        document.getElementById('qr-sub').textContent = d.sub;
        document.getElementById('lbl-primary').textContent = d.primary;
        document.getElementById('lbl-tunnel').textContent = d.tunnel;
        document.getElementById('lbl-pin').textContent = d.pin;
        document.getElementById('lbl-pin-sub').innerHTML = d.pinSub;
        document.getElementById('btn-copy-url').textContent = d.copy;
        document.getElementById('btn-open-app').textContent = d.open;
      }
      sel.addEventListener('change', () => apply(sel.value));
      apply(lang);
    })();
  </script>
</body>
</html>`);
    return;
  }

  // 0.6 Graphical First-Run Setup Wizard (/setup & POST /api/setup) for Windows (.exe) & macOS (.dmg)
  if (url.pathname === '/setup' && req.method === 'GET') {
    const authForSetup = getAuthStatus(req);
    if (!authForSetup.authenticated) {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }
    const cfg = loadKokioConfig();
    const curLang = cfg?.owner?.language || 'en';
    const curName = cfg?.owner?.name || 'Alex';
    const curHonorific = cfg?.owner?.honorific || 'Alex';
    const curAgent = cfg?.assistant?.shortName || 'Kokio AI';
    const curAvatar = cfg?.assistant?.avatar || 'AI';
    const curPin = cfg?.security?.accessPin || '123456';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KokioTalk · Setup Wizard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: #0D1117;
      color: #E6EDF3;
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Pretendard", "Segoe UI", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      max-width: 520px;
      width: 100%;
      background: #161B22;
      border: 1px solid #30363D;
      border-radius: 14px;
      padding: 24px 26px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.55);
    }
    .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .badge { background: rgba(59, 130, 246, 0.14); color: #58A6FF; border: 1px solid rgba(59, 130, 246, 0.35); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    select, input {
      width: 100%;
      background: #0D1117;
      color: #E6EDF3;
      border: 1px solid #30363D;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13.5px;
      margin-top: 5px;
      outline: none;
    }
    input:focus, select:focus { border-color: #3B82F6; }
    .lang-sel { width: auto; padding: 5px 9px; font-size: 12px; margin-top: 0; }
    h1 { color: #E6EDF3; font-size: 19px; margin-bottom: 6px; font-weight: 700; }
    .sub { color: #8B949E; font-size: 12.5px; margin-bottom: 18px; line-height: 1.45; }
    .field { margin-bottom: 13px; }
    label { display: block; font-size: 12px; font-weight: 600; color: #C9D1D9; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btn-row { display: flex; gap: 8px; margin-top: 18px; }
    .btn {
      flex: 1; padding: 11px; border-radius: 8px; border: 1px solid transparent; font-weight: 600; font-size: 13px; cursor: pointer;
    }
    .btn-primary { background: #2563EB; color: #FFFFFF; }
    .btn-secondary { background: #21262D; color: #E6EDF3; border-color: #30363D; text-decoration: none; text-align: center; }
    .msg { margin-top: 12px; font-size: 12.5px; font-weight: 600; color: #34D399; text-align: center; min-height: 18px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="top-bar">
      <span class="badge">KokioTalk · Antigravity 2.0</span>
      <select id="wiz-lang" class="lang-sel">
        <option value="en">EN · English</option>
        <option value="ko">KO · 한국어</option>
        <option value="ja">JA · 日本語</option>
        <option value="zh">ZH · 中文</option>
      </select>
    </div>
    <h1 id="t-title">Personal AI Agent Setup Wizard</h1>
    <p id="t-sub" class="sub">Configure your AI agent profile and 6-digit external security PIN in one click.</p>
    <form id="wiz-form">
      <div class="grid2">
        <div class="field">
          <label id="l-name">Your Name</label>
          <input type="text" id="f-name" value="${curName}" required />
        </div>
        <div class="field">
          <label id="l-hon">Preferred Title / Honorific</label>
          <input type="text" id="f-hon" value="${curHonorific}" required />
        </div>
      </div>
      <div class="grid2">
        <div class="field">
          <label id="l-agent">AI Agent Name</label>
          <input type="text" id="f-agent" value="${curAgent}" required />
        </div>
        <div class="field">
          <label id="l-avatar">AI Badge Label</label>
          <input type="text" id="f-avatar" value="AI" required />
        </div>
      </div>
      <div class="field">
        <label id="l-pin">6-Digit External Security PIN (Digits 0-9)</label>
        <input type="text" id="f-pin" pattern="\\d{6}" maxlength="6" value="${curPin}" required />
      </div>
      <div class="btn-row">
        <a href="/" id="b-skip" class="btn btn-secondary">Open Messenger</a>
        <button type="submit" id="b-save" class="btn btn-primary">Save & Connect Mobile QR</button>
      </div>
      <div id="wiz-msg" class="msg"></div>
    </form>
  </div>
  <script>
    (function() {
      const L = {
        en: {
          title: 'Personal AI Agent Setup Wizard',
          sub: 'Configure your AI agent profile and 6-digit external security PIN in one click.',
          name: 'Your Name', hon: 'Preferred Title / Honorific',
          agent: 'AI Agent Name', avatar: 'AI Badge Label',
          pin: '6-Digit External Security PIN (Digits 0-9)',
          skip: 'Open Messenger', save: 'Save & Connect Mobile QR',
          saved: 'Saved! Redirecting to Mobile QR Connection...'
        },
        ko: {
          title: 'AI 에이전트 초기 설정 마법사',
          sub: 'AI 에이전트 프로필과 외부 접속 6자리 보안 PIN 암호를 한 번에 설정합니다.',
          name: '사용자 이름', hon: '선호하는 호칭',
          agent: 'AI 에이전트 이름', avatar: 'AI 배지 약칭',
          pin: '외부 접속 6자리 보안 PIN 암호 (숫자 6자리)',
          skip: '메신저 바로 열기', save: '저장 후 모바일 QR 연결하기',
          saved: '저장 완료! 모바일 QR 연결 화면으로 이동합니다...'
        },
        ja: {
          title: 'パーソナルAIエージェント 初期設定',
          sub: 'AIエージェントのプロフィールと外部接続用6桁セキュリティPINを設定します。',
          name: 'あなたの名前', hon: '敬称',
          agent: 'AIエージェント名', avatar: 'AIバッジ名',
          pin: '外部アクセス用 6桁セキュリティPIN (数字6桁)',
          skip: 'メッセンジャーを開く', save: '保存してモバイルQRへ',
          saved: '保存しました！モバイルQR画面へ移動します...'
        },
        zh: {
          title: '个人 AI 代理 初始设置向导',
          sub: '一键配置您的 AI 代理资料与 6 位外部访问安全 PIN 码。',
          name: '您的姓名', hon: '称呼',
          agent: 'AI 代理名称', avatar: 'AI 徽章简称',
          pin: '外部访问 6 位安全 PIN 码 (6位数字)',
          skip: '打开聊天窗口', save: '保存并打开手机扫码连接',
          saved: '保存成功！正在跳转至手机二维码连接页面...'
        }
      };
      const sel = document.getElementById('wiz-lang');
      let lang = localStorage.getItem('kokio_ui_lang') || '${curLang}' || 'en';
      if (!L[lang]) lang = 'en';
      function apply(l) {
        lang = L[l] ? l : 'en';
        try { localStorage.setItem('kokio_ui_lang', lang); } catch(e){}
        sel.value = lang;
        const d = L[lang];
        document.getElementById('t-title').textContent = d.title;
        document.getElementById('t-sub').textContent = d.sub;
        document.getElementById('l-name').textContent = d.name;
        document.getElementById('l-hon').textContent = d.hon;
        document.getElementById('l-agent').textContent = d.agent;
        document.getElementById('l-avatar').textContent = d.avatar;
        document.getElementById('l-pin').textContent = d.pin;
        document.getElementById('b-skip').textContent = d.skip;
        document.getElementById('b-save').textContent = d.save;
      }
      sel.addEventListener('change', () => apply(sel.value));
      apply(lang);

      document.getElementById('wiz-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const pin = document.getElementById('f-pin').value.trim();
        if (!/^\\d{6}$/.test(pin)) { alert('Please enter a 6-digit numeric PIN (0-9).'); return; }
        const payload = {
          language: lang,
          ownerName: document.getElementById('f-name').value.trim(),
          honorific: document.getElementById('f-hon').value.trim(),
          agentName: document.getElementById('f-agent').value.trim(),
          avatar: document.getElementById('f-avatar').value.trim() || 'AI',
          accessPin: pin
        };
        const res = await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data && data.ok) {
          document.getElementById('wiz-msg').textContent = L[lang].saved;
          setTimeout(() => { window.location.href = '/qr'; }, 800);
        }
      });
    })();
  </script>
</body>
</html>`);
    return;
  }

  if (url.pathname === '/api/setup' && req.method === 'POST') {
    const authForSetup = getAuthStatus(req);
    if (!authForSetup.authenticated) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const d = JSON.parse(body || '{}');
        const pin = /^\d{6}$/.test(String(d.accessPin || '').trim()) ? String(d.accessPin).trim() : '123456';
        const cfg = loadKokioConfig();
        cfg.owner = {
          name: d.ownerName || 'Alex',
          honorific: d.honorific || d.ownerName || 'Alex',
          affiliation: cfg?.owner?.affiliation || '',
          language: d.language || 'en'
        };
        cfg.assistant = {
          id: 'ai-assistant',
          name: `${d.agentName || 'Kokio AI'}`,
          shortName: d.agentName || 'Kokio AI',
          avatar: d.avatar || 'AI',
          statusMessage: `${d.honorific || 'User'}'s Personal AI Agent · Antigravity 2.0+`
        };
        cfg.security = {
          accessPin: pin,
          tempSessionTimeoutSec: 18,
          setupCompleted: true
        };
        const targets = [
          path.join(DATA_DIR, 'kokio.config.json'),
          path.join(__dirname, 'kokio.config.json'),
          path.join(KOKIO_DIR, 'kokio.config.json')
        ];
        for (const t of targets) {
          try { fs.writeFileSync(t, JSON.stringify(cfg, null, 2), 'utf-8'); } catch {}
        }
        try {
          const { DatabaseSync } = require('node:sqlite');
          const dbFile = path.join(DATA_DIR, 'storage', 'kokiotalk.db');
          if (fs.existsSync(dbFile)) {
            const sdb = new DatabaseSync(dbFile);
            sdb.prepare("UPDATE users SET name = ?, status_message = ? WHERE id = 'ryu'").run(
              cfg.owner.name,
              `${cfg.owner.honorific} · Personal AI Workspace`
            );
            sdb.prepare("UPDATE users SET name = ?, avatar = ?, status_message = ? WHERE id = 'kokio'").run(
              cfg.assistant.name,
              cfg.assistant.avatar,
              cfg.assistant.statusMessage
            );
            sdb.prepare("UPDATE rooms SET name = ? WHERE id = 'room-self'").run(`${cfg.owner.name} (My Memo & Vault)`);
            sdb.prepare("UPDATE rooms SET name = ?, avatar = ? WHERE id = 'room-kokio'").run(cfg.assistant.name, cfg.assistant.avatar);
            sdb.close();
          }
        } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // 1. 보안 인증 API (/api/auth/login, /api/auth/logout, /api/auth/tab-close, /api/auth/ping, /api/auth/check)
  if (url.pathname.startsWith('/api/auth/')) {
    if (req.method === 'GET' && url.pathname === '/api/auth/check') {
      const auth = getAuthStatus(req);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, authenticated: auth.authenticated, mode: auth.mode }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = {};
      try { data = body ? JSON.parse(body) : {}; } catch {}

      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        const pin = String(data.pin || '').trim();
        const mode = data.mode === 'persistent' ? 'persistent' : 'temp';

        if (pin !== getActivePin()) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid 6-digit security PIN.' }));
          return;
        }

        if (mode === 'persistent') {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Set-Cookie': [
              `kokio_auth=${PERSISTENT_TOKEN}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`,
              `kokio_auth_mode=persistent; Path=/; Max-Age=31536000; SameSite=Lax`,
              `kokio_locked=; Path=/; Max-Age=0; SameSite=Lax`
            ]
          });
          res.end(JSON.stringify({ ok: true, mode: 'persistent' }));
          return;
        } else {
          const tempToken = 'temp_' + crypto.randomBytes(24).toString('hex');
          tempSessions.set(tempToken, { createdAt: Date.now(), lastSeenAt: Date.now(), closingTimer: null });
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Set-Cookie': [
              `kokio_auth=${tempToken}; Path=/; HttpOnly; SameSite=Lax`,
              `kokio_auth_mode=temp; Path=/; SameSite=Lax`,
              `kokio_locked=; Path=/; Max-Age=0; SameSite=Lax`
            ]
          });
          res.end(JSON.stringify({ ok: true, mode: 'temp', tempToken }));
          return;
        }
      }

      if (url.pathname === '/api/auth/ping') {
        const cookies = parseCookies(req);
        const token = req.headers['x-kokio-temp-token'] || data.tempToken || cookies.kokio_auth || '';
        const sess = tempSessions.get(token);
        if (sess) {
          if (sess.closingTimer) {
            clearTimeout(sess.closingTimer);
            sess.closingTimer = null;
          }
          sess.lastSeenAt = Date.now();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ ok: true, mode: 'temp' }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ ok: false, expired: true }));
        }
        return;
      }

      if (url.pathname === '/api/auth/tab-close') {
        const cookies = parseCookies(req);
        const token = data.tempToken || cookies.kokio_auth || '';
        const sess = tempSessions.get(token);
        if (sess) {
          // 2.5초 내 동일 탭 새로고침(F5)이 없으면 창 닫기로 판단하여 서버 메모리의 임시 세션을 완전 파기
          if (sess.closingTimer) clearTimeout(sess.closingTimer);
          sess.closingTimer = setTimeout(() => {
            tempSessions.delete(token);
          }, 2500);
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (url.pathname === '/api/auth/logout') {
        const cookies = parseCookies(req);
        if (cookies.kokio_auth && cookies.kokio_auth.startsWith('temp_')) {
          const s = tempSessions.get(cookies.kokio_auth);
          if (s && s.closingTimer) clearTimeout(s.closingTimer);
          tempSessions.delete(cookies.kokio_auth);
        }
        if (data.tempToken) {
          tempSessions.delete(data.tempToken);
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': [
            `kokio_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
            `kokio_auth_mode=; Path=/; Max-Age=0; SameSite=Lax`,
            `kokio_locked=1; Path=/; SameSite=Lax`
          ]
        });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Not Found' }));
    });
    return;
  }

  const staticMap = {
    '/manifest.json': 'application/manifest+json; charset=utf-8',
    '/manifest-dark.json': 'application/manifest+json; charset=utf-8',
    '/sw.js': 'application/javascript; charset=utf-8',
    '/logo.png': 'image/png',
    '/logo.jpg': 'image/jpeg',
    '/icon-180.png': 'image/png',
    '/icon-192.png': 'image/png',
    '/icon-512.png': 'image/png',
    '/apple-touch-icon.png': 'image/png',
    '/apple-touch-icon-precomposed.png': 'image/png',
    '/favicon.ico': 'image/png'
  };

  if (req.method === 'GET' && staticMap[url.pathname]) {
    const fileName = url.pathname === '/apple-touch-icon-precomposed.png'
      ? 'apple-touch-icon.png'
      : (url.pathname === '/manifest-dark.json' ? 'manifest.json' : url.pathname.slice(1));
    const filePath = path.join(__dirname, 'public', fileName);
    if (fs.existsSync(filePath)) {
      res.writeHead(200, {
        'Content-Type': staticMap[url.pathname],
        'Cache-Control': 'no-cache'
      });
      res.end(fs.readFileSync(filePath));
      return;
    }
  }

  // 2. 보안 게이트 검증: 로컬 PC가 아닌 외부 접속이거나 잠금 상태일 때 PIN(000000) 인증 강제
  //    (단, 파트너님 비서 Peer AI의 원격 브릿지 패킷은 허용)
  const auth = getAuthStatus(req);
  const isEaBridgeAllowedRoute =
    (req.method === 'POST' && (url.pathname === '/api/peer/register' || url.pathname === '/api/chat')) ||
    (req.method === 'GET' && url.pathname === '/api/status' && url.searchParams.has('convId') && !String(req.headers.accept || '').includes('text/html'));

  if (!auth.authenticated && !isEaBridgeAllowedRoute) {
    if (
      req.method === 'GET' &&
      (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/classic' || url.pathname.startsWith('/kokio'))
    ) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      });
      res.end(renderLockScreenHtml());
      return;
    }
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, error: '🔒 보안 잠금 상태입니다. PIN 암호를 먼저 입력해 주세요.' }));
    return;
  }

  if (url.pathname === '/kokio' || url.pathname === '/kokiotalk') {
    res.writeHead(302, { Location: '/kokio/' + (url.search || ''), 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  if (url.pathname.startsWith('/kokio/') || url.pathname.startsWith('/kokiotalk/')) {
    const stripped = url.pathname.replace(/^\/kokio(?:talk)?/, '') || '/';
    proxyToKokioTalk(req, res, stripped + (url.search || ''));
    return;
  }

  if (
    url.pathname === '/styles.css' ||
    url.pathname === '/app.js' ||
    url.pathname.startsWith('/api/v1/') ||
    url.pathname === '/api/mcp' ||
    url.pathname === '/api/bootstrap' ||
    url.pathname === '/api/events' ||
    url.pathname === '/api/drawer' ||
    url.pathname === '/api/search' ||
    url.pathname === '/api/translate' ||
    url.pathname.startsWith('/api/calendar') ||
    url.pathname.startsWith('/api/rooms') ||
    url.pathname.startsWith('/api/users') ||
    url.pathname.startsWith('/api/messages') ||
    url.pathname.startsWith('/api/vault')
  ) {
    proxyToKokioTalk(req, res, url.pathname + (url.search || ''));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/office') {
    const officeFile = path.join(__dirname, 'office_tunnel_url.txt');
    if (fs.existsSync(officeFile)) {
      const officeUrl = fs.readFileSync(officeFile, 'utf-8').trim();
      if (officeUrl.startsWith('http')) {
        res.writeHead(302, { Location: officeUrl, 'Cache-Control': 'no-store' });
        res.end();
        return;
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#14100d;color:#fefcf9;font-family:sans-serif;padding:24px;text-align:center;"><h3>🥛 아직 사무실 PC 터널(start_office_kokio.bat)이 실행되지 않았어요!</h3><p><a href="/" style="color:#f59e0b;">👉 집 메인 PC Kokio AI로 돌아가기</a></p></body></html>');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/classic') {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(htmlPath, 'utf-8'));
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    proxyToKokioTalk(req, res, '/' + (url.search || ''));
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/uploads/')) {
    const safeName = path.basename(decodeURIComponent(url.pathname.slice('/uploads/'.length)));
    const targetPath = path.join(UPLOADS_DIR, safeName);
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      const ext = path.extname(safeName).toLowerCase();
      const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/plain; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.csv': 'text/csv; charset=utf-8'
      };
      res.writeHead(200, {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400'
      });
      res.end(fs.readFileSync(targetPath));
      return;
    }
    proxyToKokioTalk(req, res, url.pathname + (url.search || ''));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/rn-kakao/status') {
    const st = rnKakaoBridge.loadState();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      ok: true,
      hasToken: Boolean(st.accessToken),
      profile: st.profile || null,
      restApiKey: st.restApiKey,
      javascriptKey: st.javascriptKey
    }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/rn-kakao/callback') {
    const code = url.searchParams.get('code');
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h3>카카오 인가 코드(code)가 없습니다.</h3>');
      return;
    }
    try {
      const base = getTunnelUrl() || `http://localhost:${PORT}`;
      const nextSt = await rnKakaoBridge.issueAccessTokenWithCode({
        code,
        redirectUri: `${base}/api/rn-kakao/callback`
      });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#14100d;color:#fef3c7;font-family:sans-serif;padding:30px;text-align:center;"><h2>✅ react-native-kakao 연동 완료!</h2><p>${nextSt.profile?.nickname || '사용자'}님의 카카오 토큰이 발급되었습니다.</p><p><a href="/" style="color:#fde047;">👉 Kokio AI로 돌아가기</a></p></body></html>`);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h3>토큰 발급 실패: ${err.message}</h3>`);
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/alarms') {
    const allAlarms = loadAlarms();
    const pendingAlarms = allAlarms.filter(a => a.status === 'pending');
    const firedAlarms = allAlarms.filter(a => a.status === 'fired');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      ok: true,
      alarms: allAlarms.filter(a => a.status !== 'dismissed').slice(0, 30),
      pendingCount: pendingAlarms.length,
      firedAlarms
    }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/remote/frame') {
    try {
      const frame = await sendPsCommand({ type: 'frame' });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(frame));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/conversations') {
    const state = loadSessions();
    const list = listAllConversations();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      ok: true,
      activeConversationId: state.activeConversationId,
      conversations: list
    }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    const state = loadSessions();
    const convId = url.searchParams.get('convId') || state.activeConversationId || null;
    const model = state.activeModel || 'argon';
    const level = state.activeLevel || 'medium';
    const transcript = readTranscriptMessages(convId);
    const allAlarms = loadAlarms();
    const pendingAlarms = allAlarms.filter(a => a.status === 'pending');
    const firedAlarms = allAlarms.filter(a => a.status === 'fired');

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      ok: true,
      activeModel: model,
      modelInfo: MODEL_MAP[model] || MODEL_MAP.argon,
      activeLevel: level,
      performanceInfo: PERFORMANCE_MAP[level] || PERFORMANCE_MAP.medium,
      conversationId: convId,
      localIp: getLocalIp(),
      tunnelUrl: getTunnelUrl(),
      port: PORT,
      peerName: state.peerName || 'Peer AI',
      peerUrl: state.peerUrl || '',
      peerConvId: state.peerConvId || null,
      pendingAlarmsCount: pendingAlarms.length,
      firedAlarms,
      ...transcript
    }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/peer/config') {
    const state = loadSessions();
    let peerOnline = false;
    if (state.peerUrl && url.searchParams.get('check') === '1') {
      try {
        const peerInfo = await requestPeerJson(state.peerUrl, '/api/status', 'GET', null, 3500);
        peerOnline = Boolean(peerInfo && peerInfo.ok);
      } catch (e) {
        peerOnline = false;
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      ok: true,
      myName: MY_AGENT_NAME,
      myUrl: getTunnelUrl(),
      peerName: state.peerName || 'Peer AI',
      peerUrl: state.peerUrl || '',
      peerConvId: state.peerConvId || null,
      peerOnline
    }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/peer/status') {
    const state = loadSessions();
    if (!state.peerUrl) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Peer AI 주소가 아직 연결되지 않았습니다.' }));
      return;
    }
    try {
      const targetConvId = url.searchParams.get('convId') || state.peerConvId || '';
      const q = targetConvId ? `?convId=${encodeURIComponent(targetConvId)}` : '';
      const peerData = await requestPeerJson(state.peerUrl, `/api/status${q}`, 'GET', null, 5000);
      if (peerData && peerData.conversationId && !state.peerConvId) {
        state.peerConvId = peerData.conversationId;
        saveSessions(state);
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({
        ...peerData,
        peerName: state.peerName || 'Peer AI',
        peerUrl: state.peerUrl
      }));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Peer AI 서버에 연결할 수 없습니다: ' + err.message }));
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/peer/remote/frame') {
    const state = loadSessions();
    try {
      const frame = await requestPeerJson(state.peerUrl, '/api/remote/frame', 'GET', null, 5000);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(frame));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = body ? JSON.parse(body) : {};

        if (url.pathname === '/api/rn-kakao/send-me') {
          const out = await rnKakaoBridge.sendTextTemplateToMe({
            text: data.text || '',
            webUrl: data.webUrl || getTunnelUrl() || `http://localhost:${PORT}`,
            buttonTitle: data.buttonTitle || '앱 열기'
          });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, result: out }));
          return;
        }

        if (url.pathname === '/api/rn-kakao/send-friends') {
          const out = await rnKakaoBridge.sendTextTemplateToFriends({
            receiverUuids: data.receiverUuids || [],
            text: data.text || '',
            webUrl: data.webUrl || getTunnelUrl() || `http://localhost:${PORT}`,
            buttonTitle: data.buttonTitle || '확인하기'
          });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, result: out }));
          return;
        }

        if (url.pathname === '/api/rn-kakao/send-pc') {
          const out = rnKakaoBridge.sendToPcKakaoWindow({
            roomTitle: data.roomTitle || '',
            text: data.text || ''
          });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(out));
          return;
        }

        if (url.pathname === '/api/alarms/add') {
          const title = (data.title || '일정 알림').trim();
          let triggerAt = data.triggerAt ? Number(data.triggerAt) : null;

          if (!triggerAt && data.delayMinutes) {
            triggerAt = Date.now() + Number(data.delayMinutes) * 60000;
          } else if (!triggerAt && data.delaySeconds) {
            triggerAt = Date.now() + Number(data.delaySeconds) * 1000;
          } else if (!triggerAt && data.timeStr) {
            const [hh, mm] = String(data.timeStr).split(':').map(Number);
            if (!isNaN(hh) && !isNaN(mm)) {
              const t = new Date();
              t.setHours(hh, mm, 0, 0);
              if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
              triggerAt = t.getTime();
            }
          }

          if (!triggerAt || isNaN(triggerAt)) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: '올바른 알림 시간을 지정해 주세요.' }));
            return;
          }

          const alarm = createAlarm({
            title,
            triggerAt,
            repeatDaily: Boolean(data.repeatDaily),
            source: data.source || 'modal'
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, alarm }));
          return;
        }

        if (url.pathname === '/api/alarms/dismiss') {
          const alarms = loadAlarms();
          const targetId = data.id;
          const snoozeMin = Number(data.snoozeMinutes) || 0;

          for (const a of alarms) {
            if (!targetId || a.id === targetId) {
              if (a.status === 'fired') {
                if (snoozeMin > 0) {
                  a.status = 'pending';
                  a.triggerAt = Date.now() + snoozeMin * 60000;
                  a.timeLabel = formatAlarmTimeLabel(a.triggerAt);
                  a.firedAt = null;
                } else {
                  a.status = 'dismissed';
                }
              }
            }
          }
          saveAlarms(alarms);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (url.pathname === '/api/alarms/delete') {
          let alarms = loadAlarms();
          if (data.id) {
            alarms = alarms.filter(a => a.id !== data.id);
          } else if (data.clearAll) {
            alarms = [];
          }
          saveAlarms(alarms);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (url.pathname === '/api/upload') {
          const rawName = String(data.fileName || 'upload.bin').replace(/[^a-zA-Z0-9가-힣._\-]/g, '_');
          const b64 = String(data.base64Data || '').replace(/^data:[^;]+;base64,/, '');
          if (!b64) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: '파일 데이터가 비어 있습니다.' }));
            return;
          }

          const tsPrefix = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          let savedName = `${tsPrefix}_${rawName}`;
          let absPath = path.join(UPLOADS_DIR, savedName);
          const buf = Buffer.from(b64, 'base64');
          fs.writeFileSync(absPath, buf);

          if (/\.(heic|heif)$/i.test(rawName)) {
            try {
              const { execFileSync } = require('child_process');
              const jpgPath = `${absPath}.jpg`;
              execFileSync('python', [
                '-c',
                'import sys; from pillow_heif import register_heif_opener; register_heif_opener(); from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], "JPEG", quality=90)',
                absPath,
                jpgPath
              ], { timeout: 10000 });
              if (fs.existsSync(jpgPath)) {
                savedName = `${savedName}.jpg`;
                absPath = jpgPath;
              }
            } catch (e) {}
          }

          const isImage = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(rawName) || String(data.mimeType || '').startsWith('image/');
          const fileUrl = `/uploads/${encodeURIComponent(savedName)}`;

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            ok: true,
            fileName: rawName,
            savedName,
            fileUrl,
            absolutePath: absPath,
            size: buf.length,
            isImage,
            attachment: {
              id: 'att-' + Date.now(),
              fileName: rawName,
              fileSize: buf.length,
              mimeType: data.mimeType || (isImage ? 'image/png' : 'application/octet-stream'),
              url: fileUrl,
              localPath: absPath,
              createdAt: Date.now()
            }
          }));
          return;
        }

        if (url.pathname === '/api/peer/register') {
          const state = loadSessions();
          if (data.peerUrl !== undefined) {
            state.peerUrl = normalizePeerUrl(data.peerUrl);
          }
          if (data.peerName) {
            state.peerName = String(data.peerName).trim();
          }
          if (data.resetConv) {
            state.peerConvId = null;
          }
          saveSessions(state);

          let syncedBack = false;
          if (data.autoSync !== false && state.peerUrl && getTunnelUrl()) {
            try {
              await requestPeerJson(state.peerUrl, '/api/peer/register', 'POST', {
                peerUrl: getTunnelUrl(),
                peerName: MY_AGENT_NAME,
                autoSync: false
              }, 4000);
              syncedBack = true;
            } catch (e) {}
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            ok: true,
            peerName: state.peerName,
            peerUrl: state.peerUrl,
            syncedBack
          }));
          return;
        }

        if (url.pathname === '/api/peer/chat') {
          const state = loadSessions();
          if (!state.peerUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'Peer AI 주소가 아직 등록되지 않았습니다.' }));
            return;
          }
          const rawMsg = (data.message || '').trim();
          if (!rawMsg) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: '전달할 메시지를 입력해 주세요.' }));
            return;
          }

          const senderTag = data.fromAgent || '사용자님(파트너님의 아버님) & 비서 Kokio AI';
          const relayedPrompt = `[🔗 발신자: ${senderTag}의 원격 연동 요청]\n${rawMsg}`;
          const peerRes = await requestPeerJson(state.peerUrl, '/api/chat', 'POST', {
            message: relayedPrompt,
            model: data.model || state.activeModel || 'argon',
            level: data.level || state.activeLevel || 'medium',
            conversationId: data.newSession ? null : (state.peerConvId || undefined),
            newSession: Boolean(data.newSession)
          }, 15000);

          if (peerRes && peerRes.conversationId) {
            state.peerConvId = peerRes.conversationId;
            saveSessions(state);
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            ok: true,
            peerName: state.peerName || 'Peer AI',
            peerConvId: state.peerConvId,
            peerRes
          }));
          return;
        }

        if (url.pathname === '/api/peer/ask') {
          const state = loadSessions();
          if (!state.peerUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'Peer AI 서버 주소가 아직 설정되지 않았습니다.' }));
            return;
          }
          const rawMsg = (data.message || '').trim();
          if (!rawMsg) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: '전달할 메시지가 비어 있습니다.' }));
            return;
          }

          const sendRes = await requestPeerJson(state.peerUrl, '/api/chat', 'POST', {
            message: `[🔗 발신자: 사용자님(파트너님의 아버님)의 비서 Kokio AI가 Peer AI에게 전달하는 요청]\n${rawMsg}`,
            model: data.model || state.activeModel || 'argon',
            level: data.level || state.activeLevel || 'medium',
            conversationId: state.peerConvId || undefined
          }, 15000);

          const convId = sendRes?.conversationId || state.peerConvId;
          if (convId) {
            state.peerConvId = convId;
            saveSessions(state);
          }

          const maxWaitMs = Number(data.timeoutMs) || 75000;
          const startMs = Date.now();
          let finalReply = '';
          let lastTools = [];

          while (Date.now() - startMs < maxWaitMs) {
            await new Promise(r => setTimeout(r, 1800));
            try {
              const q = convId ? `?convId=${encodeURIComponent(convId)}` : '';
              const st = await requestPeerJson(state.peerUrl, `/api/status${q}`, 'GET', null, 5000);
              const msgs = st?.messages || [];
              const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
              if (lastMsg && (lastMsg.role === 'ea' || lastMsg.role === 'kokio')) {
                if (lastMsg.text) finalReply = lastMsg.text;
                if (lastMsg.tools) lastTools = lastMsg.tools;
                if (!st.isThinking && finalReply) break;
              }
            } catch (e) {}
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            ok: true,
            peerName: state.peerName || 'Peer AI',
            conversationId: convId,
            reply: finalReply || '(외부 AI가 아직 작업을 수행 중입니다.)',
            tools: lastTools
          }));
          return;
        }

        if (url.pathname === '/api/peer/remote/mouse') {
          const state = loadSessions();
          const out = await requestPeerJson(state.peerUrl, '/api/remote/mouse', 'POST', data, 5000);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(out));
          return;
        }

        if (url.pathname === '/api/peer/remote/key') {
          const state = loadSessions();
          const out = await requestPeerJson(state.peerUrl, '/api/remote/key', 'POST', data, 5000);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(out));
          return;
        }

        if (url.pathname === '/api/chat') {
          const message = (data.message || '').trim();
          const attachments = Array.isArray(data.attachments) ? data.attachments : [];
          const model = data.model || 'argon';
          const level = data.level || 'medium';
          const forceNew = Boolean(data.newSession);

          const isIncomingPeerMsg = message.startsWith('[🔗');
          if (!auth.authenticated && !isIncomingPeerMsg) {
            res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: '🔒 보안 잠금 상태입니다. PIN 암호를 먼저 입력해 주세요.' }));
            return;
          }

          if (!message && attachments.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: '메시지나 첨부파일을 입력해 주세요.' }));
            return;
          }

          const state = loadSessions();
          state.activeModel = model;
          state.activeLevel = level;
          const modelObj = MODEL_MAP[model] || MODEL_MAP.argon;
          const perfObj = PERFORMANCE_MAP[level] || PERFORMANCE_MAP.medium;
          let convId = data.conversationId !== undefined ? data.conversationId : state.activeConversationId;

          const callEaPath = path.join(__dirname, 'call-ea.js');

          let autoAlarm = null;
          let alarmHint = '';
          if (!isIncomingPeerMsg && message) {
            const parsedAlarm = parseNaturalAlarm(message);
            if (parsedAlarm) {
              autoAlarm = createAlarm({
                title: parsedAlarm.title,
                triggerAt: parsedAlarm.triggerAt,
                repeatDaily: parsedAlarm.repeatDaily,
                source: 'chat'
              });
              alarmHint = `\n[⏰ 서버 자동 알림 예약 완료: "${autoAlarm.title}" 일정 알림이 "${autoAlarm.timeLabel}"에 울리도록 Kokio AI 모바일/PC 알림 타이머에 자동 등록되었습니다! 별도 타이머 도구를 실행할 필요 없이 사용자님께 "${autoAlarm.timeLabel}에 '${autoAlarm.title}' 알림을 맞춰두었어요! 🥛"라고 다정하게 안내해 주세요.]`;
            }
          }

          let attachmentBlock = '';
          if (attachments.length > 0) {
            const tags = attachments.map(a => `[📎 첨부파일: ${a.fileName} | URL: ${a.fileUrl} | PC경로: ${a.absolutePath}]`).join('\n');
            const pathsList = attachments.map(a => `"${a.absolutePath}"`).join(', ');
            attachmentBlock = `\n${tags}\n[📎 Kokio AI 안내: 사용자님이 모바일에서 사진/파일을 첨부하셨습니다! 반드시 view_file 도구로 다음 PC 경로의 파일을 직접 열어서 확인하고 답변해 주세요: ${pathsList}]`;
          }

          const peerHint = isIncomingPeerMsg
            ? `\n[⚠️ 원격 연동 수신 모드 (화자 구분 필수): 이 메시지는 사용자님이 아니라 사용자님의 막내아드님이신 '파트너님(유도준 · 초6)'과 파트너님의 AI 비서 'Peer AI'가 보낸 원격 요청입니다! 절대 사용자님으로 착각하지 마시고 아드님인 '파트너님'과 'Peer AI'에게 다정하게 답변하거나 사용자님께 아드님 파트너님의 연락임을 구분해 보고하세요. 또한 무한 루프 방지를 위해 절대 call-ea.js를 다시 호출하지 마시고 텍스트로 바로 답변하세요!]`
            : (state.peerUrl
              ? `\n[🔗 Kokio AI↔Peer AI 연동 활성: 현재 말씀하시는 분은 AI 에이전트의 주인님이신 '사용자님(파트너님의 아버님)'입니다. 사용자님이 Peer AI(파트너님 AI 비서)에게 전달/호출을 요청하시면 터미널에서 'node "${callEaPath}" "전달할 메시지"'를 실행하여 Peer AI의 답변을 받아 브리핑하세요.]`
              : '');
          const speakerPrefix = isIncomingPeerMsg
            ? `[원격 수신 메시지 (발신자: 사용자님의 아드님 유도준(파트너님) & 비서 Peer AI)]: `
            : `사용자님의 요청: `;
          const userPromptText = message || '첨부한 사진/파일을 확인해서 자세히 알려줘!';
          const fullPrompt = `[모델: ${modelObj.name} | ${perfObj.promptHint}]${peerHint}${alarmHint}${attachmentBlock}\n${speakerPrefix}${userPromptText}`;

          if (!convId || forceNew) {
            const shortTitle = `[🥛Kokio AI] ${userPromptText.slice(0, 22)}`;
            const resp = await callAgentApiAsync([
              'new-conversation',
              `--model=${modelObj.apiTier}`,
              `--title=${shortTitle}`,
              fullPrompt
            ]);
            convId = resp?.response?.newConversation?.conversationId;
            if (convId) {
              state.activeConversationId = convId;
              state.customTitles[convId] = userPromptText.slice(0, 28);
              saveSessions(state);
            }
          } else {
            await callAgentApiAsync([
              'send-message',
              `--title=🥛 사용자님의 명령 (${modelObj.name} · ${level.toUpperCase()})`,
              convId,
              fullPrompt
            ]);
            state.activeConversationId = convId;
            saveSessions(state);
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, conversationId: convId, model, level, autoAlarm }));
          return;
        }

        if (url.pathname === '/api/session') {
          const state = loadSessions();
          if (data.model && MODEL_MAP[data.model]) {
            state.activeModel = data.model;
          }
          if (data.level && PERFORMANCE_MAP[data.level]) {
            state.activeLevel = data.level;
          }
          if (data.newConversation) {
            state.activeConversationId = null;
          } else if (data.conversationId !== undefined) {
            state.activeConversationId = data.conversationId;
          }
          saveSessions(state);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            ok: true,
            activeModel: state.activeModel,
            activeLevel: state.activeLevel,
            conversationId: state.activeConversationId
          }));
          return;
        }

        if (url.pathname === '/api/remote/mouse') {
          const out = await sendPsCommand({
            type: 'mouse',
            rx: data.rx,
            ry: data.ry,
            dx: data.dx,
            dy: data.dy,
            button: data.button || 'left',
            delta: data.delta || 0
          });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(out));
          return;
        }

        if (url.pathname === '/api/remote/key') {
          const out = await sendPsCommand({
            type: 'key',
            text: data.text || '',
            special: data.special || '',
            ctrl: Boolean(data.ctrl),
            alt: Boolean(data.alt),
            shift: Boolean(data.shift),
            win: Boolean(data.win)
          });
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(out));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: '알 수 없는 API 경로입니다.' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.on('upgrade', (req, socket, head) => {
  const auth = getAuthStatus(req);
  if (!auth.authenticated) {
    try {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
    } catch (e) {}
    return;
  }
  const targetSocket = net.connect(KOKIO_PORT, '127.0.0.1', () => {
    const reqPath = (req.url || '/ws').replace(/^\/kokio(?:talk)?/, '') || '/ws';
    const rawHeaders = [`${req.method || 'GET'} ${reqPath} HTTP/${req.httpVersion || '1.1'}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      rawHeaders.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    }
    rawHeaders.push('', '');
    targetSocket.write(rawHeaders.join('\r\n'));
    if (head && head.length > 0) {
      targetSocket.write(head);
    }
    socket.pipe(targetSocket).pipe(socket);
  });
  targetSocket.on('error', () => {
    try { socket.destroy(); } catch (e) {}
  });
  socket.on('error', () => {
    try { targetSocket.destroy(); } catch (e) {}
  });
});

server.on('error', (err) => {
  console.error('[Server Error]', err.message);
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log('====================================================');
  console.log('🥛 Kokio AI 독립 백그라운드 서버 + Auto-Wakeup 시작!');
  console.log(`💻 PC 접속 주소   : http://localhost:${PORT}`);
  console.log(`📱 로컬 접속 주소 : http://${ip}:${PORT}`);
  console.log('====================================================');

  let lastSyncedTunnel = '';
  async function checkAndSyncTunnels() {
    try {
      const myTunnel = getTunnelUrl();
      if (!myTunnel || myTunnel === lastSyncedTunnel) return;
      lastSyncedTunnel = myTunnel;
      try { fs.writeFileSync(TUNNEL_FILE, myTunnel, 'utf-8'); } catch (e) {}
      try { fs.writeFileSync(path.join(__dirname, 'Kokio AI접속url.txt'), `고정 포털: https://github.com/ryu-dongsoo/kokiotalk\n직통 터널: ${myTunnel}\n`, 'utf-8'); } catch (e) {}
      await syncPortal();
      const state = loadSessions();
      if (state.peerUrl && myTunnel) {
        await requestPeerJson(state.peerUrl, '/api/peer/register', 'POST', {
          peerUrl: myTunnel,
          peerName: MY_AGENT_NAME,
          autoSync: false
        }, 5000);
        console.log(`[🔗 Peer AI 브릿지 자동 페어링 완료] ${state.peerName} (${state.peerUrl}) <- ${myTunnel}`);
      }
    } catch (e) {}
  }

  setTimeout(checkAndSyncTunnels, 3500);
  setInterval(checkAndSyncTunnels, 45000);

  fs.watchFile(__filename, { interval: 3000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      console.log('[Auto-Reload] server.js 변경 감지 — 재시작합니다...');
      process.exit(0);
    }
  });
});
