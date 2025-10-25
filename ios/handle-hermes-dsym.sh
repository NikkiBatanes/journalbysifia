#!/bin/bash

# This script handles Hermes dSYM files for crash reporting
# It's called during the Xcode build process

set -e

HERMES_FRAMEWORK_PATH="${PODS_ROOT}/hermes-engine/destroot/Library/Frameworks/universal/hermes.framework"

if [ ! -d "$HERMES_FRAMEWORK_PATH" ]; then
  echo "warning: Hermes framework not found at $HERMES_FRAMEWORK_PATH"
  exit 0
fi

HERMES_DSYM_PATH="${HERMES_FRAMEWORK_PATH}.dSYM"

if [ ! -d "$HERMES_DSYM_PATH" ]; then
  echo "warning: Hermes dSYM not found at $HERMES_DSYM_PATH"
  exit 0
fi

DWARF_DSYM_FOLDER_PATH="${DWARF_DSYM_FOLDER_PATH:-${CONFIGURATION_BUILD_DIR}}"

echo "Copying Hermes dSYM to ${DWARF_DSYM_FOLDER_PATH}"
cp -R "$HERMES_DSYM_PATH" "$DWARF_DSYM_FOLDER_PATH"

echo "Hermes dSYM copied successfully"
