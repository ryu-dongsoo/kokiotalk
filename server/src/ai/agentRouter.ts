/**
 * 🤖 KokioTalk 자연어 AI 라우터 (슬래시 명령어 및 중간 안내 문구 완전 제거 버전)
 * - 모든 명령어를 제거하고 100% 자연어로만 작동함
 * - "우유야 ~해줘" (또는 우유 1:1 대화방에서 아무 말이나 입력) 시:
 *   "전달했습니다" 같은 중간 안내 없이 지금 이 PC의 안티그래비티(우유)로 명령이 도착하며,
 *   우유가 작성한 실제 최종 답변 글만 기다렸다가 코끼오톡 채팅방에 띄움
 * - "에아야 ~해줘" (또는 에아 1:1 대화방) 시:
 *   도준님 비서 에아(Ea)의 실제 답변 글만 기다렸다가 코끼오톡 채팅방에 띄움
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  db,
  createMessage,
  getUserById,
  markRoomAsRead
} from '../db/database.ts';
import type { UserRecord } from '../db/database.ts';
import { broadcastEvent } from '../ws/realtime.ts';
import {
  callOoyooLocalApi,
  askRealOoyooAndWaitForReply,
  waitForCurrentTurnCompletion,
  getActiveAntigravityConvId,
  loadOoyooSessionState,
  extractStepsFromTranscript
} from './antigravityBridge.ts';

export const RYU_VAULT_DIR = path.join(os.homedir(), 'OneDrive', 'RyuVault');
const DEFAULT_EA_URL = '';

export async function checkBridgesStatus(): Promise<{
  ooyooServerOnline: boolean;
  ooyooModel: string;
  ooyooLevel: string;
  activeConvId: string | null;
  eaUrl: string;
  eaOnline: boolean;
  ngrokUrl: string;
  ryuVaultPath: string;
  ryuVaultExists: boolean;
}> {
  const sessionState = loadOoyooSessionState();
  let ooyooServerOnline = false;
  let ooyooModel = sessionState.activeModel || 'argon';
  let ooyooLevel = sessionState.activeLevel || 'medium';
  let activeConvId = sessionState.activeConversationId || getActiveAntigravityConvId();
  let eaUrl = sessionState.peerUrl || DEFAULT_EA_URL;
  let eaOnline = false;
  let ngrokUrl = 'https://';

  try {
    const st = await callOoyooLocalApi('/api/status', 'GET', null, 2500);
    if (st && st.ok !== false) {
      ooyooServerOnline = true;
      if (st.model) ooyooModel = st.model;
      if (st.level) ooyooLevel = st.level;
      if (st.conversationId) activeConvId = st.conversationId;
      if (st.tunnelUrl) ngrokUrl = st.tunnelUrl;
    }
  } catch {
    ooyooServerOnline = false;
  }

  try {
    const peerSt = await callOoyooLocalApi('/api/peer/status', 'GET', null, 3000);
    if (peerSt && peerSt.peerUrl) eaUrl = peerSt.peerUrl;
    if (peerSt && peerSt.online) eaOnline = true;
  } catch {
    eaOnline = false;
  }

  return {
    ooyooServerOnline,
    ooyooModel,
    ooyooLevel,
    activeConvId,
    eaUrl,
    eaOnline,
    ngrokUrl,
    ryuVaultPath: RYU_VAULT_DIR,
    ryuVaultExists: fs.existsSync(RYU_VAULT_DIR)
  };
}

export function searchRyuVaultFiles(keyword: string, maxResults: number = 15): Array<{
  name: string;
  relativePath: string;
  fullPath: string;
  isDir: boolean;
  sizeBytes: number;
  updatedAt: number;
}> {
  const results: Array<{
    name: string;
    relativePath: string;
    fullPath: string;
    isDir: boolean;
    sizeBytes: number;
    updatedAt: number;
  }> = [];

  if (!fs.existsSync(RYU_VAULT_DIR)) return results;
  const q = keyword.trim().toLowerCase();
  const skipDirs = new Set(['node_modules', '.git', '.next', 'dist', 'storage', '__pycache__']);

  function walk(currentDir: string, depth: number): void {
    if (depth > 4 || results.length >= maxResults) return;
    let entries: any[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (entry.name.startsWith('.') && entry.name !== '.agent') continue;
      if (skipDirs.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(RYU_VAULT_DIR, fullPath);

      if (!q || entry.name.toLowerCase().includes(q) || relPath.toLowerCase().includes(q)) {
        try {
          const st = fs.statSync(fullPath);
          results.push({
            name: entry.name,
            relativePath: relPath.replace(/\\/g, '/'),
            fullPath: fullPath.replace(/\\/g, '/'),
            isDir: entry.isDirectory(),
            sizeBytes: st.isDirectory() ? 0 : st.size,
            updatedAt: st.mtimeMs
          });
        } catch {}
      }

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      }
    }
  }

  walk(RYU_VAULT_DIR, 0);
  return results;
}

export async function handleIncomingUserMessage(
  messageObj: any,
  options: { model?: string; level?: string } = {}
): Promise<void> {
  const roomId: string = messageObj.roomId;
  const senderId: string = messageObj.senderId;
  const content: string = String(messageObj.content || '').trim();

  const sender = getUserById(senderId);
  if (!sender || sender.role_type === 'ai_agent') return;

  const roomMembers = db.prepare(`
    SELECT u.* FROM room_members rm
    JOIN users u ON u.id = rm.user_id
    WHERE rm.room_id = ?
  `).all(roomId) as UserRecord[];

  const aiMembers = roomMembers.filter(m => m.role_type === 'ai_agent');

  // AI 멤버 읽음('1' 소멸) 즉시 반영
  for (const ai of aiMembers) {
    const readInfo = markRoomAsRead(roomId, ai.id);
    broadcastEvent({ type: 'read_updated', payload: readInfo });
  }

  if (!content && (!messageObj.attachments || messageObj.attachments.length === 0)) return;

  // 1) 자연어 에아(Ea) 호출 감지: 에아 1:1 방이거나 "에아야 ...", "에아님 ...", "@에아", "에아 ..." 포함 시 (한글 뒤 \b 미사용)
  const isEaDirectRoom = roomId === 'room-ea' || roomId === 'room-direct-ea';
  const callsEaNaturally = /(?:^|\s)(?:에아야|에아님|@에아|에아\s+)/i.test(content);

  if (isEaDirectRoom || callsEaNaturally) {
    await waitAndPostEaReply(roomId, content, sender);
    return;
  }

  // 2) 자연어 우유(Ooyoo) 호출 감지:
  //    - 우유 1:1 방(`room-ooyoo`)에서는 매번 "우유야"를 붙이지 않아도 모든 말을 우유에게 하는 말로 인식
  //    - 단톡방이나 다른 방에서는 "우유야 ~", "우유님 ~", "우유 ~해줘", "@우유" 등 자연어로 우유를 부를 때만 반응!
  const isOoyooDirectRoom = roomId === 'room-ooyoo' || roomId === 'room-direct-ooyoo';
  const callsOoyooNaturally = /(?:^|\s)(?:우유야|우유님|@우유|우유\s+)/i.test(content);

  if (isOoyooDirectRoom || callsOoyooNaturally) {
    await waitAndPostRealOoyooReply(roomId, content, messageObj.attachments || [], options);
  }
}

async function waitAndPostRealOoyooReply(
  roomId: string,
  userContent: string,
  attachments: any[],
  options: { model?: string; level?: string }
): Promise<void> {
  // 우유가 글을 작성하는 동안만 조용히 타이핑 표시 활성화 ("전달했습니다" 같은 말풍선은 절대 생성하지 않음!)
  broadcastEvent({
    type: 'agent_typing',
    payload: {
      roomId,
      agentId: 'ooyoo',
      agentName: '우유 (Ooyoo 🥛)',
      isTyping: true,
      statusText: '우유가 생각하고 작업을 수행하고 있어요...'
    }
  });

  try {
    const result = await askRealOoyooAndWaitForReply({
      prompt: userContent,
      attachments,
      model: options.model,
      level: options.level,
      timeoutMs: 480000,
      onProgress: (statusText: string) => {
        broadcastEvent({
          type: 'agent_typing',
          payload: {
            roomId,
            agentId: 'ooyoo',
            agentName: '우유 (Ooyoo 🥛)',
            isTyping: true,
            statusText
          }
        });
      }
    });

    if (result.ok && result.reply) {
      const created = createMessage({
        roomId,
        senderId: 'ooyoo',
        content: result.reply,
        messageType: 'markdown',
        metadata: {
          agent: 'ooyoo',
          convId: result.convId
        }
      });
      broadcastEvent({ type: 'message_created', payload: created });
    }
  } catch (err) {
    console.error('[waitAndPostRealOoyooReply Error]', err);
  } finally {
    broadcastEvent({
      type: 'agent_typing',
      payload: { roomId, agentId: 'ooyoo', agentName: '우유 (Ooyoo 🥛)', isTyping: false }
    });
  }
}

/**
 * 서버 재시작 시 우유 1:1 방에 아직 답변이 달리지 않은 진행 중인 질문이 있으면
 * 자동으로 현재 턴의 완료를 감시하여 답변 말풍선을 띄웁니다.
 */
export async function resumeUnansweredOoyooRoomIfNeeded(): Promise<void> {
  startLiveTranscriptMirrorLoop();
  try {
    const lastMsg = db.prepare(`
      SELECT id, room_id, sender_id, content, created_at
      FROM messages
      WHERE room_id = 'room-ooyoo'
      ORDER BY id DESC
      LIMIT 1
    `).get() as any;

    if (!lastMsg || lastMsg.sender_id === 'ooyoo') return;
    if (Date.now() - Number(lastMsg.created_at) > 180000) return;

    const convId = getActiveAntigravityConvId() || loadOoyooSessionState().activeConversationId;
    if (!convId) return;

    broadcastEvent({
      type: 'agent_typing',
      payload: {
        roomId: 'room-ooyoo',
        agentId: 'ooyoo',
        agentName: '우유 (Ooyoo 🥛)',
        isTyping: true,
        statusText: '우유가 작업을 마무리하고 있어요...'
      }
    });

    const result = await waitForCurrentTurnCompletion({
      convId,
      timeoutMs: 180000,
      onProgress: (statusText: string) => {
        broadcastEvent({
          type: 'agent_typing',
          payload: {
            roomId: 'room-ooyoo',
            agentId: 'ooyoo',
            agentName: '우유 (Ooyoo 🥛)',
            isTyping: true,
            statusText
          }
        });
      }
    });

    if (result.ok && result.reply) {
      // 중복 삽입 방지 확인
      const latestAfter = db.prepare(`
        SELECT sender_id FROM messages WHERE room_id = 'room-ooyoo' ORDER BY id DESC LIMIT 1
      `).get() as any;
      if (latestAfter && latestAfter.sender_id !== 'ooyoo') {
        const created = createMessage({
          roomId: 'room-ooyoo',
          senderId: 'ooyoo',
          content: result.reply,
          messageType: 'markdown',
          metadata: { agent: 'ooyoo', convId }
        });
        broadcastEvent({ type: 'message_created', payload: created });
      }
    }
  } catch (err) {
    console.error('[resumeUnansweredOoyooRoomIfNeeded Error]', err);
  } finally {
    broadcastEvent({
      type: 'agent_typing',
      payload: { roomId: 'room-ooyoo', agentId: 'ooyoo', agentName: '우유 (Ooyoo 🥛)', isTyping: false }
    });
  }
}

let isMirrorLoopRunning = false;
export function startLiveTranscriptMirrorLoop(): void {
  if (isMirrorLoopRunning) return;
  isMirrorLoopRunning = true;

  const syncOnce = () => {
    try {
      const convId = getActiveAntigravityConvId() || loadOoyooSessionState().activeConversationId;
      if (!convId) return;

      const steps = extractStepsFromTranscript(convId);
      if (steps.length === 0) return;

      const recentMsgs = db.prepare(`
        SELECT id, sender_id, content, metadata_json
        FROM messages
        WHERE room_id = 'room-ooyoo'
        ORDER BY id DESC
        LIMIT 80
      `).all() as any[];

      const knownKeys = new Set<string>();
      for (const m of recentMsgs) {
        try {
          const meta = JSON.parse(m.metadata_json || '{}');
          if (meta.stepKey) knownKeys.add(meta.stepKey);
        } catch {}
      }

      // 최근 30개 스텝 중 아직 room-ooyoo에 없는 대화를 실시간 미러링
      const tailSteps = steps.slice(-30);
      for (const st of tailSteps) {
        if (knownKeys.has(st.stepKey)) continue;

        // 이미 동일한 텍스트가 최근 8개 메시지 내에 있으면 stepKey만 기록하고 중복 생성 방지
        const duplicate = recentMsgs.slice(0, 8).find(
          m => m.sender_id === st.role && String(m.content || '').trim() === st.text.trim()
        );
        if (duplicate) {
          try {
            const meta = JSON.parse(duplicate.metadata_json || '{}');
            meta.stepKey = st.stepKey;
            db.prepare('UPDATE messages SET metadata_json = ? WHERE id = ?').run(JSON.stringify(meta), duplicate.id);
            knownKeys.add(st.stepKey);
          } catch {}
          continue;
        }

        const created = createMessage({
          roomId: 'room-ooyoo',
          senderId: st.role,
          content: st.text,
          messageType: 'markdown',
          metadata: {
            agent: st.role === 'ooyoo' ? 'ooyoo' : undefined,
            convId,
            stepKey: st.stepKey,
            mirrored: true
          }
        });
        knownKeys.add(st.stepKey);
        recentMsgs.unshift({
          id: created.id,
          sender_id: st.role,
          content: st.text,
          metadata_json: JSON.stringify({ stepKey: st.stepKey })
        });
        broadcastEvent({ type: 'message_created', payload: created });
      }
    } catch {}
  };

  syncOnce();
  setInterval(syncOnce, 1500);
}

async function waitAndPostEaReply(
  roomId: string,
  userContent: string,
  sender: UserRecord
): Promise<void> {
  broadcastEvent({
    type: 'agent_typing',
    payload: {
      roomId,
      agentId: 'ea',
      agentName: '에아 (Ea 🤖)',
      isTyping: true,
      statusText: '도준님 PC의 에아(Ea)가 답변을 작성하고 있어요...'
    }
  });

  try {
    const askRes = await callOoyooLocalApi(
      '/api/peer/ask',
      'POST',
      {
        message: `[발신자: ${sender.name}] ${userContent}`,
        timeoutMs: 75000
      },
      80000
    );

    if (askRes && askRes.ok && askRes.reply) {
      const created = createMessage({
        roomId,
        senderId: 'ea',
        content: askRes.reply,
        messageType: 'markdown',
        metadata: { agent: 'ea', liveBridge: true }
      });
      broadcastEvent({ type: 'message_created', payload: created });
    } else if (askRes && askRes.error) {
      const created = createMessage({
        roomId,
        senderId: 'ea',
        content: `⚠️ 현재 도준님 PC의 에아(Ea) 서버 응답을 받지 못했어요: ${askRes.error}`,
        messageType: 'markdown',
        metadata: { agent: 'ea', liveBridge: false }
      });
      broadcastEvent({ type: 'message_created', payload: created });
    }
  } catch (err) {
    console.error('[waitAndPostEaReply Error]', err);
  } finally {
    broadcastEvent({
      type: 'agent_typing',
      payload: { roomId, agentId: 'ea', agentName: '에아 (Ea 🤖)', isTyping: false }
    });
  }
}
