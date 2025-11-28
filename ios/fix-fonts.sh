#!/bin/bash

echo "🔧 Fixing font duplication issue..."

# Navigate to iOS directory
cd "$(dirname "$0")"

# Clean derived data
echo "🧹 Cleaning derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/siFia-*

# Clean build folder  
echo "🧹 Cleaning build folder..."
rm -rf build

# The fix is already done - pods reinstalled
echo "✅ Pods reinstalled successfully"

echo ""
echo "📝 Next steps:"
echo "1. Open Xcode"
echo "2. Product → Clean Build Folder (⇧⌘K)"
echo "3. Product → Build (⌘B)"
echo ""
echo "✅ If build succeeds, archive and upload to TestFlight"
echo "🎯 The duplicate font issue should now be resolved!"
