import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { authErrorHandler } from '../utils/authErrorHandler';

export interface OperationState {
  isLoading: boolean;
  error: string | null;
  progress?: number;
}

export interface OperationOptions {
  operationName: string;
  showUserFeedback?: boolean;
  timeoutMs?: number;
  onAuthRequired?: () => void;
}

/**
 * Enterprise-grade hook for managing operation states with auth recovery
 * Prevents stuck loading states and provides user feedback
 */
export const useOperationState = () => {
  const [operations, setOperations] = useState<Map<string, OperationState>>(new Map());
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Handle operation timeout
  const handleOperationTimeout = useCallback((
    operationId: string,
    options: OperationOptions
  ) => {
    console.warn(`⏰ Operation timed out: ${operationId}`);

    setOperations(prev => {
      const newMap = new Map(prev);
      newMap.delete(operationId);
      return newMap;
    });

    if (options.showUserFeedback !== false) {
      Alert.alert(
        '⏰ Operation Timeout',
        `${options.operationName} is taking longer than expected. This might be due to a network issue or you may have been logged out.`,
        [
          {
            text: 'Cancel',
            style: 'cancel' as const,
          },
          {
            text: 'Check Connection',
            onPress: () => {
              // Could trigger a connectivity check or auth validation
              if (options.onAuthRequired) {
                options.onAuthRequired();
              }
            },
            style: 'default' as const,
          },
        ],
        { cancelable: false }
      );
    }
  }, []);

  // Start an operation
  const startOperation = useCallback((
    operationId: string,
    options: OperationOptions
  ) => {
    console.log(`🚀 Starting operation: ${operationId} (${options.operationName})`);

    setOperations(prev => new Map(prev.set(operationId, {
      isLoading: true,
      error: null,
      progress: 0,
    })));

    // Set timeout to prevent stuck loading states
    const timeoutMs = options.timeoutMs || 30000; // 30 seconds default
    const timeoutId = setTimeout(() => {
      console.warn(`⏰ Operation timeout: ${operationId}`);
      handleOperationTimeout(operationId, options);
    }, timeoutMs);

    timeoutRefs.current.set(operationId, timeoutId);
  }, [handleOperationTimeout]);

  // Update operation progress
  const updateProgress = useCallback((
    operationId: string,
    progress: number,
    message?: string
  ) => {
    setOperations(prev => {
      const current = prev.get(operationId);
      if (!current) {return prev;}

      return new Map(prev.set(operationId, {
        ...current,
        progress,
        error: message || current.error,
      }));
    });
  }, []);

  // Complete an operation successfully
  const completeOperation = useCallback((
    operationId: string,
    result?: any
  ) => {
    console.log(`✅ Operation completed: ${operationId}`);

    // Clear timeout
    const timeoutId = timeoutRefs.current.get(operationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(operationId);
    }

    setOperations(prev => {
      const newMap = new Map(prev);
      newMap.delete(operationId);
      return newMap;
    });

    return result;
  }, []);

  // Fail an operation with error handling
  const failOperation = useCallback(async (
    operationId: string,
    error: any,
    options: OperationOptions
  ) => {
    console.error(`❌ Operation failed: ${operationId}`, error);

    // Clear timeout
    const timeoutId = timeoutRefs.current.get(operationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(operationId);
    }

    // Handle the error with auth recovery
    const result = await authErrorHandler.handleApiError(error, {
      operationName: options.operationName,
      showUserFeedback: options.showUserFeedback,
      onAuthRequired: options.onAuthRequired,
    });

    setOperations(prev => {
      if (result.shouldRetry) {
        // Keep loading state for retry
        return prev;
      }

      // Remove operation or set error state
      const newMap = new Map(prev);
      if (result.handled) {
        newMap.delete(operationId);
      } else {
        const current = prev.get(operationId);
        if (current) {
          newMap.set(operationId, {
            ...current,
            isLoading: false,
            error: error.message || 'Operation failed',
          });
        }
      }
      return newMap;
    });

    return result;
  }, []);

  // Execute operation with full error handling and state management
  const executeOperation = useCallback(async <T>(
    operationId: string,
    operation: () => Promise<T>,
    options: OperationOptions
  ): Promise<T | null> => {
    try {
      startOperation(operationId, options);

      const result = await operation();

      return completeOperation(operationId, result);
    } catch (error) {
      const errorResult = await failOperation(operationId, error, options);

      if (errorResult.shouldRetry) {
        // Retry the operation
        console.log(`🔄 Retrying operation: ${operationId}`);
        return executeOperation(operationId, operation, options);
      }

      return null;
    }
  }, [startOperation, completeOperation, failOperation]);

  // Get operation state
  const getOperationState = useCallback((operationId: string): OperationState | null => {
    return operations.get(operationId) || null;
  }, [operations]);

  // Check if any operations are loading
  const hasLoadingOperations = useCallback((): boolean => {
    return Array.from(operations.values()).some(op => op.isLoading);
  }, [operations]);

  // Clear all operations (useful for logout)
  const clearAllOperations = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRefs.current.clear();

    setOperations(new Map());
  }, []);

  return {
    executeOperation,
    startOperation,
    updateProgress,
    completeOperation,
    failOperation,
    getOperationState,
    hasLoadingOperations,
    clearAllOperations,
    operations: Array.from(operations.entries()).map(([id, state]) => ({ id, ...state })),
  };
};

export default useOperationState;
