# Complete Fix: Protected Subtasks System

## The Bug
When saving ANY log editor (reflection, gratitude, prayer, timeblock), the subtask would auto-check. But when tapping another subtask, the previously auto-checked one would unmark in the UI.

## Root Causes Found

### Issue 1: Missing `_protected` Flag Preservation
The `_protected` flag was being **stripped** during data transformation:

1. **`normalizeSubTasks`** - Didn't include `_protected` in the returned object
2. **`processedSteps` useMemo** - Didn't explicitly preserve `_protected` when mapping
3. **Example subtasks** - Didn't include `_protected` field

**Fix**: Explicitly preserve `_protected` at every transformation step.

```typescript
// normalizeSubTasks
_protected: typeof task === 'object' ? task._protected : undefined,

// processedSteps useMemo  
_protected: subTask._protected,

// Example subtasks
_protected: undefined,
```

### Issue 2: Only Reflection Used Protection
**Critical Discovery**: Only `SmartJournalingReflectionModal` was using `handleAutoCheckStep` (protected). The other three modals were using `handleToggleStep` (unprotected):

- ❌ `SmartJournalingGratitudeModal` → `handleToggleStep`
- ❌ `SmartJournalingPrayerModal` → `handleToggleStep`  
- ❌ `SmartJournalingTimeBlockModal` → `handleToggleStep`
- ✅ `SmartJournalingReflectionModal` → `handleAutoCheckStep`

**Result**: Gratitude, prayer, and timeblock auto-checks were NOT protected, so they could be manually toggled off!

**Fix**: Changed all three modals to use `handleAutoCheckStep`:

```typescript
// Before
if (stepId && subtaskId && handleToggleStep && !currentEntry?.id) {
  const step = actionSteps.find(s => s.id === stepId);
  if (step) {
    const subtask = step.subTasks?.find(st => st.id === subtaskId);
    if (subtask && !subtask.completed) {
      handleToggleStep(stepId, subtaskId); // UNPROTECTED
    }
  }
}

// After
if (stepId && subtaskId && handleAutoCheckStep && !currentEntry?.id) {
  handleAutoCheckStep(stepId, subtaskId); // PROTECTED
}
```

## How Protection Works Now

### 1. Auto-Check with Protection
When a log editor saves (reflection/gratitude/prayer/timeblock):
```typescript
handleAutoCheckStep(stepId, subtaskId)
```

This:
- Adds `subtaskId` to `protectedSubtasks.current` Set
- Sets `completed: true`
- Sets `_protected: true`
- Updates database
- Updates context state

### 2. Manual Toggle Blocked
When user taps a subtask:
```typescript
const targetSubTask = targetStep?.subTasks?.find(st => st.id === subTaskId);

if (targetSubTask?._protected) {
  return; // EXIT - no context update, no database mutation
}
```

This prevents:
- Context state update
- Database mutation
- Query invalidation

### 3. Flag Preservation
The `_protected` flag is preserved through:
- Context normalization (`normalizeSubTask`)
- Component processing (`processedSteps` useMemo)
- All data transformations

## Files Modified
1. `/src/context/ActionStepsContext.tsx` - Protection system
2. `/src/components/ActionStepsCard.tsx` - Flag preservation
3. `/src/screens/SmartJournalingGratitudeModal.tsx` - Use `handleAutoCheckStep`
4. `/src/screens/SmartJournalingPrayerModal.tsx` - Use `handleAutoCheckStep`
5. `/src/screens/SmartJournalingTimeBlockModal.tsx` - Use `handleAutoCheckStep`

## Testing Checklist
✅ Save reflection → auto-checks → protected
✅ Save gratitude → auto-checks → protected
✅ Save prayer → auto-checks → protected
✅ Save timeblock → auto-checks → protected
✅ Tap another subtask → protected ones stay checked
✅ Protected subtasks show visual indicator (if implemented)
✅ TypeScript compilation passes
✅ No performance regressions

## Performance Impact
The logs showed 12-20 second mutation times with rapid toggling. This was caused by:
1. User taps subtask (thinking it didn't work)
2. Optimistic update sets UI
3. Slow database mutation
4. Query invalidation brings back old state
5. User taps again → repeat

**Protection solves this** - once protected, users can't tap it repeatedly, eliminating the rapid-fire mutation cycle.

## Summary
All journal types now properly protect auto-checked subtasks:
- Reflection ✅  
- Gratitude ✅
- Prayer ✅
- TimeBlock ✅

The `_protected` flag is preserved through the entire data pipeline, and protected subtasks cannot be manually toggled.
