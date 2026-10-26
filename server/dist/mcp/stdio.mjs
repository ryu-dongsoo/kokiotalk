/**
 * 🔌 KokioTalk Standard Stdio MCP Server
 * Usage: node --experimental-strip-types --no-warnings server/src/mcp/stdio.ts
 */

import readline from 'node:readline';
import { initDatabase } from '../db/database.mjs';
import { handleMcpJsonRpc } from './mcpHandler.mjs';

initDatabase();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line        ) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed);
    const res = handleMcpJsonRpc(req);
    process.stdout.write(JSON.stringify(res) + '\n');
  } catch (err     ) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: err.message }
      }) + '\n'
    );
  }
});
