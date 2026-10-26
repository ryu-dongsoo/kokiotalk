/**
 * 🤖 KokioTalk 자연어 AI 라우터 (슬래시 명령어 및 중간 안내 문구 완전 제거 버전)
 * - 모든 명령어를 제거하고 100% 자연어로만 작동함
 * - "AI야 ~해줘" (또는 Kokio AI 1:1 대화방에서 아무 말이나 입력) 시:
 *   "전달했습니다" 같은 중간 안내 없이 지금 이 PC의 안티그래비티(Kokio AI)로 명령이 도착하며,
 *   AI 에이전트가 작성한 실제 최종 답변 글만 기다렸다가 꼬끼오톡 채팅방에 띄움
 * - "파트너AI야 ~해줘" (또는 Peer AI 1:1 대화방) 시:
 *   파트너님 비서 Peer AI의 실제 답변 글만 기다렸다가 꼬끼오톡 채팅방에 띄움
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
  callKokioAILocalApi,
  askRealKokioAIAndWaitForReply,
  waitForCurrentTurnCompletion,
  getActiveAntigravityConvId,
  loadKokioAISessionState,
  extractStepsFromTranscript
} from './antigravityBridge.ts';

export const KOKIO_VAULT_DIR = path.join(os.homedir(), 'OneDrive', 'KokioVault');
const DEFAULT_EA_URL = '';

export async function checkBridgesStatus(): Promise<{
  kokioServerOnline: boolean;
  kokioModel: string;
  kokioLevel: string;
  activeConvId: string | null;
  eaUrl: string;
  eaOnline: boolean;
  ngrokUrl: string;
  kokioVaultPath: string;
  kokioVaultExists: boolean;
}> {
  const sessionState = loadKokioAISessionState();
  let kokioServerOnline = false;
  let kokioModel = sessionState.activeModel || 'argon';
  let kokioLevel = sessionState.activeLevel || 'medium';
  let activeConvId = sessionState.activeConversationId || getActiveAntigravityConvId();
  let eaUrl = sessionState.peerUrl || DEFAULT_EA_URL;
  let eaOnline = false;
  let ngrokUrl = 'https://';

  try {
    const st = await callKokioAILocalApi('/api/status', 'GET', null, 2500);
    if (st && st.ok !== false) {
      kokioServerOnline = true;
      if (st.model) kokioModel = st.model;
      if (st.level) kokioLevel = st.level;
      if (st.conversationId) activeConvId = st.conversationId;
      if (st.tunnelUrl) ngrokUrl = st.tunnelUrl;
    }
  } catch {
    kokioServerOnline = false;
  }

  try {
    const peerSt = await callKokioAILocalApi('/api/peer/status', 'GET', null, 3000);
    if (peerSt && peerSt.peerUrl) eaUrl = peerSt.peerUrl;
    if (peerSt && peerSt.online) eaOnline = true;
  } catch {
    eaOnline = false;
  }

  return {
    kokioServerOnline,
    kokioModel,
    kokioLevel,
    activeConvId,
    eaUrl,
    eaOnline,
    ngrokUrl,
    kokioVaultPath: KOKIO_VAULT_DIR,
    kokioVaultExists: fs.existsSync(KOKIO_VAULT_DIR)
  };
}

export function searchKokioVaultFiles(keyword: string, maxResults: number = 15): Array<{
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

  if (!fs.existsSync(KOKIO_VAULT_DIR)) return results;
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
      const relPath = path.relative(KOKIO_VAULT_DIR, fullPath);

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

  walk(KOKIO_VAULT_DIR, 0);
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

  // 1) 자연어 Peer AI 호출 감지: Peer AI 1:1 방이거나 "파트너AI야 ...", "파트너AI님 ...", "@Peer AI", "Peer AI ..." 포함 시 (한글 뒤 \b 미사용)
  const isEaDirectRoom = roomId === 'room-ea' || roomId === 'room-direct-ea';
  const callsEaNaturally = /(?:^|\s)(?:파트너AI야|파트너AI님|@Peer AI|Peer AI\s+)/i.test(content);

  if (isEaDirectRoom || callsEaNaturally) {
    await waitAndPostEaReply(roomId, content, sender);
    return;
  }

  // 2) 자연어 Kokio AI 호출 감지:
  //    - Kokio AI 1:1 방(`room-kokio`)에서는 매번 "AI야"를 붙이지 않아도 모든 말을 AI 에이전트에게 하는 말로 인식
  //    - 단톡방이나 다른 방에서는 "AI야 ~", "AI님 ~", "Kokio AI ~해줘", "@Kokio AI" 등 자연어로 AI 에이전트를 부를 때만 반응!
  const isKokioAIDirectRoom = roomId === 'room-kokio' || roomId === 'room-direct-kokio';
  const callsKokioAINaturally = /(?:^|\s)(?:AI야|AI님|@Kokio AI|Kokio AI\s+)/i.test(content);

  if (isKokioAIDirectRoom || callsKokioAINaturally) {
    await waitAndPostRealKokioAIReply(roomId, content, messageObj.attachments || [], options);
  }
}

async function waitAndPostRealKokioAIReply(
  roomId: string,
  userContent: string,
  attachments: any[],
  options: { model?: string; level?: string }
): Promise<void> {
  // AI 에이전트가 글을 작성하는 동안만 조용히 타이핑 표시 활성화 ("전달했습니다" 같은 말풍선은 절대 생성하지 않음!)
  broadcastEvent({
    type: 'agent_typing',
    payload: {
      roomId,
      agentId: 'kokio',
      agentName: 'Kokio AI (🤖)',
      isTyping: true,
      statusText: 'AI 에이전트가 생각하고 작업을 수행하고 있어요...'
    }
  });

  try {
    const result = await askRealKokioAIAndWaitForReply({
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
            agentId: 'kokio',
            agentName: 'Kokio AI (🤖)',
            isTyping: true,
            statusText
          }
        });
      }
    });

    if (result.ok && result.reply) {
      const created = createMessage({
        roomId,
        senderId: 'kokio',
        content: result.reply,
        messageType: 'markdown',
        metadata: {
          agent: 'kokio',
          convId: result.convId
        }
      });
      broadcastEvent({ type: 'message_created', payload: created });
    }
  } catch (err) {
    console.error('[waitAndPostRealKokioAIReply Error]', err);
  } finally {
    broadcastEvent({
      type: 'agent_typing',
      payload: { roomId, agentId: 'kokio', agentName: 'Kokio AI (🤖)', isTyping: false }
    });
  }
}

/**
 * 서버 재시작 시 Kokio AI 1:1 방에 아직 답변이 달리지 않은 진행 중인 질문이 있으면
 * 자동으로 현재 턴의 완료를 감시하여 답변 말풍선을 띄웁니다.
 */
export async function resumeUnansweredKokioAIRoomIfNeeded(): Promise<void> {
  startLiveTranscriptMirrorLoop();
  try {
    const lastMsg = db.prepare(`
      SELECT id, room_id, sender_id, content, created_at
      FROM messages
      WHERE room_id = 'room-kokio'
      ORDER BY id DESC
      LIMIT 1
    `).get() as any;

    if (!lastMsg || lastMsg.sender_id === 'kokio') return;
    if (Date.now() - Number(lastMsg.created_at) > 180000) return;

    const convId = getActiveAntigravityConvId() || loadKokioAISessionState().activeConversationId;
    if (!convId) return;

    broadcastEvent({
      type: 'agent_typing',
      payload: {
        roomId: 'room-kokio',
        agentId: 'kokio',
        agentName: 'Kokio AI (🤖)',
        isTyping: true,
        statusText: 'AI 에이전트가 작업을 마무리하고 있어요...'
      }
    });

    const result = await waitForCurrentTurnCompletion({
      convId,
      timeoutMs: 180000,
      onProgress: (statusText: string) => {
        broadcastEvent({
          type: 'agent_typing',
          payload: {
            roomId: 'room-kokio',
            agentId: 'kokio',
            agentName: 'Kokio AI (🤖)',
            isTyping: true,
            statusText
          }
        });
      }
    });

    if (result.ok && result.reply) {
      // 중복 삽입 방지 확인
      const latestAfter = db.prepare(`
        SELECT sender_id FROM messages WHERE room_id = 'room-kokio' ORDER BY id DESC LIMIT 1
      `).get() as any;
      if (latestAfter && latestAfter.sender_id !== 'kokio') {
        const created = createMessage({
          roomId: 'room-kokio',
          senderId: 'kokio',
          content: result.reply,
          messageType: 'markdown',
          metadata: { agent: 'kokio', convId }
        });
        broadcastEvent({ type: 'message_created', payload: created });
      }
    }
  } catch (err) {
    console.error('[resumeUnansweredKokioAIRoomIfNeeded Error]', err);
  } finally {
    broadcastEvent({
      type: 'agent_typing',
      payload: { roomId: 'room-kokio', agentId: 'kokio', agentName: 'Kokio AI (🤖)', isTyping: false }
    });
  }
}

let isMirrorLoopRunning = false;
export function startLiveTranscriptMirrorLoop(): void {
  if (isMirrorLoopRunning) return;
  isMirrorLoopRunning = true;

  const syncOnce = () => {
    try {
      const convId = getActiveAntigravityConvId() || loadKokioAISessionState().activeConversationId;
      if (!convId) return;

      const steps = extractStepsFromTranscript(convId);
      if (steps.length === 0) return;

      const recentMsgs = db.prepare(`
        SELECT id, sender_id, content, metadata_json
        FROM messages
        WHERE room_id = 'room-kokio'
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

      // 최근 30개 스텝 중 아직 room-kokio에 없는 대화를 실시간 미러링
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
          roomId: 'room-kokio',
          senderId: st.role,
          content: st.text,
          messageType: 'markdown',
          metadata: {
            agent: st.role === 'kokio' ? 'kokio' : undefined,
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
      agentName: 'Peer AI (🔗)',
      isTyping: true,
      statusText: '파트너님 PC의 Peer AI가 답변을 작성하고 있어요...'
    }
  });

  try {
    const askRes = await callKokioAILocalApi(
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
        content: `⚠️ 현재 파트너님 PC의 Peer AI 서버 응답을 받지 못했어요: ${askRes.error}`,
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
      payload: { roomId, agentId: 'ea', agentName: 'Peer AI (🔗)', isTyping: false }
    });
  }
}
