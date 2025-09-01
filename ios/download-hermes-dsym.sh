#!/bin/bash

# Download Hermes dSYM for the specific version
HERMES_VERSION=$(node -p "require('../node_modules/react-native/package.json').dependencies.hermes")
HERMES_TAG="v$(echo $HERMES_VERSION | sed 's/[\^~]//g')"

echo "Downloading Hermes dSYM for version: $HERMES_TAG"

# Create dSYMs directory if it doesn't exist
mkdir -p dSYMs

# Download Hermes dSYM
curl -L "https://github.com/facebook/hermes/releases/download/$HERMES_TAG/hermes-runtime-darwin-v$HERMES_TAG.tar.gz" -o hermes-dsym.tar.gz

# Extract dSYM
tar -xzf hermes-dsym.tar.gz
mv hermes-runtime-darwin/dSYM/hermes.framework.dSYM dSYMs/
rm -rf hermes-runtime-darwin hermes-dsym.tar.gz

echo "✅ Hermes dSYM downloaded to dSYMs/hermes.framework.dSYM"
