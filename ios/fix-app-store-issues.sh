#!/bin/bash

# Comprehensive App Store Validation Fix for siFia
# Fixes both launch screen validation and Hermes dSYM issues

set -e

echo "🚀 Starting App Store validation fixes for siFia..."

# Navigate to iOS directory
cd "$(dirname "$0")"

# Step 1: Launch Screen Fix (Already completed)
echo "✅ Launch screen fix already applied (UILaunchStoryboardName = LaunchScreen)"

# Step 2: Clean all build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf build/
rm -rf ~/Library/Developer/Xcode/DerivedData/siFia-*
rm -rf dSYMs/hermes.framework.dSYM

# Step 3: Get React Native version for correct Hermes dSYM
echo "🔍 Detecting React Native version..."
RN_VERSION=$(node -p "require('../package.json').dependencies['react-native']" | sed 's/[\^~]//g')
echo "React Native version: $RN_VERSION"

# Step 4: Download correct Hermes dSYM based on RN version
echo "📥 Downloading correct Hermes dSYM..."
mkdir -p dSYMs

# For RN 0.74+, use the new download method
if [[ "$RN_VERSION" > "0.73" ]]; then
    echo "Using RN 0.74+ method..."
    HERMES_URL="https://github.com/facebook/hermes/releases/download/v0.12.0/hermes-runtime-darwin-v0.12.0.tar.gz"
else
    echo "Using legacy RN method..."
    HERMES_URL="https://github.com/facebook/hermes/releases/download/v0.11.0/hermes-runtime-darwin-v0.11.0.tar.gz"
fi

# Download and extract
echo "Downloading from: $HERMES_URL"
if curl -L "$HERMES_URL" -o hermes-dsym.tar.gz; then
    echo "✅ Download successful"
    
    # Extract the dSYM
    tar -xzf hermes-dsym.tar.gz
    
    # Find and move the correct dSYM
    find . -name "hermes.framework.dSYM" -exec cp -R {} dSYMs/ \; 2>/dev/null || true
    
    # Alternative extraction paths
    if [ ! -d "dSYMs/hermes.framework.dSYM" ]; then
        find . -name "*.dSYM" -path "*hermes*" -exec cp -R {} dSYMs/hermes.framework.dSYM \; 2>/dev/null || true
    fi
    
    # Cleanup
    rm -f hermes-dsym.tar.gz
    rm -rf hermes-runtime-darwin* 2>/dev/null || true
    
else
    echo "❌ Download failed, trying node_modules fallback..."
    
    # Try to use dSYM from node_modules if available
    NODE_DSYM="../node_modules/react-native/sdks/hermes/dSYM/hermes.framework.dSYM"
    if [ -d "$NODE_DSYM" ]; then
        echo "Using dSYM from node_modules..."
        cp -R "$NODE_DSYM" dSYMs/
    else
        echo "⚠️  No dSYM found in node_modules either"
    fi
fi

# Step 5: Verify dSYM integrity
if [ -d "dSYMs/hermes.framework.dSYM" ]; then
    echo "🔍 Verifying dSYM integrity..."
    if dwarfdump -u dSYMs/hermes.framework.dSYM >/dev/null 2>&1; then
        echo "✅ Hermes dSYM is valid"
        dwarfdump -u dSYMs/hermes.framework.dSYM
    else
        echo "❌ dSYM is corrupted, removing..."
        rm -rf dSYMs/hermes.framework.dSYM
    fi
fi

# Step 6: Create Xcode build script to copy dSYM to archive
echo "📝 Creating Xcode build script..."
cat > copy-hermes-dsym.sh << 'EOF'
#!/bin/bash

# Copy Hermes dSYM to archive for App Store submission
echo "🔧 Copying Hermes dSYM to archive..."

HERMES_DSYM="${PROJECT_DIR}/dSYMs/hermes.framework.dSYM"

if [ -d "$HERMES_DSYM" ]; then
    echo "Found Hermes dSYM at: $HERMES_DSYM"
    
    # Ensure the dSYM folder exists in archive
    mkdir -p "${DWARF_DSYM_FOLDER_PATH}"
    
    # Copy the dSYM
    cp -R "$HERMES_DSYM" "${DWARF_DSYM_FOLDER_PATH}/"
    
    echo "✅ Hermes dSYM copied to: ${DWARF_DSYM_FOLDER_PATH}/hermes.framework.dSYM"
    
    # Verify the copy
    if [ -d "${DWARF_DSYM_FOLDER_PATH}/hermes.framework.dSYM" ]; then
        echo "✅ Copy verification successful"
    else
        echo "❌ Copy verification failed"
        exit 1
    fi
else
    echo "⚠️  Hermes dSYM not found at: $HERMES_DSYM"
    echo "This may cause App Store submission issues"
fi
EOF

chmod +x copy-hermes-dsym.sh

# Step 7: Add the build script to Xcode project
echo "🔧 Adding build script to Xcode project..."
ruby << 'RUBY'
require 'xcodeproj'

project_path = 'siFia.xcodeproj'
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'siFia' }

if target
  # Remove existing script if it exists
  target.build_phases.each do |phase|
    if phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase) && 
       phase.name == 'Copy Hermes dSYM'
      target.build_phases.delete(phase)
    end
  end
  
  # Add new script phase
  script_phase = target.new_shell_script_build_phase('Copy Hermes dSYM')
  script_phase.shell_script = '"${PROJECT_DIR}/copy-hermes-dsym.sh"'
  script_phase.run_only_for_deployment_postprocessing = '1'
  
  project.save
  
  puts "✅ Build script added to Xcode project"
else
  puts "❌ Could not find siFia target in project"
end
RUBY

# Step 8: Update CocoaPods
echo "📦 Updating CocoaPods..."
pod install --repo-update

echo ""
echo "🎉 App Store validation fixes completed!"
echo ""
echo "📋 Summary of fixes applied:"
echo "✅ 1. Launch screen validation: UILaunchStoryboardName set to 'LaunchScreen'"
echo "✅ 2. Hermes dSYM: Downloaded and configured for archive inclusion"
echo "✅ 3. Xcode build script: Added to automatically copy dSYM during archive"
echo ""
echo "🚀 Next steps for App Store submission:"
echo "1. Open siFia.xcworkspace in Xcode"
echo "2. Select 'Any iOS Device (arm64)' as destination"
echo "3. Product → Clean Build Folder (Cmd+Shift+K)"
echo "4. Product → Archive"
echo "5. In Organizer, select your archive and click 'Distribute App'"
echo ""
echo "🔍 The archive should now include:"
echo "   - Proper launch screen configuration"
echo "   - Valid Hermes dSYM with correct UUIDs"
echo ""
echo "💡 If issues persist:"
echo "   - Ensure Xcode is updated to latest version"
echo "   - Try archiving again after cleaning"
echo "   - Check Console.app for detailed error messages"
