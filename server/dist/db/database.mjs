/**
 * 🗄️ KokioTalk SQLite Database & Full-Text Search Engine
 * - Built on Node.js v22 native `node:sqlite` (zero native build dependencies)
 * - Persistent storage in `storage/kokiotalk.db` with WAL mode
 * - Supports Users, AI Agents (KokioAI 🥛, Ea 🤖, Specialists), Rooms, Read Receipts (`1`), Reactions, Attachments & Webhooks
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

                              
                                                                   
                    
                            
                  
                 
                             
 

                             
             
               
                                             
                 
                         
                                                                  
                            
                      
                                               
                     
 

                             
             
               
                                                  
                 
                        
                    
                     
                     
 

                                 
             
                   
                   
                   
              
                     
                    
 

                                
             
                  
                    
                             
                  
                                                                                  
                           
                         
                        
                     
 

const ROOT_DIR = fs.existsSync(path.resolve(__dirname, '..', '..', 'client', 'public'))
  ? path.resolve(__dirname, '..', '..')
  : path.resolve(__dirname, '..', '..', '..');
export const STORAGE_DIR = process.env.KOKIO_DATA_DIR
  ? path.join(process.env.KOKIO_DATA_DIR, 'storage')
  : path.join(ROOT_DIR, 'storage');
export const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
export const DB_PATH = path.join(STORAGE_DIR, 'kokiotalk.db');

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

export function initDatabase()       {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role_type TEXT NOT NULL DEFAULT 'human',
      avatar TEXT NOT NULL DEFAULT '🙂',
      status_message TEXT NOT NULL DEFAULT '',
      group_category TEXT NOT NULL DEFAULT 'friend',
      agent_config_json TEXT NOT NULL DEFAULT '{}',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      online_status TEXT NOT NULL DEFAULT 'online',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      room_type TEXT NOT NULL DEFAULT 'group',
      avatar TEXT NOT NULL DEFAULT '💬',
      pinned_notice TEXT NOT NULL DEFAULT '',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      last_read_message_id INTEGER NOT NULL DEFAULT 0,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      reply_to_id INTEGER NULL,
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'markdown',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      reactions_json TEXT NOT NULL DEFAULT '{}',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id, id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_url TEXT NOT NULL,
      room_id TEXT NOT NULL DEFAULT '*',
      secret_token TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `);

  seedInitialData();
}

function loadKokioConfig()      {
  const candidates = [
    process.env.KOKIO_DATA_DIR ? path.join(process.env.KOKIO_DATA_DIR, 'kokio.config.json') : '',
    path.join(ROOT_DIR, 'kokio.config.json')
  ].filter(Boolean);
  for (const cfgPath of candidates) {
    try {
      if (fs.existsSync(cfgPath)) {
        return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      }
    } catch {}
  }
  return null;
}

function seedInitialData()       {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get()                   ;
  if (countRow && countRow.cnt > 0) return;

  const cfg = loadKokioConfig();
  const ownerId = cfg?.owner?.id || 'ryu';
  const ownerName = cfg?.owner?.name || 'Alex';
  const ownerHonorific = cfg?.owner?.honorific || 'Alex';
  const ownerAvatar = cfg?.owner?.avatar || '🧑‍💻';
  const ownerStatus = cfg?.owner?.statusMessage || 'Personal AI Workspace · Antigravity 2.0+';

  const asstName = cfg?.assistant?.name || 'Kokio AI (🤖 AI Agent)';
  const asstShort = cfg?.assistant?.shortName || 'Kokio AI';
  const asstAvatar = cfg?.assistant?.avatar || '🤖';
  const asstKeywords = Array.isArray(cfg?.assistant?.mentionKeywords) && cfg.assistant.mentionKeywords.length > 0
    ? cfg.assistant.mentionKeywords
    : [`@${asstShort}`, `${asstShort}`, '@kokio', '@agent'];
  const asstPersona = cfg?.assistant?.persona || `${ownerName}'s Personal AI Agent`;

  const now = Date.now();
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, role_type, avatar, status_message, group_category, agent_config_json, is_favorite, online_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. 주 사용자
  insertUser.run(
    ownerId,
    ownerName,
    'human',
    ownerAvatar,
    ownerStatus,
    'me',
    '{}',
    1,
    'online',
    now
  );

  // 2. 전속 AI 비서 (일급 시민)
  const kokioConfig              = {
    bridgeType: 'kokio',
    endpoint: `http://127.0.0.1:${cfg?.network?.gatewayPort || 8081}`,
    mentionKeywords: asstKeywords,
    persona: asstPersona,
    model: 'Gemini 4 Argon',
    autoReplyInDirect: true
  };
  insertUser.run(
    'kokio',
    asstName,
    'ai_agent',
    asstAvatar,
    `${ownerHonorific} 전담 AI 에이전트 · 언제나 대기 중이에요!`,
    'ai_agent',
    JSON.stringify(kokioConfig),
    1,
    'online',
    now
  );

  // 3. 외부 동료 비서 (설정된 경우)
  const peerEnabled = cfg?.peerAssistant ? Boolean(cfg.peerAssistant.enabled) : true;
  const peerName = cfg?.peerAssistant?.name || 'Peer AI (🔗)';
  const peerShort = cfg?.peerAssistant?.shortName || 'Peer AI';
  const peerAvatar = cfg?.peerAssistant?.avatar || '🤖';
  const peerEndpoint = cfg?.peerAssistant?.endpoint || '';
  const peerOwner = cfg?.peerAssistant?.ownerName || '파트너님';
  const peerKeywords = Array.isArray(cfg?.peerAssistant?.mentionKeywords) && cfg.peerAssistant.mentionKeywords.length > 0
    ? cfg.peerAssistant.mentionKeywords
    : [`@${peerShort}`, `${peerShort}야`, `${peerShort}님`, '@ea'];

  if (peerEnabled) {
    const eaConfig              = {
      bridgeType: 'ea',
      endpoint: peerEndpoint,
      mentionKeywords: peerKeywords,
      persona: `${peerOwner}의 전담 AI 비서 · 원격 브릿지 연동`,
      model: 'Gemini 4 Argon',
      autoReplyInDirect: true
    };
    insertUser.run(
      'ea',
      peerName,
      'ai_agent',
      peerAvatar,
      `${peerOwner} 전담 AI 비서 · 원격 브릿지 연결됨`,
      'ai_agent',
      JSON.stringify(eaConfig),
      1,
      'online',
      now
    );
  }

  // 4. 추가 프로필 구성원 등록
  if (Array.isArray(cfg?.profiles)) {
    for (const p of cfg.profiles) {
      if (p.id && p.id !== ownerId) {
        insertUser.run(
          p.id,
          p.name || p.label || p.id,
          'human',
          p.avatar || '🙂',
          p.statusMessage || '가족/팀원 프로필',
          p.category || 'family',
          '{}',
          1,
          'online',
          now
        );
      }
    }
  } else {
    insertUser.run('dojoon', 'Partner / Family', 'human', '👦', '초6 · Peer AI의 주인님', 'family', '{}', 1, 'online', now);
    insertUser.run('eunjeong', 'Family Member 1', 'human', '👩', '우리가족 행복하게 💛', 'family', '{}', 1, 'online', now);
    insertUser.run('doheon', 'Family Member 2', 'human', '🧑', '고2 · 열공 중', 'family', '{}', 0, 'busy', now);
    insertUser.run('jiwoo', 'Family Member 3', 'human', '👧', '중2 · 음악 & 일상', 'family', '{}', 0, 'online', now);
  }

  // 5. 기본 채팅방 생성
  const insertRoom = db.prepare(`
    INSERT INTO rooms (id, name, room_type, avatar, pinned_notice, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMember = db.prepare(`
    INSERT INTO room_members (room_id, user_id, last_read_message_id, joined_at)
    VALUES (?, ?, ?, ?)
  `);

  // (1) 나와의 채팅 (코끼오 무제한 메모 & 파일 서랍)
  insertRoom.run(
    'room-self',
    `${ownerName} (나와의 채팅)`,
    'self',
    '📌',
    '파일 유효기간 만료 없이 로컬 PC(storage/uploads)에 영구 보관되는 나와의 채팅방입니다.',
    1,
    now - 3600000,
    now - 300000
  );
  insertMember.run('room-self', ownerId, 0, now - 3600000);

  // (2) 전속 비서 1:1 방
  insertRoom.run(
    'room-kokio',
    asstName,
    'direct',
    asstAvatar,
    `${asstShort}에게 자연어로 무엇이든 말씀해 주세요. 지금 이 컴퓨터의 안티그래비티 ${asstShort}가 직접 실행하고 답변을 보내드립니다.`,
    1,
    now - 3500000,
    now - 120000
  );
  insertMember.run('room-kokio', ownerId, 0, now - 3500000);
  insertMember.run('room-kokio', 'kokio', 999999, now - 3500000);

  if (peerEnabled) {
    // (3) 멀티 AI 단톡방
    insertRoom.run(
      'room-family-ai',
      `🏡 ${ownerHonorific} · ${asstShort}${asstAvatar} · ${peerShort}${peerAvatar} 단톡방`,
      'group',
      '🏡',
      `단톡방입니다. "${asstShort}야 ~해줘" 또는 "${peerShort}야 ~해줘"라고 자연어로 부르시면 각 AI 비서가 대답합니다.`,
      1,
      now - 3400000,
      now - 60000
    );
    insertMember.run('room-family-ai', ownerId, 0, now - 3400000);
    insertMember.run('room-family-ai', 'kokio', 999999, now - 3400000);
    insertMember.run('room-family-ai', 'ea', 999999, now - 3400000);

    // (4) 동료 비서 1:1 원격 연동방
    insertRoom.run(
      'room-ea',
      `${peerName} (${peerOwner} 비서)`,
      'direct',
      peerAvatar,
      `${peerOwner}의 AI 비서 ${peerName}와 직접 연결되는 1:1 원격 브릿지 방입니다.`,
      0,
      now - 3300000,
      now - 180000
    );
    insertMember.run('room-ea', ownerId, 0, now - 3300000);
    insertMember.run('room-ea', 'ea', 999999, now - 3300000);
  }
}

export function getAllUsers()               {
  return db.prepare('SELECT * FROM users ORDER BY is_favorite DESC, name ASC').all()                ;
}

export function getUserById(userId        )                         {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId)                          ;
}

export function getRoomsWithSummary(viewerId         = 'ryu')        {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY is_pinned DESC, updated_at DESC').all()                ;
  const result = [];

  for (const r of rooms) {
    const members = db.prepare(`
      SELECT rm.user_id, rm.last_read_message_id, u.name, u.avatar, u.role_type, u.online_status
      FROM room_members rm
      JOIN users u ON u.id = rm.user_id
      WHERE rm.room_id = ?
    `).all(r.id)         ;

    const myMember = members.find(m => m.user_id === viewerId);
    const myLastRead = myMember ? Number(myMember.last_read_message_id) : 0;

    const unreadRow = db.prepare(`
      SELECT COUNT(*) as cnt FROM messages
      WHERE room_id = ? AND id > ? AND sender_id != ?
    `).get(r.id, myLastRead, viewerId)                   ;

    const lastMsg = db.prepare(`
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.room_id = ?
      ORDER BY m.id DESC LIMIT 1
    `).get(r.id)       ;

    result.push({
      ...r,
      members,
      memberCount: members.length,
      unreadCount: unreadRow ? unreadRow.cnt : 0,
      lastMessage: lastMsg ? formatMessageRow(lastMsg, members) : null
    });
  }
  return result;
}

export function formatMessageRow(row     , roomMembers        )      {
  const members = roomMembers || (db.prepare(`
    SELECT rm.user_id, rm.last_read_message_id, u.role_type
    FROM room_members rm
    LEFT JOIN users u ON u.id = rm.user_id
    WHERE rm.room_id = ?
  `).all(row.room_id)         );

  // 카카오톡 스타일 안 읽은 사람 수 ('1', '2' 표시):
  // 발신자 본인과 AI 에이전트(즉시 읽음 처리)를 제외하고, last_read_message_id < row.id 인 실제 인간 멤버 수만 계산
  let unreadMemberCount = 0;
  for (const m of members) {
    if (m.user_id === row.sender_id) continue;
    if (m.role_type === 'ai_agent' || m.user_id === 'kokio' || m.user_id === 'ea') continue;
    if (Number(m.last_read_message_id) < Number(row.id)) {
      unreadMemberCount++;
    }
  }

  let replyTo = null;
  if (row.reply_to_id) {
    const parent = db.prepare(`
      SELECT m.id, m.content, m.sender_id, u.name as sender_name
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
    `).get(row.reply_to_id)       ;
    if (parent) {
      replyTo = {
        id: parent.id,
        senderId: parent.sender_id,
        senderName: parent.sender_name || parent.sender_id,
        content: parent.content.slice(0, 120)
      };
    }
  }

  return {
    id: Number(row.id),
    roomId: row.room_id,
    senderId: row.sender_id,
    senderName: row.sender_name || row.sender_id,
    senderAvatar: row.sender_avatar || '🙂',
    senderRoleType: row.sender_role_type || 'human',
    replyToId: row.reply_to_id ? Number(row.reply_to_id) : null,
    replyTo,
    content: row.content,
    messageType: row.message_type,
    attachments: safeJsonParse(row.attachments_json, []),
    reactions: safeJsonParse(row.reactions_json, {}),
    metadata: safeJsonParse(row.metadata_json, {}),
    unreadCount: unreadMemberCount,
    createdAt: Number(row.created_at)
  };
}

export function getRoomMessages(roomId        , limit         = 100)        {
  const members = db.prepare(`
    SELECT rm.user_id, rm.last_read_message_id, u.role_type
    FROM room_members rm
    LEFT JOIN users u ON u.id = rm.user_id
    WHERE rm.room_id = ?
  `).all(roomId)         ;

  const rows = db.prepare(`
    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.role_type as sender_role_type
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.room_id = ?
    ORDER BY m.id DESC
    LIMIT ?
  `).all(roomId, limit)         ;

  return rows.reverse().map(r => formatMessageRow(r, members));
}

export function createMessage(params   
                 
                   
                  
                            
                       
                                 
                                 
 )      {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO messages (room_id, sender_id, reply_to_id, content, message_type, attachments_json, reactions_json, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)
  `);
  const info = stmt.run(
    params.roomId,
    params.senderId,
    params.replyToId || null,
    params.content,
    params.messageType || 'markdown',
    JSON.stringify(params.attachments || []),
    JSON.stringify(params.metadata || {}),
    now
  );

  const msgId = Number(info.lastInsertRowid);

  // 방 최신 업데이트 시각 갱신 및 발신자 본인의 last_read_message_id 갱신
  db.prepare('UPDATE rooms SET updated_at = ? WHERE id = ?').run(now, params.roomId);
  db.prepare(`
    UPDATE room_members SET last_read_message_id = MAX(last_read_message_id, ?)
    WHERE room_id = ? AND user_id = ?
  `).run(msgId, params.roomId, params.senderId);

  const row = db.prepare(`
    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.role_type as sender_role_type
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `).get(msgId)       ;

  return formatMessageRow(row);
}

export function markRoomAsRead(roomId        , userId        )                                                                {
  const latest = db.prepare('SELECT MAX(id) as maxId FROM messages WHERE room_id = ?').get(roomId)                            ;
  const maxId = latest && latest.maxId ? Number(latest.maxId) : 0;

  db.prepare(`
    UPDATE room_members
    SET last_read_message_id = MAX(last_read_message_id, ?)
    WHERE room_id = ? AND user_id = ?
  `).run(maxId, roomId, userId);

  return { roomId, userId, lastReadMessageId: maxId };
}

export function toggleMessageReaction(messageId        , userId        , emoji        )      {
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId)                             ;
  if (!row) return null;

  const reactions                           = safeJsonParse(row.reactions_json, {});
  const list = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
  if (list.includes(userId)) {
    reactions[emoji] = list.filter(u => u !== userId);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  } else {
    reactions[emoji] = [...list, userId];
  }

  db.prepare('UPDATE messages SET reactions_json = ? WHERE id = ?').run(JSON.stringify(reactions), messageId);

  const updated = db.prepare(`
    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.role_type as sender_role_type
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `).get(messageId)       ;

  return formatMessageRow(updated);
}

export function searchMessagesAndFiles(query        , roomId         )        {
  const q = `%${query.trim()}%`;
  const sql = roomId
    ? `SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, r.name as room_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN rooms r ON r.id = m.room_id
       WHERE m.room_id = ? AND (m.content LIKE ? OR m.attachments_json LIKE ?)
       ORDER BY m.id DESC LIMIT 50`
    : `SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, r.name as room_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       LEFT JOIN rooms r ON r.id = m.room_id
       WHERE m.content LIKE ? OR m.attachments_json LIKE ?
       ORDER BY m.id DESC LIMIT 50`;

  const rows = (roomId ? db.prepare(sql).all(roomId, q, q) : db.prepare(sql).all(q, q))         ;
  return rows.map(r => ({
    ...formatMessageRow(r),
    roomName: r.room_name || r.room_id
  }));
}

export function getAllDrawerItems(roomId         )        {
  const rows = (roomId
    ? db.prepare(`
        SELECT m.*, u.name as sender_name, r.name as room_name
        FROM messages m
        LEFT JOIN users u ON u.id = m.sender_id
        LEFT JOIN rooms r ON r.id = m.room_id
        WHERE m.room_id = ? AND (m.attachments_json != '[]' OR m.content LIKE '%http://%' OR m.content LIKE '%https://%')
        ORDER BY m.id DESC LIMIT 200
      `).all(roomId)
    : db.prepare(`
        SELECT m.*, u.name as sender_name, r.name as room_name
        FROM messages m
        LEFT JOIN users u ON u.id = m.sender_id
        LEFT JOIN rooms r ON r.id = m.room_id
        WHERE m.attachments_json != '[]' OR m.content LIKE '%http://%' OR m.content LIKE '%https://%'
        ORDER BY m.id DESC LIMIT 200
      `).all())         ;

  const files        = [];
  const links        = [];
  const urlRegex = /https?:\/\/[^\s)>\]"']+/g;

  for (const r of rows) {
    const atts                   = safeJsonParse(r.attachments_json, []);
    for (const a of atts) {
      files.push({
        ...a,
        messageId: r.id,
        roomId: r.room_id,
        roomName: r.room_name,
        senderId: r.sender_id,
        senderName: r.sender_name,
        createdAt: r.created_at
      });
    }
    const matchedUrls = String(r.content || '').match(urlRegex);
    if (matchedUrls) {
      for (const u of matchedUrls) {
        links.push({
          url: u,
          messageId: r.id,
          roomId: r.room_id,
          roomName: r.room_name,
          senderName: r.sender_name,
          excerpt: r.content.slice(0, 120),
          createdAt: r.created_at
        });
      }
    }
  }

  return [{ files, links }];
}

function safeJsonParse(raw        , fallback     )      {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
