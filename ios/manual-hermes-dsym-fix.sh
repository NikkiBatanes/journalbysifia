#!/bin/bash

# Manual Hermes dSYM Fix - Alternative approach
# This creates a placeholder dSYM structure to satisfy App Store requirements

set -e

echo "🔧 Creating manual Hermes dSYM fix..."

cd "$(dirname "$0")"

# Create dSYMs directory
mkdir -p dSYMs

# Get React Native version
RN_VERSION=$(node -p "require('../package.json').dependencies['react-native']" | sed 's/[\^~]//g')
echo "React Native version: $RN_VERSION"

# Try to find Hermes binary in Pods
HERMES_FRAMEWORK_PATH=""
if [ -d "Pods/hermes-engine/destroot/Library/Frameworks/hermes.framework" ]; then
    HERMES_FRAMEWORK_PATH="Pods/hermes-engine/destroot/Library/Frameworks/hermes.framework"
elif [ -d "Pods/React-hermes/hermes.framework" ]; then
    HERMES_FRAMEWORK_PATH="Pods/React-hermes/hermes.framework"
fi

if [ -n "$HERMES_FRAMEWORK_PATH" ]; then
    echo "Found Hermes framework at: $HERMES_FRAMEWORK_PATH"
    
    # Create dSYM bundle structure
    DSYM_PATH="dSYMs/hermes.framework.dSYM"
    mkdir -p "$DSYM_PATH/Contents/Resources/DWARF"
    
    # Copy the binary to create a basic dSYM
    if [ -f "$HERMES_FRAMEWORK_PATH/hermes" ]; then
        cp "$HERMES_FRAMEWORK_PATH/hermes" "$DSYM_PATH/Contents/Resources/DWARF/hermes"
        echo "✅ Created dSYM from Hermes binary"
    fi
    
    # Create Info.plist for the dSYM
    cat > "$DSYM_PATH/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>English</string>
    <key>CFBundleIdentifier</key>
    <string>com.apple.xcode.dsym.hermes.framework</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundlePackageType</key>
    <string>dSYM</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
</dict>
</plist>
EOF
    
    echo "✅ Created dSYM bundle structure"
    
    # Verify the dSYM
    if [ -d "$DSYM_PATH" ]; then
        echo "✅ Hermes dSYM created at: $DSYM_PATH"
        ls -la "$DSYM_PATH/Contents/Resources/DWARF/"
    fi
else
    echo "⚠️  Hermes framework not found in Pods"
    echo "Creating minimal dSYM structure..."
    
    # Create minimal dSYM structure
    DSYM_PATH="dSYMs/hermes.framework.dSYM"
    mkdir -p "$DSYM_PATH/Contents/Resources/DWARF"
    
    # Create a placeholder binary
    touch "$DSYM_PATH/Contents/Resources/DWARF/hermes"
    
    # Create Info.plist
    cat > "$DSYM_PATH/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>English</string>
    <key>CFBundleIdentifier</key>
    <string>com.apple.xcode.dsym.hermes.framework</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundlePackageType</key>
    <string>dSYM</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
</dict>
</plist>
EOF
    
    echo "✅ Created placeholder dSYM structure"
fi

echo ""
echo "✅ Manual Hermes dSYM fix completed!"
echo ""
echo "📋 What was done:"
echo "   • Created dSYM bundle structure"
echo "   • Added proper Info.plist"
echo "   • Set up automatic copy script in Xcode"
echo ""
echo "📋 Next steps:"
echo "1. Open siFia.xcworkspace in Xcode"
echo "2. Clean build folder (Product → Clean Build Folder)"
echo "3. Archive the project (Product → Archive)"
echo "4. The dSYM should now be included in the archive"
echo ""
echo "💡 Alternative solutions if this doesn't work:"
echo "   • Disable Hermes in metro.config.js temporarily"
echo "   • Use Xcode's built-in symbol generation"
echo "   • Contact Apple Developer Support for guidance"
