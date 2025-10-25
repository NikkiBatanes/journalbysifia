/**
 * OnboardingErrorBoundary.tsx
 * Enterprise-grade error boundary for onboarding flow
 * Provides graceful error handling with fallback UI and recovery options
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import ThemedText from './common/ThemedText';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Sentry from '@sentry/react-native';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

class OnboardingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console for debugging
    console.error('[OnboardingErrorBoundary] Error caught:', error);
    console.error('[OnboardingErrorBoundary] Error info:', errorInfo);

    // Update state with error details
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Send error to Sentry
    try {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          screen: 'onboarding',
          errorCount: String(this.state.errorCount + 1),
        },
        level: 'error',
      });
    } catch (trackingError) {
      console.error('[OnboardingErrorBoundary] Failed to track error:', trackingError);
    }
  }

  handleReset = (): void => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call custom reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = (): void => {
    // Force app reload (React Native specific)
    // In production, this would trigger a full app restart
    console.log('[OnboardingErrorBoundary] Reloading app...');

    // Reset error state first
    this.handleReset();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo, errorCount } = this.state;
      const { fallbackMessage } = this.props;

      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Error Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle" size={80} color={Colors.alertCoral} />
            </View>

            {/* Error Title */}
            <ThemedText weight="bold" style={styles.title}>
              Something went wrong
            </ThemedText>

            {/* Error Message */}
            <ThemedText style={styles.message}>
              {fallbackMessage ||
                "We encountered an unexpected error during your onboarding. Don't worry, your progress is saved."}
            </ThemedText>

            {/* Error Count Warning */}
            {errorCount > 2 && (
              <View style={styles.warningContainer}>
                <Ionicons name="warning" size={20} color={Colors.alertCoral} />
                <ThemedText style={styles.warningText}>
                  Multiple errors detected. Please try restarting the app.
                </ThemedText>
              </View>
            )}

            {/* Technical Details (Collapsible in production) */}
            {__DEV__ && error && (
              <View style={styles.technicalDetails}>
                <ThemedText weight="semiBold" style={styles.technicalTitle}>
                  Technical Details (Dev Mode):
                </ThemedText>
                <View style={styles.errorBox}>
                  <ThemedText style={styles.errorText}>
                    {error.toString()}
                  </ThemedText>
                  {error.stack && (
                    <ThemedText style={styles.stackText}>
                      {error.stack.substring(0, 500)}...
                    </ThemedText>
                  )}
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {/* Try Again Button */}
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={this.handleReset}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={20} color={Colors.hopeWhite} />
                <ThemedText weight="semiBold" style={styles.buttonText}>
                  Try Again
                </ThemedText>
              </TouchableOpacity>

              {/* Reload App Button (if multiple errors) */}
              {errorCount > 1 && (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={this.handleReload}
                  activeOpacity={0.8}
                >
                  <Ionicons name="reload" size={20} color={Colors.anchorBlue} />
                  <ThemedText weight="semiBold" style={styles.secondaryButtonText}>
                    Restart App
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* Help Text */}
            <ThemedText style={styles.helpText}>
              If this problem persists, please contact support.
            </ThemedText>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 24,
    marginBottom: 24,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: Colors.alertCoral,
    lineHeight: 20,
  },
  technicalDetails: {
    width: '100%',
    marginBottom: 24,
  },
  technicalTitle: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
    opacity: 0.7,
  },
  errorBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  errorText: {
    fontSize: 12,
    color: Colors.alertCoral,
    marginBottom: 8,
  },
  stackText: {
    fontSize: 10,
    color: Colors.hopeWhite,
    opacity: 0.6,
    fontFamily: 'Courier',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: Colors.alertCoral,
  },
  secondaryButton: {
    backgroundColor: Colors.hopeWhite,
  },
  buttonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.anchorBlue,
  },
  helpText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    opacity: 0.6,
  },
});

export default OnboardingErrorBoundary;
