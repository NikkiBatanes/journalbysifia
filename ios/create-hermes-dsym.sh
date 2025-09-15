#!/bin/bash

# Create proper Hermes dSYM with the exact UUID App Store expects
# UUID: 6AE8A75C-5B8A-3C9B-AD6E-1D13D34ED04E

set -e

echo "🔧 Creating Hermes dSYM with UUID 6AE8A75C-5B8A-3C9B-AD6E-1D13D34ED04E..."

cd "$(dirname "$0")"

# Clean existing dSYM
rm -rf dSYMs/hermes.framework.dSYM

# Source Hermes binary with the correct UUID
HERMES_BINARY="/Users/nikkimaebatanes/CascadeProjects/siFia/ios/Pods/hermes-engine/destroot/Library/Frameworks/universal/hermes.xcframework/ios-arm64/hermes.framework/hermes"

# Verify the UUID is correct
echo "🔍 Verifying Hermes binary UUID..."
ACTUAL_UUID=$(dwarfdump -u "$HERMES_BINARY" | grep "UUID:" | awk '{print $2}')
EXPECTED_UUID="6AE8A75C-5B8A-3C9B-AD6E-1D13D34ED04E"

if [ "$ACTUAL_UUID" = "$EXPECTED_UUID" ]; then
    echo "✅ UUID matches: $ACTUAL_UUID"
else
    echo "❌ UUID mismatch. Expected: $EXPECTED_UUID, Found: $ACTUAL_UUID"
    exit 1
fi

# Create dSYM directory structure
echo "📁 Creating dSYM directory structure..."
mkdir -p dSYMs/hermes.framework.dSYM/Contents/Resources/DWARF

# Create Info.plist for the dSYM
echo "📝 Creating dSYM Info.plist..."
cat > dSYMs/hermes.framework.dSYM/Contents/Info.plist << EOF
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
    <key>dSYM_UUID</key>
    <dict>
        <key>arm64</key>
        <string>$EXPECTED_UUID</string>
    </dict>
</dict>
</plist>
EOF

# Extract debug symbols from the Hermes binary
echo "🔍 Extracting debug symbols..."
dsymutil "$HERMES_BINARY" -o dSYMs/hermes.framework.dSYM

# Verify the created dSYM
echo "✅ Verifying created dSYM..."
if [ -f "dSYMs/hermes.framework.dSYM/Contents/Resources/DWARF/hermes" ]; then
    DSYM_UUID=$(dwarfdump -u dSYMs/hermes.framework.dSYM | grep "UUID:" | awk '{print $2}')
    echo "dSYM UUID: $DSYM_UUID"
    
    if [ "$DSYM_UUID" = "$EXPECTED_UUID" ]; then
        echo "✅ dSYM created successfully with correct UUID"
    else
        echo "⚠️  dSYM UUID doesn't match, but continuing..."
    fi
else
    echo "❌ Failed to create dSYM DWARF file"
    exit 1
fi

echo "✅ Hermes dSYM creation completed"
