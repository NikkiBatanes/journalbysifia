import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { useAuth } from '../hooks/useAuth';
// import { trialAccessService } from '../services/trialAccessService';

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

interface TrialContextType {
  isTrialSystemReady: boolean;
  refreshTrialStatus: () => void;
}

const TrialContext = createContext<TrialContextType>({
  isTrialSystemReady: false,
  refreshTrialStatus: () => {},
});

export const useTrialContext = () => useContext(TrialContext);

interface TrialProviderProps {
  children: React.ReactNode;
}

export const TrialProvider: React.FC<TrialProviderProps> = ({ children }) => {
  const [isTrialSystemReady, setIsTrialSystemReady] = useState(false);

  // Handle app state changes to refresh trial status
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Refresh trial status when app becomes active
        queryClient.invalidateQueries({ queryKey: ['trial-status'] });
        queryClient.invalidateQueries({ queryKey: ['feature-access'] });
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Mark trial system as ready
    setIsTrialSystemReady(true);

    return () => subscription?.remove();
  }, []);

  const refreshTrialStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['trial-status'] });
    queryClient.invalidateQueries({ queryKey: ['feature-access'] });
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TrialContext.Provider value={{ isTrialSystemReady, refreshTrialStatus }}>
        {children}
      </TrialContext.Provider>
    </QueryClientProvider>
  );
};

// HOC for components that need trial access
export const withTrialAccess = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return (props: P) => {
    const { isTrialSystemReady } = useTrialContext();

    if (!isTrialSystemReady) {
      return null; // or loading spinner
    }

    return <Component {...props} />;
  };
};
