import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';

import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.alertCoral} />
      </View>

      <Text style={styles.title}>Something went wrong</Text>

      <Text style={styles.message}>
        {error.message || 'An unexpected error occurred while loading your reflection data.'}
      </Text>

      <TouchableOpacity
        style={styles.retryButton}
        onPress={resetErrorBoundary}
        activeOpacity={0.8}
      >
        <Ionicons name="refresh" size={20} color={Colors.hopeWhite} style={styles.retryIcon} />
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>

      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Info:</Text>
          <Text style={styles.debugText}>{error.stack}</Text>
        </View>
      )}
    </View>
  );
}

interface QueryErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}

export function QueryErrorBoundary({ children, fallback }: QueryErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={fallback || ErrorFallback}
      onError={(error: Error, errorInfo: any) => {
        // Log error to analytics/crash reporting
        console.error('Query Error Boundary caught an error:', error, errorInfo);

        // You can add crash reporting here
        // crashlytics().recordError(error);
      }}
      onReset={() => {
        // Optional: Clear any cached data or reset state

      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.hopeWhite,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: Fonts.medium,
  },
  message: {
    fontSize: 16,
    color: Colors.anchorBlue,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
    fontFamily: Fonts.regular,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.medium,
  },
  debugContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.anchorBlueLight,
    borderRadius: 8,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginBottom: 8,
    fontFamily: Fonts.medium,
  },
  debugText: {
    fontSize: 12,
    color: Colors.anchorBlue,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
