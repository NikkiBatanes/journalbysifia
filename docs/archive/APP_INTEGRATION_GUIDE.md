# siFia Notification System - App Integration Guide

## Quick Integration (3 Steps)

### Step 1: Update App.tsx

```typescript
import React, { useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { useAuth } from './src/context/IndustryStandardAuthContext';
import { useNotificationSetup } from './src/utils/notificationSetup';

function App() {
  const navigationRef = useNavigationContainerRef();
  const { user } = useAuth();

  // Initialize notification system
  useNotificationSetup(user?.id, navigationRef);

  return (
    <NavigationContainer ref={navigationRef}>
      {/* Your app navigation */}
    </NavigationContainer>
  );
}

export default App;
```

**That's it!** The notification system is now fully integrated.

---

### Step 2: Track User Activities

In any screen where user completes an activity:

```typescript
import { useNotificationIntegration } from '../hooks/useNotificationIntegration';

function JournalScreen() {
  const { trackPrayer, trackJournal } = useNotificationIntegration();

  const handlePrayerComplete = async () => {
    // Your prayer logic...
    await savePrayer();
    
    // Track activity (updates streak, schedules alerts)
    await trackPrayer();
  };

  const handleJournalSave = async () => {
    // Your journal logic...
    await saveJournal();
    
    // Track activity
    await trackJournal();
  };
}
```

---

### Step 3: Celebrate Milestones

When user earns points or levels up:

```typescript
import { useNotificationIntegration } from '../hooks/useNotificationIntegration';

function FaithPointsService() {
  const { celebrateFaithPoints, celebrateLevelUp } = useNotificationIntegration();

  const awardPoints = async (userId: string, points: number) => {
    const previousPoints = await getUserPoints(userId);
    const newPoints = previousPoints + points;
    
    await updateUserPoints(userId, newPoints);
    
    // Check and celebrate milestones
    await celebrateFaithPoints(previousPoints, newPoints);
    
    // Check if leveled up
    const previousLevel = calculateLevel(previousPoints);
    const newLevel = calculateLevel(newPoints);
    
    if (newLevel > previousLevel) {
      await celebrateLevelUp(newLevel);
    }
  };
}
```

---

## Optional: Show Notification Badge

### In Dashboard or Tab Bar

```typescript
import { useNotificationBadge } from '../hooks/useNotificationBadge';

function DashboardScreen() {
  const { badgeCount, loading } = useNotificationBadge();

  return (
    <View>
      {badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount}</Text>
        </View>
      )}
    </View>
  );
}
```

### In Tab Navigator

```typescript
import { useNotificationBadge } from '../hooks/useNotificationBadge';

function TabNavigator() {
  const { badgeCount } = useNotificationBadge();

  return (
    <Tab.Navigator>
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          tabBarBadge: badgeCount > 0 ? badgeCount : undefined,
        }}
      />
    </Tab.Navigator>
  );
}
```

---

## Deep Link Navigation Fix

### Problem
Dashboard notifications don't open the correct screen.

### Solution
The `useNotificationSetup` hook (Step 1 above) automatically fixes this by:
1. Setting the navigation reference
2. Initializing the deep-link service
3. Handling notification taps

### Supported Deep Links

All these will work automatically:

```typescript
// Journal
sifia://journal
sifia://journal/prayer
sifia://journal/prayer?tab=requests
sifia://journal/gratitude
sifia://journal/wins

// Devotionals
sifia://devotionals
sifia://devotionals/today
sifia://devotionals/{id}
sifia://devotionals/{id}/reflect

// Playbooks
sifia://playbooks
sifia://playbooks/{id}
sifia://playbooks/{id}?celebrate=true

// Dashboard
sifia://dashboard
sifia://dashboard/affirmations
sifia://dashboard/scripture

// Profile
sifia://profile
sifia://profile/stats

// Subscription
sifia://subscription/upgrade
```

---

## Notification Badge Count Fix

### Problem
Badge count shows incorrect number or doesn't update.

### Solution

#### Option 1: Use Hook (Recommended)
```typescript
import { useNotificationBadge } from '../hooks/useNotificationBadge';

function MyComponent() {
  const { badgeCount, fetchBadgeCount } = useNotificationBadge();

  // Badge count updates automatically
  // Refreshes every 5 minutes
  // Also refreshes when user changes

  return <Badge count={badgeCount} />;
}
```

#### Option 2: Manual Fetch
```typescript
import { getPendingNotificationCount } from '../utils/notificationSetup';

const count = await getPendingNotificationCount(userId);
```

---

## Complete Integration Example

### App.tsx (Full Example)

```typescript
import React, { useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/IndustryStandardAuthContext';
import { useNotificationSetup } from './src/utils/notificationSetup';
import { Logger } from './src/utils/ProductionLogger';

function AppContent() {
  const navigationRef = useNavigationContainerRef();
  const { user } = useAuth();

  // Initialize notification system
  useNotificationSetup(user?.id, navigationRef);

  // Log when navigation is ready
  useEffect(() => {
    if (navigationRef) {
      Logger.info('Navigation ready for deep links', {
        component: 'App',
      });
    }
  }, [navigationRef]);

  return (
    <NavigationContainer ref={navigationRef}>
      {/* Your navigation stack */}
      <RootNavigator />
    </NavigationContainer>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
```

---

## Testing

### Test Deep Links

```typescript
import { notificationDeepLinkService } from './src/services/notificationDeepLinkService';

// Test navigation
notificationDeepLinkService.navigate('sifia://journal/prayer');
notificationDeepLinkService.navigate('sifia://dashboard/affirmations');
notificationDeepLinkService.navigate('sifia://devotionals/today');
```

### Test Badge Count

```typescript
import { useNotificationBadge } from './src/hooks/useNotificationBadge';

function TestScreen() {
  const { badgeCount, incrementBadge, decrementBadge, clearBadge } = useNotificationBadge();

  return (
    <View>
      <Text>Badge Count: {badgeCount}</Text>
      <Button title="Increment" onPress={incrementBadge} />
      <Button title="Decrement" onPress={decrementBadge} />
      <Button title="Clear" onPress={clearBadge} />
    </View>
  );
}
```

### Test Notifications

```typescript
import { DailyNotificationScheduler } from './src/utils/dailyNotificationScheduler';

// Force reschedule all notifications (for testing)
await DailyNotificationScheduler.forceReschedule(userId);

// Check last scheduled date
const lastDate = await DailyNotificationScheduler.getLastScheduledDate();
console.log('Last scheduled:', lastDate);
```

---

## Troubleshooting

### Notifications Not Sending

1. **Check user preferences**
   - Go to User Profile → Notifications
   - Verify notification types are enabled

2. **Check quiet hours**
   - Default: 10 PM - 7 AM
   - Verify current time is not in quiet hours

3. **Check daily limit**
   - Max 3 notifications per day
   - Critical notifications bypass this

4. **Force reschedule**
   ```typescript
   await DailyNotificationScheduler.forceReschedule(userId);
   ```

### Deep Links Not Working

1. **Verify navigation ref is set**
   ```typescript
   // In App.tsx
   useNotificationSetup(user?.id, navigationRef);
   ```

2. **Check logs**
   ```typescript
   // Look for these logs:
   // "Navigation ready for deep links"
   // "Notification deep-link service initialized"
   ```

3. **Test manually**
   ```typescript
   notificationDeepLinkService.navigate('sifia://dashboard');
   ```

### Badge Count Wrong

1. **Refresh badge**
   ```typescript
   const { fetchBadgeCount } = useNotificationBadge();
   await fetchBadgeCount();
   ```

2. **Clear and refresh**
   ```typescript
   const { clearBadge, fetchBadgeCount } = useNotificationBadge();
   await clearBadge();
   await fetchBadgeCount();
   ```

---

## Performance Tips

### 1. Lazy Load Notification Services

The `useNotificationSetup` hook already does this, but if you're manually importing:

```typescript
// ✅ Good - Dynamic import
const { trackPrayer } = useNotificationIntegration();

// ❌ Bad - Direct import at top level
import { streakTrackingService } from './services/streakTrackingService';
```

### 2. Debounce Badge Updates

```typescript
import { useMemo } from 'react';
import debounce from 'lodash/debounce';

const { fetchBadgeCount } = useNotificationBadge();

const debouncedFetch = useMemo(
  () => debounce(fetchBadgeCount, 1000),
  [fetchBadgeCount]
);
```

### 3. Cache Pending Notifications

The badge hook already caches and refreshes every 5 minutes. No additional caching needed.

---

## Migration from Old System

If you have an existing notification system:

### 1. Remove Old Notification Code

```typescript
// Remove these:
- Old notification scheduling logic
- Old deep link handlers
- Old badge management
```

### 2. Replace with New System

```typescript
// Add these:
+ useNotificationSetup(user?.id, navigationRef)
+ useNotificationIntegration()
+ useNotificationBadge()
```

### 3. Update Database

```sql
-- Run the migration:
-- database/migrations/notification_system_tables.sql
```

---

## Summary

### Required (3 Steps)
1. ✅ Add `useNotificationSetup` to App.tsx
2. ✅ Track activities with `useNotificationIntegration`
3. ✅ Celebrate milestones with `celebrateFaithPoints` / `celebrateLevelUp`

### Optional
- 🔔 Show badge with `useNotificationBadge`
- 📊 Monitor with notification analytics
- 🧪 Test with `DailyNotificationScheduler.forceReschedule`

### That's It!
The notification system is now fully integrated and working. All deep links will navigate correctly, badges will show accurate counts, and notifications will send at the right times.
