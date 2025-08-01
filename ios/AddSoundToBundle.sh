#!/bin/bash

# Path to the sound file
SOUND_FILE="Sounds/bell.mp3"

# Path to the Xcode project
PROJECT_PATH="siFia.xcodeproj/project.pbxproj"

# Check if the sound file is already in the resources build phase
if ! grep -q "$SOUND_FILE" "$PROJECT_PATH"; then
    # Add the sound file to the resources build phase
    /usr/libexec/PlistBuddy -c "Add :objects:ABC123:files:0 string \"$SOUND_FILE\"" "$PROJECT_PATH" 2>/dev/null || echo "Failed to add sound file to resources"
    echo "Sound file added to resources build phase"
else
    echo "Sound file already in resources build phase"
fi
