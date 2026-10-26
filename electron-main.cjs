/**
 * 🐓 KokioTalk Desktop Application (Windows .exe & macOS .dmg)
 * - Runs KokioTalk Core Server (8082), Antigravity 2.0+ Gateway (8081), and Cloudflare HTTPS Tunnel automatically
 * - Requires ZERO external Node.js installation (uses Electron's embedded Node 22 runtime)
 */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const { spawn } = require('node:child_process');

const PORT_GATEWAY = 8081;
const PORT_CORE = 8082;
const APP_ROOT = __dirname;
const DATA_DIR = app ? app.getPath('userData') : path.join(APP_ROOT, 'data');

process.env.KOKIO_DATA_DIR = DATA_DIR;
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

// Copy initial kokio.config.json to writable userData directory if not exists
const userCfgPath = path.join(DATA_DIR, 'kokio.config.json');
const bundledCfgPath = path.join(APP_ROOT, 'kokio.config.json');
if (!fs.existsSync(userCfgPath) && fs.existsSync(bundledCfgPath)) {
  try { fs.copyFileSync(bundledCfgPath, userCfgPath); } catch {}
}

let mainWindow = null;
const childProcesses = [];

function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(600);
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => { sock.destroy(); resolve(false); });
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
    sock.connect(port, '127.0.0.1');
  });
}

function spawnNodeScript(scriptPath, cwd, extraEnv = {}) {
  const child = spawn(process.execPath, [scriptPath], {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      KOKIO_DATA_DIR: DATA_DIR,
      ...extraEnv
    },
    stdio: 'ignore',
    windowsHide: true
  });
  childProcesses.push(child);
  return child;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const request = (targetUrl) => {
      https.get(targetUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    };
    request(url);
  });
}

async function startCloudflaredTunnel() {
  try {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const binName = isWin ? 'cloudflared.exe' : 'cloudflared';
    const binPath = path.join(DATA_DIR, binName);
    const tunnelFile = path.join(DATA_DIR, 'tunnel_url.txt');

    if (!fs.existsSync(binPath)) {
      if (isWin) {
        await downloadFile(
          'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
          binPath
        );
      } else if (isMac) {
        const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
        const tgzPath = path.join(DATA_DIR, 'cloudflared.tgz');
        await downloadFile(
          `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${arch}.tgz`,
          tgzPath
        );
        await new Promise((res) => {
          const tar = spawn('tar', ['-xzf', tgzPath, '-C', DATA_DIR]);
          tar.on('close', res);
        });
        try { fs.chmodSync(binPath, 0o755); } catch {}
      }
    }

    if (fs.existsSync(binPath)) {
      const cf = spawn(binPath, ['tunnel', '--url', `http://localhost:${PORT_GATEWAY}`, '--no-autoupdate'], {
        cwd: DATA_DIR,
        windowsHide: true
      });
      childProcesses.push(cf);
      const onOutput = (chunk) => {
        const text = String(chunk || '');
        const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (m && m[0]) {
          try { fs.writeFileSync(tunnelFile, m[0].trim(), 'utf-8'); } catch {}
        }
      };
      cf.stdout.on('data', onOutput);
      cf.stderr.on('data', onOutput);
    }
  } catch (err) {
    console.error('[Cloudflared]', err.message);
  }
}

async function ensureLocalServers() {
  const coreUp = await isPortOpen(PORT_CORE);
  if (!coreUp) {
    const coreEntry = path.join(APP_ROOT, 'server', 'dist', 'index.mjs');
    if (fs.existsSync(coreEntry)) {
      spawnNodeScript(coreEntry, APP_ROOT, { PORT: String(PORT_CORE) });
    }
  }

  const gwUp = await isPortOpen(PORT_GATEWAY);
  if (!gwUp) {
    const gwEntry = path.join(APP_ROOT, 'gateway-server', 'server.js');
    if (fs.existsSync(gwEntry)) {
      spawnNodeScript(gwEntry, path.join(APP_ROOT, 'gateway-server'), { PORT: String(PORT_GATEWAY) });
    }
  }

  startCloudflaredTunnel();

  // Wait up to 8 seconds for Gateway (8081) to respond
  for (let i = 0; i < 32; i++) {
    if (await isPortOpen(PORT_GATEWAY)) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

function isFirstRunSetupNeeded() {
  try {
    if (fs.existsSync(userCfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(userCfgPath, 'utf-8'));
      return !cfg?.security?.setupCompleted;
    }
  } catch {}
  return true;
}

function buildAppMenu() {
  const template = [
    {
      label: '🐓 KokioTalk',
      submenu: [
        {
          label: '💬 Open Messenger',
          click: () => { if (mainWindow) mainWindow.loadURL(`http://localhost:${PORT_GATEWAY}/`); }
        },
        {
          label: '📱 Mobile QR Code & External Link (/qr)',
          click: () => { if (mainWindow) mainWindow.loadURL(`http://localhost:${PORT_GATEWAY}/qr`); }
        },
        {
          label: '⚙️ AI Agent & PIN Setup Wizard (/setup)',
          click: () => { if (mainWindow) mainWindow.loadURL(`http://localhost:${PORT_GATEWAY}/setup`); }
        },
        { type: 'separator' },
        {
          label: '⚡ Check for Updates (GitHub Auto-Update)',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript('if (window.kokioCheckForUpdates) window.kokioCheckForUpdates();');
            }
          }
        },
        {
          label: '🌐 Open in Default Web Browser',
          click: () => { shell.openExternal(`http://localhost:${PORT_GATEWAY}/`); }
        },
        { type: 'separator' },
        { role: 'reload', label: '🔄 Reload Window' },
        { role: 'toggleDevTools', label: '🛠️ Developer Tools' },
        { type: 'separator' },
        { role: 'quit', label: '🚪 Quit KokioTalk' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function checkUrlExists(targetUrl) {
  return new Promise((resolve) => {
    http.get(targetUrl, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function createWindow() {
  buildAppMenu();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 640,
    title: '🐓 KokioTalk · Antigravity 2.0+ Personal AI Agent',
    backgroundColor: '#181B22',
    icon: path.join(APP_ROOT, 'client', 'public', 'icon-512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  await ensureLocalServers();

  let startPath = '/';
  if (isFirstRunSetupNeeded()) {
    const hasSetupRoute = await checkUrlExists(`http://localhost:${PORT_GATEWAY}/setup`);
    if (hasSetupRoute) startPath = '/setup';
  }
  mainWindow.loadURL(`http://localhost:${PORT_GATEWAY}${startPath}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotSingleLock = app.requestSingleInstanceLock();
if (!gotSingleLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    for (const p of childProcesses) {
      try { p.kill(); } catch {}
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    for (const p of childProcesses) {
      try { p.kill(); } catch {}
    }
  });
}
