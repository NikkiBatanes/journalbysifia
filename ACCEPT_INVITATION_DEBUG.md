# Accept Invitation Flow - Line by Line Debug

## The Hanging Issue

### Call Stack:
1. User taps "Accept" in NotificationsScreen
2. `handleAcceptInvitation` (line 332) → calls `acceptInvitation(invitationCode)` (line 341)
3. `useFamilySubscription.acceptInvitation` (line 195) → calls `FamilySubscriptionService.acceptInvitation`
4. `FamilySubscriptionService.acceptInvitation` (line 312-449) → **COMPLETES SUCCESSFULLY**
5. **THEN** line 198 in hook: `await loadFamilyData()` 
6. `loadFamilyData` (line 54) → calls `FamilySubscriptionService.getUserFamilyGroup(user.id)`
7. `getUserFamilyGroup` (line 199) → calls `this.getFamilyGroup(subscription.family_group_id)`
8. **`getFamilyGroup` HANGS** because it tries to load member profiles and fails

### The Problem:
- `acceptInvitation` in the service completes fine
- But the hook then calls `loadFamilyData()` to refresh state
- `loadFamilyData` → `getUserFamilyGroup` → `getFamilyGroup` → **HANGS on profile loading**
- The `finally` block never runs, so `setAcceptingInvite(null)` never executes
- UI stays stuck on "Joining..."

### Root Cause:
`getFamilyGroup` at line 138-147 tries to load profiles:
```typescript
const { data: profiles, error: profilesError } = await supabase
  .from('user_profiles')
  .select('id, email, full_name, avatar_url')
  .in('id', memberIds);

if (profilesError) {
  Logger.warn('[FamilyService] Failed to load member profiles', {
    component: 'FamilySubscriptionService',
  });
} else if (profiles) {
  // ... build profileMap
}
```

**The issue:** If `profilesError` exists, we log a warning but then continue to the `else if (profiles)` block. If profiles is null/undefined, we skip building the profileMap, but then the code continues and tries to map members using an empty profileMap.

**BUT THE REAL ISSUE:** This isn't causing a hang - it's just a warning. The actual hang must be somewhere else in the promise chain.

---

## Decline Issues

### Issue 1: Notification not sent to admin
**Error:** `code: "42501" - new row violates row-level security policy for table "notifications"`

**Location:** `FamilyNotificationService.notifyInvitationDeclined` (line 130-140)

**Fix:** Run the RLS migration: `fix_notifications_table_rls.sql`

### Issue 2: Invitation still shows as pending
**Possible causes:**
1. The decline update fails silently
2. The UI doesn't refresh after decline
3. RLS blocks the update

**Need to check:** NotificationsScreen decline handler

---

## Badge Count Not Updating

### When does badge need to update?
1. When invitation is sent → badge should increment
2. When invitation is accepted → badge should decrement
3. When invitation is declined → badge should decrement

### Current badge logic:
`useNotificationBadge.fetchBadgeCount()` counts:
- Pending notifications in queue
- Unread in-app notifications
- Pending family invitations

**Possible issue:** Real-time subscription might not be triggering on `family_invitations` table changes.
