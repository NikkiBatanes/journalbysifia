# siFia Enhanced Authentication & Gamification Setup Guide

## Prerequisites

Before starting, ensure you have:
- React Native development environment set up
- Xcode (for iOS development)
- Android Studio (for Android development)
- Supabase account
- Google Cloud Console account
- Apple Developer account (for Apple Sign-In)

## Step 1: Install Dependencies

```bash
# Navigate to your project directory
cd /Users/nikkimaebatanes/CascadeProjects/siFia

# Install authentication dependencies
npm install @react-native-google-signin/google-signin @invertase/react-native-apple-authentication

# Install additional UI dependencies (if not already installed)
npm install expo-linear-gradient react-native-safe-area-context

# For iOS, install pods
cd ios && pod install && cd ..
```

## Step 2: Configure Google Sign-In with Supabase

### 2.1 Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project for siFia
3. Enable the Google Sign-In API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sign-In API"
   - Click "Enable"

### 2.2 Configure OAuth Consent Screen
1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in required information:
   - App name: "siFia"
   - User support email: your email
   - Developer contact information: your email
4. Add scopes: `email`, `profile`, `openid`
5. Add your domain to "Authorized domains" (e.g., `supabase.co`)

### 2.3 Create OAuth Web Credentials for Supabase
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application"
4. Name it "siFia Web"
5. Add these authorized redirect URIs:
   - `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
   - `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/authorize`
6. Click "Create" and save the Client ID and Client Secret

### 2.4 Configure Supabase with Google OAuth
1. Go to your Supabase project dashboard
2. Navigate to "Authentication" > "Providers"
3. Enable Google provider
4. Add the Google Client ID and Client Secret from step 2.3
5. Set the redirect URL to:
   `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
6. Save the configuration

### 2.5 Configure React Native for Google Sign-In
1. Install the required package:
```bash
expo install expo-auth-session expo-web-browser expo-crypto
```

2. Add a custom URL scheme to `app.json`:
```json
{
  "expo": {
    "scheme": "sifia",
    "ios": {
      "bundleIdentifier": "com.yourcompany.sifia"
    },
    "android": {
      "package": "com.yourcompany.sifia"
    }
  }
}
```

## Step 3: Configure Apple Sign-In with Supabase (iOS Only)

### 3.1 Apple Developer Console Setup
1. Go to [Apple Developer Console](https://developer.apple.com/account/)
2. Go to "Certificates, Identifiers & Profiles"
3. Select "Identifiers" and find your app identifier
4. Enable "Sign In with Apple" capability
5. Configure the domain:
   - Add `auth.services.<YOUR-APP-REGION>.supabase.co` to "Domains and Subdomains"
   - Add `https://<YOUR-PROJECT-REF>.supabase.co` to "Return URLs"
6. Save the configuration

### 3.2 Configure Supabase for Apple Sign-In
1. Go to your Supabase project dashboard
2. Navigate to "Authentication" > "Providers"
3. Enable Apple provider
4. Add your Apple Services ID (e.g., `com.yourcompany.sifia.services`)
5. Add your Apple Team ID (found in your Apple Developer Account)
6. Add your Key ID (from your Apple Developer Account)
7. Add your Private Key (downloaded from Apple Developer)
8. Set the redirect URL to:
   `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`

### 3.3 Xcode Configuration
1. Open your iOS project in Xcode
2. Select your target
3. Go to "Signing & Capabilities"
4. Click "+" and add "Sign In with Apple"
5. Ensure your team and bundle identifier are correct
6. Add this to your `Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
        </array>
    </dict>
</array>
```

## Step 4: Configure Supabase

### 4.1 Database Setup
1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor"
3. Run the enhanced schema:
```bash
# Copy the schema file to your clipboard
cat database/enhanced_auth_schema.sql

# Paste and execute in Supabase SQL Editor
```

### 4.2 Authentication Providers
1. Go to "Authentication" > "Providers"
2. Enable Email provider
3. Configure Google provider:
   - Enable Google provider
   - Add your Google OAuth client ID and secret
4. Configure Apple provider (if needed):
   - Enable Apple provider
   - Add your Apple service ID and key

### 4.3 Environment Variables
Update your `.env` file:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_WEB_CLIENT_ID=your_google_web_client_id
GOOGLE_IOS_CLIENT_ID=your_google_ios_client_id
```

## Step 5: Update App Configuration

### 5.1 Update App.tsx
Replace your current App.tsx with:
```typescript
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { EnhancedAuthProvider } from './src/context/EnhancedAuthContext';
import { QueryProvider } from './src/providers/QueryProvider';
import RootStackNavigator from './src/navigation/RootStackNavigator';

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider>
        <EnhancedAuthProvider>
          <NavigationContainer>
            <RootStackNavigator />
          </NavigationContainer>
        </EnhancedAuthProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}

export default App;
```

### 5.2 Update Navigation
Add new screens to your navigation stack:
```typescript
// In your RootStackNavigator.tsx
import EnhancedLoginScreen from '../screens/auth/EnhancedLoginScreen';
import EnhancedRegisterScreen from '../screens/auth/EnhancedRegisterScreen';
import ProfileDashboardScreen from '../screens/profile/ProfileDashboardScreen';
import GoalsScreen from '../screens/goals/GoalsScreen';
import ChallengesScreen from '../screens/challenges/ChallengesScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

// Add to your stack screens
<Stack.Screen name="Login" component={EnhancedLoginScreen} />
<Stack.Screen name="Register" component={EnhancedRegisterScreen} />
<Stack.Screen name="ProfileDashboard" component={ProfileDashboardScreen} />
<Stack.Screen name="Goals" component={GoalsScreen} />
<Stack.Screen name="Challenges" component={ChallengesScreen} />
<Stack.Screen name="Settings" component={SettingsScreen} />
```

## Step 6: Configure Themes and Colors

### 6.1 Theme Configuration
The app now supports multiple color schemes including pink. Users can select from:
- Default (Blue)
- Blue
- Green  
- Purple
- Pink (New!)
- Warm (Orange/Yellow)

### 6.2 Theme Implementation
Themes are automatically applied based on user preferences stored in the database. The system supports:
- Light/Dark mode
- Custom color schemes
- Font size preferences
- Accessibility options

## Step 7: Test the Implementation

### 7.1 Authentication Testing
1. Test email registration and login
2. Test Google Sign-In (both platforms)
3. Test Apple Sign-In (iOS only)
4. Test password reset functionality
5. Test email verification

### 7.2 Gamification Testing
1. Create user account and verify initial level/experience
2. Complete activities to test experience gain
3. Test badge awarding system
4. Test streak tracking
5. Test goals creation and completion

### 7.3 Profile Testing
1. Test profile editing
2. Test avatar upload
3. Test preferences saving
4. Test theme switching
5. Test notification settings

## Step 8: Challenges Integration

### 8.1 Playbook-Based Challenges
Challenges are now generated from your existing playbooks:
- Each playbook can have associated challenges
- Action steps can trigger specific challenges
- Completion rewards are automatically calculated

### 8.2 Challenge Creation
To create challenges from playbooks:
1. Identify key playbook milestones
2. Create challenge entries in the database
3. Link challenges to specific playbooks/action steps
4. Set appropriate rewards and difficulty levels

## Step 9: Production Deployment

### 9.1 Environment Setup
1. Set up production Supabase project
2. Configure production OAuth credentials
3. Update environment variables for production
4. Test all authentication flows in production

### 9.2 App Store Configuration
**For iOS:**
1. Ensure Apple Sign-In is properly configured
2. Add privacy policy URL
3. Configure app review information

**For Android:**
1. Generate production SHA-1 fingerprint
2. Update Google OAuth configuration
3. Test Google Sign-In with production build

## Step 10: Monitoring and Analytics

### 10.1 User Analytics
Track key metrics:
- User registration/login rates
- Authentication method preferences
- Feature usage (goals, challenges, etc.)
- User retention and engagement

### 10.2 Error Monitoring
Set up error tracking for:
- Authentication failures
- API errors
- Crash reporting
- Performance monitoring

## Troubleshooting

### Common Issues

**Google Sign-In not working:**
- Verify SHA-1 fingerprint is correct
- Check bundle ID matches OAuth configuration
- Ensure Google Play Services are installed (Android)

**Apple Sign-In not working:**
- Verify Apple Developer account is active
- Check bundle ID matches Apple configuration
- Ensure "Sign In with Apple" capability is enabled

**Database connection issues:**
- Verify Supabase URL and keys are correct
- Check Row Level Security policies
- Ensure user has proper permissions

**Theme not applying:**
- Check user preferences are saved correctly
- Verify theme colors are properly defined
- Test theme switching functionality

## Support

For additional support:
1. Check the implementation documentation
2. Review Supabase logs for API errors
3. Test with different devices and OS versions
4. Monitor user feedback and analytics

## Future Enhancements

Planned features for future releases:
1. Community features (friends, sharing)
2. Advanced analytics dashboard
3. Push notifications
4. Offline mode improvements
5. AI-powered recommendations
6. Social sharing integration

This setup guide provides a comprehensive foundation for implementing the enhanced authentication and gamification system in your siFia app.
