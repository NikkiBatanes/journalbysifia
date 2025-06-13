#!/bin/bash

# This script helps set up your environment variables

echo "Setting up Anchored App environment..."

# Check if .env exists
if [ ! -f ".env" ]; then
  echo "Creating .env file..."
  cat > .env <<EOL
# Supabase Configuration
SUPABASE_URL=https://aesmrjinczhknchlrsmt.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlc21yamluY3poa25jaGxyc210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NjYxOTMsImV4cCI6MjA2NDM0MjE5M30.x7XMjrm9WWlvEdc5eaK7Z5Fy-V_85qMJQ7pInsrKIyM
EOL
  echo "Created .env file with default values"
else
  echo ".env file already exists"
fi

# Make the script executable
chmod +x setup-env.sh

echo "Environment setup complete!"
echo "Please restart your development server for the changes to take effect."
