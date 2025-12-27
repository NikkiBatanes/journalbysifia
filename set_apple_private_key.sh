#!/bin/bash
# Set Apple Private Key from .p8 file
# Usage: ./set_apple_private_key.sh /path/to/AuthKey_UNR2UMA26W.p8

if [ -z "$1" ]; then
  echo "Usage: ./set_apple_private_key.sh /path/to/AuthKey_UNR2UMA26W.p8"
  exit 1
fi

if [ ! -f "$1" ]; then
  echo "Error: File not found: $1"
  exit 1
fi

# Read the .p8 file content
PRIVATE_KEY=$(cat "$1")

# Set as Supabase secret
cd /Users/nikkimaebatanes/CascadeProjects/siFia
supabase secrets set APPLE_PRIVATE_KEY="$PRIVATE_KEY"

echo "✅ Apple private key set successfully"
