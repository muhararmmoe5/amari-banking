#!/bin/bash
# Nuke everything and start fresh. Run with: bash restart.sh
set -e

echo "==> Killing all node/next processes…"
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
pkill -f node 2>/dev/null || true
sleep 1

echo "==> Clearing caches…"
rm -rf .next
rm -rf node_modules/.cache

echo "==> Confirming port 3000 is free…"
if lsof -ti :3000 >/dev/null 2>&1; then
  lsof -ti :3000 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo "==> Starting dev server…"
echo "    When you see 'Ready in', open http://localhost:3000 with Cmd+Shift+R."
echo "    Look for 'v.budgets+opts' tiny text at the bottom of the sidebar"
echo "    to confirm you're on the new bundle."
echo ""
exec npm run dev
