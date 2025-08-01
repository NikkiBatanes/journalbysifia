#!/bin/bash

# Path to the sound file
SOUND_FILE="../ios/siFia/Sounds/bell.mp3"

# Path to the Xcode project
PROJECT_PATH="../ios/siFia.xcodeproj"

# Add the sound file to the Xcode project
/usr/bin/xcrun xcproj --project "$PROJECT_PATH" --add-file "$SOUND_FILE" --target siFia --group siFia

echo "Sound file added to Xcode project"
