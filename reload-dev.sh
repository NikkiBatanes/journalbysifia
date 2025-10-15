#!/bin/bash

# Quick reload script for React Native development
# Usage: ./reload-dev.sh

echo "🔄 Reloading React Native app..."

# Kill existing Metro bundler
echo "1️⃣ Stopping Metro bundler..."
pkill -f metro 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true

# Clear watchman
echo "2️⃣ Clearing watchman..."
watchman watch-del-all 2>/dev/null || true

# Clear Metro cache
echo "3️⃣ Clearing Metro cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-* 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true

# Start Metro with reset cache
echo "4️⃣ Starting Metro bundler with reset cache..."
npx react-native start --reset-cache &

# Wait for Metro to start
sleep 3

echo "✅ Metro bundler restarted!"
echo ""
echo "📱 Now reload your app:"
echo "   iOS Simulator: Press Cmd+R or shake device"
echo "   Android Emulator: Press R twice or Cmd+M → Reload"
echo ""
echo "💡 Tip: In Metro terminal, press 'r' to reload all devices"
