/**
 * 💛 rn-kakao-bridge.js
 * `react-native-kakao-main` (packages/core, user, share, social, channel) 기반
 * 카카오톡 통합 브릿지 모듈 (Peer AI Ea & Kokio AI KokioAI 공용)
 *
 * 지원 기능:
 * 1) [User] 카카오 OAuth 로그인 / 액세스 토큰 발급 & 자동 갱신 (packages/user)
 * 2) [Social] 내 카톡 프로필(/v1/api/talk/profile) & 친구 목록(/v1/api/talk/friends) 조회 (packages/social)
 * 3) [Share] 나에게 카톡 보내기(/v2/api/talk/memo/default/send) & 친구에게 보내기(/v1/api/talk/friends/message/default/send) (packages/share)
 * 4) [PC Kakao Read/Send] PC 카카오톡 열린 모든 채팅방 목록 조회, 대화 내용 실시간 읽어오기(Ctrl+A/C), 채팅방에 답장 보내기
 */

const https = require('node:https');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function httpsRequestFormOrJson(urlStr, { method = 'POST', headers = {}, formParams = null, jsonBody = null } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    let bodyStr = '';
    const reqHeaders = { ...headers };

    if (formParams) {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(formParams)) {
        if (v !== undefined && v !== null) {
          sp.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        }
      }
      bodyStr = sp.toString();
      reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
    } else if (jsonBody) {
      bodyStr = JSON.stringify(jsonBody);
      reqHeaders['Content-Type'] = 'application/json;charset=utf-8';
    }

    if (bodyStr) {
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr, 'utf-8');
    }

    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.msg || parsed.error_description || `HTTP ${res.statusCode}: ${data}`));
            }
          } catch (e) {
            reject(new Error(`Invalid JSON (${res.statusCode}): ${data.slice(0, 200)}`));
          }
        });
      }
    );

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

class RnKakaoBridge {
  constructor(storageDir) {
    this.storageDir = storageDir;
    this.tokenFile = path.join(storageDir, 'rn_kakao_token.json');
    this.historyFile = path.join(storageDir, 'rn_kakao_history.json');
  }

  loadState() {
    const defaults = {
      appKey: 'fb975c77483d1edbe69467fca6bb2a6e',
      javascriptKey: '7bd64215ea748be5c4a2bbcea40ebee9',
      restApiKey: '8b32d258f3f3fb553d86cfaa20964077',
      clientSecret: '',
      redirectUri: '',
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      profile: null
    };
    try {
      if (fs.existsSync(this.tokenFile)) {
        const s = JSON.parse(fs.readFileSync(this.tokenFile, 'utf-8'));
        return {
          ...defaults,
          ...s,
          appKey: s.appKey || defaults.appKey,
          javascriptKey: s.javascriptKey || defaults.javascriptKey,
          restApiKey: s.restApiKey || defaults.restApiKey
        };
      }
    } catch (e) {}
    return defaults;
  }

  saveState(state) {
    try {
      fs.writeFileSync(this.tokenFile, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {}
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const arr = JSON.parse(fs.readFileSync(this.historyFile, 'utf-8'));
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) {}
    return [];
  }

  appendHistory(item) {
    try {
      const list = this.loadHistory();
      list.unshift({
        id: 'rnk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        ...item
      });
      fs.writeFileSync(this.historyFile, JSON.stringify(list.slice(0, 80), null, 2), 'utf-8');
    } catch (e) {}
  }

  async issueAccessTokenWithCode({ restApiKey, clientSecret, redirectUri, code }) {
    const state = this.loadState();
    const apiKey = restApiKey || state.restApiKey;
    const secret = clientSecret !== undefined ? clientSecret : state.clientSecret;
    const redir = redirectUri || state.redirectUri;

    const tokenRes = await httpsRequestFormOrJson('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      formParams: {
        grant_type: 'authorization_code',
        client_id: apiKey,
        redirect_uri: redir,
        code,
        ...(secret ? { client_secret: secret } : {})
      }
    });

    const nextState = {
      ...state,
      restApiKey: apiKey,
      clientSecret: secret || '',
      redirectUri: redir,
      accessToken: tokenRes.access_token,
      refreshToken: tokenRes.refresh_token || state.refreshToken,
      expiresAt: Date.now() + (Number(tokenRes.expires_in || 21599) * 1000)
    };
    this.saveState(nextState);

    try {
      const prof = await this.getTalkProfile();
      nextState.profile = prof;
      this.saveState(nextState);
    } catch (e) {}

    return nextState;
  }

  async ensureValidAccessToken() {
    const state = this.loadState();
    if (!state.accessToken) {
      throw new Error('카카오 OAuth 로그인이 아직 되지 않았습니다. [💛 RN카톡] 버튼을 눌러 1단계 카카오 로그인을 먼저 진행해 주세요.');
    }
    if (state.expiresAt && Date.now() > state.expiresAt - 60000 && state.refreshToken && state.restApiKey) {
      const refreshed = await httpsRequestFormOrJson('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        formParams: {
          grant_type: 'refresh_token',
          client_id: state.restApiKey,
          refresh_token: state.refreshToken,
          ...(state.clientSecret ? { client_secret: state.clientSecret } : {})
        }
      });
      state.accessToken = refreshed.access_token || state.accessToken;
      if (refreshed.refresh_token) state.refreshToken = refreshed.refresh_token;
      state.expiresAt = Date.now() + (Number(refreshed.expires_in || 21599) * 1000);
      this.saveState(state);
    }
    return state.accessToken;
  }

  async getTalkProfile() {
    const token = await this.ensureValidAccessToken();
    const res = await httpsRequestFormOrJson('https://kapi.kakao.com/v1/api/talk/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    return {
      nickname: res.nickName,
      profileImageUrl: res.profileImageURL,
      thumbnailUrl: res.thumbnailURL,
      countryISO: res.countryISO
    };
  }

  async getFriends({ offset = 0, limit = 30, order = 'asc' } = {}) {
    const token = await this.ensureValidAccessToken();
    const q = new URLSearchParams({ offset: String(offset), limit: String(limit), order }).toString();
    const res = await httpsRequestFormOrJson(`https://kapi.kakao.com/v1/api/talk/friends?${q}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    return {
      totalCount: res.total_count || 0,
      favoriteCount: res.favorite_count || 0,
      friends: res.elements || []
    };
  }

  async sendTextTemplateToMe({ text, webUrl = 'https://', buttonTitle = '앱 열기' }) {
    const token = await this.ensureValidAccessToken();
    const templateObject = {
      object_type: 'text',
      text: String(text || '').slice(0, 950),
      link: {
        web_url: webUrl,
        mobile_web_url: webUrl
      },
      button_title: buttonTitle
    };
    const res = await httpsRequestFormOrJson('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      formParams: { template_object: templateObject }
    });
    this.appendHistory({
      type: 'send_me',
      room: '나와의 채팅 (카카오 API)',
      sender: '나에게 보내기',
      text: String(text || '').slice(0, 950)
    });
    return res;
  }

  async sendTextTemplateToFriends({ receiverUuids = [], text, webUrl = 'https://', buttonTitle = '확인하기' }) {
    const token = await this.ensureValidAccessToken();
    const templateObject = {
      object_type: 'text',
      text: String(text || '').slice(0, 950),
      link: {
        web_url: webUrl,
        mobile_web_url: webUrl
      },
      button_title: buttonTitle
    };
    const res = await httpsRequestFormOrJson('https://kapi.kakao.com/v1/api/talk/friends/message/default/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      formParams: {
        receiver_uuids: receiverUuids,
        template_object: templateObject
      }
    });
    this.appendHistory({
      type: 'send_friends',
      room: `친구 전송 (${receiverUuids.length}명)`,
      sender: '카카오 API',
      text: String(text || '').slice(0, 950)
    });
    return res;
  }

  readPcKakaoMessages({ roomTitle = '', copyFromWindow = true } = {}) {
    try {
      const encodedRoom = Buffer.from(String(roomTitle || ''), 'utf8').toString('base64');
      const psScript = `
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
        Add-Type -AssemblyName System.Windows.Forms;
        Add-Type @"
        using System;
        using System.Text;
        using System.Collections.Generic;
        using System.Runtime.InteropServices;
        public class KakaoWin32 {
          public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
          [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
          [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
          [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
          [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
          [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
          [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, int dwExtraInfo);
          public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
        }
"@
        $targetRoom = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedRoom}'));
        $kakaoPids = @(Get-Process -Name 'KakaoTalk' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id);
        if ($kakaoPids.Count -eq 0) {
          Write-Output '{"ok":false,"running":false,"windows":[],"messages":[],"error":"PC 카카오톡(KakaoTalk.exe)이 실행 중이지 않습니다."}';
          exit;
        }

        $winList = New-Object System.Collections.ArrayList;
        $callback = [KakaoWin32+EnumWindowsProc]{
          param($hWnd, $lParam)
          if ([KakaoWin32]::IsWindowVisible($hWnd)) {
            $pidOut = [uint32]0;
            [void][KakaoWin32]::GetWindowThreadProcessId($hWnd, [ref]$pidOut);
            if ($kakaoPids -contains $pidOut) {
              $sb = New-Object System.Text.StringBuilder 256;
              [void][KakaoWin32]::GetWindowText($hWnd, $sb, 256);
              $title = $sb.ToString().Trim();
              if ($title -and $title -ne 'Default IME' -and $title -ne 'MSCTFIME UI') {
                [void]$winList.Add(@{ hwnd = [int64]$hWnd; title = $title });
              }
            }
          }
          return $true;
        };
        [void][KakaoWin32]::EnumWindows($callback, [IntPtr]::Zero);

        $chatWindows = @($winList | Where-Object { $_.title -ne '카카오톡' -and $_.title -ne 'KakaoTalk' });
        $targetWin = $null;
        if ($targetRoom) {
          $targetWin = $chatWindows | Where-Object { $_.title -like "*$targetRoom*" } | Select-Object -First 1;
        }
        if (-not $targetWin -and $chatWindows.Count -gt 0) {
          $targetWin = $chatWindows[0];
        }

        $copiedText = '';
        $activeRoomTitle = '';
        if (${copyFromWindow ? '$true' : '$false'} -and $targetWin) {
          $activeRoomTitle = $targetWin.title;
          $hwnd = [IntPtr]$targetWin.hwnd;
          $oldClip = '';
          try { $oldClip = Get-Clipboard -Raw -ErrorAction SilentlyContinue; } catch {}
          Set-Clipboard -Value ' ';

          [void][KakaoWin32]::ShowWindow($hwnd, 9);
          [void][KakaoWin32]::SetForegroundWindow($hwnd);
          Start-Sleep -Milliseconds 220;

          $rect = New-Object KakaoWin32+RECT;
          if ([KakaoWin32]::GetWindowRect($hwnd, [ref]$rect)) {
            $cx = [int](($rect.Left + $rect.Right) / 2);
            $cy = [int]($rect.Top + (($rect.Bottom - $rect.Top) * 0.45));
            [void][KakaoWin32]::SetCursorPos($cx, $cy);
            Start-Sleep -Milliseconds 60;
            [KakaoWin32]::mouse_event(0x0002, 0, 0, 0, 0);
            [KakaoWin32]::mouse_event(0x0004, 0, 0, 0, 0);
            Start-Sleep -Milliseconds 100;
            [System.Windows.Forms.SendKeys]::SendWait('^a');
            Start-Sleep -Milliseconds 100;
            [System.Windows.Forms.SendKeys]::SendWait('^c');
            Start-Sleep -Milliseconds 140;
            [KakaoWin32]::mouse_event(0x0002, 0, 0, 0, 0);
            [KakaoWin32]::mouse_event(0x0004, 0, 0, 0, 0);
          }
          try { $copiedText = [string](Get-Clipboard -Raw -ErrorAction SilentlyContinue); } catch {}
          if (-not $copiedText.Trim() -and $oldClip) {
            $copiedText = [string]$oldClip;
          }
        } else {
          try { $copiedText = [string](Get-Clipboard -Raw -ErrorAction SilentlyContinue); } catch {}
        }

        $out = @{
          ok = $true;
          running = $true;
          allWindows = @($winList | ForEach-Object { $_.title });
          chatRooms = @($chatWindows | ForEach-Object { $_.title });
          activeRoom = $activeRoomTitle;
          rawText = [string]$copiedText
        };
        $out | ConvertTo-Json -Compress -Depth 4
      `;

      const rawOut = execFileSync('powershell.exe', ['-NoProfile', '-Sta', '-Command', psScript], {
        encoding: 'utf-8',
        windowsHide: true
      }).trim();

      const parsed = rawOut ? JSON.parse(rawOut) : { ok: false, running: false };
      const lines = String(parsed.rawText || '')
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);

      const recentLines = lines.slice(-30);
      if (recentLines.length > 0) {
        this.appendHistory({
          type: 'read_pc',
          room: parsed.activeRoom || 'PC 카카오톡',
          sender: '카톡 대화 스캔',
          text: recentLines.slice(-10).join('\n')
        });
      }

      return {
        ...parsed,
        recentMessages: recentLines
      };
    } catch (e) {
      return { ok: false, running: false, error: e.message, recentMessages: [] };
    }
  }

  sendToPcKakaoWindow({ roomTitle = '', text = '' }) {
    if (!text) return { ok: false, error: '전송할 텍스트가 없습니다.' };
    try {
      const encodedText = Buffer.from(String(text), 'utf8').toString('base64');
      const encodedRoom = Buffer.from(String(roomTitle || ''), 'utf8').toString('base64');
      const psScript = `
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
        Add-Type -AssemblyName System.Windows.Forms;
        Add-Type @"
        using System;
        using System.Text;
        using System.Runtime.InteropServices;
        public class KakaoSendWin32 {
          public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
          [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
          [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
          [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
          [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
          [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
          [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, int dwExtraInfo);
          public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
        }
"@
        $msg = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedText}'));
        $targetRoom = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedRoom}'));
        $kakaoPids = @(Get-Process -Name 'KakaoTalk' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id);
        if ($kakaoPids.Count -eq 0) {
          Write-Output '{"ok":false,"error":"PC 카카오톡이 실행 중이지 않습니다."}';
          exit;
        }

        $winList = New-Object System.Collections.ArrayList;
        $callback = [KakaoSendWin32+EnumWindowsProc]{
          param($hWnd, $lParam)
          if ([KakaoSendWin32]::IsWindowVisible($hWnd)) {
            $pidOut = [uint32]0;
            [void][KakaoSendWin32]::GetWindowThreadProcessId($hWnd, [ref]$pidOut);
            if ($kakaoPids -contains $pidOut) {
              $sb = New-Object System.Text.StringBuilder 256;
              [void][KakaoSendWin32]::GetWindowText($hWnd, $sb, 256);
              $title = $sb.ToString().Trim();
              if ($title -and $title -ne 'Default IME' -and $title -ne 'MSCTFIME UI') {
                [void]$winList.Add(@{ hwnd = [int64]$hWnd; title = $title });
              }
            }
          }
          return $true;
        };
        [void][KakaoSendWin32]::EnumWindows($callback, [IntPtr]::Zero);

        $chatWindows = @($winList | Where-Object { $_.title -ne '카카오톡' -and $_.title -ne 'KakaoTalk' });
        $targetWin = $null;
        if ($targetRoom) {
          $targetWin = $chatWindows | Where-Object { $_.title -like "*$targetRoom*" } | Select-Object -First 1;
        }
        if (-not $targetWin -and $chatWindows.Count -gt 0) {
          $targetWin = $chatWindows[0];
        }
        if (-not $targetWin) {
          Write-Output '{"ok":false,"error":"PC 카카오톡에 열려 있는 채팅방 창이 없습니다. 채팅방을 하나 열어주세요!"}';
          exit;
        }

        $hwnd = [IntPtr]$targetWin.hwnd;
        [void][KakaoSendWin32]::ShowWindow($hwnd, 9);
        [void][KakaoSendWin32]::SetForegroundWindow($hwnd);
        Start-Sleep -Milliseconds 180;

        $rect = New-Object KakaoSendWin32+RECT;
        if ([KakaoSendWin32]::GetWindowRect($hwnd, [ref]$rect)) {
          $ix = [int](($rect.Left + $rect.Right) / 2);
          $iy = [int]($rect.Bottom - 65);
          [void][KakaoSendWin32]::SetCursorPos($ix, $iy);
          Start-Sleep -Milliseconds 50;
          [KakaoSendWin32]::mouse_event(0x0002, 0, 0, 0, 0);
          [KakaoSendWin32]::mouse_event(0x0004, 0, 0, 0, 0);
          Start-Sleep -Milliseconds 80;
        }

        $oldClip = Get-Clipboard -Raw -ErrorAction SilentlyContinue;
        Set-Clipboard -Value $msg;
        [System.Windows.Forms.SendKeys]::SendWait('^v');
        Start-Sleep -Milliseconds 120;
        [System.Windows.Forms.SendKeys]::SendWait('{ENTER}');
        Start-Sleep -Milliseconds 100;
        if ($oldClip) { Set-Clipboard -Value $oldClip; }
        Write-Output ('{"ok":true,"windowTitle":"' + ($targetWin.title -replace '"','''') + '"}');
      `;
      const out = execFileSync('powershell.exe', ['-NoProfile', '-Sta', '-Command', psScript], {
        encoding: 'utf-8',
        windowsHide: true
      }).trim();
      const parsed = out ? JSON.parse(out) : { ok: false };
      if (parsed.ok) {
        this.appendHistory({
          type: 'send_pc',
          room: parsed.windowTitle || roomTitle || 'PC 카카오톡',
          sender: 'PC 카톡 전송',
          text: String(text)
        });
      }
      return parsed;
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}

module.exports = { RnKakaoBridge };
