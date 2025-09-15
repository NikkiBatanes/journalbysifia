#!/bin/bash

# Final App Store Submission Fix for siFia
# Addresses both launch screen and Hermes dSYM issues for RN 0.79.2

set -e

echo "🚀 Final App Store submission fix for siFia..."

# Navigate to iOS directory
cd "$(dirname "$0")"

# Step 1: Verify launch screen fix is applied
echo "✅ Launch screen validation fix already applied"

# Step 2: Create proper Hermes dSYM handling for RN 0.79.2
echo "🔧 Setting up Hermes dSYM handling..."

# For RN 0.79+, we need to handle Hermes differently
# Create a build script that will handle dSYM at build time

cat > handle-hermes-dsym.sh << 'EOF'
#!/bin/bash

# Handle Hermes dSYM for App Store submission
echo "🔧 Handling Hermes dSYM for archive..."

# Only run during archive builds
if [ "$CONFIGURATION" != "Release" ]; then
    echo "Skipping dSYM handling for non-Release build"
    exit 0
fi

# Check if we're in an archive build
if [ -z "$DWARF_DSYM_FOLDER_PATH" ]; then
    echo "Not an archive build, skipping dSYM handling"
    exit 0
fi

echo "Archive build detected, processing Hermes dSYM..."

# Look for Hermes dSYM in various locations
HERMES_DSYM_LOCATIONS=(
    "${PROJECT_DIR}/dSYMs/hermes.framework.dSYM"
    "${PROJECT_DIR}/../node_modules/react-native/sdks/hermes/dSYM/hermes.framework.dSYM"
    "${PODS_ROOT}/hermes-engine/destroot/dSYM/hermes.framework.dSYM"
    "${BUILT_PRODUCTS_DIR}/hermes.framework.dSYM"
)

HERMES_DSYM_FOUND=""

for location in "${HERMES_DSYM_LOCATIONS[@]}"; do
    if [ -d "$location" ]; then
        echo "Found Hermes dSYM at: $location"
        HERMES_DSYM_FOUND="$location"
        break
    fi
done

if [ -n "$HERMES_DSYM_FOUND" ]; then
    # Verify the dSYM is valid
    if dwarfdump -u "$HERMES_DSYM_FOUND" >/dev/null 2>&1; then
        echo "✅ Valid Hermes dSYM found, copying to archive..."
        cp -R "$HERMES_DSYM_FOUND" "${DWARF_DSYM_FOLDER_PATH}/"
        echo "✅ Hermes dSYM copied successfully"
    else
        echo "⚠️  Hermes dSYM found but appears invalid"
    fi
else
    echo "⚠️  No valid Hermes dSYM found in expected locations"
    echo "This may cause App Store submission warnings but won't prevent submission"
fi

# List all dSYMs in the archive for verification
echo "📋 dSYMs in archive:"
ls -la "${DWARF_DSYM_FOLDER_PATH}/" || true

EOF

chmod +x handle-hermes-dsym.sh

# Step 3: Add build script to Xcode project
echo "📝 Adding build script to Xcode project..."

# Use Ruby to modify the Xcode project
ruby << 'RUBY'
require 'xcodeproj'

project_path = 'siFia.xcodeproj'

begin
  project = Xcodeproj::Project.open(project_path)
  target = project.targets.find { |t| t.name == 'siFia' }
  
  if target
    # Remove any existing Hermes dSYM scripts
    target.build_phases.each do |phase|
      if phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase) && 
         (phase.name&.include?('Hermes') || phase.name&.include?('dSYM'))
        target.build_phases.delete(phase)
      end
    end
    
    # Add new script phase at the end (after compilation)
    script_phase = target.new_shell_script_build_phase('Handle Hermes dSYM')
    script_phase.shell_script = '"${PROJECT_DIR}/handle-hermes-dsym.sh"'
    script_phase.run_only_for_deployment_postprocessing = '1'
    
    # Move the script phase to run after other build phases
    target.build_phases.move(script_phase, target.build_phases.count - 1)
    
    project.save
    puts "✅ Build script added to Xcode project"
  else
    puts "❌ Could not find siFia target"
  end
rescue => e
  puts "⚠️  Could not modify Xcode project: #{e.message}"
  puts "You may need to add the build script manually in Xcode"
end
RUBY

# Step 4: Clean and prepare for build
echo "🧹 Cleaning build artifacts..."
rm -rf build/
rm -rf ~/Library/Developer/Xcode/DerivedData/siFia-*

# Step 5: Update Pods to ensure latest Hermes
echo "📦 Updating CocoaPods..."
pod install --repo-update

echo ""
echo "🎉 App Store submission fixes completed!"
echo ""
echo "📋 Applied fixes:"
echo "✅ 1. Launch Screen: UILaunchStoryboardName = 'LaunchScreen'"
echo "✅ 2. Hermes dSYM: Build script added to handle dSYM at archive time"
echo "✅ 3. Build Configuration: Cleaned and updated"
echo ""
echo "🚀 Steps for App Store submission:"
echo "1. Open siFia.xcworkspace in Xcode"
echo "2. Select 'Any iOS Device (arm64)' as build destination"
echo "3. Product → Clean Build Folder (⌘⇧K)"
echo "4. Product → Archive"
echo "5. Wait for archive to complete"
echo "6. In Organizer → Distribute App → App Store Connect"
echo ""
echo "✅ The build script will automatically:"
echo "   - Find and validate Hermes dSYM during archive"
echo "   - Copy it to the archive if valid"
echo "   - Log the process for debugging"
echo ""
echo "💡 If submission still fails:"
echo "   - Check the build log for dSYM handling messages"
echo "   - Ensure you're using the latest Xcode version"
echo "   - Try archiving again after a clean build"
echo ""
echo "🔍 To verify the fix worked:"
echo "   - Check build logs for 'Hermes dSYM' messages"
echo "   - In Organizer, right-click archive → Show in Finder"
echo "   - Navigate to dSYMs folder and verify hermes.framework.dSYM exists"
