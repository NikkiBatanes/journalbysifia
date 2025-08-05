# Trial Access Implementation Guide

## 🎯 **Overview**

This guide shows how to implement the **"Full Access → Lock After 3 Days"** trial strategy throughout the siFia app, ensuring users experience premium features during trial and face strategic friction after expiration to drive conversions.

## 📁 **Files Created**

### **1. Core Services**
- `src/services/trialAccessService.ts` - Trial logic and feature access control
- `src/hooks/useTrialAccess.ts` - React hooks for trial management
- `src/components/TrialStatusBanner.tsx` - Trial countdown banner
- `src/components/FeatureLockOverlay.tsx` - Feature blocking UI components

## 🔧 **Integration Steps**

### **Step 1: Database Schema Updates**

Add trial tracking fields to subscriptions table:

```sql
-- Add trial tracking columns
ALTER TABLE subscriptions 
ADD COLUMN trial_ends_at TIMESTAMP,
ADD COLUMN status VARCHAR(50) DEFAULT 'active';

-- Add user events table for trial analytics
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- RLS policy for user events
CREATE POLICY "Users can view own events" ON user_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events" ON user_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### **Step 2: App-Wide Integration**

#### **A. Main App Component**

```tsx
// src/App.tsx
import { TrialStatusBanner } from './components/TrialStatusBanner';
import { useTrialAccess } from './hooks/useTrialAccess';

export const App = () => {
  const { hasActiveAccess, hasExpired } = useTrialAccess();

  return (
    <NavigationContainer>
      {/* Show trial banner when trial is active */}
      <TrialStatusBanner />
      
      <Stack.Navigator>
        {/* Your existing navigation */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

#### **B. Smart Journaling Integration**

```tsx
// src/screens/JournalingScreen.tsx
import { useFeatureAccess } from '../hooks/useTrialAccess';
import { FeatureLockOverlay } from '../components/FeatureLockOverlay';

export const JournalingScreen = () => {
  const { hasAccess } = useFeatureAccess('smartJournalingEnabled');
  const [showLockModal, setShowLockModal] = useState(false);

  const handleSmartJournalingPress = () => {
    if (!hasAccess) {
      setShowLockModal(true);
      return;
    }
    // Proceed with smart journaling
    navigateToSmartJournaling();
  };

  return (
    <View>
      <TouchableOpacity onPress={handleSmartJournalingPress}>
        <Text>Smart Journaling {!hasAccess && '🔒'}</Text>
      </TouchableOpacity>

      <FeatureLockOverlay
        visible={showLockModal}
        feature="smartJournaling"
        onClose={() => setShowLockModal(false)}
      />
    </View>
  );
};
```

#### **C. Journal Templates Integration**

```tsx
// src/screens/JournalTemplatesScreen.tsx
import { useFeatureAccess } from '../hooks/useTrialAccess';
import { FeatureLockCard } from '../components/FeatureLockOverlay';

export const JournalTemplatesScreen = () => {
  const { hasAccess } = useFeatureAccess('journalTemplatesAccess');
  const premiumTemplates = templates.filter(t => t.isPremium);

  return (
    <ScrollView>
      {/* Free templates - always accessible */}
      {templates.filter(t => !t.isPremium).map(template => (
        <TemplateCard key={template.id} template={template} />
      ))}

      {/* Premium templates - locked after trial */}
      <FeatureLockCard
        feature="journalTemplates"
        isLocked={hasAccess !== 'all'}
      >
        {premiumTemplates.map(template => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </FeatureLockCard>
    </ScrollView>
  );
};
```

#### **D. Content Generation Integration**

```tsx
// src/screens/PlaybookGenerationScreen.tsx
import { useContentGeneration } from '../hooks/useTrialAccess';

export const PlaybookGenerationScreen = () => {
  const { playbooksRemaining, checkCanGenerate } = useContentGeneration();
  const [showLimitModal, setShowLimitModal] = useState(false);

  const handleGeneratePlaybook = async () => {
    const result = await checkCanGenerate('playbook');
    
    if (!result.canGenerate) {
      if (result.reason === 'trial_expired') {
        setShowLimitModal(true);
        return;
      }
    }
    
    // Proceed with generation
    generatePlaybook();
  };

  return (
    <View>
      <Text>Playbooks Remaining: {playbooksRemaining}</Text>
      <Button onPress={handleGeneratePlaybook} title="Generate Playbook" />

      <FeatureLockOverlay
        visible={showLimitModal}
        feature="playbooks"
        onClose={() => setShowLimitModal(false)}
      />
    </View>
  );
};
```

### **Step 3: User Onboarding Integration**

#### **A. Trial Start on Signup**

```tsx
// src/screens/OnboardingScreen.tsx
import { trialAccessService } from '../services/trialAccessService';

export const OnboardingScreen = () => {
  const { user } = useAuth();

  useEffect(() => {
    // Start trial automatically for new users
    if (user?.id) {
      trialAccessService.startTrial(user.id);
    }
  }, [user?.id]);

  return (
    <View>
      <Text>Welcome! You have 3 days of full access to explore all features.</Text>
      {/* Onboarding content */}
    </View>
  );
};
```

#### **B. Trial Welcome Message**

```tsx
// src/components/TrialWelcome.tsx
export const TrialWelcome = () => {
  const { trialStatus } = useTrialAccess();

  if (!trialStatus?.isActive) return null;

  return (
    <View style={styles.welcomeBanner}>
      <Text style={styles.title}>🎉 Welcome to your 3-day trial!</Text>
      <Text style={styles.subtitle}>
        Explore all premium features including smart journaling, unlimited playbooks, 
        and advanced AI guidance. No credit card required.
      </Text>
    </View>
  );
};
```

### **Step 4: Background Trial Management**

#### **A. Trial Expiration Check**

```tsx
// src/services/backgroundTasks.ts
import { trialAccessService } from './trialAccessService';

export const checkTrialExpirations = async () => {
  // Run this periodically (e.g., every hour)
  const { data: expiredTrials } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('tier', 'free_trial')
    .eq('status', 'active')
    .lt('trial_ends_at', new Date().toISOString());

  for (const trial of expiredTrials || []) {
    await trialAccessService.handleTrialExpiration(trial.user_id);
  }
};
```

#### **B. App State Management**

```tsx
// src/hooks/useAppState.ts
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

export const useAppState = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Refresh trial status when app becomes active
        queryClient.invalidateQueries({ queryKey: ['trial-status'] });
        queryClient.invalidateQueries({ queryKey: ['feature-access'] });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [queryClient]);
};
```

## 🎨 **UI/UX Implementation**

### **Trial Status Indicators**

```tsx
// Add trial indicators throughout the app
const TrialBadge = ({ feature }: { feature: string }) => {
  const { hasActiveAccess } = useTrialAccess();
  
  if (!hasActiveAccess) return null;
  
  return (
    <View style={styles.trialBadge}>
      <Text style={styles.trialText}>TRIAL</Text>
    </View>
  );
};
```

### **Feature Preview Mode**

```tsx
// Show locked features with preview
const FeaturePreview = ({ children, isLocked }: { children: React.ReactNode, isLocked: boolean }) => {
  return (
    <View style={[styles.preview, isLocked && styles.locked]}>
      {children}
      {isLocked && (
        <View style={styles.lockOverlay}>
          <Ionicons name="lock-closed" size={20} color="#6366F1" />
          <Text>Upgrade to unlock</Text>
        </View>
      )}
    </View>
  );
};
```

## 📊 **Analytics Integration**

### **Track Trial Events**

```tsx
// src/services/analytics.ts
export const trackTrialEvent = async (event: string, metadata?: any) => {
  await trialAccessService.logTrialEvent(user.id, event);
  
  // Also send to your analytics service
  analytics.track('Trial Event', {
    event,
    ...metadata
  });
};

// Usage throughout app
trackTrialEvent('trial_started');
trackTrialEvent('feature_blocked', { feature: 'smart_journaling' });
trackTrialEvent('upgrade_prompt_shown', { feature: 'playbooks' });
```

## 🔄 **Testing Strategy**

### **Manual Testing Checklist**

1. **Trial Start**
   - [ ] New user gets 3-day trial automatically
   - [ ] All premium features are accessible
   - [ ] Trial countdown shows correct days

2. **During Trial**
   - [ ] Smart journaling works
   - [ ] All journal templates accessible
   - [ ] Unlimited content generation
   - [ ] Trial banner shows countdown

3. **Trial Expiration**
   - [ ] Premium features lock automatically
   - [ ] Upgrade prompts appear
   - [ ] Free features still work
   - [ ] Analytics events fire

4. **Edge Cases**
   - [ ] App restart during trial
   - [ ] Network offline/online
   - [ ] Multiple devices
   - [ ] Time zone changes

### **Automated Tests**

```tsx
// src/__tests__/trialAccess.test.ts
describe('Trial Access Service', () => {
  test('should grant full access during trial', async () => {
    const access = await trialAccessService.getFeatureAccess(testUserId);
    expect(access.smartJournalingEnabled).toBe(true);
    expect(access.playbooksRemaining).toBe(999);
  });

  test('should lock features after trial expiration', async () => {
    // Mock expired trial
    mockTrialExpired();
    const access = await trialAccessService.getFeatureAccess(testUserId);
    expect(access.smartJournalingEnabled).toBe(false);
  });
});
```

## 🚀 **Deployment Checklist**

### **Pre-Launch**
- [ ] Database migrations applied
- [ ] Trial service tested in staging
- [ ] UI components tested on all screen sizes
- [ ] Analytics events configured
- [ ] Background tasks scheduled

### **Launch Day**
- [ ] Monitor trial conversion rates
- [ ] Watch for errors in trial logic
- [ ] Track user feedback on trial experience
- [ ] Monitor server performance

### **Post-Launch**
- [ ] A/B test trial duration (3 vs 7 days)
- [ ] Optimize upgrade prompts based on data
- [ ] Refine feature locking strategy
- [ ] Analyze conversion funnel

## 📈 **Success Metrics**

### **Key Performance Indicators**
- **Trial-to-paid conversion**: Target 25-35%
- **Feature engagement during trial**: >80% use premium features
- **Time to first premium feature use**: <24 hours
- **Upgrade prompt click-through**: >15%

### **Monitoring Dashboard**
```sql
-- Trial conversion rate
SELECT 
  COUNT(CASE WHEN tier != 'free_trial' THEN 1 END) * 100.0 / COUNT(*) as conversion_rate
FROM subscriptions 
WHERE trial_ends_at < NOW();

-- Feature usage during trial
SELECT 
  event_name,
  COUNT(*) as usage_count
FROM user_events 
WHERE event_type = 'feature_usage' 
  AND created_at >= trial_start_date;
```

This implementation creates a seamless trial experience that maximizes feature exposure during the trial period and strategically applies friction after expiration to drive conversions. 🚀
