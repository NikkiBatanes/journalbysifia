/**
 * ScreenErrorBoundary - Enterprise-grade error boundary for screen-level error handling
 * Catches React errors and provides graceful fallback UI
 * Zero impact on existing functionality - pure safety layer
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { logger } from '../../utils/enterpriseLogger';

interface Props {
  children: ReactNode;
  screenName: string;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ScreenErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { screenName, onError } = this.props;

    // Log error with enterprise logger
    logger.error(
      `Screen Error: ${screenName}`,
      error,
      {
        screen: screenName,
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      }
    );

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallbackComponent, screenName } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallbackComponent) {
        return fallbackComponent;
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
          >
            <Text style={styles.emoji}>😔</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              We encountered an error in {screenName}.{'\n'}
              Don't worry, your data is safe.
            </Text>

            {__DEV__ && error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Error Details:</Text>
                <Text style={styles.errorText}>{error.toString()}</Text>
                {errorInfo && (
                  <Text style={styles.errorStack}>
                    {errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.button}
              onPress={this.handleReset}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.anchorBlue,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
  },
  errorDetails: {
    width: '100%',
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#856404',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#856404',
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: '#856404',
    opacity: 0.7,
  },
});

export default ScreenErrorBoundary;
