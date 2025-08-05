# 🚀 Quick Trial System Setup Guide

This guide helps you integrate the simplified trial system into your existing siFia app in **under 30 minutes**.

## 📋 Prerequisites

1. ✅ Supabase project is set up
2. ✅ Environment variables are configured
3. ✅ Your existing auth system is working

## 🛠️ Step 1: Install Dependencies

```bash
# If you don't have these already
npm install @tanstack/react-query react-native-config
# or
yarn add @tanstack/react-query react-native-config
```

## 🗄️ Step 2: Run Database Migration

1. Open your Supabase SQL Editor
2. Run the safe migration script:

```sql
-- Copy and paste the contents of supabase_migration_safe.sql
-- This will create the necessary tables and triggers
```

## 📱 Step 3: Integrate into Your App

### A. Add Trial Banner to Main App

```tsx
// In your main App.tsx or wherever you want the trial banner
import { SimpleTrialBanner } from './src/components/SimpleTrialBanner';
import { useAuth } from './src/context/AuthContext'; // Your existing auth

export default function App() {
  const { user } = useAuth(); // Your existing auth hook

  return (
    <View style={{ flex: 1 }}>
      {/* Your existing app content */}
      
      {/* Add trial banner */}
      <SimpleTrialBanner 
        userId={user?.id}
        onUpgradePress={() => {
          // Navigate to your subscription screen
          navigation.navigate('Subscription');
        }}
      />
      
      {/* Rest of your app */}
    </View>
  );
}
```

### B. Protect Premium Features

```tsx
// Example: In your Journaling screen
import { useSimpleTrialAccess } from '../hooks/useSimpleTrialAccess';
import { SimpleFeatureLock } from '../components/SimpleFeatureLock';

export const JournalingScreen = () => {
  const { user } = useAuth(); // Your existing auth
  const { featureAccess } = useSimpleTrialAccess(user?.id);

  return (
    <View>
      {/* Free journaling - always available */}
      <BasicJournalingComponent />
      
      {/* Smart journaling - premium feature */}
      <SimpleFeatureLock
        isLocked={!featureAccess.smartJournalingEnabled}
        feature="smartJournaling"
        onUpgradePress={() => navigation.navigate('Subscription')}
      >
        <SmartJournalingComponent />
      </SimpleFeatureLock>
    </View>
  );
};
```

### C. Check Content Generation Limits

```tsx
// Example: Before generating playbooks or devotionals
import { useSimpleTrialAccess } from '../hooks/useSimpleTrialAccess';

export const PlaybookScreen = () => {
  const { user } = useAuth();
  const { checkCanGenerate } = useSimpleTrialAccess(user?.id);

  const handleGeneratePlaybook = async () => {
    const { canGenerate, reason } = await checkCanGenerate('playbook');
    
    if (!canGenerate) {
      if (reason === 'trial_expired') {
        // Show upgrade modal
        setShowUpgradeModal(true);
      } else {
        // Show limit reached message
        Alert.alert('Limit Reached', 'You\'ve reached your monthly limit.');
      }
      return;
    }

    // Proceed with generation
    generatePlaybook();
  };

  return (
    <View>
      <TouchableOpacity onPress={handleGeneratePlaybook}>
        <Text>Generate Playbook</Text>
      </TouchableOpacity>
    </View>
  );
};
```

## 🎯 Step 4: Start Trials for New Users

```tsx
// In your signup/onboarding flow
import { useSimpleTrialAccess } from '../hooks/useSimpleTrialAccess';

export const OnboardingScreen = () => {
  const { user } = useAuth();
  const { startTrial } = useSimpleTrialAccess(user?.id);

  useEffect(() => {
    if (user?.id) {
      // Automatically start trial for new users
      startTrial();
    }
  }, [user?.id]);

  return (
    <View>
      <Text>Welcome! Your 3-day trial has started!</Text>
      {/* Rest of onboarding */}
    </View>
  );
};
```

## 🧪 Step 5: Test the Flow

1. **Create a test user** and verify trial starts automatically
2. **Check trial banner** appears with countdown
3. **Test feature locking** after trial expires
4. **Verify upgrade prompts** work correctly

## 📊 Step 6: Monitor Analytics (Optional)

The system automatically logs events to your `user_events` table:
- `trial_started`
- `trial_expired`
- `feature_locked`
- `upgrade_prompt_shown`

Query these for insights:

```sql
SELECT event_type, COUNT(*) 
FROM user_events 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type;
```

## 🔧 Customization Options

### Change Trial Duration
```tsx
// In useSimpleTrialAccess.ts, modify the startTrial function:
trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7 days instead of 3
```

### Customize UI Colors
```tsx
// In SimpleTrialBanner.tsx and SimpleFeatureLock.tsx
// Modify the styles object to match your brand colors
```

### Add More Features
```tsx
// In useSimpleTrialAccess.ts, extend the SimpleFeatureAccess interface:
export interface SimpleFeatureAccess {
  smartJournalingEnabled: boolean;
  hasAllTemplates: boolean;
  playbooksRemaining: number;
  devotionalsRemaining: number;
  // Add your new features here
  customFeatureEnabled: boolean;
  isUnlimited: boolean;
}
```

## 🚨 Troubleshooting

### Trial not starting?
- Check Supabase connection
- Verify user ID is being passed correctly
- Check database permissions

### Features not locking?
- Verify trial expiration logic
- Check feature access conditions
- Ensure components are wrapped correctly

### Styling issues?
- The components use basic React Native styles
- Customize the StyleSheet objects to match your design system

## 🎉 You're Done!

Your trial system is now live! Users will get:
- ✅ 3-day full access trial
- ✅ Feature locking after expiration  
- ✅ Clear upgrade prompts
- ✅ Smooth conversion flow

## 📈 Next Steps

1. **Deploy to TestFlight** for beta testing
2. **Monitor conversion metrics** in your analytics
3. **A/B test pricing** using the market pricing service
4. **Optimize trial duration** based on user behavior

Need help? Check the detailed `TRIAL_IMPLEMENTATION_GUIDE.md` for advanced features and customization options.
