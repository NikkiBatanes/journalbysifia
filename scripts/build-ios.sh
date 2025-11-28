#!/bin/bash

# Enterprise-grade iOS build script for siFia
# Ensures proper font loading in TestFlight/production builds

set -e

echo "🚀 Starting enterprise iOS build..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cd ios
xcodebuild clean -workspace siFia.xcworkspace -scheme siFia

# Update pods to ensure proper linking
echo "📦 Updating pods..."
pod install --repo-update

# Verify fonts are in correct location
echo "🔍 Verifying font files..."
FONT_DIR="siFia"
REQUIRED_FONTS=(
    "AntDesign.ttf"
    "Entypo.ttf"
    "EvilIcons.ttf"
    "Feather.ttf"
    "FontAwesome.ttf"
    "Foundation.ttf"
    "Ionicons.ttf"
    "MaterialIcons.ttf"
    "MaterialCommunityIcons.ttf"
    "SimpleLineIcons.ttf"
    "Octicons.ttf"
    "Zocial.ttf"
    "Fontisto.ttf"
)

for font in "${REQUIRED_FONTS[@]}"; do
    if [ ! -f "$FONT_DIR/$font" ]; then
        echo "❌ Missing font: $font"
        echo "📥 Copying from node_modules..."
        cp "../node_modules/react-native-vector-icons/Fonts/$font" "$FONT_DIR/"
    else
        echo "✅ Font found: $font"
    fi
done

# Build the app
echo "🔨 Building iOS app..."
xcodebuild -workspace siFia.xcworkspace \
           -scheme siFia \
           -configuration Release \
           -destination generic/platform=iOS \
           -archivePath build/siFia.xcarchive \
           archive

echo "🎉 Enterprise build completed successfully!"
echo "📱 Archive available at: build/siFia.xcarchive"
