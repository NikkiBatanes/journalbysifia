# Reset Password Deep Link - Testing Guide

## Issues Fixed

### 1. **Token Extraction from Hash Fragment**
**Problem**: The URL parser wasn't reliably extracting `access_token` and `refresh_token` from the hash fragment in custom URL schemes (`sifia://reset-password#access_token=xxx&refresh_token=yyy`).

**Fix**: Implemented regex-based extraction as the primary method, with URL API as fallback.

**File**: `src/utils/deepLinkHandler.ts`

### 2. **Missing Session Establishment**
**Problem**: The `updatePassword` function received tokens but never established a Supabase session before attempting to update the password.

**Fix**: Added `supabase.auth.setSession()` call with both access and refresh tokens before calling `updateUser()`.

**Files**: 
- `src/context/IndustryStandardAuthContext.tsx` (updatePassword function)
- `src/screens/ResetPasswordScreen.tsx` (passing both tokens)

### 3. **React Navigation Linking Conflict**
**Problem**: Two competing deep link handlers (React Navigation's automatic linking and manual handler) created race conditions.

**Fix**: Removed `GlobalResetPassword` from React Navigation linking config, letting manual handler extract tokens properly.

**File**: `App.tsx`

### 4. **Navigation Timing Issues**
**Problem**: Fixed 500ms delay was insufficient for cold app starts.

**Fix**: Implemented retry mechanism with 50 attempts (5 seconds max) and immediate start.

**File**: `App.tsx`

### 5. **Missing Token Validation**
**Problem**: Code only checked for `access_token`, not `refresh_token`.

**Fix**: Added validation for both tokens before navigation and password update.

**Files**: `App.tsx`, `src/screens/ResetPasswordScreen.tsx`

## Testing Steps

### Test 1: Reset Password Email Flow (Cold Start)

1. **Close the app completely** (swipe up from app switcher)
2. Open Supabase dashboard → Authentication → Users
3. Find your test user and click "Send password reset email"
4. Check your email for the reset link
5. **Tap the reset link in the email**
6. App should open and navigate to reset password screen
7. **Check console logs** for:
   ```
   [DeepLink] 🔗 Parsing URL: sifia://reset-password#access_token=...
   [DeepLink] Hash fragment found: access_token=...
   [DeepLink] ✅ Has access_token: true
   [DeepLink] ✅ Has refresh_token: true
   [App] ✅ Parsed deep link: { type: 'reset-password', hasToken: true }
   [App] 🚀 Navigating to ResetPassword screen with tokens...
   [App] ✅ Navigation command sent to GlobalResetPassword with tokens
   [ResetPassword] Screen mounted with tokens: { hasAccessToken: true, hasRefreshToken: true }
   ```

### Test 2: Reset Password Email Flow (App Running)

1. **Keep the app open** on any screen
2. Send password reset email (same as Test 1)
3. Tap the reset link in the email
4. App should come to foreground and navigate to reset password screen
5. Verify same console logs as Test 1

### Test 3: Password Update with Valid Tokens

1. Follow Test 1 or Test 2 to reach reset password screen
2. Enter a new password that meets requirements:
   - At least 8 characters
   - One lowercase letter
   - One uppercase letter
   - One number
   - One special character (@$!%*?&#)
3. Confirm the password
4. Tap "Reset Password"
5. **Check console logs** for:
   ```
   [ResetPassword] Attempting to update password with tokens
   [AuthContext] Establishing session with recovery tokens
   [AuthContext] Session established successfully
   [AuthContext] Password updated successfully
   [ResetPassword] Password updated successfully
   ```
6. Should see success alert: "Password Reset Successful"
7. Tap "Continue to Login"
8. Should navigate to login screen
9. **Test login** with new password

### Test 4: Invalid/Expired Token Handling

1. Use an old reset password link (>1 hour old)
2. Tap the link
3. App should open to reset password screen
4. Try to reset password
5. Should see error: "Failed to reset password" or "Invalid session"

### Test 5: Missing Tokens

1. Manually test with malformed URL (if possible via deep link tester)
2. URL without tokens should show alert: "Invalid Reset Link"
3. Should navigate back to login screen

## Supabase Configuration Check

### Email Template Configuration

1. Go to Supabase Dashboard → Authentication → Email Templates
2. Find "Reset Password" template
3. Verify the confirmation URL uses: `{{ .ConfirmationURL }}`
4. The URL should be configured in: Authentication → URL Configuration
5. **Site URL** should be: `sifia://`
6. **Redirect URLs** should include: `sifia://reset-password`

### Expected Email Link Format

The reset password email should contain a link like:
```
sifia://reset-password#access_token=eyJhbGc...&refresh_token=v2_abc...&type=recovery
```

**Important**: Tokens are in the **hash fragment** (after `#`), not query parameters (after `?`).

## Console Log Checklist

When testing, you should see these logs in order:

### On Deep Link Received:
- ✅ `[DeepLink] 🔗 Parsing URL:`
- ✅ `[DeepLink] Hash fragment found:`
- ✅ `[DeepLink] Hash param: access_token`
- ✅ `[DeepLink] Hash param: refresh_token`
- ✅ `[DeepLink] ✅ Has access_token: true`
- ✅ `[DeepLink] ✅ Has refresh_token: true`
- ✅ `[App] ✅ Parsed deep link:`
- ✅ `[App] 🚀 Navigating to ResetPassword screen with tokens...`
- ✅ `[App] 📍 Navigation ready, navigating now...`
- ✅ `[App] ✅ Navigation command sent to GlobalResetPassword with tokens`

### On Screen Mount:
- ✅ `[ResetPassword] Screen mounted with tokens: { hasAccessToken: true, hasRefreshToken: true }`

### On Password Update:
- ✅ `[ResetPassword] Attempting to update password with tokens`
- ✅ `[AuthContext] Establishing session with recovery tokens`
- ✅ `[AuthContext] Session established successfully`
- ✅ `[AuthContext] Password updated successfully`
- ✅ `[ResetPassword] Password updated successfully`

## Troubleshooting

### Issue: "Invalid Reset Link" alert immediately
**Cause**: Tokens not extracted from URL
**Check**: 
- Console logs for `[DeepLink] Hash fragment found:`
- Supabase email template uses correct URL format
- Deep link scheme is registered in iOS/Android

### Issue: "Failed to reset password" error
**Cause**: Session not established or tokens expired
**Check**:
- Console logs for `[AuthContext] Session established successfully`
- Token expiration (tokens expire after 1 hour)
- Supabase project is accessible

### Issue: App doesn't open when tapping email link
**Cause**: Deep link scheme not registered
**Check**:
- iOS: `Info.plist` has `CFBundleURLSchemes` with `sifia`
- Android: `AndroidManifest.xml` has intent filter for `sifia://`
- Rebuild the app after checking

### Issue: Navigation doesn't happen
**Cause**: Navigation not ready or screen not registered
**Check**:
- Console logs for navigation retry attempts
- `GlobalResetPassword` screen is registered in `RootStackNavigator.tsx`
- Navigation ref is properly set

## Files Modified

1. **src/utils/deepLinkHandler.ts**
   - Enhanced token extraction with regex
   - Added fallback mechanisms
   - Better logging

2. **src/context/IndustryStandardAuthContext.tsx**
   - Added `refreshToken` parameter to `updatePassword`
   - Implemented session establishment before password update
   - Enhanced error logging

3. **src/screens/ResetPasswordScreen.tsx**
   - Added `refreshToken` extraction from route params
   - Validation for both tokens
   - Pass both tokens to `updatePassword`

4. **App.tsx**
   - Removed React Navigation linking conflict
   - Improved navigation retry mechanism
   - Enhanced token validation
   - Better error logging

## Next Steps

After testing, if issues persist:

1. **Check Supabase logs**: Dashboard → Logs → Auth logs
2. **Verify email template**: Should use `{{ .ConfirmationURL }}`
3. **Test with Metro logs**: Run `npx react-native start` and watch console
4. **Check device logs**: 
   - iOS: Xcode → Window → Devices and Simulators → View Device Logs
   - Android: `adb logcat | grep -i sifia`
