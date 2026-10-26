#!/bin/bash
cd "$(dirname "$0")"
echo "=================================================================="
echo "  🐓 Starting KokioTalk & Antigravity 2.0+ Personal AI Agent..."
echo "=================================================================="

node scripts/build-server.cjs >/dev/null 2>&1
node server/dist/index.mjs &
CORE_PID=$!

cd gateway-server
node server.js &
GW_PID=$!
cd ..

sleep 2
if command -v open >/dev/null 2>&1; then
  open "http://localhost:8081"
  open "http://localhost:8081/qr"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:8081"
fi

echo "✅ KokioTalk is running on http://localhost:8081 (Mobile QR: http://localhost:8081/qr)"
wait $CORE_PID $GW_PID
