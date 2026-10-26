/**
 * 🐓 KokioTalk (꼬끼오톡) Core Server — 순수 자연어 Kokio AI(KokioAI 🥛) & Peer AI(Ea 🤖) 카카오톡
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  db,
  initDatabase,
  UPLOADS_DIR,
  getAllUsers,
  getUserById,
  getRoomsWithSummary,
  getRoomMessages,
  createMessage,
  markRoomAsRead,
  toggleMessageReaction,
  searchMessagesAndFiles,
  getAllDrawerItems
} from './db/database.mjs';
                                                       
import {
  attachWebSocketUpgrade,
  registerSseClient,
  broadcastEvent
} from './ws/realtime.mjs';
import {
  handleIncomingUserMessage,
  resumeUnansweredKokioAIRoomIfNeeded,
  checkBridgesStatus,
  searchKokioVaultFiles,
  KOKIO_VAULT_DIR
} from './ai/agentRouter.mjs';
import { callKokioAILocalApi } from './ai/antigravityBridge.mjs';
import { handleMcpJsonRpc, KOKIO_MCP_TOOLS } from './mcp/mcpHandler.mjs';

const PORT = Number(process.env.PORT) || 8082;
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'client', 'public');

initDatabase();

// 기존 DB에 남아있던 불필요한 기본 안내 공지 문구 정리 (공지가 비어 있으면 상단 공지바 자동 숨김)
try {
  db.prepare(`
    UPDATE rooms
    SET pinned_notice = ''
    WHERE pinned_notice LIKE '%AI 에이전트에게 자연어로%'
       OR pinned_notice LIKE '%가족 단톡방입니다%'
       OR pinned_notice LIKE '%파일 유효기간 만료 없이%'
       OR pinned_notice LIKE '%파트너님의 AI 비서 Peer AI%'
  `).run();
  db.prepare(`
    DELETE FROM messages WHERE content LIKE '%/vault%' OR content LIKE '%/status%' OR content LIKE '%첫 개통 테스트%'
  `).run();
  // 불필요한 전문 하위 에이전트(수업 총괄 조교, 논문 심사관, 스마트농업 아키텍트) 및 관련 방 정리
  const obsoleteRooms = db.prepare(`
    SELECT DISTINCT r.id FROM rooms r
    LEFT JOIN room_members rm ON r.id = rm.room_id
    WHERE r.id = 'room-lab-ai'
       OR rm.user_id IN ('paper-reviewer', 'course-ta', 'ag-iot-architect')
       OR r.name LIKE '%수업 총괄 조교%'
       OR r.name LIKE '%논문 심사관%'
       OR r.name LIKE '%스마트농업 아키텍트%'
       OR r.name LIKE '%스마트농업 R&D%'
  `).all()                    ;
  for (const row of obsoleteRooms) {
    db.prepare('DELETE FROM messages WHERE room_id = ?').run(row.id);
    db.prepare('DELETE FROM room_members WHERE room_id = ?').run(row.id);
    db.prepare('DELETE FROM rooms WHERE id = ?').run(row.id);
  }
  for (const uid of ['paper-reviewer', 'course-ta', 'ag-iot-architect', 'wife']) {
    db.prepare('DELETE FROM messages WHERE sender_id = ?').run(uid);
    db.prepare('DELETE FROM room_members WHERE user_id = ?').run(uid);
    db.prepare('DELETE FROM users WHERE id = ?').run(uid);
  }
  // 1:1 방에 실수로 추가된 타 사용자 정리
  db.prepare(`DELETE FROM room_members WHERE room_id = 'room-self' AND user_id != 'ryu'`).run();
  db.prepare(`DELETE FROM room_members WHERE room_id = 'room-kokio' AND user_id NOT IN ('ryu', 'kokio')`).run();
  db.prepare(`DELETE FROM room_members WHERE room_id = 'room-ea' AND user_id NOT IN ('ryu', 'ea')`).run();
} catch {}

function sendJson(res     , statusCode        , data     )       {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Kokio-Api-Key, ngrok-skip-browser-warning',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJsonBody(req     )               {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk        ) => {
      raw += chunk.toString('utf-8');
      if (raw.length > 50 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const MIME_MAP                         = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

const server = http.createServer(async (req     , res     ) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Kokio-Api-Key, ngrok-skip-browser-warning'
      });
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname
      .replace(/^\/kokio(?:talk)?/, '')
      .replace(/^\/api\/v1\//, '/api/') || '/';

    if (req.method === 'GET' && pathname === '/api/events') {
      registerSseClient(req, res);
      return;
    }

    if (pathname === '/api/mcp') {
      if (req.method === 'GET') {
        sendJson(res, 200, { ok: true, name: 'kokiotalk-mcp-server', version: '1.0.0', tools: KOKIO_MCP_TOOLS });
        return;
      }
      if (req.method === 'POST') {
        const rpcBody = await readJsonBody(req);
        sendJson(res, 200, handleMcpJsonRpc(rpcBody));
        return;
      }
    }

    if (req.method === 'GET' && pathname === '/api/bootstrap') {
      const viewerId = url.searchParams.get('viewerId') || 'ryu';
      const users = getAllUsers();
      const rooms = getRoomsWithSummary(viewerId);
      const drawer = getAllDrawerItems()[0];
      const bridges = await checkBridgesStatus();
      sendJson(res, 200, {
        ok: true,
        viewerId,
        users,
        rooms,
        drawer,
        bridges,
        mcpToolsCount: KOKIO_MCP_TOOLS.length
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/status') {
      const bridges = await checkBridgesStatus();
      sendJson(res, 200, { ok: true, port: PORT, bridges });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/session') {
      const body = await readJsonBody(req);
      const out = await callKokioAILocalApi('/api/session', 'POST', body, 5000);
      sendJson(res, 200, out);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/translate') {
      const body = await readJsonBody(req);
      const rawText = String(body.text || '').trim();
      if (!rawText) {
        sendJson(res, 400, { ok: false, error: '번역할 텍스트가 비어 있습니다.' });
        return;
      }
      const foreignLang = String(body.foreignLang || 'en');
      const hasKorean = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(rawText);
      const sl = body.sourceLang && body.sourceLang !== 'auto'
        ? String(body.sourceLang)
        : (hasKorean ? 'ko' : foreignLang);
      const tl = body.targetLang && body.targetLang !== 'auto'
        ? String(body.targetLang)
        : (sl === 'ko' ? foreignLang : 'ko');

      const t0 = Date.now();
      try {
        const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(rawText)}`;
        const gRes = await fetch(gUrl);
        const gData = await gRes.json()         ;
        const translatedText = Array.isArray(gData?.[0])
          ? gData[0].map((seg     ) => seg?.[0] || '').join('').trim()
          : '';
        sendJson(res, 200, {
          ok: true,
          sourceText: rawText,
          translatedText: translatedText || rawText,
          sourceLang: sl,
          targetLang: tl,
          latencyMs: Date.now() - t0
        });
      } catch (trErr     ) {
        sendJson(res, 500, { ok: false, error: trErr.message || '번역 중 오류가 발생했습니다.' });
      }
      return;
    }

    if (pathname === '/api/calendar') {
      const pyScript = path.join(__dirname, 'dotday_calendar.py');
      if (req.method === 'GET') {
        const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
        const month = Number(url.searchParams.get('month')) || (new Date().getMonth() + 1);
        try {
          const outRaw = execFileSync('python', [pyScript], {
            input: JSON.stringify({ action: 'list', year, month }),
            encoding: 'utf-8',
            timeout: 15000
          });
          sendJson(res, 200, JSON.parse(outRaw.trim()));
        } catch (err     ) {
          sendJson(res, 500, { ok: false, error: err.message || '캘린더 조회 실패' });
        }
        return;
      }
      if (req.method === 'POST') {
        const body = await readJsonBody(req);
        try {
          const outRaw = execFileSync('python', [pyScript], {
            input: JSON.stringify(body),
            encoding: 'utf-8',
            timeout: 15000
          });
          sendJson(res, 200, JSON.parse(outRaw.trim()));
        } catch (err     ) {
          sendJson(res, 500, { ok: false, error: err.message || '캘린더 작업 실패' });
        }
        return;
      }
    }

    if (req.method === 'GET' && pathname === '/api/remote/frame') {
      const out = await callKokioAILocalApi('/api/remote/frame', 'GET', null, 5000);
      sendJson(res, 200, out);
      return;
    }
    if (req.method === 'POST' && pathname === '/api/remote/mouse') {
      const body = await readJsonBody(req);
      const out = await callKokioAILocalApi('/api/remote/mouse', 'POST', body, 5000);
      sendJson(res, 200, out);
      return;
    }
    if (req.method === 'POST' && pathname === '/api/remote/key') {
      const body = await readJsonBody(req);
      const out = await callKokioAILocalApi('/api/remote/key', 'POST', body, 5000);
      sendJson(res, 200, out);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/users') {
      sendJson(res, 200, { ok: true, users: getAllUsers() });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/users') {
      const body = await readJsonBody(req);
      const id = String(body.id || `user-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const name = String(body.name || '새 친구').trim();
      const roleType = body.roleType === 'ai_agent' ? 'ai_agent' : 'human';
      const avatar = String(body.avatar || (roleType === 'ai_agent' ? '🤖' : '🙂'));
      const statusMessage = String(body.statusMessage || '');
      const groupCategory = body.groupCategory || (roleType === 'ai_agent' ? 'ai_agent' : 'friend');
      const agentConfig = body.agentConfig || {
        bridgeType: body.endpoint ? 'webhook' : 'specialist',
        endpoint: body.endpoint || '',
        mentionKeywords: [name, id],
        persona: statusMessage || `${name} AI 에이전트`,
        model: 'Gemini 4 Argon',
        autoReplyInDirect: true
      };

      db.prepare(`
        INSERT OR REPLACE INTO users (id, name, role_type, avatar, status_message, group_category, agent_config_json, is_favorite, online_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'online', ?)
      `).run(id, name, roleType, avatar, statusMessage, groupCategory, JSON.stringify(agentConfig), body.isFavorite ? 1 : 0, Date.now());

      const user = getUserById(id);
      broadcastEvent({ type: 'user_updated', payload: user });
      sendJson(res, 201, { ok: true, user });
      return;
    }

    if (req.method === 'PATCH' && pathname.startsWith('/api/users/')) {
      const userId = decodeURIComponent(pathname.slice('/api/users/'.length));
      const body = await readJsonBody(req);
      const existing = getUserById(userId);
      if (!existing) {
        sendJson(res, 404, { ok: false, error: 'User not found' });
        return;
      }
      db.prepare('UPDATE users SET name = ?, status_message = ?, is_favorite = ?, avatar = ? WHERE id = ?').run(
        body.name !== undefined ? String(body.name) : existing.name,
        body.statusMessage !== undefined ? String(body.statusMessage) : existing.status_message,
        body.isFavorite !== undefined ? (body.isFavorite ? 1 : 0) : existing.is_favorite,
        body.avatar !== undefined ? String(body.avatar) : existing.avatar,
        userId
      );
      const updated = getUserById(userId);
      broadcastEvent({ type: 'user_updated', payload: updated });
      sendJson(res, 200, { ok: true, user: updated });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/rooms') {
      const viewerId = url.searchParams.get('viewerId') || 'ryu';
      sendJson(res, 200, { ok: true, rooms: getRoomsWithSummary(viewerId) });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/rooms') {
      const body = await readJsonBody(req);
      const memberIds           = Array.isArray(body.memberIds) ? body.memberIds : ['ryu'];
      if (!memberIds.includes('ryu')) memberIds.unshift('ryu');

      if (memberIds.length === 2 && body.roomType === 'direct') {
        const targetId = memberIds.find(m => m !== 'ryu') ;
        if (targetId === 'kokio') {
          sendJson(res, 200, { ok: true, roomId: 'room-kokio', rooms: getRoomsWithSummary('ryu') });
          return;
        }
        if (targetId === 'ea') {
          sendJson(res, 200, { ok: true, roomId: 'room-ea', rooms: getRoomsWithSummary('ryu') });
          return;
        }
        const directRoomId = `room-direct-${targetId}`;
        const existingRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(directRoomId);
        if (!existingRoom) {
          const targetUser = getUserById(targetId);
          const now = Date.now();
          db.prepare(`
            INSERT INTO rooms (id, name, room_type, avatar, pinned_notice, is_pinned, created_at, updated_at)
            VALUES (?, ?, 'direct', ?, '', 0, ?, ?)
          `).run(directRoomId, targetUser ? targetUser.name : targetId, targetUser ? targetUser.avatar : '💬', now, now);
          db.prepare('INSERT OR IGNORE INTO room_members VALUES (?, ?, 0, ?)').run(directRoomId, 'ryu', now);
          db.prepare('INSERT OR IGNORE INTO room_members VALUES (?, ?, 999999, ?)').run(directRoomId, targetId, now);
        }
        sendJson(res, 200, { ok: true, roomId: directRoomId, rooms: getRoomsWithSummary('ryu') });
        return;
      }

      const roomId = String(body.id || `room-${Date.now()}`);
      const memberNames = memberIds.filter(id => id !== 'ryu').map(id => getUserById(id)?.name || id);
      const roomName = String(body.name || memberNames.join(' · ') || '새 그룹 채팅방');
      const now = Date.now();

      db.prepare(`
        INSERT INTO rooms (id, name, room_type, avatar, pinned_notice, is_pinned, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(roomId, roomName, body.roomType || 'group', String(body.avatar || '💬'), String(body.pinnedNotice || ''), body.isPinned ? 1 : 0, now, now);

      for (const uid of memberIds) {
        const u = getUserById(uid);
        db.prepare('INSERT OR IGNORE INTO room_members VALUES (?, ?, ?, ?)').run(roomId, uid, u?.role_type === 'ai_agent' ? 999999 : 0, now);
      }

      const rooms = getRoomsWithSummary('ryu');
      broadcastEvent({ type: 'room_updated', payload: { roomId } });
      sendJson(res, 201, { ok: true, roomId, rooms });
      return;
    }

    if (req.method === 'PATCH' && /^\/api\/rooms\/[^/]+$/.test(pathname)) {
      const roomId = decodeURIComponent(pathname.slice('/api/rooms/'.length));
      const body = await readJsonBody(req);
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId)       ;
      if (!room) {
        sendJson(res, 404, { ok: false, error: 'Room not found' });
        return;
      }
      const newPinned = body.isPinned !== undefined ? (body.isPinned ? 1 : 0) : room.is_pinned;
      const newNotice = body.pinnedNotice !== undefined ? String(body.pinnedNotice) : room.pinned_notice;
      const newName = body.name !== undefined ? String(body.name) : room.name;
      db.prepare('UPDATE rooms SET is_pinned = ?, pinned_notice = ?, name = ? WHERE id = ?').run(newPinned, newNotice, newName, roomId);
      broadcastEvent({ type: 'room_updated', payload: { roomId } });
      sendJson(res, 200, { ok: true, rooms: getRoomsWithSummary('ryu') });
      return;
    }

    const roomMsgMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/messages$/);
    if (req.method === 'GET' && roomMsgMatch) {
      const roomId = decodeURIComponent(roomMsgMatch[1]);
      const limit = Number(url.searchParams.get('limit')) || 120;
      const messages = getRoomMessages(roomId, limit);
      sendJson(res, 200, { ok: true, roomId, messages });
      return;
    }

    const roomReadMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/read$/);
    if (req.method === 'POST' && roomReadMatch) {
      const roomId = decodeURIComponent(roomReadMatch[1]);
      const body = await readJsonBody(req);
      const userId = String(body.userId || 'ryu');
      const readInfo = markRoomAsRead(roomId, userId);
      broadcastEvent({ type: 'read_updated', payload: readInfo });
      sendJson(res, 200, { ok: true, ...readInfo });
      return;
    }

    // 메시지 전송 API:
    // 1) 사용자의 말풍선만 먼저 저장 및 브로드캐스트 ("AI 에이전트에게 전달했습니다" 같은 가짜 문구 일절 없음)
    // 2) 백그라운드에서 "AI야 ~" / Kokio AI 1:1방이면 지금 이 PC의 안티그래비티(Kokio AI)로 전달하고,
    //    AI 에이전트의 진짜 답변 글이 나올 때까지 기다렸다가 그 글만 꼬끼오톡에 띄움!
    if (req.method === 'POST' && pathname === '/api/messages') {
      const body = await readJsonBody(req);
      const roomId = String(body.roomId || 'room-kokio');
      const senderId = String(body.senderId || 'ryu');
      const content = String(body.content || '').trim();
      const attachments                   = Array.isArray(body.attachments) ? body.attachments : [];

      if (!content && attachments.length === 0) {
        sendJson(res, 400, { ok: false, error: '메시지 내용 또는 첨부파일이 필요합니다.' });
        return;
      }

      const created = createMessage({
        roomId,
        senderId,
        content: content || `📎 첨부파일 ${attachments.length}개 전송`,
        replyToId: body.replyToId ? Number(body.replyToId) : null,
        messageType: body.messageType || (attachments.length > 0 ? 'file' : 'markdown'),
        attachments,
        metadata: body.metadata || {}
      });

      broadcastEvent({ type: 'message_created', payload: created });

      handleIncomingUserMessage(created, {
        model: body.model,
        level: body.level
      }).catch(err => {
        console.error('[AgentRouter Error]', err);
      });

      sendJson(res, 201, { ok: true, message: created });
      return;
    }

    const reactionMatch = pathname.match(/^\/api\/messages\/(\d+)\/reactions$/);
    if (req.method === 'POST' && reactionMatch) {
      const messageId = Number(reactionMatch[1]);
      const body = await readJsonBody(req);
      const updated = toggleMessageReaction(messageId, String(body.userId || 'ryu'), String(body.emoji || '❤️'));
      if (!updated) {
        sendJson(res, 404, { ok: false, error: 'Message not found' });
        return;
      }
      broadcastEvent({ type: 'message_updated', payload: updated });
      sendJson(res, 200, { ok: true, message: updated });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/upload') {
      const body = await readJsonBody(req);
      const rawName = String(body.fileName || 'file.bin').replace(/[^a-zA-Z0-9가-힣._\- ()]/g, '_');
      const mimeType = String(body.mimeType || 'application/octet-stream');
      const b64 = String(body.base64Data || '').replace(/^data:[^;]+;base64,/, '');
      if (!b64) {
        sendJson(res, 400, { ok: false, error: 'base64Data is empty' });
        return;
      }
      const buf = Buffer.from(b64, 'base64');
      let storedName = `${Date.now()}_${rawName}`;
      let fullPath = path.join(UPLOADS_DIR, storedName);
      let finalMime = mimeType;
      fs.writeFileSync(fullPath, buf);

      if (/\.(heic|heif)$/i.test(rawName)) {
        try {
          const jpgPath = `${fullPath}.jpg`;
          execFileSync('python', [
            '-c',
            'import sys; from pillow_heif import register_heif_opener; register_heif_opener(); from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], "JPEG", quality=90)',
            fullPath,
            jpgPath
          ], { timeout: 10000 });
          if (fs.existsSync(jpgPath)) {
            storedName = `${storedName}.jpg`;
            fullPath = jpgPath;
            finalMime = 'image/jpeg';
          }
        } catch {}
      }

      const item                 = {
        id: `att-${Date.now()}`,
        fileName: rawName,
        fileSize: fs.statSync(fullPath).size,
        mimeType: finalMime,
        url: `/uploads/${encodeURIComponent(storedName)}`,
        localPath: fullPath,
        createdAt: Date.now()
      };
      sendJson(res, 201, { ok: true, attachment: item });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/drawer') {
      const roomId = url.searchParams.get('roomId') || undefined;
      const drawer = getAllDrawerItems(roomId)[0];
      sendJson(res, 200, { ok: true, ...drawer });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/search') {
      const q = url.searchParams.get('q') || '';
      const roomId = url.searchParams.get('roomId') || undefined;
      sendJson(res, 200, { ok: true, query: q, results: searchMessagesAndFiles(q, roomId) });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/vault') {
      const q = url.searchParams.get('q') || '';
      sendJson(res, 200, { ok: true, vaultRoot: KOKIO_VAULT_DIR, items: searchKokioVaultFiles(q, 25) });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/vault/share') {
      const body = await readJsonBody(req);
      const relPath = String(body.relativePath || '');
      const roomId = String(body.roomId || 'room-kokio');
      const fullPath = path.resolve(KOKIO_VAULT_DIR, relPath);
      if (!fullPath.startsWith(path.resolve(KOKIO_VAULT_DIR)) || !fs.existsSync(fullPath)) {
        sendJson(res, 404, { ok: false, error: '유효하지 않은 KokioVault 경로입니다.' });
        return;
      }
      const st = fs.statSync(fullPath);
      const attachments                   = [];
      if (!st.isDirectory() && st.size <= 15 * 1024 * 1024) {
        const fileName = path.basename(fullPath);
        const storedName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9가-힣._\- ()]/g, '_')}`;
        const destPath = path.join(UPLOADS_DIR, storedName);
        fs.copyFileSync(fullPath, destPath);
        const ext = path.extname(fileName).toLowerCase();
        attachments.push({
          id: `vault-${Date.now()}`,
          fileName,
          fileSize: st.size,
          mimeType: MIME_MAP[ext] || 'application/octet-stream',
          url: `/uploads/${encodeURIComponent(storedName)}`,
          localPath: fullPath,
          createdAt: Date.now()
        });
      }

      const msg = createMessage({
        roomId,
        senderId: 'ryu',
        content: `📂 파일 공유: \`${relPath}\``,
        messageType: 'file',
        attachments
      });
      broadcastEvent({ type: 'message_created', payload: msg });
      sendJson(res, 201, { ok: true, message: msg });
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/uploads/')) {
      const fileName = path.basename(decodeURIComponent(pathname.slice('/uploads/'.length)));
      const filePath = path.join(UPLOADS_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      const ext = path.extname(fileName).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_MAP[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const cleanStatic = pathname === '/' ? '/index.html' : pathname;
    const staticPath = path.join(PUBLIC_DIR, path.normalize(cleanStatic));
    if (staticPath.startsWith(PUBLIC_DIR) && fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
      const ext = path.extname(staticPath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_MAP[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(staticPath).pipe(res);
      return;
    }

    sendJson(res, 404, { ok: false, error: `Route not found: ${req.method} ${pathname}` });
  } catch (err     ) {
    console.error('[Server Error]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal Server Error' });
  }
});

attachWebSocketUpgrade(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================================`);
  console.log(`🐓 KokioTalk (꼬끼오톡) Natural-Language Server Started on ${PORT}`);
  console.log(`👉 Local Web UI     : http://localhost:${PORT}`);
  console.log(`👉 Ngrok Public URL : https:///`);
  console.log(`==================================================================`);
  resumeUnansweredKokioAIRoomIfNeeded().catch(() => {});
});
