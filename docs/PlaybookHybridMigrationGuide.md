# Playbook System Hybrid Migration Guide

## Overview

This guide documents the complete migration of the Playbook system from legacy Zustand-only state management to a hybrid React Query + Zustand architecture. The hybrid approach combines the best of both worlds:

- **React Query**: Server state management, caching, background sync, optimistic updates
- **Zustand**: Local state management, offline support, persistence

## Architecture Overview

### Before (Legacy)
```
Components → Zustand Store → Supabase API
```

### After (Hybrid)
```
Components → Hybrid Store (Zustand + React Query) → Supabase API
                ↓
         React Query Cache + Local Persistence
```

## Key Benefits

1. **Industry Standard**: Uses React Query for server state management
2. **Optimistic UI**: Immediate feedback with automatic rollback on errors
3. **Offline Support**: Tracks changes offline and syncs when online
4. **Better Performance**: Smart caching and background updates
5. **Developer Experience**: Better error handling, loading states, and debugging
6. **Type Safety**: Full TypeScript support throughout the stack

## Migration Phases

### Phase 1: Database Schema ✅ COMPLETE
- Created normalized database schema with separate tables
- Added Row Level Security (RLS) policies
- Implemented triggers for automatic progress calculation
- Added indexes for performance

### Phase 2: React Query Hooks ✅ COMPLETE
- Implemented `usePlaybooksData` for fetching all playbooks
- Implemented `usePlaybookData` for fetching single playbook
- Created mutation hooks for action steps, sub-tasks, and affirmations
- Added optimistic updates and error handling

### Phase 3: Component Migration ✅ COMPLETE
- Created React Query versions of PlaybookListScreen and PlaybookDetailScreen
- Maintained exact UI/UX, animations, and functionality
- Enhanced error and loading states

### Phase 4: Hybrid Store Integration ✅ COMPLETE
- Created `usePlaybookStoreReactQuery` hybrid store
- Integrated React Query data with Zustand local state
- Implemented offline change tracking and synchronization
- Added computed getters for derived state

### Phase 5: Hybrid Components 🎯 CURRENT
- Created `PlaybookListScreenHybrid` and `PlaybookDetailScreenHybrid`
- Integrated hybrid store with components
- Added sync status indicators
- Enhanced offline support

## File Structure

```
src/
├── services/
│   ├── hooks/
│   │   └── usePlaybookData.ts          # React Query hooks
│   ├── queryKeys.ts                    # Query key management
│   └── supabaseApi.ts                  # API functions
├── store/
│   ├── usePlaybookStore.ts             # Legacy Zustand store
│   └── usePlaybookStoreReactQuery.ts   # Hybrid store
├── screens/
│   ├── PlaybookListScreen.tsx          # Legacy component
│   ├── PlaybookDetailScreen.tsx        # Legacy component
│   ├── PlaybookListScreenReactQuery.tsx    # React Query version
│   ├── PlaybookDetailScreenReactQuery.tsx  # React Query version
│   ├── PlaybookListScreenHybrid.tsx    # Hybrid version
│   └── PlaybookDetailScreenHybrid.tsx  # Hybrid version
├── utils/
│   └── retry.ts                        # Retry configurations
└── tests/
    └── PlaybookHybridIntegration.test.ts   # Comprehensive tests
```

## Database Schema

### Tables Created
- `playbooks`: Main playbook data
- `playbook_action_steps`: Action steps with sub-tasks
- `playbook_sub_tasks`: Sub-tasks for action steps
- `playbook_affirmations`: Affirmations for playbooks

### Key Features
- **Normalized Structure**: Separate tables for better scalability
- **RLS Policies**: User-specific data access
- **Automatic Triggers**: Progress calculation and timestamps
- **Indexes**: Optimized query performance

## Hybrid Store API

### Core Methods

```typescript
const {
  // Data
  playbooks,
  selectedPlaybook,
  isLoading,
  error,
  
  // Filters & Sorting
  filterStatus,
  sortBy,
  setFilterStatus,
  setSortBy,
  
  // Actions
  setSelectedPlaybook,
  handleActionStepUpdate,
  handleSubTaskUpdate,
  handleAffirmationUpdate,
  
  // Computed
  getPlaybookProgress,
  
  // Offline Support
  offlineChanges,
  lastSyncTime,
  
  // Utilities
  refetch,
} = usePlaybookDataWithStore(userId);
```

### Key Features

1. **Automatic Data Sync**: React Query handles background updates
2. **Optimistic Updates**: Immediate UI feedback with rollback on error
3. **Offline Tracking**: Changes are tracked and synced when online
4. **Computed State**: Progress calculation and filtered data
5. **Persistence**: Local state persisted with AsyncStorage

## Component Integration

### PlaybookListScreenHybrid

```typescript
// Enhanced with sync status and offline support
const {
  playbooks,
  isLoading,
  error,
  filterStatus,
  setFilterStatus,
  offlineChanges,
  lastSyncTime,
  refetch,
} = usePlaybookDataWithStore(userId);

// Sync status indicator
const renderSyncStatus = () => {
  if (offlineChanges.length > 0) {
    return (
      <View style={styles.syncStatusContainer}>
        <Ionicons name="cloud-offline" size={16} color={Colors.alertCoral} />
        <Text>{offlineChanges.length} changes pending sync</Text>
      </View>
    );
  }
  // ... synced state
};
```

### PlaybookDetailScreenHybrid

```typescript
// Enhanced with optimistic updates and offline support
const {
  selectedPlaybook,
  handleActionStepUpdate,
  handleSubTaskUpdate,
  handleAffirmationUpdate,
  getPlaybookProgress,
  offlineChanges,
} = usePlaybookDataWithStore(userId);

// Optimistic action step update
const handleActionStepToggle = useCallback(async (stepId: string, completed: boolean) => {
  try {
    setIsSaving(true);
    await handleActionStepUpdate(playbook.id, stepId, completed);
  } catch (error) {
    // Error handling is done by the hybrid store
  } finally {
    setIsSaving(false);
  }
}, [handleActionStepUpdate]);
```

## Testing Strategy

### Test Coverage
- ✅ Hybrid store initialization
- ✅ Data loading from React Query
- ✅ Optimistic updates
- ✅ Error handling and rollback
- ✅ Offline change tracking
- ✅ Cache invalidation
- ✅ Progress calculation
- ✅ Persistence to AsyncStorage

### Running Tests
```bash
npm test PlaybookHybridIntegration.test.ts
```

## Migration Steps

### 1. Deploy Database Schema
```sql
-- Run the playbook_system_schema.sql file
\i database/playbook_system_schema.sql
```

### 2. Update Navigation
```typescript
// Replace legacy screens with hybrid versions
import PlaybookListScreenHybrid from '../screens/PlaybookListScreenHybrid';
import PlaybookDetailScreenHybrid from '../screens/PlaybookDetailScreenHybrid';

// In your navigator
<Stack.Screen 
  name="PlaybookList" 
  component={PlaybookListScreenHybrid} 
/>
<Stack.Screen 
  name="PlaybookDetail" 
  component={PlaybookDetailScreenHybrid} 
/>
```

### 3. Update Dependencies
```json
{
  "@tanstack/react-query": "^4.29.0",
  "zustand": "^4.3.8",
  "@react-native-async-storage/async-storage": "^1.19.0"
}
```

### 4. Remove Legacy Code (After Testing)
- Remove `usePlaybookStore.ts`
- Remove `PlaybookListScreen.tsx`
- Remove `PlaybookDetailScreen.tsx`
- Remove `ActionStepsContext.tsx` (if not used elsewhere)

## Performance Optimizations

### React Query Configuration
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Custom retry logic
        return failureCount < 3 && !error.message.includes('401');
      },
    },
  },
});
```

### Zustand Persistence
```typescript
const usePlaybookStoreReactQuery = create<PlaybookStoreState>()(
  persist(
    (set, get) => ({
      // Store implementation
    }),
    {
      name: 'playbook-store-react-query',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist necessary data
        offlineChanges: state.offlineChanges,
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
);
```

## Monitoring and Debugging

### React Query DevTools
```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Add to your app
<ReactQueryDevtools initialIsOpen={false} />
```

### Logging
```typescript
// Enhanced logging for debugging
console.log('[PlaybookHybrid] Action step updated:', {
  playbookId,
  stepId,
  completed,
  timestamp: new Date().toISOString(),
});
```

## Error Handling

### Network Errors
- Automatic retry with exponential backoff
- Offline change tracking
- User-friendly error messages

### Data Validation
- TypeScript type checking
- Runtime validation for API responses
- Graceful degradation for invalid data

### Recovery Strategies
- Automatic cache invalidation on errors
- Manual refresh capabilities
- Offline-first approach

## Future Enhancements

### Planned Features
1. **Real-time Sync**: WebSocket integration for live updates
2. **Conflict Resolution**: Handle concurrent edits
3. **Advanced Caching**: Implement more sophisticated cache strategies
4. **Analytics**: Track user engagement and performance metrics
5. **Backup & Restore**: Cloud backup for offline changes

### Performance Improvements
1. **Virtualization**: For large playbook lists
2. **Code Splitting**: Lazy load playbook components
3. **Image Optimization**: Optimize playbook images and assets
4. **Bundle Analysis**: Reduce bundle size

## Troubleshooting

### Common Issues

1. **Cache Not Updating**
   - Check query key structure
   - Verify cache invalidation logic
   - Ensure mutations are properly configured

2. **Offline Changes Not Syncing**
   - Check network connectivity
   - Verify AsyncStorage permissions
   - Review retry configuration

3. **Performance Issues**
   - Monitor query frequency
   - Check for unnecessary re-renders
   - Optimize component memoization

### Debug Commands
```typescript
// Clear React Query cache
queryClient.clear();

// Inspect cache
console.log(queryClient.getQueryCache().getAll());

// Check offline changes
console.log(usePlaybookStoreReactQuery.getState().offlineChanges);
```

## Conclusion

The hybrid Playbook system migration provides a robust, scalable, and maintainable solution that combines the best practices of modern React development. The implementation maintains all existing UI/UX while significantly improving data management, offline support, and developer experience.

The migration is designed to be incremental and safe, allowing for thorough testing at each phase before proceeding to the next. The comprehensive test suite ensures reliability and helps prevent regressions during the transition.

---

**Next Steps:**
1. Deploy the database schema to production
2. Test the hybrid components thoroughly
3. Update navigation to use hybrid screens
4. Monitor performance and user feedback
5. Remove legacy code after successful migration
