#!/usr/bin/env ruby

require 'xcodeproj'

# Path to the Xcode project
project_path = 'siFia.xcodeproj'

# Open the Xcode project
project = Xcodeproj::Project.open(project_path)

# Find the main target
main_target = project.targets.find { |target| target.name == 'siFia' }

# Add the sound file to the resources build phase
sound_file = project.new_file('Sounds/bell.mp3')

# Add the file to the target's resources build phase
main_target.add_file_references([sound_file])

# Save the project
project.save

puts "Sound file added to Xcode project resources"
