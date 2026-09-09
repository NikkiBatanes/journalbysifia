// src/components/ErrorBoundary/ErrorBoundary.tsx
// Comprehensive error boundary for React components

import React, { Component, ReactNode } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { ErrorBoundaryState, ErrorInfo } from '../../types/api';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
  name?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const enhancedErrorInfo: ErrorInfo = {
      componentStack: errorInfo.componentStack || '',
      errorBoundary: this.props.name || 'Unknown',
    };

    this.setState({
      error,
      errorInfo: enhancedErrorInfo,
    });

    // Call the onError callback if provided
    this.props.onError?.(error, enhancedErrorInfo);

    // Log error for debugging
    Logger.error('ErrorBoundary caught an error', error, {
        component: 'ErrorBoundary',
      componentStack: errorInfo.componentStack,
      boundaryName: this.props.name,
      level: this.props.level,
    });

    // Report to crash analytics (you can integrate with services like Sentry, Bugsnag, etc.)
    this.reportError(error, enhancedErrorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // Here you can integrate with error reporting services
    // Example: Sentry, Bugsnag, Firebase Crashlytics, etc.

    // For now, we'll just log it
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      boundaryName: this.props.name,
      level: this.props.level,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
    };

    // You can send this to your error reporting service
    Logger.error('Error Report', undefined, {
      component: 'ErrorBoundary',
      report: errorReport,
    });
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private renderDefaultFallback = (error: Error, errorInfo: ErrorInfo) => {
    const { level = 'component' } = this.props;

    return (
      <View style={[styles.container, styles[`${level}Container`]]}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {level === 'critical' ? '🚨 Critical Error' :
             level === 'page' ? '📄 Page Error' :
             '⚠️ Component Error'}
          </Text>

          <Text style={styles.message}>
            {level === 'critical'
              ? 'A critical error occurred. Please restart the app.'
              : level === 'page'
              ? 'This page encountered an error. You can try refreshing or go back.'
              : 'Something went wrong with this component.'
            }
          </Text>

          <Text style={styles.errorText}>
            {error.message}
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.handleRetry}
            >
              <Text style={styles.retryButtonText}>
                {level === 'page' ? 'Refresh Page' : 'Try Again'}
              </Text>
            </TouchableOpacity>
          </View>

          {__DEV__ && (
            <ScrollView style={styles.debugContainer}>
              <Text style={styles.debugTitle}>Debug Information:</Text>
              <Text style={styles.debugText}>
                Error: {error.message}
              </Text>
              <Text style={styles.debugText}>
                Stack: {error.stack}
              </Text>
              <Text style={styles.debugText}>
                Component Stack: {errorInfo.componentStack}
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    );
  };

  render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      // Use custom fallback if provided, otherwise use default
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error,
          this.state.errorInfo,
          this.handleRetry
        );
      }

      return this.renderDefaultFallback(this.state.error, this.state.errorInfo);
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  componentContainer: {
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    minHeight: 100,
  },
  pageContainer: {
    backgroundColor: Colors.hopeWhite,
    minHeight: 300,
  },
  criticalContainer: {
    backgroundColor: Colors.alertCoral,
    minHeight: 400,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.darkGray,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.alertCoral,
    textAlign: 'center',
    marginBottom: 24,
    padding: 12,
    backgroundColor: Colors.lightGray,
    borderRadius: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  retryButton: {
    backgroundColor: Colors.sage,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
  debugContainer: {
    marginTop: 24,
    maxHeight: 200,
    width: '100%',
    backgroundColor: Colors.darkGray,
    borderRadius: 4,
    padding: 12,
  },
  debugTitle: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontFamily: Fonts.bold,
    marginBottom: 8,
  },
  debugText: {
    color: Colors.lightGray,
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginBottom: 4,
  },
});

// Specialized error boundaries for different use cases
export const ComponentErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 'level'>> = (props) => (
  <ErrorBoundary {...props} level="component" />
);

export const PageErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 'level'>> = (props) => (
  <ErrorBoundary {...props} level="page" />
);

export const CriticalErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 'level'>> = (props) => (
  <ErrorBoundary {...props} level="critical" />
);
