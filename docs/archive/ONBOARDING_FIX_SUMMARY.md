# Onboarding Fixes - Testing Guide

## Issues Fixed

### 1. Intro Modal Flash After Tutorial
**Problem**: Modal briefly reappears after completing/skipping tutorial
**Fix**: 
- Removed redundant `setShowIntroModal(false)` call in mount effect
- Modal visibility now controlled by `visible={showIntroModal && !showTutorial}`
- Added logging to track state changes

**Test**:
1. Navigate to Playbook Ready screen
2. Click "Explore My First Playbook"
3. Complete tutorial (Next → Done) OR skip tutorial
4. Watch for modal flash - should NOT appear

**Console logs to check**:
```
"Component mounted/re-rendered"
"closeTutorial called - hiding tutorial and modal"
```

---

### 2. iPad Carousel Not Centering in Landscape
**Problem**: Carousel stays at top of screen when rotating to landscape
**Fix**:
- Made `screenHeight` reactive to device rotation using `Dimensions.addEventListener`
- Carousel wrapper uses `height: availableHeight` (not `minHeight`)
- Added comprehensive logging for debugging

**Test**:
1. Open Playbook Ready screen in portrait
2. Rotate to landscape
3. Carousel should center vertically between header and footer

**Console logs to check**:
```
"Screen dimensions changed" { newHeight: 834, newWidth: 1194, oldHeight: 1194 }
"Available height calculated" { screenHeight: 834, headerH: 120, footerH: 150, availableHeight: 564 }
```

---

### 3. Trial Offer X Button Not Working
**Problem**: Tapping X on Trial Offer screen does nothing
**Fix**:
- Set `isClosing = true` immediately to prevent double-tap
- Wrapped navigation calls in `setTimeout(..., 50)` to avoid blocking
- Added comprehensive logging to trace execution
- Verified `onboardingFlow` flag is passed correctly

**Test**:
1. From Playbook Ready → Continue My Journey → Sales Offer
2. Tap X on Sales Offer → Trial Offer appears
3. Tap X on Trial Offer
4. Should navigate to Notification Setup screen

**Console logs to check**:
```
"handleClose executing" { routeParams: { onboardingFlow: true, ... } }
"Onboarding flow - navigating to notification setup"
```

---

## How to Test

1. **Kill the app completely** (swipe up from app switcher)
2. **Reload Metro** (press `r` in terminal or shake device → Reload)
3. **Clear cache if needed**: In Metro terminal, press `Shift + R` for full reload
4. **Test each scenario** above
5. **Check console logs** in Metro terminal for the expected messages

---

## If Issues Persist

Share the console output showing:
1. All log messages from `OnboardingPlaybookReadyScreenNew`
2. All log messages from `OnboardingTrialOfferScreen`
3. Any error messages

This will help identify exactly where the flow is breaking.
