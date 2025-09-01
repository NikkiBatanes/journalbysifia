#!/bin/bash
# Copy Hermes dSYM to archive

if [ -d "${PROJECT_DIR}/dSYMs/hermes.framework.dSYM" ]; then
    echo "Copying Hermes dSYM to archive..."
    cp -R "${PROJECT_DIR}/dSYMs/hermes.framework.dSYM" "${DWARF_DSYM_FOLDER_PATH}/"
    echo "✅ Hermes dSYM copied to archive"
else
    echo "⚠️  Hermes dSYM not found at ${PROJECT_DIR}/dSYMs/hermes.framework.dSYM"
fi
