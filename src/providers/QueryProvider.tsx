import { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createOptimizedQueryClient } from '../config/queryClientConfig';

// Create optimized query client with performance monitoring
const queryClient = createOptimizedQueryClient();

interface QueryProviderProps {
  children: ReactNode;
}

export const QueryProvider = ({ children }: QueryProviderProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Note: ReactQueryDevtools is not compatible with React Native */}
      {/* For debugging, use React Query DevTools browser extension or Flipper */}
    </QueryClientProvider>
  );
};

// Export the query client for use in other parts of the app
export { queryClient };
