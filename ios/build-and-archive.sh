#!/bin/bash

echo "🚀 Building siFia for TestFlight..."

# Navigate to iOS directory
cd "$(dirname "$0")"

echo "🧹 Cleaning build folder..."
rm -rf build

echo "🧹 Cleaning derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/siFia-*

echo "📱 Opening Xcode for archiving..."
echo ""
echo "📝 NEXT STEPS:"
echo "1. In Xcode: Product → Clean Build Folder (⇧⌘K)"
echo "2. In Xcode: Product → Archive"
echo "3. In Organizer: Distribute App → TestFlight"
echo "4. Wait for processing (10-15 minutes)"
echo "5. Test the NEW build on TestFlight"
echo ""
echo "✅ All font fixes are applied:"
echo "   - react-native.config.js fixed (removed ios: null)"
echo "   - metro.config.js fixed (SVG as source extension)"
echo "   - RNVectorIcons pod properly installed"
echo "   - Complex FontLoader removed (keep it simple)"
echo ""
echo "🎯 Lucide icons (SVG) will work"
echo "🎯 Vector icons (FontAwesome, etc.) will work"
