#!/usr/bin/env ruby

# Script to add Hermes dSYM copy script to Xcode project
# This ensures the dSYM is included in every archive

require 'xcodeproj'

project_path = 'siFia.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Find the main target
target = project.targets.find { |t| t.name == 'siFia' }

if target.nil?
  puts "❌ Could not find siFia target"
  exit 1
end

# Check if script already exists
existing_script = target.build_phases.find do |phase|
  phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase) &&
  phase.name == 'Copy Hermes dSYM'
end

if existing_script
  puts "✅ Hermes dSYM script already exists"
else
  # Add new script build phase
  script_phase = target.new_shell_script_build_phase('Copy Hermes dSYM')
  script_phase.shell_script = <<~SCRIPT
    # Copy Hermes dSYM to archive for App Store submission
    if [ -d "${PROJECT_DIR}/dSYMs/hermes.framework.dSYM" ]; then
        echo "📦 Copying Hermes dSYM to archive..."
        mkdir -p "${DWARF_DSYM_FOLDER_PATH}"
        cp -R "${PROJECT_DIR}/dSYMs/hermes.framework.dSYM" "${DWARF_DSYM_FOLDER_PATH}/"
        echo "✅ Hermes dSYM copied successfully"
        
        # Verify the copy
        if [ -d "${DWARF_DSYM_FOLDER_PATH}/hermes.framework.dSYM" ]; then
            echo "✅ Hermes dSYM verified in archive"
        else
            echo "❌ Hermes dSYM copy failed"
            exit 1
        fi
    else
        echo "⚠️  Hermes dSYM not found at ${PROJECT_DIR}/dSYMs/hermes.framework.dSYM"
        echo "💡 Run ./fix-hermes-dsym-complete.sh to download it"
    fi
  SCRIPT
  
  # Move the script to run after compile sources but before other scripts
  target.build_phases.move(script_phase, 2)
  
  puts "✅ Added Hermes dSYM copy script to Xcode project"
end

# Save the project
project.save

puts "✅ Xcode project updated successfully"
puts ""
puts "📋 The build script will now automatically:"
puts "   • Copy Hermes dSYM to every archive"
puts "   • Verify the copy was successful"
puts "   • Show helpful error messages if dSYM is missing"
