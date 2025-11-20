#!/bin/bash

# Test deep link for password reset
echo "Testing deep link: sifia://reset-password#access_token=test123&refresh_token=test456"

# For iOS Simulator
xcrun simctl openurl booted "sifia://reset-password#access_token=test123&refresh_token=test456"

# For Android Emulator (uncomment if testing on Android)
# adb shell am start -W -a android.intent.action.VIEW -d "sifia://reset-password#access_token=test123&refresh_token=test456" com.sifia

echo "Deep link sent! Check the app and console logs."
