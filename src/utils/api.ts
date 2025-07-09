import { useAuth } from '../context/AuthContext';

// Example API wrapper using fetch
export const apiFetch = async (
  url: string,
  options: RequestInit = {},
  retry = true
): Promise<Response> => {
  // Access AuthContext (must be inside a React component or custom hook)
  // For non-hook usage, pass token explicitly or refactor to support context
  // Here, we assume you will wrap API calls in a custom hook
  throw new Error('apiFetch must be called from within a useApi hook');
};

// Custom hook for API usage with auth
export const useApi = () => {
  const {
    accessToken,
    refreshAuthToken,
    logout,
    refreshRetrying,
    loading,
  } = useAuth();

  // Authenticated fetch with 401/403 handling
  const authFetch = async (
    url: string,
    options: RequestInit = {},
    retry = true
  ): Promise<Response> => {
    const headers = {
      ...(options.headers || {}),
      Authorization: accessToken ? `Bearer ${accessToken}` : '',
    };
    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401 || response.status === 403) {
        // Try to refresh token and retry once
        if (retry && !refreshRetrying && !loading) {
          const refreshed = await refreshAuthToken();
          if (refreshed) {
            return authFetch(url, options, false);
          } else {
            // Only log out if refresh truly fails
            await logout();
          }
        }
      }
      return response;
    } catch (e) {
      // Network error: do not log out, just rethrow
      throw e;
    }
  };

  return { authFetch };
};
