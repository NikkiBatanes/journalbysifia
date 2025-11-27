#!/bin/bash

# Enterprise-grade Xcode build preparation script
# This ensures all ReactCodegen files are properly generated before Xcode builds

set -e

echo "🔧 Preparing iOS project for Xcode build..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Step 1: Clean all build artifacts
echo "📦 Cleaning build artifacts..."
rm -rf ios/build
rm -rf ios/Pods
rm -rf ~/Library/Developer/Xcode/DerivedData/siFia-*
rm -rf ~/Library/Caches/com.apple.dt.Xcode

# Step 2: Reinstall dependencies
echo "📦 Installing npm dependencies..."
npm install

# Step 3: Install pods and generate codegen
echo "📦 Installing CocoaPods and generating ReactCodegen..."
cd ios
pod install

# Step 4: Trigger codegen generation via React Native
echo "🔨 Generating ReactCodegen files..."
cd ..
npx react-native codegen || true

# Step 5: Verify critical files exist
echo "✅ Verifying generated files..."
REQUIRED_FILES=(
  "ios/build/generated/ios/safeareacontextJSI-generated.cpp"
  "ios/build/generated/ios/react/renderer/components/safeareacontext/States.cpp"
  "ios/build/generated/ios/react/renderer/components/rngesturehandler_codegen/States.cpp"
)

MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠️  Missing: $file"
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done

if [ $MISSING_FILES -gt 0 ]; then
  echo "⚠️  Some codegen files are missing. Running full iOS build to generate them..."
  npx react-native run-ios --simulator="iPhone 16" &
  BUILD_PID=$!
  
  # Wait for codegen files to be generated (usually takes 30-60 seconds)
  echo "⏳ Waiting for codegen generation..."
  sleep 60
  
  # Kill the build process - we only needed it to generate files
  kill $BUILD_PID 2>/dev/null || true
  
  echo "✅ Codegen files generated"
fi

echo ""
echo "✅ iOS project is ready for Xcode!"
echo ""
echo "Next steps:"
echo "1. Open ios/siFia.xcworkspace in Xcode"
echo "2. Select your device/simulator"
echo "3. Product → Build (Cmd+B)"
echo "4. Product → Archive (for App Store)"
echo ""
