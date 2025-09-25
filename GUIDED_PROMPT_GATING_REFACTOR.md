# Guided Prompt Gating Refactor Plan

## Current Problems
1. **Duplicate Logic**: Same random generation code exists in 3+ places
2. **Inconsistent Seeds**: Different components use different seed strings
3. **No Single Source of Truth**: Dashboard and hook manage separate prompt lists
4. **Confusing API**: `isPromptFree` vs `canUsePrompt` overlap
5. **Race Conditions**: Components don't coordinate state updates

## Proposed Solution: Centralized Gating Service

### 1. Create Single Gating Service
```typescript
// src/services/guidedPromptGatingService.ts
class GuidedPromptGatingService {
  private static instance: GuidedPromptGatingService;
  
  // Single method to get daily prompt allocation for user
  getDailyPrompts(userId: string, tier: SubscriptionTier): {
    freePrompts: string[];
    lockedPrompts: string[];
    allPrompts: string[];
  }
  
  // Single method to check if user can use a specific prompt
  canUsePrompt(userId: string, tier: SubscriptionTier, prompt: string, completedPrompts: string[]): boolean
  
  // Single random generation with consistent seed
  private generateDeterministicPrompts(userId: string, seedSuffix: string, count: number): string[]
}
```

### 2. Simplify Hook API
```typescript
// src/hooks/useGuidedPromptGating.ts
export function useGuidedPromptGating() {
  return {
    // Clear, single-purpose methods
    freePrompts: string[];
    lockedPrompts: string[];
    canUsePrompt: (prompt: string) => boolean;
    markPromptUsed: (prompt: string) => Promise<void>;
    
    // Remove confusing duplicates
    // ❌ isPromptFree (redundant with canUsePrompt)
    // ❌ availablePrompts (unclear what "available" means)
  }
}
```

### 3. Update Dashboard to Use Hook
```typescript
// src/components/dashboard/ReflectionQuestionsCard.tsx
const guidedPromptGating = useGuidedPromptGating();

// ❌ Remove 70+ lines of duplicate logic (lines 308-376)
// ✅ Use hook's freePrompts and lockedPrompts directly
const guidedQuestions = [
  ...guidedPromptGating.freePrompts.map(prompt => ({ prompt, isFree: true })),
  ...guidedPromptGating.lockedPrompts.map(prompt => ({ prompt, isFree: false }))
];
```

### 4. Consistent Storage Keys
```typescript
// Single storage key pattern
const STORAGE_KEYS = {
  completedPrompts: (date: string) => `@guided_completed_${date}`,
  // Remove redundant keys like @guided_prompts_used_${date}
};
```

### 5. Clear Component Responsibilities
- **Service**: All gating logic, random generation, storage
- **Hook**: React state management, async operations
- **Dashboard**: UI rendering only
- **Editor**: Prompt selection and usage tracking

## Implementation Steps
1. Create centralized service with single random generation
2. Refactor hook to use service, remove duplicate methods
3. Update dashboard to use hook instead of custom logic
4. Update editor to use simplified hook API
5. Remove duplicate utility functions
6. Add comprehensive tests for service

## Benefits
- ✅ Single source of truth for all gating logic
- ✅ Consistent behavior across all components
- ✅ Easier to test and debug
- ✅ Clear separation of concerns
- ✅ No more race conditions or state sync issues
