#!/bin/bash

# Enterprise Resilience Redeployment Script
# Rebuilds app with enterprise resilience for playbook & devotional generation

echo "🚀 Starting Enterprise Resilience Redeployment..."
echo ""

# Step 1: Stop any running Metro bundler
echo "📦 Step 1: Stopping any running Metro bundler..."
lsof -ti:8081 | xargs kill -9 2>/dev/null || echo "No Metro bundler running"
sleep 2

# Step 2: Clear watchman (if installed)
echo "🔍 Step 2: Clearing watchman cache..."
if command -v watchman &> /dev/null; then
    watchman watch-del-all
    echo "✅ Watchman cache cleared"
else
    echo "ℹ️  Watchman not installed, skipping"
fi

# Step 3: Clean Metro bundler cache
echo "🧹 Step 3: Cleaning Metro bundler cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null || echo "No Metro cache to clear"
rm -rf $TMPDIR/react-* 2>/dev/null || echo "No React cache to clear"

# Step 4: Clean npm cache (optional, commented out for speed)
# echo "🗑️  Step 4: Cleaning npm cache..."
# npm cache clean --force

# Step 5: Clean build artifacts
echo "🗂️  Step 4: Cleaning build artifacts..."
rm -rf ios/build 2>/dev/null || echo "No iOS build to clear"
rm -rf android/app/build 2>/dev/null || echo "No Android build to clear"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Enterprise Resilience Changes:"
echo "  ✅ Playbook generation - Enterprise resilience integrated"
echo "  ✅ Devotional generation - Enterprise resilience integrated"
echo "  ✅ Circuit breaker - Production optimized (20 failures, 15s recovery)"
echo "  ✅ Rate limiting - Tier-based (2-20 req/min)"
echo "  ✅ Priority queuing - 50 concurrent, 200 queue size"
echo "  ✅ Health monitoring - Real-time dashboard"
echo "  ✅ User-friendly errors - No more technical messages"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "  1. Start Metro bundler with cache reset:"
echo "     npx react-native start --reset-cache"
echo ""
echo "  2. In a NEW terminal, build and run:"
echo "     iOS:     npx react-native run-ios"
echo "     Android: npx react-native run-android"
echo ""
echo "  3. Test both:"
echo "     - Playbook generation"
echo "     - Devotional generation (1, 3, 5, 7 days)"
echo ""
echo "  4. Verify friendly error messages (if failures occur)"
echo ""
echo "  5. Check health monitoring (dev mode):"
echo "     import { logSystemHealth } from './src/utils/healthMonitoring';"
echo "     logSystemHealth();"
echo ""
echo "📚 Documentation:"
echo "  - Full guide: docs/ENTERPRISE_RESILIENCE.md"
echo "  - Quick start: QUICK_START_MONITORING.md"
echo "  - Deployment: DEPLOYMENT_SUMMARY.md"
echo ""
echo "✨ Ready to start Metro bundler!"
echo ""
