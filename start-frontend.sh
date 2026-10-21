#!/usr/bin/env bash
# Script to launch the VaultLend frontend dashboard

PORT=3000
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/frontend" && pwd)"

echo "================================================="
echo "⚡ Starting VaultLend Frontend Dashboard ⚡"
echo "================================================="
echo "Serving files from: $DIR"
echo "URL: http://localhost:$PORT"
echo ""

# Try opening the browser automatically on macOS
if command -v open >/dev/null 2>&1; then
  (sleep 1 && open "http://localhost:$PORT") &
fi

# Use Python3's built-in HTTP server
if command -v python3 >/dev/null 2>&1; then
  cd "$DIR" && python3 -m http.server $PORT
elif command -v npx >/dev/null 2>&1; then
  cd "$DIR" && npx serve -p $PORT .
else
  echo "Please open $DIR/index.html directly in your web browser."
fi
