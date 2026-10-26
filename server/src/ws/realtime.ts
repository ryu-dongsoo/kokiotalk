/**
 * ⚡ KokioTalk Real-time Engine (RFC 6455 WebSocket + SSE Dual Engine)
 * - Zero external dependencies (pure Node.js `node:crypto` & `node:http`)
 * - Broadcasts instant messages, KakaoTalk `1` read receipt updates, reactions, and AI typing states
 */

import crypto from 'node:crypto';

export interface RealtimeEvent {
  type:
    | 'connected'
    | 'message_created'
    | 'message_updated'
    | 'read_updated'
    | 'room_updated'
    | 'agent_typing'
    | 'user_updated';
  payload: any;
  timestamp?: number;
}

const wsClients = new Set<any>();
const sseClients = new Set<any>();

export function attachWebSocketUpgrade(server: any): void {
  server.on('upgrade', (req: any, socket: any) => {
    const upgradeHeader = String(req.headers['upgrade'] || '').toLowerCase();
    if (upgradeHeader !== 'websocket') {
      socket.destroy();
      return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary')
      .digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n'
    ].join('\r\n');

    socket.write(headers);
    wsClients.add(socket);

    sendWsFrame(socket, {
      type: 'connected',
      payload: { ok: true, protocol: 'KokioTalk-WS-1.0' },
      timestamp: Date.now()
    });

    socket.on('data', (buffer: Buffer) => {
      try {
        const decoded = decodeWsFrame(buffer);
        if (!decoded) return;
        if (decoded.opcode === 0x8) {
          // Close frame
          wsClients.delete(socket);
          socket.end();
          return;
        }
        if (decoded.opcode === 0x9) {
          // Ping -> Pong
          socket.write(Buffer.from([0x8a, 0x00]));
          return;
        }
        if (decoded.opcode === 0x1 && decoded.text) {
          const msg = JSON.parse(decoded.text);
          if (msg.type === 'ping') {
            sendWsFrame(socket, { type: 'connected', payload: { pong: Date.now() } });
          }
        }
      } catch {
        // Ignore malformed frame
      }
    });

    socket.on('close', () => wsClients.delete(socket));
    socket.on('error', () => wsClients.delete(socket));
  });
}

function sendWsFrame(socket: any, data: RealtimeEvent): void {
  try {
    const jsonBytes = Buffer.from(JSON.stringify(data), 'utf-8');
    const len = jsonBytes.length;
    let header: Buffer;

    if (len < 126) {
      header = Buffer.from([0x81, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }

    socket.write(Buffer.concat([header, jsonBytes]));
  } catch {
    wsClients.delete(socket);
  }
}

function decodeWsFrame(buf: Buffer): { opcode: number; text?: string } | null {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const isMasked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }

  let maskKey: Buffer | null = null;
  if (isMasked) {
    if (buf.length < offset + 4) return null;
    maskKey = buf.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buf.length < offset + payloadLen) return null;
  const payload = Buffer.from(buf.subarray(offset, offset + payloadLen));

  if (isMasked && maskKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  return {
    opcode,
    text: opcode === 0x1 ? payload.toString('utf-8') : undefined
  };
}

export function registerSseClient(req: any, res: any): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const initEvent: RealtimeEvent = {
    type: 'connected',
    payload: { ok: true, protocol: 'KokioTalk-SSE-1.0' },
    timestamp: Date.now()
  };
  res.write(`data: ${JSON.stringify(initEvent)}\n\n`);
  sseClients.add(res);

  req.on('close', () => sseClients.delete(res));
  req.on('error', () => sseClients.delete(res));
}

export function broadcastEvent(event: RealtimeEvent): void {
  const fullEvent: RealtimeEvent = {
    ...event,
    timestamp: event.timestamp || Date.now()
  };

  for (const sock of wsClients) {
    sendWsFrame(sock, fullEvent);
  }

  const sseLine = `data: ${JSON.stringify(fullEvent)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(sseLine);
    } catch {
      sseClients.delete(res);
    }
  }
}
