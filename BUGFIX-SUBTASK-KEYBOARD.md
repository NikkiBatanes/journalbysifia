# Bug Fixes: Subtask Protection & Keyboard Animation

## Bug 1: Auto-Checked Subtasks Being Unmarked

### Problem
When a reflection was saved, the subtask was auto-checked. However, when another subtask was manually toggled, the previously auto-checked subtask would lose its checkmark.

### Root Cause
The `setActionSteps` function in `PlaybookDetailScreenNew.tsx` was calling the context's `setActionSteps` directly, which bypassed the protection system. The protected subtask Set was being maintained, but the state updates weren't preserving the protected flags.

### Solution
Implemented a **wrapper function** for `setActionSteps` that intercepts ALL state updates and preserves protected subtasks:

```typescript
const setActionSteps = useCallback((updater: React.SetStateAction<ActionStep[]>) => {
  setActionStepsInternal(prev => {
    const nextSteps = typeof updater === 'function' ? updater(prev) : updater;
    
    // Preserve protected subtasks in the new state
    return nextSteps.map(step => ({
      ...step,
      subTasks: step.subTasks?.map(subTask => {
        const isProtected = protectedSubtasks.current.has(subTask.id);
        if (isProtected) {
          return {
            ...subTask,
            completed: true,
            _protected: true,
          };
        }
        return subTask;
      }),
    }));
  });
}, []);
```

### How It Works
1. **Intercepts all updates**: Whether from `handleToggleStep`, `handleAutoCheckStep`, or direct `setActionSteps` calls
2. **Checks protection Set**: Looks up each subtask ID in `protectedSubtasks.current`
3. **Force-preserves state**: If protected, always sets `completed: true` and `_protected: true`
4. **Transparent to callers**: No changes needed in consuming code

## Bug 2: Keyboard Sliding Animation on Save

### Problem
When saving a reflection in the log editor, the keyboard would slide up then immediately slide down, creating a jarring animation.

### Root Cause
Multiple `Keyboard.dismiss()` calls with setTimeout delays were causing repeated keyboard animations:
- Initial dismiss on save
- Dismiss after 50ms
- Dismiss after 150ms  
- Dismiss after 300ms

### Solution
Simplified to **single keyboard dismissal** at key points:

```typescript
// Before (multiple dismissals)
Keyboard.dismiss();
setTimeout(() => Keyboard.dismiss(), 50);
setTimeout(() => Keyboard.dismiss(), 150);
setTimeout(() => Keyboard.dismiss(), 300);

// After (single dismissal)
Keyboard.dismiss();
```

### Changes Made
1. **Success modal callback**: Single dismiss, no delays
2. **Cancel handler**: Single dismiss
3. **Modal visibility effect**: Single dismiss when modal closes

## Files Modified
1. `/src/context/ActionStepsContext.tsx` - Added setActionSteps wrapper
2. `/src/screens/SmartJournalingReflectionModal.tsx` - Simplified keyboard dismissal

## Testing
✅ TypeScript compilation passes  
✅ Auto-checked subtasks remain checked  
✅ Manual toggles don't affect protected subtasks  
✅ Keyboard dismisses smoothly without animation  

## Impact
- **Zero breaking changes**: All existing functionality preserved
- **Performance**: Minimal overhead from protection check
- **UX**: Smooth keyboard dismissal, reliable subtask states
