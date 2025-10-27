import { useAuth } from '../context/IndustryStandardAuthContext';
import { Logger } from '../utils/ProductionLogger';
import { authErrorHandler, AuthErrorHandlerOptions } from './authErrorHandler';
import { useCallback, useRef } from 'react';

// Enhanced API wrapper with authentication recovery
export const useApi = () => {
  const {
    session,
    signOut,
    loading,
  } = useAuth();

  const retryCountRef = useRef<Map<string, number>>(new Map());

  // Authenticated fetch with comprehensive error handling
  const authFetch = useCallback(async (
    url: string,
    options: RequestInit = {},
    errorHandlerOptions: AuthErrorHandlerOptions = {}
  ): Promise<Response> => {
    const operationId = `${options.method || 'GET'}_${url}`;
    const maxRetries = errorHandlerOptions.retryAttempts || 2;
    const currentRetries = retryCountRef.current.get(operationId) || 0;

    try {
      // Check if we have a valid session
      if (!session?.access_token) {
        Logger.warn('⚠️ No authentication token available', { component: 'api' });

        const result = await authErrorHandler.handleApiError(
          { status: 401, message: 'No authentication token' },
          {
            ...errorHandlerOptions,
            operationName: errorHandlerOptions.operationName || 'API request',
            onAuthRequired: () => signOut(),
          }
        );

        if (!result.handled) {
          throw new Error('Authentication required');
        }

        return new Response(null, { status: 401 });
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Reset retry count on successful request
      if (response.ok) {
        retryCountRef.current.delete(operationId);
        return response;
      }

      // Handle error responses
      Logger.warn(`⚠️ API request failed: ${response.status} ${response.statusText}`, {
        component: 'api',
      });

      const errorData = await response.text().catch(() => 'Unknown error');
      const error = {
        status: response.status,
        statusText: response.statusText,
        message: errorData,
        url,
      };

      const result = await authErrorHandler.handleApiError(error, {
        ...errorHandlerOptions,
        retryAttempts: maxRetries - currentRetries,
        operationName: errorHandlerOptions.operationName || `API request to ${url}`,
        onAuthRequired: () => signOut(),
      });

      if (result.shouldRetry && currentRetries < maxRetries) {

        retryCountRef.current.set(operationId, currentRetries + 1);

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, currentRetries) * 1000));

        return authFetch(url, options, errorHandlerOptions);
      }

      // No retry or max retries reached
      retryCountRef.current.delete(operationId);

      if (!result.handled) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return response;

    } catch (networkError: any) {
      Logger.error(`💥 Network error for ${operationId}:`, {
        component: 'api',
        data: networkError,
      });

      const result = await authErrorHandler.handleApiError(networkError, {
        ...errorHandlerOptions,
        retryAttempts: maxRetries - currentRetries,
        operationName: errorHandlerOptions.operationName || `API request to ${url}`,
        onAuthRequired: () => signOut(),
      });

      if (result.shouldRetry && currentRetries < maxRetries) {

        retryCountRef.current.set(operationId, currentRetries + 1);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, currentRetries) * 1000));

        return authFetch(url, options, errorHandlerOptions);
      }

      retryCountRef.current.delete(operationId);

      if (!result.handled) {
        throw networkError;
      }

      // Return a failed response instead of throwing
      return new Response(null, { status: 500, statusText: 'Network Error' });
    }
  }, [session, signOut]);

  // Simplified fetch for non-authenticated requests
  const simpleFetch = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }, []);

  return {
    authFetch,
    simpleFetch,
    isAuthenticated: !!session,
    loading,
    session,
  };
};
