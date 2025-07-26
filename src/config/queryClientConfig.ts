/**
 * DEPRECATED: Legacy Query Client Configuration
 *
 * This file has been replaced by queryClientConfigV2.ts which provides:
 * - React Query v5 compatibility
 * - Enhanced performance monitoring
 * - Background sync capabilities
 * - Better TypeScript support
 * - Network-aware operations
 *
 * Please use queryClientConfigV2.ts for all new implementations.
 * This file is kept for reference only and will be removed in a future version.
 */

// Re-export from the new configuration
export * from './queryClientConfigV2';

// Legacy export for backward compatibility
export { createOptimizedQueryClient as createQueryClient } from './queryClientConfigV2';
