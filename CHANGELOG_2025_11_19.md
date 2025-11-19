# Changelog - November 19, 2025

## 🎯 Summary
This update includes critical bug fixes for prayer requests, complete removal of quiet hours feature, notification time optimizations, and fixes for feature gating navigation issues.

---

## ✅ COMPLETED FIXES

### 1. Prayer Request UI Auto-Refresh ✅
**Issue**: Prayer requests remained visible in UI after marking as prayed via "Pray for Name Now" button. Required app reload to see changes.

**Root Cause**: 
- `useUnprayedPrayerRequests` query had `staleTime: 60000` (1 minute)
- React Query wouldn't refetch if data was less than 1 minute old
- Optimistic updates worked but were overwritten by stale cache

**Solution**:
- Set `staleTime: 0` to always refetch fresh data
- Added `refetchOnMount: true` to ensure data loads on component mount
- Prayer requests now disappear immediately from both Dashboard and Journal screens

**Files Modified**:
- `src/services/hooks/usePrayerData.ts`

**Commit**: `710cb445`

---

### 2. Quiet Hours Complete Removal ✅
**Issue**: Quiet hours feature needed to be completely removed from notifications system, UI, and database.

**Changes Made**:

#### A. Notification Scheduler Service
- Removed `respectQuietHours` parameter from `ScheduleOptions` interface
- Removed `adjustForQuietHours()` method (54 lines)
- Removed `isTimeInQuietHours()` method (14 lines)
- Removed `QUIET_HOURS_DEFAULT_START` and `QUIET_HOURS_DEFAULT_END` constants
- Updated all `scheduleNotification()` calls to remove `respectQuietHours` parameter

**Files Modified**: `src/services/notificationSchedulerService.ts`
**Commit**: `423eeaf6`

#### B. Notification Management Service
- Removed `quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end` from `NotificationPreferences` interface
- Removed quiet hours from default preferences
- Removed quiet hours from preference update logic

**Files Modified**: `src/services/notificationManagementService.ts`
**Commit**: `bb9a9a51`

#### C. User Interface Removal
**UserProfileScreen.tsx**:
- Removed `formatTo12h()` helper function (10 lines)
- Removed `showTimePicker`, `timePickerType`, `tempTime` state variables
- Removed `showNativeTimePicker()` function (14 lines)
- Removed `handleTimeChange()` function (34 lines)
- Removed entire "Quiet Hours" UI section with time pickers (32 lines)
- Removed DateTimePicker modals for iOS and Android (42 lines)
- Removed quiet hours from default preferences fallback

**OnboardingNotificationSetupScreen.tsx**:
- Removed `quiet_hours_start: '22:00'` from default preferences
- Removed `quiet_hours_end: '07:00'` from default preferences

**Files Modified**: 
- `src/screens/UserProfileScreen.tsx`
- `src/screens/onboarding/OnboardingNotificationSetupScreen.tsx`

**Commit**: `f683b31a`

#### D. Database Migration
Created SQL migrations to remove columns from `notification_preferences` table:
- `quiet_hours_enabled`
- `quiet_hours_start`
- `quiet_hours_end`

**Files Created**:
- `database/migrations/remove_quiet_hours_from_notification_preferences.sql`
- `database/migrations/remove_quiet_hours_from_notification_preferences_rollback.sql`

**Commit**: `1c500251`

#### E. Final Cleanup
- Removed `respectQuietHours: true` from streak alert scheduling in `streakTrackingService.ts`

**Commit**: `984e6b14`

**Total Lines Removed**: ~200+ lines of code

---

### 3. Autosync Calendar Feature Gating Fix ✅
**Issue**: When tapping "Permissions" or "Auto-sync to Calendar" in UserProfile, if user cancels the sales offer modal, the app gets stuck and doesn't return to UserProfile screen.

**Root Cause**:
- `OnboardingSalesOfferScreen.handleClose()` checked for trial eligibility before checking `returnTo` parameter
- If user was trial-eligible, it navigated to `OnboardingTrialOffer` instead of returning to UserProfile
- Created a navigation loop where user couldn't dismiss back to profile

**Solution**:
- Reordered logic in `handleClose()` to prioritize `returnTo` navigation
- Check for `returnTo === 'UserProfile'` or `context === 'profile_settings'` FIRST
- Only show trial offer if not coming from profile settings
- User now properly returns to UserProfile when canceling upgrade

**Files Modified**: `src/screens/onboarding/OnboardingSalesOfferScreen.tsx`
**Commit**: `aef81f63`

---

### 4. Notification Time Adjustments ✅
**Issue**: Streak alert notifications were scheduled too late in the evening, giving users less time to complete their daily activities.

**Changes**:
- **Prayer Streak Alert**: 8:00 PM → 7:00 PM (1 hour earlier)
- **Devotional Streak Alert**: 9:00 PM → 7:30 PM (1.5 hours earlier)
- **Journal Streak Alert**: 10:00 PM → 8:00 PM (2 hours earlier)

**Rationale**: Earlier notifications give users more evening time to complete their spiritual activities before end of day.

**Files Modified**: `src/services/streakTrackingService.ts`
**Commit**: `984e6b14`

---

### 5. Previous Session Fixes (Recap)
These were completed in the previous session:

#### A. Streak Tracking for Journal & Prayer Entries
- Added `streakTrackingService.updateStreak()` calls to journal and prayer mutations
- Journal entries (Focus, Todos, Timeblock, Gratitude, Win, Looking Forward) now count toward streaks
- Prayer entries (ACTS, People, Devotional) now count toward streaks

**Files Modified**:
- `src/services/hooks/useJournalData.ts`
- `src/services/hooks/usePrayerData.ts`

#### B. Streak Tracker UI Auto-Refresh
- Added `dashboard.streaks` query key to `queryKeys.ts`
- Invalidate streak tracker after journal/prayer entries
- Dashboard streak counter updates immediately without page reload

**Files Modified**:
- `src/services/queryKeys.ts`
- `src/services/hooks/useJournalData.ts`
- `src/services/hooks/usePrayerData.ts`

#### C. Reflection Label Change
- Changed "FREE FORM" label to "THOUGHTS" in reflection logs
- More intuitive and user-friendly label

**Files Modified**: `src/components/journal/ReflectionLogReactQuery.tsx`

#### D. Sales Offer Status Bar
- Added `useScreenStatusBar('light', Colors.hopeWhite)` to OnboardingSalesOfferScreen
- Status bar now always shows white icons (light mode)

**Files Modified**: `src/screens/onboarding/OnboardingSalesOfferScreen.tsx`

---

## 📊 Impact Summary

### Code Quality
- **Lines Removed**: ~200+ lines (quiet hours feature)
- **Files Modified**: 11 files
- **Database Migrations**: 2 files created
- **Commits**: 8 commits

### User Experience Improvements
1. ✅ Prayer requests update instantly in UI
2. ✅ Simplified notification settings (no confusing quiet hours)
3. ✅ Feature gating modals dismiss properly
4. ✅ Streak notifications arrive earlier, giving more time to complete activities
5. ✅ Streak tracking works for all journal and prayer activities
6. ✅ Dashboard updates immediately without reload

### Performance
- Reduced query cache complexity
- Removed unnecessary time calculation logic
- Cleaner navigation flow

---

## 🧪 Testing Checklist

### Prayer Requests
- [ ] Add prayer request in Dashboard
- [ ] Tap "Pray for Name Now"
- [ ] Verify request disappears immediately from Dashboard
- [ ] Verify request disappears from Journal screen
- [ ] No app reload required

### Quiet Hours Removal
- [ ] Open UserProfile → Notifications
- [ ] Verify no "Quiet Hours" section visible
- [ ] Verify all notification toggles work
- [ ] Run database migration to remove columns
- [ ] Verify app works without quiet hours columns

### Autosync Calendar Gating
- [ ] As Seeker user, go to UserProfile
- [ ] Tap "Auto-sync to Calendar" toggle
- [ ] Sales offer modal appears
- [ ] Tap X to close modal
- [ ] Verify returns to UserProfile (not stuck)
- [ ] Tap "System Permissions"
- [ ] Verify can close and return to profile

### Notification Times
- [ ] Check streak alert notifications arrive at new times:
  - Prayer: 7:00 PM
  - Devotional: 7:30 PM
  - Journal: 8:00 PM

### Streak Tracking
- [ ] Add journal entry (any type)
- [ ] Check Dashboard - streak counter updates immediately
- [ ] Add prayer entry (any type)
- [ ] Check Dashboard - streak counter updates immediately
- [ ] No reload required

---

## 🔄 Migration Steps

### Database Migration
Run the following SQL migration on your Supabase database:

```sql
-- Remove quiet hours columns
ALTER TABLE notification_preferences 
DROP COLUMN IF EXISTS quiet_hours_enabled,
DROP COLUMN IF EXISTS quiet_hours_start,
DROP COLUMN IF EXISTS quiet_hours_end;
```

Location: `database/migrations/remove_quiet_hours_from_notification_preferences.sql`

### Rollback (if needed)
If you need to rollback, run:
```sql
-- Restore quiet hours columns
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT DEFAULT '07:00';
```

Location: `database/migrations/remove_quiet_hours_from_notification_preferences_rollback.sql`

---

## 📝 Notes

### Breaking Changes
- Quiet hours feature completely removed
- Users who had custom quiet hours settings will lose those preferences
- No migration path to preserve quiet hours settings (feature removed by design)

### Backward Compatibility
- App will work with or without quiet hours database columns
- Graceful handling if columns still exist
- No crashes if migration not run immediately

### Future Considerations
- Consider user-configurable notification times per notification type
- Consider "Do Not Disturb" integration with system settings
- Monitor user feedback on new notification times

---

## 🎉 Conclusion

All requested fixes have been completed and committed to the repository. The app now has:
- Instant UI updates for prayer requests
- Cleaner notification system without quiet hours
- Proper navigation flow for feature gating
- Optimized notification timing
- Complete streak tracking for all activities

Total commits: 8
Total files changed: 13
Total lines removed: ~200+
Total lines added: ~100+

**All changes pushed to main branch and ready for testing.**
