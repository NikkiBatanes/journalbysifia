# Smart Journaling Feature Gating - Remaining Work

## ✅ Completed
- [x] Created `useSmartJournalingGating` hook
- [x] Added gating to **TimeBlockLogEditor**
  - Lock icon in title
  - Sales/trial offer trigger on save
- [x] Added gating to **GratitudeLogEditor**
  - Lock icon in title
  - Sales/trial offer trigger on save

## 🔲 Remaining Tasks

### 1. PrayerLogEditor
**File**: `src/components/journal/PrayerLogEditor.tsx`

**Changes needed**:
1. Add imports (same as TimeBlock/Gratitude):
   ```typescript
   import { useSmartJournalingGating } from '../../hooks/useSmartJournalingGating';
   import { useNavigation } from '@react-navigation/native';
   import { useSubscription } from '../../hooks/useSubscription';
   import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
   import { triggerLightHaptic } from '../../utils/haptics';
   ```

2. Add hooks in component:
   ```typescript
   const navigation = useNavigation();
   const { subscription } = useSubscription();
   const smartJournalingGating = useSmartJournalingGating();
   ```

3. Add gating check in `handleSave` (line ~630):
   ```typescript
   const handleSave = async () => {
     try {
       // Check if feature is gated for seeker accounts
       if (smartJournalingGating.isLocked) {
         try { triggerLightHaptic(); } catch {}
         (navigation as any).navigate('OnboardingSalesOffer', {
           source: 'smart_journaling_lock',
           feature: 'smart_journaling',
           tier: subscription?.tier || 'seeker',
           upgradeMode: false,
           skipNotificationPreference: true,
         });
         return;
       }
       // ... rest of save logic
   ```

4. Add lock icon to title (find the title section and wrap with flexDirection row + lock icon)

### 2. ReflectionLogEditor / EnhancedReflectionLogEditor
**File**: `src/components/journal/ReflectionLogEditor.tsx` or `EnhancedReflectionLogEditor.tsx`

**Note**: ReflectionLogEditor already has guided prompt gating. Check if it needs smart journaling gating for non-guided reflections.

**If needed, apply same pattern as above**:
- Add imports
- Add hooks
- Add gating check in handleSave
- Add lock icon to title

## Testing Checklist
- [ ] Seeker account sees lock icon on all 4 editors (time block, gratitude, prayer, reflect)
- [ ] Tapping lock icon triggers sales offer screen
- [ ] Pressing Save button triggers sales offer screen for seeker accounts
- [ ] Sales offer shows trial option if user hasn't used trial yet
- [ ] After upgrading, lock icons disappear and save works normally
- [ ] Non-seeker accounts (Spark+) don't see locks and can save normally

## Pattern Reference
See `TimeBlockLogEditor.tsx` lines 29-32, 689-691, 776-790, 897-918 for complete implementation pattern.
