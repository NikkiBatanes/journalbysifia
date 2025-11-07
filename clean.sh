#!/bin/bash

echo "🧹 Starting comprehensive clean..."

# Kill all node processes
echo "Killing Node processes..."
killall node 2>/dev/null || true

# Kill Metro bundler
echo "Killing Metro bundler..."
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# Clean watchman
echo "Cleaning Watchman..."
watchman watch-del-all 2>/dev/null || true

# Clean Metro cache
echo "Cleaning Metro cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/react-* 2>/dev/null || true

# Clean npm cache
echo "Cleaning npm cache..."
npm cache clean --force

# Remove node_modules (force)
echo "Removing node_modules..."
rm -rf node_modules
rm -f package-lock.json

# Clean iOS
echo "Cleaning iOS..."
rm -rf ios/Pods
rm -rf ios/Podfile.lock
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Clean Android
echo "Cleaning Android..."
rm -rf android/app/build
rm -rf android/build
rm -rf android/.gradle

# Clean React Native cache
echo "Cleaning React Native cache..."
rm -rf ~/.rncache

echo "✅ Clean complete!"
echo ""
echo "Next steps:"
echo "1. npm install"
echo "2. cd ios && pod install && cd .."
echo "3. npx react-native start --reset-cache"
