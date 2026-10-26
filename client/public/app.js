/**
 * 🐓 KokioTalk (코끼오톡) Frontend Engine — 순수 자연어 방식 (명령어 및 중간 안내 문구 완전 제거)
 * - "우유야 ~해줘" (또는 우유 1:1 방에서 아무 말이나) 입력 시:
 *   중간 안내 말풍선 없이 지금 이 PC의 안티그래비티(우유)가 작성한 실제 최종 답변 글만 기다렸다가 띄움
 */

(function () {
  const API_PREFIX = location.pathname.startsWith('/kokio') ? '/kokio' : '';

  const UI_I18N = {
    en: {
      nav_friends: 'Friends',
      nav_chats: 'Chats',
      nav_calendar: 'Calendar',
      nav_aihub: 'AI·API',
      nav_drawer: 'Drawer',
      pane_friends: 'Friends',
      pane_chats: 'Chats',
      pane_aihub: 'AI & External Tunnel Hub',
      pane_drawer: 'Kokio Unlimited Vault',
      search_global: 'Search rooms, AI sessions, messages...',
      search_room: 'Search messages or tool logs in this room...',
      btn_close: 'Close',
      btn_calendar: '📅 Calendar',
      btn_interpreter: '🌐 Interpreter',
      btn_light: '☀️ Light',
      btn_dark: '🌙 Dark',
      btn_install: '📲 Install',
      btn_remote: '🖥️ Remote PC',
      btn_lock: '🔒 Lock',
      btn_lock_temp: '⏱️ Temp Access (🔒 Lock)',
      input_placeholder: 'Type a message in any language... (Press Enter to send)',
      btn_send: 'Send'
    },
    ko: {
      nav_friends: '친구',
      nav_chats: '채팅',
      nav_calendar: '달력',
      nav_aihub: 'AI·API',
      nav_drawer: '톡서랍',
      pane_friends: '친구',
      pane_chats: '채팅',
      pane_aihub: 'AI · 외부 접속 허브',
      pane_drawer: '코끼오 무제한 톡서랍',
      search_global: '우유 작업방, 단톡방, 대화내용 검색...',
      search_room: '이 대화방에서 메시지나 도구 실행 내역 검색...',
      btn_close: '닫기',
      btn_calendar: '📅 달력',
      btn_interpreter: '🌐 통역',
      btn_light: '☀️ 라이트',
      btn_dark: '🌙 다크',
      btn_install: '📲 앱설치',
      btn_remote: '🖥️ PC화면',
      btn_lock: '🔒 잠금',
      btn_lock_temp: '⏱️ 임시접속 (🔒 잠금)',
      input_placeholder: '메시지를 입력하세요 (우유야 ~해줘 / 에아야 ~해줘 처럼 자연어로 말씀해 주세요)',
      btn_send: '전송'
    },
    ja: {
      nav_friends: '友だち',
      nav_chats: 'トーク',
      nav_calendar: 'カレンダー',
      nav_aihub: 'AI·API',
      nav_drawer: '引き出し',
      pane_friends: '友だち',
      pane_chats: 'トーク',
      pane_aihub: 'AI・外部トンネルハブ',
      pane_drawer: '無制限ファイル引き出し',
      search_global: 'トークルーム、AIセッション、メッセージを検索...',
      search_room: 'このトークルーム内のメッセージを検索...',
      btn_close: '閉じる',
      btn_calendar: '📅 カレンダー',
      btn_interpreter: '🌐 通訳',
      btn_light: '☀️ ライト',
      btn_dark: '🌙 ダーク',
      btn_install: '📲 アプリ追加',
      btn_remote: '🖥️ PC画面',
      btn_lock: '🔒 ロック',
      btn_lock_temp: '⏱️ 一時接続 (🔒 ロック)',
      input_placeholder: 'メッセージを入力してください (Enterで送信)',
      btn_send: '送信'
    },
    zh: {
      nav_friends: '好友',
      nav_chats: '聊天',
      nav_calendar: '日历',
      nav_aihub: 'AI·接口',
      nav_drawer: '文件柜',
      pane_friends: '好友',
      pane_chats: '聊天',
      pane_aihub: 'AI 与外部隧道中心',
      pane_drawer: '无限容量聊天文件柜',
      search_global: '搜索聊天室、AI会话、聊天内容...',
      search_room: '在此聊天室中搜索消息或工具记录...',
      btn_close: '关闭',
      btn_calendar: '📅 日历',
      btn_interpreter: '🌐 同传',
      btn_light: '☀️ 浅色',
      btn_dark: '🌙 深色',
      btn_install: '📲 安装应用',
      btn_remote: '🖥️ 远程桌面',
      btn_lock: '🔒 锁定',
      btn_lock_temp: '⏱️ 临时访问 (🔒 锁定)',
      input_placeholder: '请输入消息 (按 Enter 发送)',
      btn_send: '发送'
    }
  };

  const state = {
    uiLang: localStorage.getItem('kokio_ui_lang') || 'en',
    activeTab: 'chats',
    activeRoomId: 'room-ooyoo',
    activeSenderId: localStorage.getItem('kokio_sender_id') || 'ryu',
    activeModel: 'argon',
    activeLevel: 'medium',
    filterQuery: '',
    inRoomSearchQuery: '',
    users: [],
    rooms: [],
    messagesByRoom: {},
    drawer: { files: [], links: [] },
    bridges: {},
    replyToMsg: null,
    pendingAttachments: [],
    themes: ['theme-dark', 'theme-classic', 'theme-lab'],
    themeIdx: 0,
    remoteTimer: null,
    lastMsgSignature: '',
    isRecordingStt: false
  };

  function t(key) {
    const dict = UI_I18N[state.uiLang] || UI_I18N.en;
    return dict[key] || UI_I18N.en[key] || key;
  }

  function applyUiLanguage(lang) {
    state.uiLang = UI_I18N[lang] ? lang : 'en';
    try { localStorage.setItem('kokio_ui_lang', state.uiLang); } catch {}
    const sel = document.getElementById('ui-lang-select');
    if (sel) sel.value = state.uiLang;

    document.querySelectorAll('[data-i18n]').forEach(node => {
      const k = node.getAttribute('data-i18n');
      if (k) node.textContent = t(k);
    });

    const paneMap = {
      friends: t('pane_friends'),
      chats: t('pane_chats'),
      aihub: t('pane_aihub'),
      drawer: t('pane_drawer')
    };
    const paneTitleEl = document.getElementById('pane-title');
    if (paneTitleEl) paneTitleEl.textContent = paneMap[state.activeTab] || t('pane_chats');

    const globalSearch = document.getElementById('global-filter-input');
    if (globalSearch) globalSearch.placeholder = t('search_global');

    const roomSearch = document.getElementById('in-room-search-input');
    if (roomSearch) roomSearch.placeholder = t('search_room');

    const closeSearchBtn = document.getElementById('btn-close-room-search');
    if (closeSearchBtn) closeSearchBtn.textContent = t('btn_close');

    const calBtn = document.getElementById('btn-header-calendar');
    if (calBtn) calBtn.textContent = t('btn_calendar');

    const interpBtn = document.getElementById('btn-live-interpreter');
    if (interpBtn) interpBtn.textContent = t('btn_interpreter');

    const themeBtn = document.getElementById('btn-header-theme');
    const activeTheme = state.themes[state.themeIdx];
    if (themeBtn) themeBtn.textContent = activeTheme === 'theme-dark' ? t('btn_light') : t('btn_dark');

    const installBtn = document.getElementById('btn-install-pwa-header');
    if (installBtn) installBtn.textContent = t('btn_install');

    const remoteBtn = document.getElementById('btn-header-pc-remote');
    if (remoteBtn) remoteBtn.textContent = t('btn_remote');

    const lockBtn = document.getElementById('btn-lock-logout');
    const isTempCookie = document.cookie.split(';').some(c => c.trim() === 'ooyoo_auth_mode=temp');
    if (lockBtn) {
      lockBtn.textContent = isTempCookie ? t('btn_lock_temp') : t('btn_lock');
    }

    const chatInputEl = document.getElementById('chat-input');
    if (chatInputEl) chatInputEl.placeholder = t('input_placeholder');

    const sendBtn = document.getElementById('btn-send-message');
    if (sendBtn) sendBtn.textContent = t('btn_send');
  }

  function playKakaoChime() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(1174.66, now + 0.09);
      osc2.frequency.setValueAtTime(1318.51, now + 0.09);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc2.start(now + 0.09);
      osc1.stop(now + 0.28);
      osc2.stop(now + 0.28);
    } catch {}
  }

  function speakTextKorean(rawText) {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const clean = String(rawText || '')
        .replace(/```[\s\S]*?```/g, ' 코드 블록 ')
        .replace(/[#*`_~>|]/g, ' ')
        .replace(/https?:\/\/\S+/g, ' 링크 ')
        .trim();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = 'ko-KR';
      utter.rate = 1.05;
      window.speechSynthesis.speak(utter);
    } catch {}
  }

  const el = {
    navBtns: document.querySelectorAll('.nav-btn'),
    tabContents: {
      friends: document.getElementById('tab-friends'),
      chats: document.getElementById('tab-chats'),
      aihub: document.getElementById('tab-aihub'),
      drawer: document.getElementById('tab-drawer')
    },
    paneTitle: document.getElementById('pane-title'),
    totalUnreadBadge: document.getElementById('total-unread-badge'),
    globalFilterInput: document.getElementById('global-filter-input'),
    btnClearFilter: document.getElementById('btn-clear-filter'),
    activeRoomAvatar: document.getElementById('active-room-avatar'),
    activeRoomName: document.getElementById('active-room-name'),
    activeRoomCount: document.getElementById('active-room-count'),
    activeRoomMembersPreview: document.getElementById('active-room-members-preview'),
    btnTogglePin: document.getElementById('btn-toggle-pin'),
    modelSelect: document.getElementById('ooyoo-model-select'),
    levelSelect: document.getElementById('ooyoo-level-select'),
    roomNoticeBar: document.getElementById('room-notice-bar'),
    roomNoticeText: document.getElementById('room-notice-text'),
    btnEditNotice: document.getElementById('btn-edit-notice'),
    messageStream: document.getElementById('message-stream'),
    typingIndicator: document.getElementById('typing-indicator'),
    typingText: document.getElementById('typing-text'),
    replyPreviewBar: document.getElementById('reply-preview-bar'),
    replyTargetName: document.getElementById('reply-target-name'),
    replyTargetText: document.getElementById('reply-target-text'),
    btnCancelReply: document.getElementById('btn-cancel-reply'),
    pendingAttachmentsBar: document.getElementById('pending-attachments-bar'),
    chatInput: document.getElementById('chat-input'),
    btnSendMessage: document.getElementById('btn-send-message'),
    fileUploadInput: document.getElementById('file-upload-input'),
    inRoomSearchBar: document.getElementById('in-room-search-bar'),
    inRoomSearchInput: document.getElementById('in-room-search-input'),
    connDot: document.getElementById('conn-dot')
  };

  function apiFetch(urlPath, options = {}) {
    let tempToken = '';
    try { tempToken = sessionStorage.getItem('ooyoo_temp_token') || ''; } catch {}
    const headers = {
      'ngrok-skip-browser-warning': 'true',
      ...(tempToken ? { 'X-Ooyoo-Temp-Token': tempToken } : {}),
      ...(options.headers || {})
    };
    return fetch(`${API_PREFIX}${urlPath}`, { ...options, headers }).then((res) => {
      if (res.status === 401 && !urlPath.startsWith('/api/auth/')) {
        try { sessionStorage.removeItem('ooyoo_temp_token'); } catch {}
        window.location.reload();
      }
      return res;
    });
  }

  async function lockAndLogoutNow() {
    let tempToken = '';
    try {
      tempToken = sessionStorage.getItem('ooyoo_temp_token') || '';
      sessionStorage.removeItem('ooyoo_temp_token');
    } catch {}
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken })
      });
    } catch {}
    window.location.replace(window.location.pathname + window.location.search);
  }

  async function initSecurityAndTempSessionGuard() {
    document.getElementById('btn-lock-logout')?.addEventListener('click', lockAndLogoutNow);
    document.getElementById('btn-nav-lock')?.addEventListener('click', lockAndLogoutNow);

    const isTempCookie = document.cookie.split(';').some(c => c.trim() === 'ooyoo_auth_mode=temp');
    if (!isTempCookie) return true;

    let tempToken = '';
    try { tempToken = sessionStorage.getItem('ooyoo_temp_token') || ''; } catch {}

    // 브라우저를 닫았다가 다시 열었거나 새 탭에서 열었을 경우(sessionStorage 소멸) -> 즉시 로그아웃 및 암호 화면 강제!
    if (!tempToken) {
      const appRoot = document.getElementById('kokio-app');
      if (appRoot) appRoot.style.display = 'none';
      await lockAndLogoutNow();
      return false;
    }

    // 임시 접속 상태임을 상단 버튼에 명확히 표시
    const lockBtn = document.getElementById('btn-lock-logout');
    if (lockBtn) {
      lockBtn.textContent = '⏱️ 임시접속 (🔒 잠금)';
      lockBtn.style.borderColor = '#F59E0B';
      lockBtn.style.color = '#FCD34D';
      lockBtn.style.background = 'rgba(245, 158, 11, 0.16)';
    }

    // 창이나 탭을 닫을 때 서버 메모리의 임시 토큰을 즉시 파기 예약 (새로고침 F5는 2.5초 내 복귀하므로 유지됨)
    const notifyTabClose = () => {
      try {
        const curToken = sessionStorage.getItem('ooyoo_temp_token') || tempToken;
        if (navigator.sendBeacon && curToken) {
          const blob = new Blob([JSON.stringify({ tempToken: curToken })], { type: 'application/json' });
          navigator.sendBeacon('/api/auth/tab-close', blob);
        }
      } catch {}
    };
    window.addEventListener('pagehide', notifyTabClose);
    window.addEventListener('beforeunload', notifyTabClose);

    // 4초마다 서버 임시 세션 생존 확인 및 연장
    setInterval(async () => {
      try {
        const res = await fetch('/api/auth/ping', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Ooyoo-Temp-Token': tempToken
          },
          body: JSON.stringify({ tempToken })
        });
        if (!res.ok) {
          try { sessionStorage.removeItem('ooyoo_temp_token'); } catch {}
          window.location.reload();
        }
      } catch {}
    }, 4000);

    return true;
  }

  let deferredPwaPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.update().catch(() => {}));
    }).catch(() => {});
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
    }
  }

  async function triggerPwaInstall() {
    if (deferredPwaPrompt) {
      deferredPwaPrompt.prompt();
      try {
        await deferredPwaPrompt.userChoice;
      } catch {}
      deferredPwaPrompt = null;
      return;
    }
    document.getElementById('modal-pwa-install')?.classList.remove('hidden');
  }

  async function initApp() {
    const authOk = await initSecurityAndTempSessionGuard();
    if (!authOk) return;
    bindEvents();
    await fetchBootstrap();
    const initialRoom =
      state.rooms.find(r => r.id === 'room-ooyoo') ||
      state.rooms[0];
    if (initialRoom) {
      await selectRoom(initialRoom.id);
    }
    connectRealtime();
    startLivePollingLoop();
  }

  async function fetchBootstrap() {
    try {
      const res = await apiFetch(`/api/bootstrap?viewerId=${encodeURIComponent(state.activeSenderId)}`);
      const data = await res.json();
      if (data.ok) {
        state.users = data.users || [];
        state.rooms = data.rooms || [];
        state.drawer = data.drawer || { files: [], links: [] };
        state.bridges = data.bridges || {};
        if (state.bridges.ooyooModel && el.modelSelect) {
          state.activeModel = state.bridges.ooyooModel;
          el.modelSelect.value = state.activeModel;
        }
        if (state.bridges.ooyooLevel && el.levelSelect) {
          state.activeLevel = state.bridges.ooyooLevel;
          el.levelSelect.value = state.activeLevel;
        }
        renderAllLeftPanes();
      }
    } catch (err) {
      console.error('Bootstrap error:', err);
    }
  }

  let typingWatchdogTimer = null;

  function hideTypingIndicator() {
    if (typingWatchdogTimer) {
      clearTimeout(typingWatchdogTimer);
      typingWatchdogTimer = null;
    }
    el.typingIndicator?.classList.add('hidden');
  }

  function showTypingIndicator(text) {
    if (!el.typingIndicator) return;
    if (el.typingText) {
      el.typingText.textContent = text || '우유 (Ooyoo 🥛)님이 글을 작성하고 있어요...';
    }
    el.typingIndicator.classList.remove('hidden');
    if (typingWatchdogTimer) clearTimeout(typingWatchdogTimer);
    typingWatchdogTimer = setTimeout(() => {
      hideTypingIndicator();
    }, 20000);
  }

  function connectRealtime() {
    try {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}${API_PREFIX}/ws`);
      ws.onopen = () => {
        el.connDot.className = 'status-dot online';
      };
      ws.onmessage = (ev) => {
        try {
          handleRealtimeEvent(JSON.parse(ev.data));
        } catch {}
      };
      ws.onclose = () => {
        el.connDot.className = 'status-dot offline';
        hideTypingIndicator();
        setTimeout(connectRealtime, 2500);
      };
    } catch {}
  }

  let pollTick = 0;
  function startLivePollingLoop() {
    setInterval(async () => {
      pollTick++;
      if (pollTick % 4 === 0) {
        fetchBootstrap().catch(() => {});
      }
      if (!state.activeRoomId) return;
      try {
        const res = await apiFetch(`/api/rooms/${encodeURIComponent(state.activeRoomId)}/messages?limit=150`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.messages)) {
          const msgs = data.messages;
          const last = msgs.length > 0 ? msgs[msgs.length - 1] : null;
          if (last && last.senderId !== state.activeSenderId) {
            hideTypingIndicator();
          }
          const totalUnreadInView = msgs.reduce((s, m) => s + (Number(m.unreadCount) || 0), 0);
          const sig = `${msgs.length}:${last ? last.id : 0}:${last ? (last.content || '').length : 0}:${last ? JSON.stringify(last.reactions || {}).length : 0}:${totalUnreadInView}`;
          if (sig !== state.lastMsgSignature) {
            state.lastMsgSignature = sig;
            state.messagesByRoom[state.activeRoomId] = msgs;
            renderActiveRoomMessages(true);
            refreshRoomsList();
            if (last && last.senderId !== state.activeSenderId && Number(last.unreadCount) > 0) {
              apiFetch(`/api/rooms/${encodeURIComponent(state.activeRoomId)}/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: state.activeSenderId })
              }).catch(() => {});
            }
          }
        }
      } catch {}
    }, 1200);
  }

  async function handleRealtimeEvent(event) {
    if (!event || !event.type) return;

    if (event.type === 'message_created') {
      const msg = event.payload;
      if (!state.messagesByRoom[msg.roomId]) state.messagesByRoom[msg.roomId] = [];
      const exists = state.messagesByRoom[msg.roomId].some(m => m.id === msg.id);
      if (!exists) {
        state.messagesByRoom[msg.roomId].push(msg);
        if (msg.senderId !== state.activeSenderId) {
          playKakaoChime();
        }
      }

      if (msg.roomId === state.activeRoomId) {
        if (msg.senderId !== state.activeSenderId) {
          hideTypingIndicator();
          msg.unreadCount = Math.max(0, (Number(msg.unreadCount) || 0) - 1);
          apiFetch(`/api/rooms/${encodeURIComponent(msg.roomId)}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: state.activeSenderId })
          }).catch(() => {});
        }
        renderActiveRoomMessages(true);
      }
      await refreshRoomsList();
    } else if (event.type === 'message_updated') {
      const msg = event.payload;
      const list = state.messagesByRoom[msg.roomId] || [];
      const idx = list.findIndex(m => m.id === msg.id);
      if (idx !== -1) {
        list[idx] = msg;
        if (msg.roomId === state.activeRoomId) renderActiveRoomMessages(false);
      }
    } else if (event.type === 'agent_typing') {
      const { roomId, agentName, isTyping, statusText } = event.payload;
      if (roomId === state.activeRoomId) {
        if (isTyping) {
          showTypingIndicator(statusText || `${agentName || '우유 (Ooyoo 🥛)'}님이 글을 작성하고 있어요...`);
          scrollToBottom();
        } else {
          hideTypingIndicator();
        }
      }
    } else if (event.type === 'read_updated') {
      if (event.payload && event.payload.roomId === state.activeRoomId) {
        await loadRoomMessages(state.activeRoomId, false);
      }
      await refreshRoomsList();
    } else if (event.type === 'room_updated' || event.type === 'user_updated') {
      await refreshRoomsList();
    }
  }

  async function refreshRoomsList() {
    try {
      const res = await apiFetch(`/api/rooms?viewerId=${encodeURIComponent(state.activeSenderId)}`);
      const data = await res.json();
      if (data.ok) {
        state.rooms = data.rooms;
        renderChatsTab();
        updateTotalUnreadBadge();
      }
    } catch {}
  }

  function renderAllLeftPanes() {
    renderFriendsTab();
    renderChatsTab();
    renderAiHubTab();
    renderDrawerTab();
    updateTotalUnreadBadge();
  }

  function updateTotalUnreadBadge() {
    const total = state.rooms.reduce((acc, r) => acc + (Number(r.unreadCount) || 0), 0);
    if (total > 0) {
      el.totalUnreadBadge.textContent = total > 99 ? '99+' : String(total);
      el.totalUnreadBadge.classList.remove('hidden');
    } else {
      el.totalUnreadBadge.classList.add('hidden');
    }
  }

  function renderFriendsTab() {
    const q = state.filterQuery.toLowerCase();
    const filtered = state.users.filter(u =>
      !q || u.name.toLowerCase().includes(q) || (u.status_message || '').toLowerCase().includes(q)
    );
    const me = filtered.find(u => u.id === 'ryu') || state.users[0];
    const aiAgents = filtered.filter(u => u.role_type === 'ai_agent');
    const humans = filtered.filter(u => u.role_type === 'human' && u.id !== 'ryu');

    let html = '';
    if (me) {
      html += `
        <div class="section-group-header"><span>내 프로필</span></div>
        <div class="friend-item" data-friend-id="ryu">
          <div class="squircle-avatar lg">${escapeHtml(me.avatar)}</div>
          <div class="friend-info">
            <div class="friend-name-row">
              <span class="friend-name">${escapeHtml(me.name)}</span>
              <span class="ai-pill" style="background:#FEF9C3;color:#854D0E;">나와의 채팅</span>
            </div>
            <div class="friend-status">${escapeHtml(me.status_message)}</div>
          </div>
        </div>
      `;
    }

    html += `<div class="section-group-header"><span>🤖 AI 비서 (${aiAgents.length})</span></div>`;
    for (const ai of aiAgents) {
      html += `
        <div class="friend-item" data-friend-id="${escapeHtml(ai.id)}">
          <div class="squircle-avatar ai-avatar">${escapeHtml(ai.avatar)}</div>
          <div class="friend-info">
            <div class="friend-name-row">
              <span class="friend-name">${escapeHtml(ai.name)}</span>
              <span class="ai-pill">AI</span>
            </div>
            <div class="friend-status">${escapeHtml(ai.status_message)}</div>
          </div>
        </div>
      `;
    }

    html += `<div class="section-group-header"><span>👨‍👩‍👧‍👦 가족 & 동료 (${humans.length})</span></div>`;
    for (const h of humans) {
      html += `
        <div class="friend-item" data-friend-id="${escapeHtml(h.id)}">
          <div class="squircle-avatar">${escapeHtml(h.avatar)}</div>
          <div class="friend-info">
            <div class="friend-name-row">
              <span class="friend-name">${escapeHtml(h.name)}</span>
            </div>
            <div class="friend-status">${escapeHtml(h.status_message)}</div>
          </div>
        </div>
      `;
    }

    el.tabContents.friends.innerHTML = html;
    el.tabContents.friends.querySelectorAll('[data-friend-id]').forEach(node => {
      node.addEventListener('click', () => {
        openDirectChatWith(node.getAttribute('data-friend-id'));
      });
    });
  }

  function renderChatsTab() {
    const q = state.filterQuery.toLowerCase();
    const list = state.rooms.filter(r => {
      if (!q) return true;
      const lastText = r.lastMessage ? r.lastMessage.content : '';
      return r.name.toLowerCase().includes(q) || lastText.toLowerCase().includes(q);
    });

    let html = '';
    for (const r of list) {
      const isActive = r.id === state.activeRoomId;
      const lastMsg = r.lastMessage;
      const preview = lastMsg
        ? `${String(lastMsg.content).replace(/\n+/g, ' ').slice(0, 46)}`
        : '대화를 시작해보세요.';
      const timeStr = lastMsg ? formatShortTime(lastMsg.createdAt) : '';
      const pinIcon = r.is_pinned ? '<span title="상단 고정">📌</span>' : '';
      const unreadHtml = r.unreadCount > 0 ? `<span class="room-unread-badge">${r.unreadCount}</span>` : '';

      html += `
        <div class="room-item ${isActive ? 'active' : ''}" data-room-id="${escapeHtml(r.id)}">
          <div class="squircle-avatar">${escapeHtml(r.avatar || '💬')}</div>
          <div class="room-info">
            <div class="room-name-row">
              ${pinIcon}
              <span class="room-name">${escapeHtml(r.name)}</span>
              <span class="member-count-pill">${r.memberCount}</span>
            </div>
            <div class="room-preview">${escapeHtml(preview)}</div>
          </div>
          <div class="room-meta-right">
            <span class="room-time">${timeStr}</span>
            ${unreadHtml}
          </div>
        </div>
      `;
    }

    el.tabContents.chats.innerHTML = html;
    el.tabContents.chats.querySelectorAll('[data-room-id]').forEach(node => {
      node.addEventListener('click', () => {
        selectRoom(node.getAttribute('data-room-id'));
      });
    });
  }

  function renderAiHubTab() {
    const b = state.bridges || {};
    const portalUrl = 'https://ryu-dongsoo.github.io/ooyoo/';
    const tailscaleUrl = '/';
    const fullKokioUrl = portalUrl;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(fullKokioUrl)}`;

    el.tabContents.aihub.innerHTML = `
      <div class="hub-card" style="background:#FEFCE8;border-color:#FDE047;text-align:center;">
        <h3 style="justify-content:center;">📱 핸드폰 카메라로 스캔하여 바로 열기</h3>
        <img src="${qrSrc}" alt="꼬끼오톡 모바일 접속 QR" style="width:150px;height:150px;border-radius:12px;margin:8px auto;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.1);" />
        <p style="color:#713F12;margin-top:4px;">
          <a href="${escapeHtml(fullKokioUrl)}" target="_blank" style="font-weight:800;color:#B45309;word-break:break-all;">${escapeHtml(fullKokioUrl)}</a>
        </p>
      </div>

      <div class="hub-card">
        <h3>🥛 자연어 대화 방식 안내</h3>
        <p>
          • <strong>우유(Ooyoo 🥛) 1:1 대화방</strong>: 그냥 자연어로 무엇이든 말씀하시면 지금 이 컴퓨터의 안티그래비티 우유에게 바로 도착하여 우유가 작성한 글이 그대로 뜹니다.<br/>
          • <strong>단톡방에서 부를 때</strong>: <code>우유야 ~해줘</code> 또는 <code>에아야 ~해줘</code>라고 자연어로 말씀하시면 해당 AI 비서의 답변 글이 도착합니다.
        </p>
      </div>
    `;
  }

  function renderDrawerTab() {
    const files = state.drawer.files || [];
    const links = state.drawer.links || [];
    let html = `
      <div class="hub-card" style="background:#ECFDF5;border-color:#A7F3D0;">
        <h3 style="color:#065F46;">🗄️ 코끼오 무제한 톡서랍 (유효기간 만료 없음)</h3>
        <p style="color:#047857;margin:0;">모든 첨부파일은 <code>storage/uploads</code>에 영구 보존됩니다.</p>
      </div>
      <div class="section-group-header"><span>📎 영구 보관 파일 (${files.length})</span></div>
    `;
    for (const f of files) {
      const sizeKb = ((f.fileSize || 0) / 1024).toFixed(1);
      html += `
        <div class="drawer-item">
          <div class="drawer-item-meta">
            <div class="drawer-item-title">📄 ${escapeHtml(f.fileName)}</div>
            <div class="drawer-item-sub">${sizeKb} KB · <span class="att-permanence-tag">영구보관</span></div>
          </div>
          <a href="${API_PREFIX}${escapeHtml(f.url)}" download="${escapeHtml(f.fileName)}" class="btn-secondary" style="text-decoration:none;padding:5px 9px;font-size:11.5px;">다운로드</a>
        </div>
      `;
    }
    html += `<div class="section-group-header" style="margin-top:10px;"><span>🔗 공유된 링크 (${links.length})</span></div>`;
    for (const l of links) {
      html += `
        <div class="drawer-item">
          <div class="drawer-item-meta">
            <div class="drawer-item-title"><a href="${escapeHtml(l.url)}" target="_blank">${escapeHtml(l.url)}</a></div>
          </div>
        </div>
      `;
    }
    el.tabContents.drawer.innerHTML = html;
  }

  function getActiveRoom() {
    return state.rooms.find(r => r.id === state.activeRoomId) || state.rooms[0];
  }

  async function selectRoom(roomId) {
    if (!roomId) return;
    state.activeRoomId = roomId;
    state.lastMsgSignature = '';
    document.body.classList.add('mobile-chat-open');
    renderChatsTab();
    updateChatHeader();
    await loadRoomMessages(roomId, true);
    await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.activeSenderId })
    });
  }

  async function openDirectChatWith(targetUserId) {
    if (targetUserId === 'ryu') return selectRoom('room-self');
    if (targetUserId === 'ea') return selectRoom('room-ea');
    if (targetUserId === 'ooyoo') return selectRoom('room-ooyoo');
    const res = await apiFetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomType: 'direct', memberIds: ['ryu', targetUserId] })
    });
    const data = await res.json();
    if (data.ok) {
      state.rooms = data.rooms || state.rooms;
      switchNavTab('chats');
      await selectRoom(data.roomId);
    }
  }

  function updateChatHeader() {
    const room = getActiveRoom();
    if (!room) return;
    el.activeRoomAvatar.textContent = room.avatar || '🥛';
    el.activeRoomName.textContent = room.name;
    el.activeRoomCount.textContent = String(room.memberCount || 2);
    el.btnTogglePin.className = `pin-btn ${room.is_pinned ? 'pinned' : ''}`;
    el.activeRoomMembersPreview.textContent = (room.members || []).map(m => m.name).join(', ');
    const noticeText = (room.pinned_notice || '').trim();
    el.roomNoticeText.textContent = noticeText;
    const noticeBar = document.getElementById('room-notice-bar');
    if (noticeBar) {
      noticeBar.classList.toggle('hidden', !noticeText);
    }
  }

  async function loadRoomMessages(roomId, scrollBottom) {
    try {
      const res = await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/messages?limit=150`);
      const data = await res.json();
      if (data.ok) {
        state.messagesByRoom[roomId] = data.messages || [];
        if (roomId === state.activeRoomId) {
          renderActiveRoomMessages(scrollBottom);
        }
      }
    } catch (err) {
      console.error('Load messages error:', err);
    }
  }

  function renderActiveRoomMessages(scrollBottom) {
    const msgs = state.messagesByRoom[state.activeRoomId] || [];
    const q = state.inRoomSearchQuery.toLowerCase();
    const filtered = q ? msgs.filter(m => String(m.content || '').toLowerCase().includes(q)) : msgs;

    let html = '';
    let lastDateStr = '';

    for (const m of filtered) {
      const dateStr = formatFullDate(m.createdAt);
      if (dateStr !== lastDateStr) {
        html += `<div class="date-divider">📅 ${escapeHtml(dateStr)}</div>`;
        lastDateStr = dateStr;
      }

      const isMine = m.senderId === state.activeSenderId;
      const isAi = m.senderRoleType === 'ai_agent';
      const unreadNum = Number(m.unreadCount) > 0 ? `<span class="kakao-unread-one">${m.unreadCount}</span>` : '';
      const timeStr = formatShortTime(m.createdAt);

      let replyHtml = '';
      if (m.replyTo) {
        replyHtml = `
          <div class="bubble-reply-quote">
            <strong>↩️ ${escapeHtml(m.replyTo.senderName)}에게 답장</strong>
            <span>${escapeHtml(m.replyTo.content)}</span>
          </div>
        `;
      }

      let attHtml = '';
      if (Array.isArray(m.attachments) && m.attachments.length > 0) {
        attHtml = '<div class="bubble-attachments">';
        for (const a of m.attachments) {
          const rawUrl = String(a.url || '');
          const fullUrl = rawUrl.startsWith('/uploads/') ? `${API_PREFIX}${rawUrl}` : rawUrl;
          const isImg = String(a.mimeType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.fileName || '');
          if (isImg) {
            attHtml += `<a href="${escapeHtml(fullUrl)}" target="_blank"><img src="${escapeHtml(fullUrl)}" class="att-image-preview" alt="${escapeHtml(a.fileName)}" /></a>`;
          } else {
            attHtml += `
              <a href="${escapeHtml(fullUrl)}" download="${escapeHtml(a.fileName)}" class="att-file-card">
                <div><strong>📎 ${escapeHtml(a.fileName)}</strong></div>
                <span>⬇️</span>
              </a>
            `;
          }
        }
        attHtml += '</div>';
      }

      let reactionsHtml = '';
      const reactionEntries = Object.entries(m.reactions || {});
      if (reactionEntries.length > 0) {
        reactionsHtml = '<div class="msg-reactions-row">';
        for (const [emoji, users] of reactionEntries) {
          if (!Array.isArray(users) || users.length === 0) continue;
          const activeClass = users.includes(state.activeSenderId) ? 'active' : '';
          reactionsHtml += `
            <button class="reaction-chip ${activeClass}" data-react-id="${m.id}" data-emoji="${escapeHtml(emoji)}">
              <span>${escapeHtml(emoji)}</span>
              <span>${users.length}</span>
            </button>
          `;
        }
        reactionsHtml += '</div>';
      }

      const renderedBody = renderMarkdownContent(m.content);

      html += `
        <div class="msg-row ${isMine ? 'mine' : 'other'}" data-msg-id="${m.id}">
          ${!isMine ? `<div class="squircle-avatar sm ${isAi ? 'ai-avatar' : ''}">${escapeHtml(m.senderAvatar || '🥛')}</div>` : ''}
          <div class="msg-body-col">
            ${!isMine ? `
              <div class="msg-sender-line">
                <span>${escapeHtml(m.senderName || '우유 (Ooyoo 🥛)')}</span>
                ${isAi ? '<span class="ai-pill">AI</span>' : ''}
              </div>
            ` : ''}
            <div class="msg-bubble-line">
              <div class="msg-bubble">
                ${replyHtml}
                <div class="msg-content">${renderedBody}</div>
                ${attHtml}
              </div>
              <div class="msg-meta-side">
                ${unreadNum}
                <span class="kakao-msg-time">${timeStr}</span>
              </div>
            </div>
            ${reactionsHtml}
            <div class="msg-hover-tools">
              <button class="hover-tool-btn" data-action="reply" data-id="${m.id}" title="답장">↩️</button>
              <button class="hover-tool-btn" data-action="react" data-id="${m.id}" data-emoji="❤️" title="하트">❤️</button>
              <button class="hover-tool-btn" data-action="react" data-id="${m.id}" data-emoji="👍" title="좋아요">👍</button>
              <button class="hover-tool-btn" data-action="react" data-id="${m.id}" data-emoji="✅" title="확인">✅</button>
              <button class="hover-tool-btn" data-action="tts" data-id="${m.id}" title="음성으로 읽어주기">🔊</button>
              <button class="hover-tool-btn" data-action="copy" data-id="${m.id}" title="복사">📋</button>
            </div>
          </div>
        </div>
      `;
    }

    el.messageStream.innerHTML = html;

    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(el.messageStream, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      } catch {}
    }

    el.messageStream.querySelectorAll('[data-react-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleReaction(Number(btn.getAttribute('data-react-id')), btn.getAttribute('data-emoji'));
      });
    });

    el.messageStream.querySelectorAll('.hover-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const msgId = Number(btn.getAttribute('data-id'));
        const targetMsg = msgs.find(x => x.id === msgId);
        if (!targetMsg) return;
        if (action === 'reply') {
          state.replyToMsg = targetMsg;
          el.replyTargetName.textContent = `↩️ ${targetMsg.senderName}에게 답장`;
          el.replyTargetText.textContent = targetMsg.content.replace(/\n+/g, ' ').slice(0, 100);
          el.replyPreviewBar.classList.remove('hidden');
          el.chatInput.focus();
        } else if (action === 'react') {
          toggleReaction(msgId, btn.getAttribute('data-emoji'));
        } else if (action === 'tts') {
          speakTextKorean(targetMsg.content);
        } else if (action === 'copy') {
          navigator.clipboard.writeText(targetMsg.content);
        }
      });
    });

    if (scrollBottom) scrollToBottom();
  }

  function renderMarkdownContent(raw) {
    const text = String(raw || '');
    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        return window.marked.parse(text, { breaks: true, gfm: true });
      } catch {}
    }
    return escapeHtml(text).replace(/\n/g, '<br/>');
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      el.messageStream.scrollTop = el.messageStream.scrollHeight;
    });
  }

  let stopVoiceSttFn = null;

  async function sendCurrentMessage() {
    if (stopVoiceSttFn) stopVoiceSttFn();
    const content = el.chatInput.value.trim();
    if (!content && state.pendingAttachments.length === 0) return;

    const payload = {
      roomId: state.activeRoomId,
      senderId: state.activeSenderId,
      content,
      replyToId: state.replyToMsg ? state.replyToMsg.id : null,
      model: state.activeModel,
      level: state.activeLevel,
      attachments: state.pendingAttachments
    };

    el.chatInput.value = '';
    state.replyToMsg = null;
    el.replyPreviewBar.classList.add('hidden');
    state.pendingAttachments = [];
    renderPendingAttachments();

    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Send error:', err);
    }
  }

  async function toggleReaction(messageId, emoji) {
    try {
      await apiFetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.activeSenderId, emoji })
      });
    } catch {}
  }

  async function handleFilesSelected(fileList) {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      const base64Data = await readFileAsDataUrl(file);
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data
        })
      });
      const data = await res.json();
      if (data.ok && data.attachment) {
        state.pendingAttachments.push(data.attachment);
      }
    }
    renderPendingAttachments();
  }

  function renderPendingAttachments() {
    if (state.pendingAttachments.length === 0) {
      el.pendingAttachmentsBar.classList.add('hidden');
      el.pendingAttachmentsBar.innerHTML = '';
      return;
    }
    el.pendingAttachmentsBar.classList.remove('hidden');
    el.pendingAttachmentsBar.innerHTML = `
      <div>📎 첨부 대기 (${state.pendingAttachments.length}개): <strong>${state.pendingAttachments.map(a => escapeHtml(a.fileName)).join(', ')}</strong></div>
      <button id="btn-clear-atts" class="clear-btn">✕</button>
    `;
    document.getElementById('btn-clear-atts')?.addEventListener('click', () => {
      state.pendingAttachments = [];
      renderPendingAttachments();
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function switchNavTab(tabName) {
    state.activeTab = tabName;
    el.navBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabName));
    Object.entries(el.tabContents).forEach(([k, node]) => node.classList.toggle('active', k === tabName));
    const titles = {
      friends: t('pane_friends'),
      chats: t('pane_chats'),
      aihub: t('pane_aihub'),
      drawer: t('pane_drawer')
    };
    el.paneTitle.textContent = titles[tabName] || t('pane_chats');
  }

  function openPcRemoteModal() {
    const modal = document.getElementById('modal-pc-remote');
    modal?.classList.remove('hidden');
    const img = document.getElementById('remote-screen-img');
    const fetchFrame = async () => {
      if (modal?.classList.contains('hidden')) return;
      try {
        const res = await apiFetch('/api/remote/frame');
        const data = await res.json();
        if (data && data.image) {
          img.src = 'data:image/jpeg;base64,' + data.image;
        }
      } catch {}
    };
    fetchFrame();
    if (state.remoteTimer) clearInterval(state.remoteTimer);
    state.remoteTimer = setInterval(fetchFrame, 900);
  }

  function bindEvents() {
    document.getElementById('btn-install-pwa-left')?.addEventListener('click', triggerPwaInstall);
    document.getElementById('btn-install-pwa-header')?.addEventListener('click', triggerPwaInstall);
    document.getElementById('btn-copy-kokio-url')?.addEventListener('click', () => {
      const targetUrl = 'https://ryu-dongsoo.github.io/ooyoo/';
      navigator.clipboard.writeText(targetUrl);
      alert('꼬끼오톡 고정 포털 주소가 복사되었습니다! 크롬이나 사파리 주소창에 붙여넣어 주세요.');
    });

    const profileSel = document.getElementById('sender-profile-select');
    if (profileSel) {
      profileSel.value = state.activeSenderId;
      profileSel.addEventListener('change', async () => {
        state.activeSenderId = profileSel.value;
        localStorage.setItem('kokio_sender_id', state.activeSenderId);
        await fetchBootstrap();
        if (state.activeRoomId) {
          await selectRoom(state.activeRoomId);
        }
      });
    }

    const voiceBtn = document.getElementById('btn-voice-stt');
    let activeRec = null;
    let voiceSilenceTimer = null;

    function stopVoiceStt() {
      state.isRecordingStt = false;
      if (voiceSilenceTimer) {
        clearTimeout(voiceSilenceTimer);
        voiceSilenceTimer = null;
      }
      if (activeRec) {
        try { activeRec.onend = null; activeRec.stop(); } catch {}
        activeRec = null;
      }
      if (voiceBtn) {
        voiceBtn.textContent = '🎤';
        voiceBtn.style.background = '';
        voiceBtn.style.borderColor = '';
      }
    }
    stopVoiceSttFn = stopVoiceStt;

    function resetVoiceSilenceTimer() {
      if (voiceSilenceTimer) clearTimeout(voiceSilenceTimer);
      // 15초 동안 아무 말씀이 없으실 때만 자동 종료 (한마디 후 숨 고르실 때는 절대 안 끊김!)
      voiceSilenceTimer = setTimeout(() => {
        stopVoiceStt();
      }, 15000);
    }

    function startSingleVoiceSegment() {
      if (!state.isRecordingStt) return;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return;

      const rec = new SR();
      activeRec = rec;
      rec.lang = 'ko-KR';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      const segmentBaseText = el.chatInput.value.trim();
      let latestTranscript = '';

      rec.onresult = (ev) => {
        resetVoiceSilenceTimer();
        let combined = '';
        for (let i = 0; i < ev.results.length; i++) {
          const piece = (ev.results[i]?.[0]?.transcript || '').trim();
          if (piece) combined = piece;
        }
        if (combined) {
          latestTranscript = combined;
          el.chatInput.value = segmentBaseText ? `${segmentBaseText} ${latestTranscript}` : latestTranscript;
        }
      };

      rec.onend = () => {
        activeRec = null;
        if (state.isRecordingStt) {
          // 한 문장이 끝나도 문자 키보드로 넘어가지 않고 바로 다음 문장 연속 대기!
          setTimeout(() => {
            if (state.isRecordingStt) startSingleVoiceSegment();
          }, 120);
        }
      };

      rec.onerror = (ev) => {
        if (ev && (ev.error === 'not-allowed' || ev.error === 'service-not-allowed')) {
          stopVoiceStt();
        }
      };

      try {
        rec.start();
      } catch {
        setTimeout(() => {
          if (state.isRecordingStt) startSingleVoiceSegment();
        }, 250);
      }
    }

    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
          alert('이 브라우저에서는 음성 인식을 지원하지 않습니다.');
          return;
        }
        if (state.isRecordingStt) {
          stopVoiceStt();
          return;
        }
        // 음성 입력 시작 시 소프트 키보드가 올라오지 않도록 입력창 포커스 해제
        el.chatInput.blur();
        state.isRecordingStt = true;
        voiceBtn.textContent = '🔴';
        voiceBtn.style.background = 'rgba(239, 68, 68, 0.22)';
        voiceBtn.style.borderColor = '#EF4444';
        resetVoiceSilenceTimer();
        startSingleVoiceSegment();
      });
    }

    el.chatInput.addEventListener('paste', (ev) => {
      const items = ev.clipboardData?.items;
      if (!items) return;
      const files = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        handleFilesSelected(files);
      }
    });

    el.navBtns.forEach(btn => {
      btn.addEventListener('click', () => switchNavTab(btn.getAttribute('data-tab')));
    });

    document.getElementById('btn-mobile-back')?.addEventListener('click', () => {
      document.body.classList.remove('mobile-chat-open');
    });

    function applyTheme(themeName) {
      const idx = state.themes.indexOf(themeName);
      state.themeIdx = idx !== -1 ? idx : 0;
      const activeTheme = state.themes[state.themeIdx];
      state.themes.forEach(t => document.body.classList.remove(t));
      document.body.classList.add(activeTheme);
      try { localStorage.setItem('kokio_theme', activeTheme); } catch {}

      const headerBtn = document.getElementById('btn-header-theme');
      const listBtn = document.getElementById('btn-list-theme');
      const metaTheme = document.getElementById('meta-theme-color');
      if (activeTheme === 'theme-dark') {
        if (headerBtn) headerBtn.textContent = t('btn_light');
        if (listBtn) listBtn.textContent = '☀️';
        if (metaTheme) metaTheme.setAttribute('content', '#282C37');
      } else if (activeTheme === 'theme-classic') {
        if (headerBtn) headerBtn.textContent = t('btn_dark');
        if (listBtn) listBtn.textContent = '🌙';
        if (metaTheme) metaTheme.setAttribute('content', '#282C37');
      } else {
        if (headerBtn) headerBtn.textContent = t('btn_dark');
        if (listBtn) listBtn.textContent = '🌙';
        if (metaTheme) metaTheme.setAttribute('content', '#282C37');
      }
    }

    function toggleDarkLight() {
      const cur = state.themes[state.themeIdx];
      const next = cur === 'theme-dark' ? 'theme-classic' : 'theme-dark';
      applyTheme(next);
    }

    const savedTheme = localStorage.getItem('kokio_theme') || 'theme-dark';
    applyTheme(savedTheme);
    applyUiLanguage(state.uiLang);

    const uiLangSel = document.getElementById('ui-lang-select');
    if (uiLangSel) {
      uiLangSel.value = state.uiLang;
      uiLangSel.addEventListener('change', () => applyUiLanguage(uiLangSel.value));
    }

    document.getElementById('btn-theme-cycle')?.addEventListener('click', () => {
      const nextIdx = (state.themeIdx + 1) % state.themes.length;
      applyTheme(state.themes[nextIdx]);
    });
    document.getElementById('btn-brand-reload')?.addEventListener('click', () => {
      location.reload();
    });
    document.getElementById('btn-header-theme')?.addEventListener('click', toggleDarkLight);
    document.getElementById('btn-list-theme')?.addEventListener('click', toggleDarkLight);

    // === 1. 좌우 폭 조절 (채팅방 목록/제목 영역 <-> 채팅방 대화창) ===
    const appShell = document.getElementById('kokio-app');
    const paneResizer = document.getElementById('pane-resizer');
    const btnToggleListPane = document.getElementById('btn-toggle-list-pane');

    const savedPaneWidth = Number(localStorage.getItem('kokio_list_pane_width') || 250);
    if (appShell && savedPaneWidth >= 150 && savedPaneWidth <= 500) {
      appShell.style.setProperty('--list-pane-width', `${savedPaneWidth}px`);
    }
    if (localStorage.getItem('kokio_list_collapsed') === '1') {
      document.body.classList.add('list-pane-collapsed');
      if (btnToggleListPane) btnToggleListPane.textContent = '▶';
    }

    function toggleListPaneCollapse() {
      const collapsed = document.body.classList.toggle('list-pane-collapsed');
      if (btnToggleListPane) btnToggleListPane.textContent = collapsed ? '▶' : '◀';
      try { localStorage.setItem('kokio_list_collapsed', collapsed ? '1' : '0'); } catch {}
    }

    btnToggleListPane?.addEventListener('click', toggleListPaneCollapse);
    paneResizer?.addEventListener('dblclick', toggleListPaneCollapse);

    if (paneResizer && appShell) {
      let isResizingPane = false;
      paneResizer.addEventListener('pointerdown', (ev) => {
        isResizingPane = true;
        paneResizer.classList.add('dragging');
        try { paneResizer.setPointerCapture(ev.pointerId); } catch {}
      });
      paneResizer.addEventListener('pointermove', (ev) => {
        if (!isResizingPane) return;
        const navRailWidth = 60;
        const newWidth = Math.round(ev.clientX - navRailWidth);
        if (newWidth < 95) {
          document.body.classList.add('list-pane-collapsed');
          if (btnToggleListPane) btnToggleListPane.textContent = '▶';
          try { localStorage.setItem('kokio_list_collapsed', '1'); } catch {}
        } else {
          document.body.classList.remove('list-pane-collapsed');
          if (btnToggleListPane) btnToggleListPane.textContent = '◀';
          const clamped = Math.max(150, Math.min(Math.min(480, window.innerWidth - 320), newWidth));
          appShell.style.setProperty('--list-pane-width', `${clamped}px`);
          try {
            localStorage.setItem('kokio_list_collapsed', '0');
            localStorage.setItem('kokio_list_pane_width', String(clamped));
          } catch {}
        }
      });
      const endPaneResize = () => {
        if (!isResizingPane) return;
        isResizingPane = false;
        paneResizer.classList.remove('dragging');
      };
      paneResizer.addEventListener('pointerup', endPaneResize);
      paneResizer.addEventListener('pointercancel', endPaneResize);
    }

    // === 2. 상하 간격 조절 (채팅방 상단 제목/공지 <-> 채팅방 메시지 영역) ===
    const headerResizer = document.getElementById('header-resizer');
    const savedHeaderGap = Number(localStorage.getItem('kokio_header_gap') || 6);
    if (appShell && savedHeaderGap >= 0 && savedHeaderGap <= 120) {
      appShell.style.setProperty('--header-bottom-gap', `${savedHeaderGap}px`);
    }
    if (headerResizer && appShell) {
      let isResizingHeader = false;
      let startY = 0;
      let startGap = savedHeaderGap || 6;
      headerResizer.addEventListener('pointerdown', (ev) => {
        isResizingHeader = true;
        startY = ev.clientY;
        const curVal = parseInt(getComputedStyle(appShell).getPropertyValue('--header-bottom-gap'), 10);
        startGap = Number.isNaN(curVal) ? 6 : curVal;
        headerResizer.classList.add('dragging');
        try { headerResizer.setPointerCapture(ev.pointerId); } catch {}
      });
      headerResizer.addEventListener('pointermove', (ev) => {
        if (!isResizingHeader) return;
        const deltaY = Math.round(ev.clientY - startY);
        const nextGap = Math.max(0, Math.min(100, startGap + deltaY));
        appShell.style.setProperty('--header-bottom-gap', `${nextGap}px`);
        try { localStorage.setItem('kokio_header_gap', String(nextGap)); } catch {}
      });
      const endHeaderResize = () => {
        if (!isResizingHeader) return;
        isResizingHeader = false;
        headerResizer.classList.remove('dragging');
      };
      headerResizer.addEventListener('pointerup', endHeaderResize);
      headerResizer.addEventListener('pointercancel', endHeaderResize);
      headerResizer.addEventListener('dblclick', () => {
        el.roomNoticeBar?.classList.toggle('hidden');
      });
    }

    el.modelSelect?.addEventListener('change', async () => {
      state.activeModel = el.modelSelect.value;
      await apiFetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: state.activeModel })
      });
    });
    el.levelSelect?.addEventListener('change', async () => {
      state.activeLevel = el.levelSelect.value;
      await apiFetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: state.activeLevel })
      });
    });

    document.getElementById('btn-open-pc-remote')?.addEventListener('click', openPcRemoteModal);
    document.getElementById('btn-header-pc-remote')?.addEventListener('click', openPcRemoteModal);
    document.getElementById('btn-close-pc-remote')?.addEventListener('click', () => {
      if (state.remoteTimer) clearInterval(state.remoteTimer);
    });
    document.getElementById('remote-screen-img')?.addEventListener('click', async (ev) => {
      const rect = ev.target.getBoundingClientRect();
      const rx = (ev.clientX - rect.left) / rect.width;
      const ry = (ev.clientY - rect.top) / rect.height;
      await apiFetch('/api/remote/mouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rx, ry, button: 'left' })
      });
    });
    document.getElementById('btn-send-remote-key')?.addEventListener('click', async () => {
      const inp = document.getElementById('remote-key-input');
      if (!inp.value) return;
      await apiFetch('/api/remote/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inp.value })
      });
      inp.value = '';
    });
    document.getElementById('btn-send-remote-enter')?.addEventListener('click', async () => {
      await apiFetch('/api/remote/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ special: '{ENTER}' })
      });
    });

    el.globalFilterInput.addEventListener('input', () => {
      state.filterQuery = el.globalFilterInput.value.trim();
      el.btnClearFilter.classList.toggle('hidden', !state.filterQuery);
      renderAllLeftPanes();
    });
    el.btnClearFilter.addEventListener('click', () => {
      state.filterQuery = '';
      el.globalFilterInput.value = '';
      el.btnClearFilter.classList.add('hidden');
      renderAllLeftPanes();
    });

    document.getElementById('btn-room-search')?.addEventListener('click', () => {
      el.inRoomSearchBar.classList.toggle('hidden');
      if (!el.inRoomSearchBar.classList.contains('hidden')) el.inRoomSearchInput.focus();
    });
    document.getElementById('btn-close-room-search')?.addEventListener('click', () => {
      state.inRoomSearchQuery = '';
      el.inRoomSearchInput.value = '';
      el.inRoomSearchBar.classList.add('hidden');
      renderActiveRoomMessages(false);
    });
    el.inRoomSearchInput.addEventListener('input', () => {
      state.inRoomSearchQuery = el.inRoomSearchInput.value.trim();
      renderActiveRoomMessages(false);
    });

    el.btnCancelReply.addEventListener('click', () => {
      state.replyToMsg = null;
      el.replyPreviewBar.classList.add('hidden');
    });

    el.btnSendMessage.addEventListener('click', sendCurrentMessage);
    el.chatInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        sendCurrentMessage();
      }
    });

    el.fileUploadInput.addEventListener('change', () => {
      handleFilesSelected(el.fileUploadInput.files);
      el.fileUploadInput.value = '';
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-close');
        if (id) document.getElementById(id)?.classList.add('hidden');
      });
    });

    document.getElementById('btn-open-new-room')?.addEventListener('click', () => {
      const container = document.getElementById('new-room-members-list');
      container.innerHTML = state.users
        .filter(u => u.id !== 'ryu')
        .map(u => `
          <label class="checkbox-member-row">
            <input type="checkbox" value="${escapeHtml(u.id)}" ${u.id === 'ooyoo' || u.id === 'ea' ? 'checked' : ''} />
            <span>${escapeHtml(u.avatar)} <strong>${escapeHtml(u.name)}</strong> ${u.role_type === 'ai_agent' ? '<span class="ai-pill">AI</span>' : ''}</span>
          </label>
        `)
        .join('');
      document.getElementById('modal-new-room')?.classList.remove('hidden');
    });

    document.getElementById('btn-confirm-create-room')?.addEventListener('click', async () => {
      const checked = Array.from(document.querySelectorAll('#new-room-members-list input:checked')).map(i => i.value);
      const name = document.getElementById('new-room-name').value.trim();
      const avatar = document.getElementById('new-room-avatar').value.trim() || '💬';
      const res = await apiFetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatar, roomType: 'group', memberIds: ['ryu', ...checked] })
      });
      const data = await res.json();
      if (data.ok) {
        document.getElementById('modal-new-room')?.classList.add('hidden');
        await fetchBootstrap();
        await selectRoom(data.roomId);
      }
    });

    document.getElementById('btn-open-new-friend')?.addEventListener('click', () => {
      document.getElementById('modal-new-friend')?.classList.remove('hidden');
    });

    document.getElementById('btn-confirm-create-user')?.addEventListener('click', async () => {
      const roleType = document.getElementById('new-user-role').value;
      const name = document.getElementById('new-user-name').value.trim();
      const avatar = document.getElementById('new-user-avatar').value.trim() || '🤖';
      const statusMessage = document.getElementById('new-user-status').value.trim();
      const endpoint = document.getElementById('new-user-endpoint').value.trim();
      if (!name) return alert('이름을 입력해주세요.');
      await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleType, name, avatar, statusMessage, endpoint })
      });
      document.getElementById('modal-new-friend')?.classList.add('hidden');
      await fetchBootstrap();
      switchNavTab('friends');
    });

    document.getElementById('btn-open-vault-picker')?.addEventListener('click', () => {
      document.getElementById('modal-vault-picker')?.classList.remove('hidden');
      loadVaultFiles('');
    });
    document.getElementById('btn-search-vault')?.addEventListener('click', () => {
      loadVaultFiles(document.getElementById('vault-search-input').value.trim());
    });

    initLiveInterpreter();
    initDotDayCalendar();
  }

  function initDotDayCalendar() {
    const modal = document.getElementById('modal-dotday-calendar');
    const btnNav = document.getElementById('btn-nav-calendar');
    const btnHeader = document.getElementById('btn-header-calendar');
    const btnComposer = document.getElementById('btn-composer-calendar');
    const btnPrev = document.getElementById('btn-cal-prev');
    const btnNext = document.getElementById('btn-cal-next');
    const btnToday = document.getElementById('btn-cal-today');
    const btnRefresh = document.getElementById('btn-cal-refresh');
    const hideAutoCheckbox = document.getElementById('dotday-hide-auto');
    const monthTitleEl = document.getElementById('dotday-month-title');
    const daysGridEl = document.getElementById('dotday-days-grid');
    const selectedDateLabelEl = document.getElementById('dotday-selected-date-label');
    const selectedCountEl = document.getElementById('dotday-selected-count');
    const dayEventsListEl = document.getElementById('dotday-day-events-list');
    const newTitleInput = document.getElementById('dotday-new-title');
    const newTimeInput = document.getElementById('dotday-new-time');
    const newColorSelect = document.getElementById('dotday-new-color');
    const newCalSelect = document.getElementById('dotday-new-cal');
    const btnAddSubmit = document.getElementById('btn-dotday-add-submit');

    if (!modal || !daysGridEl) return;

    const now = new Date();
    let curYear = now.getFullYear();
    let curMonth = now.getMonth() + 1; // 1~12
    let selectedDateStr = toYmd(now);
    let cachedEvents = [];

    function toYmd(d) {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }

    async function openCalendarModal() {
      modal.classList.remove('hidden');
      await fetchAndRenderMonth(curYear, curMonth);
    }

    btnNav?.addEventListener('click', openCalendarModal);
    btnHeader?.addEventListener('click', openCalendarModal);
    btnComposer?.addEventListener('click', openCalendarModal);

    btnPrev?.addEventListener('click', () => {
      curMonth--;
      if (curMonth < 1) { curMonth = 12; curYear--; }
      fetchAndRenderMonth(curYear, curMonth);
    });

    btnNext?.addEventListener('click', () => {
      curMonth++;
      if (curMonth > 12) { curMonth = 1; curYear++; }
      fetchAndRenderMonth(curYear, curMonth);
    });

    btnToday?.addEventListener('click', () => {
      const t = new Date();
      curYear = t.getFullYear();
      curMonth = t.getMonth() + 1;
      selectedDateStr = toYmd(t);
      fetchAndRenderMonth(curYear, curMonth);
    });

    btnRefresh?.addEventListener('click', () => {
      fetchAndRenderMonth(curYear, curMonth);
    });

    hideAutoCheckbox?.addEventListener('change', () => {
      renderMonthGrid();
      renderSelectedDayDetail();
    });

    function isAutoGeneratedEvent(ev) {
      const t = String(ev.title || '');
      const d = String(ev.description || '');
      if (/\[(마감\/일정|PCB-SMT|Google Cloud)\]/.test(t)) return true;
      if (/(\[✉️ 지메일 자동|\[지메일 자동|\[🏫 전북대메일|■ 경로: 1\. Projects\/)/.test(d)) return true;
      return false;
    }

    async function fetchAndRenderMonth(year, month) {
      if (monthTitleEl) monthTitleEl.textContent = `${year}년 ${month}월`;
      daysGridEl.innerHTML = '<div style="grid-column:1/-1;padding:24px;text-align:center;">📅 PC DotDay · 구글 캘린더 일정 불러오는 중...</div>';
      try {
        const res = await apiFetch(`/api/calendar?year=${year}&month=${month}`);
        const data = await res.json();
        if (data.ok) {
          cachedEvents = data.events || [];
        }
      } catch (e) {
        console.error('Calendar fetch error:', e);
      }
      renderMonthGrid();
      renderSelectedDayDetail();
    }

    function getEventsForDate(ymd) {
      const hideAuto = Boolean(hideAutoCheckbox?.checked);
      return cachedEvents.filter(ev => {
        if (hideAuto && isAutoGeneratedEvent(ev)) return false;
        const s = ev.startDate || '';
        const e = ev.endDate || s;
        return s <= ymd && ymd <= e;
      });
    }

    function renderMonthGrid() {
      const firstDay = new Date(curYear, curMonth - 1, 1);
      const startDow = firstDay.getDay(); // 0=Sun
      const startCellDate = new Date(curYear, curMonth - 1, 1 - startDow);
      const todayYmd = toYmd(new Date());

      let html = '';
      for (let i = 0; i < 42; i++) {
        const cellDate = new Date(startCellDate.getFullYear(), startCellDate.getMonth(), startCellDate.getDate() + i);
        const ymd = toYmd(cellDate);
        const isCurrentMonth = (cellDate.getMonth() + 1) === curMonth;
        const isToday = ymd === todayYmd;
        const isPast = ymd < todayYmd;
        const isSelected = ymd === selectedDateStr;
        const dow = cellDate.getDay();

        const dayEvs = getEventsForDate(ymd);
        const holidayEv = dayEvs.find(e => e.isHoliday);
        const scheduleEvs = dayEvs.filter(e => !e.isHoliday);

        const classes = [
          'dotday-cell',
          !isCurrentMonth ? 'other-month' : '',
          isToday ? 'today' : '',
          isPast ? 'past-day' : '',
          isSelected ? 'selected' : '',
          dow === 0 ? 'sun' : (dow === 6 ? 'sat' : ''),
          holidayEv ? 'holiday' : ''
        ].filter(Boolean).join(' ');

        const maxChips = 4;
        const visibleEvs = scheduleEvs.slice(0, maxChips);
        const extraCount = scheduleEvs.length - visibleEvs.length;

        const chipsHtml = visibleEvs.map(ev => {
          const timePrefix = ev.startTime ? `${ev.startTime} ` : '';
          const cleanChipTitle = String(ev.title || '')
            .replace(/^[📧🏫🟣🟠☁️🔧✈️🚄🚗🚙]+\s*/u, '')
            .replace(/^\[(마감\/일정|마감|학사일정|Google Cloud)\]\s*/u, '');
          return `<div class="dotday-ev-chip" style="background:${escapeHtml(ev.color || '#FB8C00')};" title="${escapeHtml(timePrefix + ev.title)}">${escapeHtml(cleanChipTitle || ev.title)}</div>`;
        }).join('');

        const moreHtml = extraCount > 0 ? `<div class="dotday-more-tag">+${extraCount}건</div>` : '';

        html += `
          <div class="${classes}" data-ymd="${ymd}">
            <div class="dotday-cell-top">
              <span class="day-num">${cellDate.getDate()}</span>
              ${holidayEv ? `<span class="holiday-label">${escapeHtml(holidayEv.title)}</span>` : ''}
            </div>
            ${chipsHtml}
            ${moreHtml}
          </div>
        `;
      }

      daysGridEl.innerHTML = html;
      daysGridEl.querySelectorAll('.dotday-cell').forEach(cell => {
        cell.addEventListener('click', () => {
          selectedDateStr = cell.getAttribute('data-ymd');
          daysGridEl.querySelectorAll('.dotday-cell').forEach(c => c.classList.toggle('selected', c.getAttribute('data-ymd') === selectedDateStr));
          renderSelectedDayDetail();
        });
      });
    }

    function renderSelectedDayDetail() {
      if (!selectedDateStr || !dayEventsListEl) return;
      const [yy, mm, dd] = selectedDateStr.split('-').map(Number);
      const dt = new Date(yy, mm - 1, dd);
      const wkNames = ['일', '월', '화', '수', '목', '금', '토'];
      if (selectedDateLabelEl) {
        selectedDateLabelEl.textContent = `📅 ${yy}년 ${mm}월 ${dd}일 (${wkNames[dt.getDay()]})`;
      }

      const evs = getEventsForDate(selectedDateStr);
      if (selectedCountEl) selectedCountEl.textContent = `${evs.length}건`;

      if (evs.length === 0) {
        dayEventsListEl.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-secondary);font-size:12.5px;">등록된 일정이 없습니다.<br/>아래에서 새 일정을 등록하시면 PC DotDay에도 즉시 반영됩니다!</div>`;
        return;
      }

      dayEventsListEl.innerHTML = evs.map(ev => {
        const timeBadge = ev.allDay ? '종일' : `${ev.startTime || ''}${ev.endTime ? ' ~ ' + ev.endTime : ''}`;
        const delBtn = ev.writable && !ev.isHoliday
          ? `<button class="dotday-del-btn" data-del-id="${escapeHtml(ev.id)}" data-cal-id="${escapeHtml(ev.calendarId)}">삭제</button>`
          : '';
        return `
          <div class="dotday-event-card" style="border-left-color:${escapeHtml(ev.color || '#FB8C00')};">
            <div class="dotday-event-info">
              <div class="dotday-event-title">${escapeHtml(ev.title)}</div>
              <div class="dotday-event-sub">⏰ ${escapeHtml(timeBadge)} · ${escapeHtml(ev.calendarName || '')}</div>
              ${ev.description ? `<div class="dotday-event-sub" style="margin-top:3px;white-space:pre-line;">${escapeHtml(ev.description.slice(0, 140))}</div>` : ''}
            </div>
            ${delBtn}
          </div>
        `;
      }).join('');

      dayEventsListEl.querySelectorAll('[data-del-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const eventId = btn.getAttribute('data-del-id');
          const calendarId = btn.getAttribute('data-cal-id');
          if (!confirm('이 일정을 삭제할까요? (PC DotDay에서도 함께 삭제됩니다)')) return;
          try {
            const res = await apiFetch('/api/calendar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', eventId, calendarId })
            });
            const data = await res.json();
            if (data.ok) {
              await fetchAndRenderMonth(curYear, curMonth);
            } else {
              alert('삭제 실패: ' + (data.error || '오류'));
            }
          } catch {}
        });
      });
    }

    async function handleAddEvent() {
      const title = (newTitleInput?.value || '').trim();
      if (!title) {
        alert('일정 제목을 입력해 주세요!');
        return;
      }
      const startTime = (newTimeInput?.value || '').trim();
      const colorId = newColorSelect?.value || '';
      const calendarId = newCalSelect?.value || 'ryudongsoo@gmail.com';

      btnAddSubmit.disabled = true;
      btnAddSubmit.textContent = '등록 중...';
      try {
        const res = await apiFetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            calendarId,
            title,
            startDate: selectedDateStr,
            endDate: selectedDateStr,
            startTime,
            allDay: !startTime,
            colorId
          })
        });
        const data = await res.json();
        if (data.ok) {
          newTitleInput.value = '';
          newTimeInput.value = '';
          await fetchAndRenderMonth(curYear, curMonth);
        } else {
          alert('일정 등록 실패: ' + (data.error || '오류'));
        }
      } catch (e) {
        alert('네트워크 오류: ' + e.message);
      } finally {
        btnAddSubmit.disabled = false;
        btnAddSubmit.textContent = '📅 일정 등록하기';
      }
    }

    btnAddSubmit?.addEventListener('click', handleAddEvent);
    newTitleInput?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        handleAddEvent();
      }
    });
  }

  function initLiveInterpreter() {
    const modal = document.getElementById('modal-live-interpreter');
    const btnHeader = document.getElementById('btn-live-interpreter');
    const btnComposer = document.getElementById('btn-open-interpreter');
    const langSelect = document.getElementById('interp-foreign-lang');
    const autoTtsCheck = document.getElementById('interp-auto-tts');
    const btnSaveChat = document.getElementById('btn-interp-save-chat');
    const btnClear = document.getElementById('interp-interp-clear') || document.getElementById('btn-interp-clear');
    const streamEl = document.getElementById('interp-stream');
    const livePreviewEl = document.getElementById('interp-live-preview');
    const liveTextEl = document.getElementById('interp-live-text');
    const btnMicKo = document.getElementById('btn-interp-mic-ko');
    const btnMicForeign = document.getElementById('btn-interp-mic-foreign');
    const btnContinuous = document.getElementById('btn-interp-continuous');
    const foreignFlagEl = document.getElementById('interp-foreign-flag');
    const foreignTitleEl = document.getElementById('interp-foreign-btn-title');
    const textInput = document.getElementById('interp-text-input');
    const btnTextSend = document.getElementById('btn-interp-text-send');

    if (!modal || !streamEl) return;

    const LANG_META = {
      'en': { flag: '🇺🇸', name: '영어', sttLang: 'en-US', ttsLang: 'en-US' },
      'zh-CN': { flag: '🇨🇳', name: '중국어', sttLang: 'zh-CN', ttsLang: 'zh-CN' },
      'ja': { flag: '🇯🇵', name: '일본어', sttLang: 'ja-JP', ttsLang: 'ja-JP' }
    };

    let interpHistory = [];
    let activeMode = null; // 'ko' | 'foreign' | 'continuous' | null
    let recInstance = null;

    function getForeignMeta() {
      const code = langSelect ? langSelect.value : 'en';
      return { code, ...(LANG_META[code] || LANG_META['en']) };
    }

    function updateLangLabels() {
      const meta = getForeignMeta();
      if (foreignFlagEl) foreignFlagEl.textContent = meta.flag;
      if (foreignTitleEl) foreignTitleEl.textContent = `${meta.name}로 듣기`;
    }

    langSelect?.addEventListener('change', () => {
      updateLangLabels();
      if (activeMode) {
        const prev = activeMode;
        stopInterpMic();
        startInterpMic(prev);
      }
    });
    updateLangLabels();

    function openInterpreterModal() {
      if (stopVoiceSttFn) stopVoiceSttFn();
      modal.classList.remove('hidden');
    }

    btnHeader?.addEventListener('click', openInterpreterModal);
    btnComposer?.addEventListener('click', openInterpreterModal);

    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        stopInterpMic();
      });
    });

    let isTtsSpeaking = false;

    function unlockMobileSpeech() {
      if (!window.speechSynthesis) return;
      try {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch {}
    }

    function speakTranslated(text, langCode, onDone) {
      if (!window.speechSynthesis || !text) {
        if (onDone) onDone();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        isTtsSpeaking = true;
        const u = new SpeechSynthesisUtterance(text);
        if (langCode === 'ko') {
          u.lang = 'ko-KR';
        } else {
          const meta = LANG_META[langCode] || LANG_META['en'];
          u.lang = meta.ttsLang;
        }
        u.rate = 1.02;
        const finish = () => {
          isTtsSpeaking = false;
          if (onDone) onDone();
        };
        u.onend = finish;
        u.onerror = finish;
        window.speechSynthesis.speak(u);
      } catch {
        isTtsSpeaking = false;
        if (onDone) onDone();
      }
    }

    async function translateAndAppend(rawText, forceSourceLang, forceTargetLang) {
      const trimmed = String(rawText || '').trim();
      if (!trimmed) return;

      const meta = getForeignMeta();
      const hasKo = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(trimmed);
      const sl = forceSourceLang || (hasKo ? 'ko' : meta.code);
      const tl = forceTargetLang || (sl === 'ko' ? meta.code : 'ko');

      if (liveTextEl) {
        liveTextEl.textContent = `⚡ 번역 중: "${trimmed}" ...`;
      }

      try {
        const res = await apiFetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmed,
            sourceLang: sl,
            targetLang: tl,
            foreignLang: meta.code
          })
        });
        const data = await res.json();
        if (!data.ok) {
          if (liveTextEl) liveTextEl.textContent = `⚠️ 번역 오류: ${data.error || '실패'}`;
          return;
        }

        const guide = streamEl.querySelector('.interp-empty-guide');
        if (guide) guide.remove();

        const isKoToForeign = data.sourceLang === 'ko';
        const item = {
          id: Date.now() + Math.random(),
          sourceText: trimmed,
          translatedText: data.translatedText,
          sourceLang: data.sourceLang,
          targetLang: data.targetLang,
          latencyMs: data.latencyMs || 0,
          timeStr: formatShortTime(Date.now())
        };
        interpHistory.push(item);

        const srcFlag = isKoToForeign ? '🇰🇷 한국어' : `${meta.flag} ${meta.name}`;
        const dstFlag = isKoToForeign ? `${meta.flag} ${meta.name} 통역` : '🇰🇷 한국어 통역';

        const card = document.createElement('div');
        card.className = `interp-card ${isKoToForeign ? 'dir-ko-to-foreign' : 'dir-foreign-to-ko'}`;
        card.innerHTML = `
          <div class="interp-card-top">
            <span><strong>${srcFlag} ➔ ${dstFlag}</strong> · ${escapeHtml(item.timeStr)} <small>(${item.latencyMs}ms)</small></span>
            <div class="interp-card-actions">
              <button class="interp-mini-btn" data-action="tts" title="번역문 음성으로 듣기">🔊 듣기</button>
              <button class="interp-mini-btn" data-action="copy" title="번역문 복사">📋 복사</button>
            </div>
          </div>
          <div class="interp-source-line">${escapeHtml(item.sourceText)}</div>
          <div class="interp-translated-line">${escapeHtml(item.translatedText)}</div>
        `;

        card.querySelector('[data-action="tts"]')?.addEventListener('click', () => {
          unlockMobileSpeech();
          speakTranslated(item.translatedText, item.targetLang);
        });
        card.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
          navigator.clipboard.writeText(`${item.sourceText}\n${item.translatedText}`);
        });

        streamEl.appendChild(card);
        streamEl.scrollTop = streamEl.scrollHeight;

        if (liveTextEl && activeMode) {
          liveTextEl.textContent = `✅ 통역 완료! 다음 말씀을 듣고 있습니다...`;
        }

        if (autoTtsCheck && autoTtsCheck.checked) {
          speakTranslated(item.translatedText, item.targetLang);
        }
      } catch (e) {
        console.error('Translation error:', e);
        if (liveTextEl) liveTextEl.textContent = `⚠️ 네트워크 오류: ${e.message}`;
      }
    }

    function updateMicButtonsUI() {
      btnMicKo?.classList.toggle('active', activeMode === 'ko');
      btnMicForeign?.classList.toggle('active', activeMode === 'foreign');
      btnContinuous?.classList.toggle('active', activeMode === 'continuous');
      if (!activeMode) {
        livePreviewEl?.classList.add('hidden');
      } else {
        livePreviewEl?.classList.remove('hidden');
      }
    }

    function stopInterpMic() {
      activeMode = null;
      if (recInstance) {
        try { recInstance.onend = null; recInstance.stop(); } catch {}
        recInstance = null;
      }
      updateMicButtonsUI();
    }

    function startInterpMic(mode) {
      unlockMobileSpeech();
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        alert('이 브라우저에서는 실시간 음성 인식을 지원하지 않습니다. 크롬(Chrome)이나 삼성 인터넷을 사용해 주세요.');
        return;
      }

      if (activeMode === mode) {
        stopInterpMic();
        return;
      }

      stopInterpMic();
      activeMode = mode;

      // 학회 연속 자막 모드에서는 발표에 방해되지 않게 기본 자동음성출력을 끔 (원하면 체크 가능)
      if (mode === 'continuous' && autoTtsCheck) {
        autoTtsCheck.checked = false;
      } else if ((mode === 'ko' || mode === 'foreign') && autoTtsCheck) {
        autoTtsCheck.checked = true;
      }

      updateMicButtonsUI();

      const meta = getForeignMeta();
      const recLang = mode === 'ko' ? 'ko-KR' : meta.sttLang;
      if (liveTextEl) {
        liveTextEl.textContent = mode === 'ko'
          ? '🇰🇷 한국어 음성을 듣고 있습니다... 말씀하시면 즉시 외국어로 통역합니다.'
          : mode === 'foreign'
          ? `${meta.flag} ${meta.name} 음성을 듣고 있습니다... 즉시 한국어로 통역합니다.`
          : `📺 [학회 연속 자막 모드] ${meta.flag} ${meta.name} 발표를 연속으로 듣고 실시간 한국어 자막을 생성합니다...`;
      }

      function launchSegment() {
        if (!activeMode) return;
        const r = new SpeechRec();
        recInstance = r;
        r.lang = recLang;
        r.interimResults = true;
        // 모바일(안드로이드 크롬/삼성 인터넷)에서 문장 단위 즉시 완료 및 중복 버그 방지를 위해 continuous = false + 자동 재시작 사용
        r.continuous = false;
        let segmentFinalized = false;
        let latestInterim = '';

        r.onresult = (ev) => {
          if (isTtsSpeaking) return;
          let interim = '';
          let finalChunk = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const res = ev.results[i];
            const transcript = String(res[0]?.transcript || '').trim();
            if (!transcript) continue;
            if (res.isFinal) {
              finalChunk += transcript + ' ';
            } else {
              interim += transcript + ' ';
            }
          }
          if (interim.trim()) {
            latestInterim = interim.trim();
            if (liveTextEl) {
              liveTextEl.textContent = `🎙️ 인식 중: ${latestInterim}`;
            }
          }
          if (finalChunk.trim() && !segmentFinalized) {
            segmentFinalized = true;
            latestInterim = '';
            const sl = mode === 'ko' ? 'ko' : meta.code;
            const tl = mode === 'ko' ? meta.code : 'ko';
            translateAndAppend(finalChunk.trim(), sl, tl);
          }
        };

        r.onerror = (ev) => {
          if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
            stopInterpMic();
          }
        };

        r.onend = () => {
          if (!segmentFinalized && latestInterim.trim() && !isTtsSpeaking) {
            segmentFinalized = true;
            const textToTranslate = latestInterim.trim();
            latestInterim = '';
            const sl = mode === 'ko' ? 'ko' : meta.code;
            const tl = mode === 'ko' ? meta.code : 'ko';
            translateAndAppend(textToTranslate, sl, tl);
          }
          if (activeMode === mode) {
            setTimeout(() => {
              if (activeMode === mode) launchSegment();
            }, 180);
          }
        };

        try {
          r.start();
        } catch {}
      }

      launchSegment();
    }

    btnMicKo?.addEventListener('click', () => startInterpMic('ko'));
    btnMicForeign?.addEventListener('click', () => startInterpMic('foreign'));
    btnContinuous?.addEventListener('click', () => startInterpMic('continuous'));

    async function handleManualTextTranslate() {
      if (!textInput) return;
      const val = textInput.value.trim();
      if (!val) return;
      textInput.value = '';
      await translateAndAppend(val, null, null);
    }

    btnTextSend?.addEventListener('click', handleManualTextTranslate);
    textInput?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        handleManualTextTranslate();
      }
    });

    btnClear?.addEventListener('click', () => {
      interpHistory = [];
      streamEl.innerHTML = `
        <div class="interp-empty-guide">
          <div style="font-size:28px;margin-bottom:6px;">🎙️ ⚡ 🌐</div>
          <strong>통역 자막 기록을 비웠습니다. 아래 마이크 버튼을 눌러 통역을 시작하세요!</strong>
        </div>
      `;
    });

    btnSaveChat?.addEventListener('click', async () => {
      if (interpHistory.length === 0) {
        alert('저장할 통역 자막 기록이 없습니다.');
        return;
      }
      const lines = interpHistory.map((item, idx) =>
        `${idx + 1}. **[${item.timeStr}]** ${item.sourceText}\n   ➔ **${item.translatedText}**`
      );
      const mdContent = `🌐 **실시간 동시통역 · 학회 자막 기록 (${interpHistory.length}문장)**\n\n` + lines.join('\n\n');
      try {
        await apiFetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: state.activeRoomId || 'room-self',
            senderId: state.activeSenderId || 'ryu',
            content: mdContent
          })
        });
        alert('현재 대화방에 통역 기록을 저장했습니다!');
      } catch {}
    });
  }

  async function loadVaultFiles(query) {
    const listEl = document.getElementById('vault-results-list');
    listEl.innerHTML = '<div style="padding:12px;">로컬 RyuVault 탐색 중...</div>';
    try {
      const res = await apiFetch(`/api/vault?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const items = data.items || [];
      listEl.innerHTML = items
        .map(item => `
          <div class="vault-row">
            <div>
              <strong>${item.isDir ? '📁' : '📄'} ${escapeHtml(item.name)}</strong>
              <div style="font-size:11px;color:#666;"><code>${escapeHtml(item.relativePath)}</code></div>
            </div>
            <button class="btn-kakao-primary" data-share-vault="${escapeHtml(item.relativePath)}" style="padding:5px 10px;font-size:11.5px;">공유</button>
          </div>
        `)
        .join('');
      listEl.querySelectorAll('[data-share-vault]').forEach(btn => {
        btn.addEventListener('click', async () => {
          await apiFetch('/api/vault/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: state.activeRoomId, relativePath: btn.getAttribute('data-share-vault') })
          });
          document.getElementById('modal-vault-picker')?.classList.add('hidden');
        });
      });
    } catch {}
  }

  function formatShortTime(ts) {
    if (!ts) return '';
    return new Date(Number(ts)).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatFullDate(ts) {
    return new Date(Number(ts)).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  initApp();
})();
