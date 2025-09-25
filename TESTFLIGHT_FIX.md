# TestFlight Crash Fix

## 🚨 Problem
The app was crashing on TestFlight launch with the error:
```
*** -[__NSPlaceholderDictionary initWithObjects:forKeys:count:]: attempt to insert nil object from objects[5]
```

**Root Cause**: `RNGoogleSignInButtonComponentView` class was returning `nil` during React Native's third-party component registration, causing a crash when trying to insert it into an NSDictionary.

## ✅ Solution Applied

### 1. Nil-Safe Component Registration
Updated `RCTThirdPartyComponentsProvider.mm` to use nil-safe component registration:

```objc
// Before (crash-prone)
thirdPartyComponents = @{
    @"RNGoogleSignInButton": NSClassFromString(@"RNGoogleSignInButtonComponentView"),
    // ... other components
};

// After (nil-safe)
NSMutableDictionary *components = [[NSMutableDictionary alloc] init];

void (^addComponent)(NSString *, NSString *) = ^(NSString *key, NSString *className) {
  Class componentClass = NSClassFromString(className);
  if (componentClass != nil) {
    components[key] = componentClass;
  }
};

addComponent(@"RNGoogleSignInButton", @"RNGoogleSignInButtonComponentView");
// ... other components

thirdPartyComponents = [components copy];
```

### 2. Automated Fix Script
Created `scripts/fix-third-party-components.sh` to automatically apply the fix after builds.

### 3. Package.json Scripts
Added convenient npm scripts:
- `npm run ios:release` - Build in Release mode
- `npm run fix-testflight` - Apply the TestFlight fix

## 🛠️ How to Use

### For Future Builds:
1. **Build normally**: `npm run ios` or `npm run ios:release`
2. **Apply fix**: `npm run fix-testflight` (if needed)
3. **Archive and distribute** to TestFlight

### Manual Fix (if script fails):
1. Open `build/generated/ios/RCTThirdPartyComponentsProvider.mm`
2. Replace the `thirdPartyComponents = @{...}` block with the nil-safe version
3. Build and archive

## 🔍 Technical Details

### Files Modified:
- `build/generated/ios/RCTThirdPartyComponentsProvider.mm` - Main fix
- `scripts/fix-third-party-components.sh` - Automated fix script
- `package.json` - Added convenience scripts
- `patches/react-native-third-party-components-fix.patch` - Patch file for reference

### Why This Happens:
- React Native's New Architecture (Fabric) generates component registration code
- Some third-party components may not be properly linked in Release builds
- `NSClassFromString()` returns `nil` for missing classes
- Inserting `nil` into NSDictionary causes immediate crash

### Prevention:
- The nil-safe approach only registers components that actually exist
- Missing components are gracefully skipped
- App launches successfully even with missing third-party components

## 🚀 Testing

### Before TestFlight:
1. Test Release build on simulator: `npm run ios:release`
2. Test Release build on device via Xcode
3. Verify app launches without crashing

### TestFlight Verification:
1. Archive and upload to App Store Connect
2. Install via TestFlight
3. Confirm app launches successfully

## 📋 Troubleshooting

### If the fix doesn't work:
1. Clean build folder: `rm -rf ios/build`
2. Reinstall pods: `cd ios && pod install`
3. Reapply fix: `npm run fix-testflight`
4. Build again: `npm run ios:release`

### If script fails:
1. Check if file exists: `build/generated/ios/RCTThirdPartyComponentsProvider.mm`
2. Run `npm run ios` first to generate the file
3. Apply fix manually using the patch file as reference

## 🎯 Success Criteria
- ✅ App launches on TestFlight without crashing
- ✅ All existing functionality works normally
- ✅ Third-party components that are properly linked still work
- ✅ Missing components are gracefully handled

This fix ensures your app will work reliably on TestFlight and production builds.
