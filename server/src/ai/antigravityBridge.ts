/**
 * 🧠 KokioTalk ↔ Antigravity (Kokio AI KokioAI 🥛) & Peer AI (🔗) 자연어 직결 브릿지
 * - 꼬끼오톡에서 "AI야 ~해줘" (또는 Kokio AI 1:1 방에서 자연어 메시지) 입력 시:
 *   1) 중간 안내 문구("전달했습니다" 등)를 일절 띄우지 않음
 *   2) 현재 PC의 안티그래비티(Kokio AI 본체)로 즉시 자연어 명령을 전달함
 *   3) 안티그래비티가 모든 도구 실행과 추론을 마치고 최종 답변(`PLANNER_RESPONSE`)을 출력할 때까지 대기함
 *   4) AI 에이전트가 작성한 실제 최종 답변 글만 꼬끼오톡 말풍선으로 전달함
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

const HOME_DIR = os.homedir();
const LOCAL_GATEWAY_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..', 'gateway-server');
export const BRAIN_DIR = path.join(HOME_DIR, '.gemini', 'antigravity', 'brain');
export const GATEWAY_SERVER_DIR = fs.existsSync(path.join(HOME_DIR, 'OneDrive', 'KokioVault', 'gateway-server'))
  ? path.join(HOME_DIR, 'OneDrive', 'KokioVault', 'gateway-server')
  : LOCAL_GATEWAY_DIR;
export const GATEWAY_SESSIONS_FILE = path.join(GATEWAY_SERVER_DIR, 'sessions.json');
export const GATEWAY_PORT = 8081;

export function loadKokioAISessionState(): {
  activeModel: string;
  activeLevel: string;
  activeConversationId: string | null;
  peerName: string;
  peerUrl: string;
} {
  try {
    if (fs.existsSync(GATEWAY_SESSIONS_FILE)) {
      const s = JSON.parse(fs.readFileSync(GATEWAY_SESSIONS_FILE, 'utf-8'));
      return {
        activeModel: s.activeModel || 'argon',
        activeLevel: s.activeLevel || 'medium',
        activeConversationId: s.activeConversationId || null,
        peerName: s.peerName || 'Peer AI (🔗)',
        peerUrl: s.peerUrl || ''
      };
    }
  } catch {}
  return {
    activeModel: 'argon',
    activeLevel: 'medium',
    activeConversationId: null,
    peerName: 'Peer AI (🔗)',
    peerUrl: ''
  };
}

export function getActiveAntigravityConvId(): string | null {
  // 가장 최근에 활성화된 transcript.jsonl이 있는 대화 ID 반환
  if (!fs.existsSync(BRAIN_DIR)) return null;
  try {
    const dirs = fs.readdirSync(BRAIN_DIR, { withFileTypes: true });
    let bestId: string | null = null;
    let bestMtime = 0;
    for (const d of dirs) {
      if (!d.isDirectory() || d.name === 'tempmediaStorage' || !/^[0-9a-f\-]{36}$/i.test(d.name)) continue;
      const logPath = path.join(BRAIN_DIR, d.name, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(logPath)) {
        const st = fs.statSync(logPath);
        if (st.mtimeMs > bestMtime) {
          bestMtime = st.mtimeMs;
          bestId = d.name;
        }
      }
    }
    if (bestId) return bestId;
  } catch {}
  return loadKokioAISessionState().activeConversationId;
}

function getTranscriptLineCount(convId: string): number {
  if (!convId) return 0;
  const logPath = path.join(BRAIN_DIR, convId, '.system_generated', 'logs', 'transcript.jsonl');
  if (!fs.existsSync(logPath)) return 0;
  try {
    const raw = fs.readFileSync(logPath, 'utf-8');
    return raw.split(/\r?\n/).filter(Boolean).length;
  } catch {
    return 0;
  }
}

function readFullPlannerContent(convId: string, stepObj: any): string {
  const stripMobileQuote = (s: string) =>
    String(s || '').replace(/^>\s*📱\s*\*\*사용자님\s*\(모바일\)\*\*:\s*[^\r\n]+\r?\n*/m, '').trim();

  const isTruncated =
    Array.isArray(stepObj.truncated_fields) && stepObj.truncated_fields.includes('content');
  if (!isTruncated) {
    return stripMobileQuote(stepObj.content);
  }

  const fullPath = path.join(BRAIN_DIR, convId, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (!fs.existsSync(fullPath)) {
    return stripMobileQuote(stepObj.content);
  }

  try {
    const lines = fs.readFileSync(fullPath, 'utf-8').split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const fullStep = JSON.parse(lines[i]);
        if (fullStep.step_index === stepObj.step_index && fullStep.type === 'PLANNER_RESPONSE') {
          return stripMobileQuote(fullStep.content);
        }
      } catch {}
    }
  } catch {}

  return stripMobileQuote(stepObj.content);
}

export function extractStepsFromTranscript(convId: string): Array<{
  stepKey: string;
  role: 'ryu' | 'kokio';
  text: string;
  createdAt: number;
}> {
  if (!convId) return [];
  const logPath = path.join(BRAIN_DIR, convId, '.system_generated', 'logs', 'transcript.jsonl');
  if (!fs.existsSync(logPath)) return [];

  const results: Array<{ stepKey: string; role: 'ryu' | 'kokio'; text: string; createdAt: number }> = [];
  try {
    const lines = fs.readFileSync(logPath, 'utf-8').split(/\r?\n/).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      let step: any;
      try {
        step = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      const stepIdx = step.step_index ?? i;
      const ts = step.created_at ? new Date(step.created_at).getTime() : Date.now();

      if (step.type === 'USER_INPUT') {
        let raw = String(step.content || '');
        const mReq = raw.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
        if (mReq) raw = mReq[1];
        const mAsk = raw.match(/사용자님의 요청:\s*([\s\S]*)$/);
        if (mAsk) raw = mAsk[1];
        const clean = raw.trim();
        if (clean) {
          results.push({ stepKey: `${convId}:u:${stepIdx}`, role: 'ryu', text: clean, createdAt: ts });
        }
      } else if (step.type === 'SYSTEM_MESSAGE') {
        const raw = String(step.content || '');
        const mAsk = raw.match(/사용자님의 요청:\s*([\s\S]*?)<\/SYSTEM_MESSAGE>/) || raw.match(/사용자님의 요청:\s*([\s\S]*)$/);
        if (mAsk) {
          const clean = mAsk[1].replace(/<\/SYSTEM_MESSAGE>[\s\S]*$/, '').trim();
          if (clean) {
            results.push({ stepKey: `${convId}:s:${stepIdx}`, role: 'ryu', text: clean, createdAt: ts });
          }
        }
      } else if (step.type === 'PLANNER_RESPONSE') {
        const toolCalls = Array.isArray(step.tool_calls) ? step.tool_calls : [];
        if (step.status === 'DONE' && toolCalls.length === 0) {
          const text = readFullPlannerContent(convId, step);
          if (text) {
            results.push({ stepKey: `${convId}:a:${stepIdx}`, role: 'kokio', text, createdAt: ts });
          }
        }
      }
    }
  } catch {}
  return results;
}

export function callKokioAILocalApi(
  apiPath: string,
  method: 'GET' | 'POST',
  bodyObj: any = null,
  timeoutMs: number = 30000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = bodyObj ? Buffer.from(JSON.stringify(bodyObj), 'utf-8') : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: GATEWAY_PORT,
        path: apiPath,
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        },
        timeout: timeoutMs
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve(raw.trim() ? JSON.parse(raw) : {});
          } catch {
            resolve({ ok: res.statusCode === 200, raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('KokioAI 8081 API timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * 현재 진행 중인 턴(가장 최근 USER_INPUT / SYSTEM_MESSAGE 이후)의
 * 실시간 도구 실행 상태를 중계하고 최종 PLANNER_RESPONSE 텍스트를 반환합니다.
 */
export async function waitForCurrentTurnCompletion(params: {
  convId: string;
  startFromLine?: number;
  timeoutMs?: number;
  onProgress?: (statusText: string) => void;
}): Promise<{ ok: boolean; reply: string; convId: string }> {
  const { convId, timeoutMs = 480000, onProgress } = params;
  const logPath = path.join(BRAIN_DIR, convId, '.system_generated', 'logs', 'transcript.jsonl');
  const startMs = Date.now();
  let lastReportedStatus = '';

  while (Date.now() - startMs < timeoutMs) {
    await new Promise(r => setTimeout(r, 850));
    if (!fs.existsSync(logPath)) continue;

    try {
      const raw = fs.readFileSync(logPath, 'utf-8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) continue;

      let searchStart = typeof params.startFromLine === 'number' ? params.startFromLine : -1;
      if (searchStart < 0) {
        // 가장 마지막 USER_INPUT 또는 SYSTEM_MESSAGE 위치 탐색
        for (let idx = lines.length - 1; idx >= 0; idx--) {
          try {
            const st = JSON.parse(lines[idx]);
            if (st.type === 'USER_INPUT' || st.type === 'SYSTEM_MESSAGE') {
              searchStart = idx;
              break;
            }
          } catch {}
        }
      }
      if (searchStart < 0 || lines.length <= searchStart) continue;

      const newLines = lines.slice(searchStart);
      let sawUserPrompt = false;

      for (let i = 0; i < newLines.length; i++) {
        let step: any;
        try {
          step = JSON.parse(newLines[i]);
        } catch {
          continue;
        }

        if (step.type === 'USER_INPUT' || step.type === 'SYSTEM_MESSAGE') {
          sawUserPrompt = true;
        } else if (sawUserPrompt && step.type === 'PLANNER_RESPONSE') {
          const toolCalls = Array.isArray(step.tool_calls) ? step.tool_calls : [];
          if (toolCalls.length > 0 && onProgress) {
            const lastTool = toolCalls[toolCalls.length - 1];
            const toolLabel =
              lastTool?.args?.toolSummary ||
              lastTool?.args?.Path ||
              lastTool?.args?.query ||
              lastTool?.name ||
              '도구 실행';
            const statusMsg = `AI 에이전트가 작업 중이에요 (${toolLabel})...`;
            if (statusMsg !== lastReportedStatus) {
              lastReportedStatus = statusMsg;
              onProgress(statusMsg);
            }
          }

          if (step.status === 'DONE' && toolCalls.length === 0) {
            const text = readFullPlannerContent(convId, step);
            if (text.length > 0) {
              return { ok: true, reply: text, convId };
            }
          }
        }
      }
    } catch {}
  }

  return { ok: false, reply: '', convId };
}

/**
 * 지금 이 PC의 안티그래비티(Kokio AI)에게 자연어 명령을 전달하고,
 * 중간 안내 메시지 없이 AI 에이전트의 최종 답변 글이 나올 때까지 기다려 반환합니다.
 */
export async function askRealKokioAIAndWaitForReply(params: {
  prompt: string;
  attachments?: any[];
  model?: string;
  level?: string;
  timeoutMs?: number;
  onProgress?: (statusText: string) => void;
}): Promise<{ ok: boolean; reply: string; convId: string | null }> {
  const sessionState = loadKokioAISessionState();
  const targetConvId = getActiveAntigravityConvId() || sessionState.activeConversationId;
  const beforeLines = targetConvId ? getTranscriptLineCount(targetConvId) : 0;

  const formattedAttachments = (params.attachments || []).map((a: any) => ({
    fileName: a.fileName,
    fileUrl: a.url,
    absolutePath: a.localPath || a.url
  }));

  const sendRes = await callKokioAILocalApi(
    '/api/chat',
    'POST',
    {
      message: params.prompt,
      attachments: formattedAttachments,
      model: params.model || sessionState.activeModel || 'argon',
      level: params.level || sessionState.activeLevel || 'medium',
      conversationId: targetConvId
    },
    20000
  );

  const convId: string | null = sendRes?.conversationId || targetConvId;
  if (!convId) {
    return { ok: false, reply: '', convId: null };
  }

  return waitForCurrentTurnCompletion({
    convId,
    startFromLine: beforeLines,
    timeoutMs: params.timeoutMs || 180000,
    onProgress: params.onProgress
  });
}
