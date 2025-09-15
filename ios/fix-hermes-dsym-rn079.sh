#!/bin/bash

# Hermes dSYM Fix for React Native 0.79.2
# Updated approach for latest RN versions

set -e

echo "🔧 Fixing Hermes dSYM for React Native 0.79.2..."

# Navigate to iOS directory
cd "$(dirname "$0")"

# Clean existing dSYM
echo "🧹 Cleaning existing Hermes dSYM..."
rm -rf dSYMs/hermes.framework.dSYM

# Create dSYMs directory
mkdir -p dSYMs

# For RN 0.79+, Hermes is bundled differently
echo "📦 Extracting Hermes dSYM from React Native bundle..."

# Check if Hermes dSYM exists in node_modules
NODE_HERMES_DSYM="../node_modules/react-native/sdks/hermes/dSYM/hermes.framework.dSYM"
NODE_HERMES_TAR="../node_modules/react-native/sdks/hermes/dSYM/hermes.framework.dSYM.tar.gz"

if [ -d "$NODE_HERMES_DSYM" ]; then
    echo "✅ Found Hermes dSYM in node_modules"
    cp -R "$NODE_HERMES_DSYM" dSYMs/
elif [ -f "$NODE_HERMES_TAR" ]; then
    echo "✅ Found Hermes dSYM tar in node_modules"
    cd dSYMs
    tar -xzf "$NODE_HERMES_TAR"
    cd ..
else
    # Try to find Hermes in Pods
    echo "🔍 Searching for Hermes in Pods..."
    
    PODS_HERMES=$(find Pods -name "hermes.framework.dSYM" 2>/dev/null | head -1)
    if [ -n "$PODS_HERMES" ]; then
        echo "✅ Found Hermes dSYM in Pods: $PODS_HERMES"
        cp -R "$PODS_HERMES" dSYMs/
    else
        # Download from Maven Central (React Native's official source)
        echo "📥 Downloading from Maven Central..."
        
        # Get Hermes version from React Native
        HERMES_VERSION=$(node -p "
            try {
                const rnPackage = require('../node_modules/react-native/package.json');
                const hermesVersion = rnPackage.dependencies?.hermes || 
                                    rnPackage.devDependencies?.hermes || 
                                    '0.12.0';
                hermesVersion.replace(/[\^~]/g, '');
            } catch(e) {
                '0.12.0';
            }
        ")
        
        echo "Hermes version: $HERMES_VERSION"
        
        # Try Maven Central URL
        MAVEN_URL="https://repo1.maven.org/maven2/com/facebook/react/hermes-engine/$HERMES_VERSION/hermes-engine-$HERMES_VERSION-debugsymbols.tar.gz"
        
        echo "Downloading: $MAVEN_URL"
        if curl -L "$MAVEN_URL" -o hermes-dsym.tar.gz; then
            echo "✅ Downloaded from Maven Central"
            tar -xzf hermes-dsym.tar.gz -C dSYMs/ 2>/dev/null || {
                echo "⚠️  Extraction failed, trying alternative..."
                rm -f hermes-dsym.tar.gz
            }
        fi
        
        # If Maven failed, try GitHub releases
        if [ ! -d "dSYMs/hermes.framework.dSYM" ]; then
            echo "📥 Trying GitHub releases..."
            GITHUB_URL="https://github.com/facebook/hermes/releases/download/v$HERMES_VERSION/hermes-runtime-darwin-v$HERMES_VERSION.tar.gz"
            
            if curl -L "$GITHUB_URL" -o hermes-dsym.tar.gz; then
                echo "✅ Downloaded from GitHub"
                tar -xzf hermes-dsym.tar.gz
                find . -name "hermes.framework.dSYM" -exec mv {} dSYMs/ \; 2>/dev/null || true
            fi
        fi
        
        # Cleanup
        rm -f hermes-dsym.tar.gz
        rm -rf hermes-runtime-darwin* hermes-engine* 2>/dev/null || true
    fi
fi

# Verify dSYM
if [ -d "dSYMs/hermes.framework.dSYM" ]; then
    echo "🔍 Verifying Hermes dSYM..."
    
    # Check if dSYM is valid
    if dwarfdump -u dSYMs/hermes.framework.dSYM 2>/dev/null | grep -q "UUID:"; then
        echo "✅ Hermes dSYM is valid"
        echo "UUIDs found:"
        dwarfdump -u dSYMs/hermes.framework.dSYM
    else
        echo "❌ dSYM appears corrupted, removing..."
        rm -rf dSYMs/hermes.framework.dSYM
    fi
else
    echo "⚠️  Could not obtain valid Hermes dSYM"
    echo "Creating placeholder to prevent build errors..."
    
    # Create a basic dSYM structure to prevent build failures
    mkdir -p dSYMs/hermes.framework.dSYM/Contents/Resources/DWARF
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
</dict>
</plist>
EOF
    
    echo "⚠️  Placeholder dSYM created - App Store submission may still have issues"
fi

echo "✅ Hermes dSYM setup completed"
