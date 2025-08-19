/**
 * Query Client Configuration
 */

import { createOptimizedQueryClient } from './queryClientConfigV2';

// Create the singleton query client instance
export const queryClient = createOptimizedQueryClient();

// Re-export from the new implementation
export * from './queryClientConfigV2';
export { createOptimizedQueryClient as default } from './queryClientConfigV2';
