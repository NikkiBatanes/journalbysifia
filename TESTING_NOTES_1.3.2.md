# Testing Notes for Version 1.3.2

## 1. Purchase Flow (Apple Webhook Fix)

### Option 1: Onboarding Purchase Flow
- Go through onboarding
- Create an account
- Follow the onboarding flow
- Create a Playbook
- Tap button "Continue my Journey" will lead to the purchase flow
- Tap "Start Trial" and Purchase using sandbox
- **Verify that the purchase completes successfully**
- **Verify subscription status updates correctly after purchase**

### Option 2: Dashboard Upgrade Flow
- Open the app and go to Dashboard
- Tap the user profile avatar in the upper-right corner
- Select Subscription Plan
- Attempt to upgrade your subscription
- **Verify that the purchase completes successfully**
- **Confirm that the subscription modal updates automatically to reflect the new subscription**

### Apple Webhook Specific Tests
- Test with Apple sandbox account
- Verify webhook payload processing works correctly
- Confirm subscription sync happens without delays
- Test renewal/failure scenarios if possible

---

## 2. Notification Badge Clear All Fix

### Clear All Notifications Test
- Navigate to Notifications screen
- Ensure there are multiple unread notifications
- Tap "Clear All" button
- **Verify badge count disappears instantly** (no race condition)
- **Verify real-time subscriptions don't restore the badge count**
- Refresh the app and confirm badge stays at 0

---

## 3. Onboarding Trial Offer Improvements

### Trial Offer Screen Layout
- Go through onboarding to reach Trial Offer screen
- **Verify CTA button says "Start 3-day Free Trial"**
- **Verify reduced scrolling** (screen should be less scroll-heavy)
- **Verify tier-specific content displays correctly** (Spark/Growth/Transformation)
- **Verify pricing summary shows correct format** ("3 days free, then $X/month/year")
- **Verify "Save 2 months free" and monthly equivalent display**

---

## 4. Small Screen Responsiveness (iPhone SE/12 mini)

### Auth Screens on Small Phones
- Log out: Dashboard → User Profile → Scroll → Log Out
- **Verify all components fit on iPhone SE/12 mini screens**
- **Check login, register, and forgot password screens**
- **Verify no cutoff or overlap issues**
- **Ensure buttons are fully accessible**

### Onboarding Screens on Small Phones
- Complete onboarding flow on iPhone SE/12 mini
- **Verify all text and buttons are fully visible**
- **Check "Start My Journey" button is not cut off**
- **Verify proper spacing and layout**

---

## 5. Logo Sizing Changes

### User Input Screen Logo
- Navigate to User Input screen
- **Verify logo size is now smaller** (45% scale)
- **Test on iPad to ensure proper positioning**
- **Verify logo doesn't move too far down on iPad landscape**
- **Test keyboard open/close animations**

### Splash Screen Logo
- Launch app and observe splash screen
- **Verify logo size is appropriately larger** (150px phone, 180px tablet)

---

## 6. Timeblock Display & Timezone

### Timeblock Creation and Display
- Tap Journal in the bottom main tab
- Swipe the carousel under Plan & Prepare until you reach Timeblock
- Tap the Add Timeblock button (Begin)
- Add a title, select a category (both required), and set the frequency to Everyday
- Save the timeblock by tapping the check button
- **Verify that the timeblock is saved successfully**
- Tap the feather icon in the upper-right corner
- The Moments screen will open
- **Confirm that the new timeblock appears correctly**

---

## 7. Empty-State Button in Devotionals Screen

### Devotionals Empty State
- Navigate to Devotionals via the main tab
- Ensure the screen is empty
- Tap the "Create a Devotional" button
- **Confirm that the Devotional modal slides up**

---

## 8. Action Steps Automated Completion

### Playbook Action Steps
- Go to Playbooks in the main tab
- Tap a playbook
- Tap Action Steps to expand
- In Step 1, long tap a subtask
- Tap the light blue reflection icon
- Enter a reflection, then tap Save and Done
- **Verify that the subtask is automatically marked as completed**
- Tap the next subtask
- **Confirm that previously completed subtasks remain marked and are not unmarked**

---

## 9. General Stability

### Lint and TypeScript
- **Verify no console errors or warnings**
- **Check that all screens load without crashes**
- **Test navigation between screens**

### Memory and Performance
- Test app on various device sizes
- **Verify no memory leaks during extended use**
- **Check animations are smooth**

---

## What's New in 1.3.2 (Summary)

- **Purchases**: Improved Apple subscription sync reliability (fixed Apple webhook auth/payload handling)
- **Onboarding offers**: Refined sales/trial offer copy + improved Trial Offer CTA and layout (less scrolling)
- **Notifications**: "Clear All" now updates badge count instantly and reliably
- **UI/UX**: Better responsiveness on small phones (iPhone SE/12 mini) and tablets across auth/onboarding; updated splash/welcome spacing and logo sizing
- **Small-screen fixes**: Improved layouts and spacing for small phones (especially iPhone SE / iPhone 12 mini) across key screens (auth + onboarding), so UI fits better without awkward clipping/overlap
- **Stability**: Lint/TypeScript cleanup and fixes

---

## Priority Focus Areas for 1.3.2

1. **Purchase Flow** - Critical: Verify Apple webhook fix works end-to-end
2. **Notification Badge** - High: Test "Clear All" instant update
3. **Small Screen Layout** - High: Verify iPhone SE/12 mini compatibility
4. **Trial Offer UI** - Medium: Check improved layout and CTA text
5. **Logo Sizing** - Medium: Verify consistent sizing across devices
