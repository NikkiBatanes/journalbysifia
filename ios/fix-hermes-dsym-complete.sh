#!/bin/bash

# Complete Hermes dSYM Fix Script for iOS Archive
# This script ensures the Hermes dSYM is properly included in your archive

set -e

echo "🔧 Starting Hermes dSYM fix for iOS archive..."
echo ""

# Navigate to iOS directory
cd "$(dirname "$0")"

# Step 1: Verify dSYM exists
echo "📋 Step 1: Verifying Hermes dSYM..."
if [ -d "dSYMs/hermes.framework.dSYM" ]; then
    echo "✅ Hermes dSYM found"
    
    # Check UUID
    UUID=$(dwarfdump --uuid dSYMs/hermes.framework.dSYM 2>/dev/null | grep -o '[0-9A-F]\{8\}-[0-9A-F]\{4\}-[0-9A-F]\{4\}-[0-9A-F]\{4\}-[0-9A-F]\{12\}' | head -1)
    if [ -n "$UUID" ]; then
        echo "✅ dSYM UUID: $UUID"
    else
        echo "⚠️  Could not read UUID from dSYM"
    fi
else
    echo "❌ Hermes dSYM not found. Downloading..."
    ruby hermes-dsym-fix.rb
fi

echo ""

# Step 2: Add build script to Xcode project
echo "📋 Step 2: Adding build script to Xcode project..."
ruby add-hermes-dsym-script.rb

echo ""

# Step 3: Verify Xcode project
echo "📋 Step 3: Verifying Xcode project configuration..."
if grep -q "Copy Hermes dSYM" siFia.xcodeproj/project.pbxproj; then
    echo "✅ Build script added to Xcode project"
else
    echo "⚠️  Build script may not be properly configured"
fi

echo ""
echo "✅ Hermes dSYM fix completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Open Xcode: open siFia.xcworkspace"
echo "   2. Clean build folder: Product → Clean Build Folder (Cmd+Shift+K)"
echo "   3. Archive your app: Product → Archive"
echo "   4. The Hermes dSYM will be automatically included in the archive"
echo ""
echo "💡 If you still see the error:"
echo "   • Check that the dSYM exists at: $(pwd)/dSYMs/hermes.framework.dSYM"
echo "   • Verify the build script in Xcode: Target → Build Phases → Copy Hermes dSYM"
echo "   • Try archiving again after cleaning the build folder"
echo ""
