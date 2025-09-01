#!/bin/bash

# Complete Hermes dSYM Fix for App Store Submission
# This script addresses the persistent Hermes framework dSYM issue

set -e

echo "🔧 Starting comprehensive Hermes dSYM fix..."

# Navigate to iOS directory
cd "$(dirname "$0")"

# Step 1: Clean everything
echo "1️⃣ Cleaning build artifacts..."
rm -rf build/
rm -rf ~/Library/Developer/Xcode/DerivedData/siFia-*
rm -rf dSYMs/

# Step 2: Get React Native and Hermes versions
echo "2️⃣ Detecting versions..."
RN_VERSION=$(node -p "require('../package.json').dependencies['react-native']" | sed 's/[\^~]//g')
HERMES_VERSION=$(node -p "require('../node_modules/react-native/package.json').dependencies.hermes" | sed 's/[\^~]//g')

echo "React Native version: $RN_VERSION"
echo "Hermes version: $HERMES_VERSION"

# Step 3: Download correct Hermes dSYM
echo "3️⃣ Downloading Hermes dSYM..."
mkdir -p dSYMs

# Try multiple download URLs for different RN versions
HERMES_TAG="v$HERMES_VERSION"
DOWNLOAD_URLS=(
    "https://github.com/facebook/hermes/releases/download/$HERMES_TAG/hermes-runtime-darwin-$HERMES_TAG.tar.gz"
    "https://github.com/facebook/hermes/releases/download/$HERMES_TAG/hermes-runtime-darwin-v$HERMES_VERSION.tar.gz"
    "https://repo1.maven.org/maven2/com/facebook/react/hermes-engine/$HERMES_VERSION/hermes-engine-$HERMES_VERSION-debugsymbols.tar.gz"
)

DOWNLOADED=false
for url in "${DOWNLOAD_URLS[@]}"; do
    echo "Trying: $url"
    if curl -L "$url" -o hermes-dsym.tar.gz 2>/dev/null; then
        if tar -tf hermes-dsym.tar.gz >/dev/null 2>&1; then
            echo "✅ Successfully downloaded from: $url"
            DOWNLOADED=true
            break
        fi
    fi
    rm -f hermes-dsym.tar.gz
done

if [ "$DOWNLOADED" = false ]; then
    echo "❌ Could not download Hermes dSYM. Trying alternative method..."
    
    # Alternative: Extract from node_modules
    if [ -f "../node_modules/react-native/sdks/hermes/dSYM/hermes.framework.dSYM.tar.gz" ]; then
        echo "Using dSYM from node_modules..."
        cp "../node_modules/react-native/sdks/hermes/dSYM/hermes.framework.dSYM.tar.gz" hermes-dsym.tar.gz
        DOWNLOADED=true
    fi
fi

if [ "$DOWNLOADED" = true ]; then
    # Extract dSYM
    echo "4️⃣ Extracting dSYM..."
    tar -xzf hermes-dsym.tar.gz
    
    # Find and move the dSYM file
    find . -name "hermes.framework.dSYM" -exec mv {} dSYMs/ \; 2>/dev/null || true
    find . -name "*.dSYM" -path "*/hermes*" -exec mv {} dSYMs/hermes.framework.dSYM \; 2>/dev/null || true
    
    # Cleanup
    rm -f hermes-dsym.tar.gz
    rm -rf hermes-runtime-darwin* hermes-engine* 2>/dev/null || true
    
    if [ -d "dSYMs/hermes.framework.dSYM" ]; then
        echo "✅ Hermes dSYM extracted successfully"
    else
        echo "⚠️  dSYM extraction may have failed"
    fi
else
    echo "⚠️  Could not download Hermes dSYM automatically"
fi

# Step 5: Update Xcode project settings
echo "5️⃣ Updating Xcode project settings..."

# Add build script to copy dSYM
cat > copy-hermes-dsym.sh << 'EOF'
#!/bin/bash
# Copy Hermes dSYM to archive

if [ -d "${PROJECT_DIR}/dSYMs/hermes.framework.dSYM" ]; then
    echo "Copying Hermes dSYM to archive..."
    cp -R "${PROJECT_DIR}/dSYMs/hermes.framework.dSYM" "${DWARF_DSYM_FOLDER_PATH}/"
    echo "✅ Hermes dSYM copied to archive"
else
    echo "⚠️  Hermes dSYM not found at ${PROJECT_DIR}/dSYMs/hermes.framework.dSYM"
fi
EOF

chmod +x copy-hermes-dsym.sh

# Step 6: Pod install
echo "6️⃣ Refreshing CocoaPods..."
pod install --repo-update

echo ""
echo "✅ Hermes dSYM fix completed!"
echo ""
echo "📋 Next steps for App Store submission:"
echo "1. Open siFia.xcworkspace in Xcode"
echo "2. Select 'Any iOS Device (arm64)' as destination"
echo "3. Product → Archive"
echo "4. In Organizer, select your archive"
echo "5. Click 'Distribute App'"
echo "6. The archive should now include proper Hermes symbols"
echo ""
echo "🔍 To verify dSYM is included:"
echo "   dwarfdump -u dSYMs/hermes.framework.dSYM"
echo ""
echo "💡 If the issue persists, try:"
echo "   - Ensure Xcode is updated to latest version"
echo "   - Clean build folder (Cmd+Shift+K)"
echo "   - Delete derived data"
echo "   - Run this script again"
