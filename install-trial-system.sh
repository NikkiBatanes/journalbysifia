#!/bin/bash

# =====================================================
# SIFIA TRIAL SYSTEM INSTALLATION SCRIPT
# =====================================================

echo "🚀 Installing siFia Trial System Dependencies..."

# Check if we're in a React Native project
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from your React Native project root."
    exit 1
fi

# Install required dependencies
echo "📦 Installing dependencies..."

# Check if using npm or yarn
if [ -f "yarn.lock" ]; then
    echo "Using Yarn..."
    yarn add @tanstack/react-query react-native-config
    yarn add --dev @types/react-native-config
else
    echo "Using npm..."
    npm install @tanstack/react-query react-native-config
    npm install --save-dev @types/react-native-config
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📄 Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
    echo "⚠️  Please update your .env file with your actual Supabase credentials"
else
    echo "✅ .env file already exists"
fi

# iOS specific setup for react-native-config
echo "🍎 Setting up iOS configuration..."
echo "⚠️  For iOS, you'll need to:"
echo "   1. Run 'cd ios && pod install'"
echo "   2. Add your .env variables to your iOS build configuration"
echo "   3. See react-native-config documentation for details"

# Android specific setup
echo "🤖 Android configuration should work automatically with react-native-config"

echo ""
echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env file with real Supabase credentials"
echo "2. Run the Supabase migration script in your SQL editor"
echo "3. Follow the QUICK_TRIAL_SETUP.md guide"
echo "4. For iOS: cd ios && pod install"
echo ""
echo "🎉 Your trial system is ready to integrate!"
