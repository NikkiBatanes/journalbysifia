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

# First, ensure we have the correct Hermes dSYM
HERMES_DSYM_PATH="${PROJECT_DIR}/dSYMs/hermes.framework.dSYM"
EXPECTED_UUID="6AE8A75C-5B8A-3C9B-AD6E-1D13D34ED04E"

# Create the dSYM if it doesn't exist or has wrong UUID
if [ ! -d "$HERMES_DSYM_PATH" ]; then
    echo "Creating Hermes dSYM with correct UUID..."
    cd "${PROJECT_DIR}"
    ./create-hermes-dsym.sh
fi

# Verify UUID matches what App Store expects
if [ -d "$HERMES_DSYM_PATH" ]; then
    ACTUAL_UUID=$(dwarfdump -u "$HERMES_DSYM_PATH" 2>/dev/null | grep "UUID:" | awk '{print $2}' | head -1)
    
    if [ "$ACTUAL_UUID" = "$EXPECTED_UUID" ]; then
        echo "✅ Hermes dSYM has correct UUID: $ACTUAL_UUID"
        echo "Copying to archive..."
        cp -R "$HERMES_DSYM_PATH" "${DWARF_DSYM_FOLDER_PATH}/"
        echo "✅ Hermes dSYM copied successfully"
        
        # Verify the copy
        COPIED_UUID=$(dwarfdump -u "${DWARF_DSYM_FOLDER_PATH}/hermes.framework.dSYM" 2>/dev/null | grep "UUID:" | awk '{print $2}' | head -1)
        if [ "$COPIED_UUID" = "$EXPECTED_UUID" ]; then
            echo "✅ Archive verification successful - UUID: $COPIED_UUID"
        else
            echo "❌ Archive verification failed - UUID mismatch"
        fi
    else
        echo "❌ UUID mismatch. Expected: $EXPECTED_UUID, Found: $ACTUAL_UUID"
        echo "Recreating dSYM with correct UUID..."
        cd "${PROJECT_DIR}"
        ./create-hermes-dsym.sh
        cp -R "$HERMES_DSYM_PATH" "${DWARF_DSYM_FOLDER_PATH}/"
    fi
else
    echo "❌ Could not create or find Hermes dSYM"
    exit 1
fi

# List all dSYMs in the archive for verification
echo "📋 dSYMs in archive:"
ls -la "${DWARF_DSYM_FOLDER_PATH}/" || true

