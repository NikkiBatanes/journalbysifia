import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { Logger } from '../utils/ProductionLogger';

interface Props {
  children: ReactNode;
  name?: string;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class NetworkErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Check if it's a network-related error
    const isNetworkError = error.message.includes('RCTBlobManager') ||
                          error.message.includes('suggestedFilename') ||
                          error.message.includes('UTType') ||
                          error.message.includes('CoreServices');

    if (isNetworkError) {
      Logger.error('NetworkErrorBoundary: Caught network-related error', error, {
        component: 'Unknown',
        isNetworkError: true,
      });
      return { hasError: true, error, errorInfo: null };
    }

    // Let other errors propagate to parent error boundaries
    return { hasError: false, error: null, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isNetworkError = error.message.includes('RCTBlobManager') ||
                          error.message.includes('suggestedFilename') ||
                          error.message.includes('UTType') ||
                          error.message.includes('CoreServices');

    Logger.error('NetworkErrorBoundary: Error caught', error, {
      component: this.props.name || 'Unknown',
      errorInfo,
      isNetworkError,
    });

    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Network Error</Text>
            <Text style={styles.message}>
              A network-related error occurred. This has been logged and will be fixed in a future update.
            </Text>
            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
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
    backgroundColor: Colors.hopeWhite,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  button: {
    backgroundColor: Colors.sage,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
