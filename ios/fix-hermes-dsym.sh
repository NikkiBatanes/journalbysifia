#!/bin/bash

# Fix Hermes dSYM generation for App Store submission
# This script ensures proper symbol generation for Hermes framework

echo "🔧 Fixing Hermes dSYM generation..."

# Navigate to iOS directory
cd "$(dirname "$0")"

# Clean build folder
echo "Cleaning build folder..."
xcodebuild clean -workspace siFia.xcworkspace -scheme siFia

# Remove derived data
echo "Removing derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData/siFia-*

# Pod install to refresh
echo "Refreshing CocoaPods..."
pod install --repo-update

# Create Hermes dSYM download script
echo "Creating Hermes dSYM download script..."
cat > download-hermes-dsym.sh << 'EOF'
#!/bin/bash

# Download Hermes dSYM for the specific version
HERMES_VERSION=$(node -p "require('../node_modules/react-native/package.json').dependencies.hermes")
HERMES_TAG="v$(echo $HERMES_VERSION | sed 's/[\^~]//g')"

echo "Downloading Hermes dSYM for version: $HERMES_TAG"

# Create dSYMs directory if it doesn't exist
mkdir -p dSYMs

# Download Hermes dSYM
curl -L "https://github.com/facebook/hermes/releases/download/$HERMES_TAG/hermes-runtime-darwin-v$HERMES_TAG.tar.gz" -o hermes-dsym.tar.gz

# Extract dSYM
tar -xzf hermes-dsym.tar.gz
mv hermes-runtime-darwin/dSYM/hermes.framework.dSYM dSYMs/
rm -rf hermes-runtime-darwin hermes-dsym.tar.gz

echo "✅ Hermes dSYM downloaded to dSYMs/hermes.framework.dSYM"
EOF

chmod +x download-hermes-dsym.sh

echo "✅ Hermes dSYM fix applied!"
echo ""
echo "Next steps:"
echo "1. Run './download-hermes-dsym.sh' to download Hermes symbols"
echo "2. Open siFia.xcworkspace in Xcode"
echo "3. Select 'Any iOS Device' as destination"
echo "4. Product → Archive"
echo "5. The archive should now include proper Hermes symbols"
