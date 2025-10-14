# ✅ Usage Tooltips Implementation - Complete

## Feature Overview

Added informative tooltips to all usage badges in the User Profile screen. Users can now tap any badge (Playbooks, Devotionals, Faith Points, Badges) to see detailed explanations.

---

## Tooltip Information

### 1. **Playbooks Tooltip** 📋
**Tap the playbooks badge (e.g., "0/2")**

**For Trial Users:**
```
You are on siFia Growth Trial. You have 2 available tokens to generate playbooks and you have used 0.

After 2 days remaining, you will have 20 playbooks every month.
```

**For Paid Users:**
```
You are on siFia Growth. You have 20 playbooks available each month and you have used 5.

15 playbooks remaining this month.
```

**For Unlimited Users:**
```
You are on siFia Transformation. You have unlimited playbooks! Generate as many as you need to support your spiritual journey.
```

---

### 2. **Devotionals Tooltip** 📖
**Tap the devotionals badge (e.g., "1/2")**

**For Trial Users:**
```
You are on siFia Spark Trial. You have 2 available tokens to generate devotionals and you have used 1.

After 3 days remaining, you will have 8 devotionals every month.
```

**For Paid Users:**
```
You are on siFia Spark. You have 8 devotionals available each month and you have used 3.

5 devotionals remaining this month.
```

**For Unlimited Users:**
```
You are on siFia Family. You have unlimited devotionals! Generate as many as you need for your daily spiritual growth.
```

---

### 3. **Faith Points Tooltip** ⭐
**Tap the faith points badge (e.g., "112 FP")**

```
You currently have 112 Faith Points and are at Level 2: Believer.

Faith Points are earned by:
• Completing playbook action steps
• Finishing devotionals
• Daily journaling
• Prayer activities
• Maintaining streaks

You need 188 more points to reach Level 3: Disciple.
```

---

### 4. **Badges Tooltip** 🏆
**Tap the badges badge (e.g., "5")**

```
You have earned 5 badges!

Badges are awarded for:
• Completing playbooks
• Maintaining prayer streaks
• Finishing devotional series
• Reaching faith point milestones
• Consistent journaling
• Special achievements

Keep growing in your spiritual journey to earn more badges!
```

---

## Implementation Details

### Files Created:
1. **`/src/components/profile/UsageTooltipModal.tsx`** (NEW)
   - Modal component for displaying tooltips
   - Dynamic content based on tooltip type
   - Trial-aware messaging with days remaining
   - Tier-specific information

### Files Modified:
2. **`/src/components/profile/ProfileHeader.tsx`**
   - Added `useState` for tooltip management
   - Made all usage pills touchable
   - Added `subscription` prop for tooltip data
   - Integrated `UsageTooltipModal` component

3. **`/src/screens/UserProfileScreen.tsx`**
   - Passed `subscription` prop to `ProfileHeader`

---

## Key Features

### ✅ **Trial-Aware Messaging**
- Shows current trial limits (2/2)
- Displays days remaining in trial
- Explains post-trial limits for chosen tier
- Example: "After 2 days remaining, you will have 20 playbooks every month"

### ✅ **Tier-Specific Information**
- **Spark**: 8/8 limits
- **Growth**: 20/20 limits
- **Transformation/Family**: Unlimited with special messaging

### ✅ **Dynamic Content**
- Calculates remaining tokens (limit - used)
- Proper singular/plural grammar ("1 playbook" vs "2 playbooks")
- Shows exact days remaining for trials
- Displays current level and next level requirements

### ✅ **User-Friendly Design**
- Clean modal with icon and title
- Easy-to-read descriptions
- "Got it!" button to close
- Tap outside to dismiss
- Smooth fade animation

---

## Tooltip Content Logic

### Trial Users:
```typescript
const daysRemaining = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));
const fullLimits = getFullTierLimits(trial_chosen_tier);

"After {daysRemaining} days remaining, you will have {fullLimits} every month."
```

### Paid Users:
```typescript
const remaining = limit - used;

"You have {limit} available each month and you have used {used}.
{remaining} remaining this month."
```

### Unlimited Users:
```typescript
"You have unlimited {resource}! Generate as many as you need..."
```

---

## Usage Examples

### Example 1: Growth Trial User
- **Subscription**: siFia Growth Trial
- **Limits**: 2/2 (trial limits)
- **Days Remaining**: 2 days
- **Post-Trial**: 20/20 (Growth tier limits)

**Playbooks Tooltip:**
```
You are on siFia Growth Trial. You have 2 available tokens to generate playbooks and you have used 0.

After 2 days remaining, you will have 20 playbooks every month.
```

### Example 2: Spark Paid User
- **Subscription**: siFia Spark
- **Limits**: 8/8
- **Used**: 3 playbooks, 5 devotionals

**Devotionals Tooltip:**
```
You are on siFia Spark. You have 8 devotionals available each month and you have used 5.

3 devotionals remaining this month.
```

### Example 3: Transformation User
- **Subscription**: siFia Transformation
- **Limits**: Unlimited

**Playbooks Tooltip:**
```
You are on siFia Transformation. You have unlimited playbooks! Generate as many as you need to support your spiritual journey.
```

---

## Faith Points Levels

| Level | Title | Points Required |
|-------|-------|----------------|
| 1 | Seeker | 0 |
| 2 | Believer | 100 |
| 3 | Disciple | 300 |
| 4 | Servant | 600 |
| 5 | Leader | 1,000 |
| 6 | Teacher | 1,500 |
| 7 | Mentor | 2,500 |
| 8 | Elder | 4,000 |
| 9 | Steward | 6,000 |
| 10 | Ambassador | 10,000 |

---

## Testing Checklist

### Playbooks Tooltip:
- [ ] Tap playbooks badge → Modal opens
- [ ] Trial user → Shows trial limits and post-trial info
- [ ] Paid user → Shows monthly limits and remaining
- [ ] Unlimited user → Shows unlimited message
- [ ] Tap "Got it!" → Modal closes
- [ ] Tap outside → Modal closes

### Devotionals Tooltip:
- [ ] Tap devotionals badge → Modal opens
- [ ] Shows correct tier-specific information
- [ ] Days remaining calculated correctly for trials
- [ ] Proper singular/plural grammar

### Faith Points Tooltip:
- [ ] Tap faith points badge → Modal opens
- [ ] Shows current points and level
- [ ] Lists ways to earn points
- [ ] Shows points needed for next level
- [ ] Max level (10) shows special message

### Badges Tooltip:
- [ ] Tap badges badge → Modal opens
- [ ] Shows correct badge count
- [ ] Lists ways to earn badges
- [ ] Encourages continued growth

---

## Status: ✅ COMPLETE

All tooltips are implemented and ready to use! Users can now tap any badge in their profile to see detailed, context-aware information about their usage, progress, and subscription benefits.

### Benefits:
- ✅ **User Education**: Clear explanations of all metrics
- ✅ **Trial Transparency**: Shows exactly what happens after trial
- ✅ **Motivation**: Encourages engagement with faith points and badges
- ✅ **Subscription Value**: Highlights tier benefits and limits
- ✅ **Professional UX**: Industry-standard tooltip pattern
