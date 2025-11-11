# Playbook Issues Analysis & Solutions

## Issues Identified

### 1. ✅ FIXED: "Create a list" Journal Type
**Problem:** "Create a list" was classified as `none` instead of `reflection`
**Solution:** Updated rules in `persona.config.ts`
- Added rule: "Create a list" → reflection (creating/organizing requires thinking)
- Updated example: "Create a list of specific prayers" → reflection

---

### 2. 🔴 CRITICAL: Dynamic Name Not Updating in Playbooks

**Problem:** When user changes their name in profile, playbooks don't reflect the new name

**Root Cause:**
- Backend correctly stores `[User's Name]` placeholder ✅
- Utility function `replaceAllNamePlaceholders` exists in `/src/utils/nameReplacement.ts` ✅
- **BUT**: `PlaybookDetailScreenNew.tsx` does NOT use this utility ❌

**Current Code (lines 428-461):**
```typescript
return [
  {
    type: 'truth' as const,
    truth: playbook.truthInLove?.text ?? '',  // ❌ No name replacement
    summary: playbook.truthInLove?.summary ?? '',  // ❌ No name replacement
    tappable: false,
  },
  // ... other cards also missing name replacement
];
```

**Solution Required:**
1. Import `replaceAllNamePlaceholders` from `../utils/nameReplacement`
2. Get user's current name from auth context
3. Apply name replacement to:
   - `truthInLove.text`
   - `truthInLove.summary`
   - `directChallenge`
   - `affirmations[].text`
   - Any other text fields with `[User's Name]` placeholder

**Example Fix:**
```typescript
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { useAuth } from '../context/IndustryStandardAuthContext';

// In component:
const { user } = useAuth();

// In cardData useMemo:
{
  type: 'truth' as const,
  truth: replaceAllNamePlaceholders(
    playbook.truthInLove?.text ?? '',
    { firstName: user?.firstName, displayName: user?.displayName }
  ),
  summary: replaceAllNamePlaceholders(
    playbook.truthInLove?.summary ?? '',
    { firstName: user?.firstName, displayName: user?.displayName }
  ),
  tappable: false,
}
```

---

### 3. 🔴 ISSUE: "SPIRITUAL" and "TACTICAL" Labels in Rise in Faith Section

**Problem:** Challenge section shows "SPIRITUAL:" and "TACTICAL:" labels which may not look good

**Current Format (from persona.config.ts lines 341-347):**
```
CHALLENGE:
[TWO-PART CHALLENGE - BOTH REQUIRED]:

SPIRITUAL: [Specific prayer commitment, Scripture to meditate on, or worship act - with timing]

TACTICAL (48-72 hour deadline): [Concrete deliverable with metric or proof]
```

**Suggested Solutions:**

**Option A: Remove Labels, Use Icons/Visual Separation**
```
CHALLENGE:
[First part - prayer/Scripture with timing]

[Second part - concrete deliverable with deadline]
```

**Option B: Better Labels**
```
CHALLENGE:
Prayer Focus: [Specific prayer commitment with timing]

Action Item: [Concrete deliverable with metric]
```

**Option C: Single Unified Challenge**
```
CHALLENGE:
[Combine spiritual and tactical into one cohesive challenge without explicit labels]
Example: "This week, pray Psalm 139:23-24 daily at 6 AM, then complete your post-mortem by Friday and text your one-sentence pattern to your accountability partner by Saturday noon."
```

---

### 4. 🔴 ISSUE: Playbook Cards Missing Content (Appears After Refresh)

**Problem:** Sometimes playbook cards are incomplete on first load, but complete after refresh

**Possible Causes:**
1. **Race condition** - Data fetching not complete before render
2. **Cache issue** - React Query cache serving stale/incomplete data
3. **Parsing issue** - Backend parsing fails intermittently
4. **State update timing** - Component renders before all data is processed

**Investigation Needed:**
- Check `getPlaybook` API call in `apiIntegration.ts`
- Check React Query configuration in `PlaybookDetailScreenNew.tsx`
- Check if `useQuery` has proper `enabled` flag
- Add logging to track when data is incomplete

**Current Query (need to verify):**
```typescript
const { data: playbook, isLoading, error } = useQuery({
  queryKey: ['playbook', playbookId],
  queryFn: () => getPlaybook(playbookId),
  // Check if there's proper error handling and retry logic
});
```

**Recommended Fixes:**
1. Add `staleTime` and `cacheTime` to prevent stale data
2. Add `refetchOnMount: true` to ensure fresh data
3. Add loading skeleton until ALL data is present
4. Add validation to check if playbook data is complete before rendering

---

### 5. 🔴 ISSUE: Incomplete Bible Verses

**Problem:** Bible verses are truncated (e.g., "Matthew 28:19 Go therefore and make disciples of all nations..." missing rest)

**Root Cause:** Backend prompt may not be requesting full verse context

**Current Prompt (persona.config.ts):**
```
BIBLE VERSE:
"[Verse text]" - [Reference]
```

**No explicit instruction to include FULL verse or multiple verses**

**Solution:**
Update prompt to be more explicit:

```
BIBLE VERSE:
[CRITICAL: Provide the COMPLETE verse text, not truncated. If the verse is long, include the full text. If context is needed, include 2-4 verses.]

"[FULL verse text - do not truncate or use ellipsis]" - [Reference]

EXAMPLES:
✅ "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life." - John 3:16

❌ "For God so loved the world..." - John 3:16 (INCOMPLETE - DO NOT DO THIS)

✅ "Go therefore and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit, teaching them to observe all that I have commanded you. And behold, I am with you always, to the end of the age." - Matthew 28:19-20

❌ "Go therefore and make disciples of all nations..." - Matthew 28:19 (INCOMPLETE - DO NOT DO THIS)
```

---

## Priority Order

1. **HIGH**: Fix dynamic name replacement (Issue #2)
2. **HIGH**: Fix incomplete Bible verses (Issue #5)
3. **MEDIUM**: Investigate missing content on first load (Issue #4)
4. **MEDIUM**: Improve Challenge section layout (Issue #3)
5. **LOW**: Create a list journal type (Issue #1) - Already fixed

---

## Files to Modify

### For Issue #2 (Dynamic Names):
- `/src/screens/PlaybookDetailScreenNew.tsx` - Add name replacement

### For Issue #3 (Challenge Labels):
- `/supabase/functions/generate-playbook/persona.config.ts` - Update CHALLENGE format

### For Issue #5 (Bible Verses):
- `/supabase/functions/generate-playbook/persona.config.ts` - Add explicit full verse instructions
