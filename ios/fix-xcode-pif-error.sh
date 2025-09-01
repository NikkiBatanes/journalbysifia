#!/bin/bash

# Fix Xcode PIF Transfer Session Error
# This script resolves "unable to initiate PIF transfer session" errors

set -e

echo "🔧 Fixing Xcode PIF transfer session error..."

cd "$(dirname "$0")"

# Step 1: Kill all Xcode processes
echo "1️⃣ Terminating Xcode processes..."
pkill -f Xcode || true
pkill -f xcodebuild || true
pkill -f xcrun || true
sleep 2

# Step 2: Clear Xcode caches and derived data
echo "2️⃣ Clearing Xcode caches..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf ~/Library/Caches/com.apple.dt.Xcode/*
rm -rf ~/Library/Developer/Xcode/iOS\ DeviceSupport/*/Symbols/System/Library/Caches/*

# Step 3: Clear project build artifacts
echo "3️⃣ Clearing project build artifacts..."
rm -rf build/
rm -rf Pods/
rm -rf *.xcworkspace/xcuserdata/
rm -rf *.xcodeproj/xcuserdata/
rm -rf *.xcodeproj/project.xcworkspace/xcuserdata/

# Step 4: Clear module cache
echo "4️⃣ Clearing module cache..."
rm -rf ~/Library/Developer/Xcode/DerivedData/ModuleCache.noindex/*

# Step 5: Reinstall pods
echo "5️⃣ Reinstalling CocoaPods..."
pod deintegrate || true
pod install --repo-update

# Step 6: Reset Xcode settings
echo "6️⃣ Resetting Xcode settings..."
defaults delete com.apple.dt.Xcode 2>/dev/null || true

echo ""
echo "✅ Xcode PIF error fix completed!"
echo ""
echo "📋 Next steps:"
echo "1. Open Xcode"
echo "2. Open siFia.xcworkspace (NOT .xcodeproj)"
echo "3. Wait for indexing to complete"
echo "4. Try cleaning again (⌘+Shift+K)"
echo "5. If clean works, proceed with archive"
echo ""
echo "💡 If the error persists:"
echo "   • Restart your Mac"
echo "   • Update Xcode to latest version"
echo "   • Try opening project in Xcode 15+ if available"
