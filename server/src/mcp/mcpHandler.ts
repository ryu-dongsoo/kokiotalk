/**
 * 🔌 KokioTalk Built-in MCP (Model Context Protocol) Server Engine
 * - Solves KakaoTalk's closed message silo by exposing standard JSON-RPC 2.0 MCP tools
 * - Allows Claude, Gemini, Antigravity (KokioAI/Ea), and custom scripts to read, search, and send KokioTalk messages
 */

import {
  getRoomsWithSummary,
  getRoomMessages,
  createMessage,
  searchMessagesAndFiles,
  getAllDrawerItems
} from '../db/database.ts';
import { broadcastEvent } from '../ws/realtime.ts';

export const KOKIO_MCP_TOOLS = [
  {
    name: 'kokio_list_rooms',
    description: 'KokioTalk의 전체 채팅방 목록과 참여자, 안 읽은 메시지 수를 조회합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        viewerId: { type: 'string', description: '조회 기준 사용자 ID (기본값: ryu)' }
      }
    }
  },
  {
    name: 'kokio_read_messages',
    description: '특정 KokioTalk 채팅방의 최근 대화 내역을 조회합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        roomId: { type: 'string', description: '채팅방 ID (예: room-kokio, room-family-ai, room-lab-ai, room-self)' },
        limit: { type: 'number', description: '조회할 최대 메시지 수 (기본값: 30)' }
      },
      required: ['roomId']
    }
  },
  {
    name: 'kokio_send_message',
    description: '지정한 KokioTalk 채팅방에 메시지(마크다운, 수식, 코드 포함)를 전송합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        roomId: { type: 'string', description: '전송할 채팅방 ID' },
        senderId: { type: 'string', description: '발신자 ID (예: kokio, ea, ryu, ag-iot-architect)' },
        content: { type: 'string', description: '전송할 메시지 본문 (마크다운 및 LaTeX 수식 지원)' },
        replyToId: { type: 'number', description: '답장할 원본 메시지 ID (선택)' }
      },
      required: ['roomId', 'content']
    }
  },
  {
    name: 'kokio_search_messages',
    description: 'KokioTalk 전체 대화 내용 및 첨부파일 이름을 키워드로 전문 검색합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색할 키워드' },
        roomId: { type: 'string', description: '특정 방으로 한정할 경우 채팅방 ID (선택)' }
      },
      required: ['query']
    }
  },
  {
    name: 'kokio_list_drawer_files',
    description: '코끼오 무제한 톡서랍(Kokio Drawer)에 보관된 첨부파일 및 링크 목록을 조회합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        roomId: { type: 'string', description: '특정 채팅방 ID (생략 시 전체 조회)' }
      }
    }
  }
];

export function handleMcpJsonRpc(rpcReq: any): any {
  const id = rpcReq?.id ?? null;
  const method = rpcReq?.method || '';
  const params = rpcReq?.params || {};

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'kokiotalk-mcp-server',
          version: '1.0.0'
        }
      }
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: KOKIO_MCP_TOOLS
      }
    };
  }

  if (method === 'tools/call') {
    const toolName = params.name;
    const args = params.arguments || {};

    try {
      let output: any;
      if (toolName === 'kokio_list_rooms') {
        output = getRoomsWithSummary(args.viewerId || 'ryu');
      } else if (toolName === 'kokio_read_messages') {
        output = getRoomMessages(args.roomId, Number(args.limit) || 30);
      } else if (toolName === 'kokio_send_message') {
        const msg = createMessage({
          roomId: args.roomId,
          senderId: args.senderId || 'kokio',
          content: args.content,
          replyToId: args.replyToId || null,
          messageType: 'markdown',
          metadata: { via: 'MCP' }
        });
        broadcastEvent({ type: 'message_created', payload: msg });
        output = { ok: true, message: msg };
      } else if (toolName === 'kokio_search_messages') {
        output = searchMessagesAndFiles(args.query || '', args.roomId);
      } else if (toolName === 'kokio_list_drawer_files') {
        output = getAllDrawerItems(args.roomId);
      } else {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown MCP tool: ${toolName}` }
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(output, null, 2)
            }
          ]
        }
      };
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: err.message }
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    result: { ok: true, tools: KOKIO_MCP_TOOLS }
  };
}
