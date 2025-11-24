import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { ErrorBoundary } from '../ErrorBoundary';

// Mock the ProductionLogger
jest.mock('../../../utils/ProductionLogger', () => ({
  Logger: {
    error: jest.fn(),
  },
}));

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const SafeComponent = () => (
    <View testID="safe-component">
      <Text>Safe Component</Text>
    </View>
  );

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe Component')).toBeTruthy();
  });

  it('has correct initial state', () => {
    const { getByTestId } = render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(getByTestId('safe-component')).toBeTruthy();
  });

  it('renders with custom level', () => {
    render(
      <ErrorBoundary level="page">
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe Component')).toBeTruthy();
  });

  it('renders with custom name', () => {
    render(
      <ErrorBoundary name="TestBoundary">
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe Component')).toBeTruthy();
  });

  it('renders with custom onError callback', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe Component')).toBeTruthy();
    expect(onError).not.toHaveBeenCalled();
  });

  it('renders with custom fallback', () => {
    const CustomFallback = ({ error: _error, errorInfo: _errorInfo, retry: _retry }: any) => (
      <View testID="custom-fallback">
        <Text>Custom Fallback</Text>
      </View>
    );

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe Component')).toBeTruthy();
  });
});

describe('ErrorBoundary Component Structure', () => {
  it('exports specialized components', () => {
    const { ComponentErrorBoundary, PageErrorBoundary, CriticalErrorBoundary } = require('../ErrorBoundary');

    expect(ComponentErrorBoundary).toBeDefined();
    expect(PageErrorBoundary).toBeDefined();
    expect(CriticalErrorBoundary).toBeDefined();
  });

  it('specialized components render children correctly', () => {
    const { ComponentErrorBoundary, PageErrorBoundary, CriticalErrorBoundary } = require('../ErrorBoundary');

    const SafeComponent = () => (
      <View testID="safe-component">
        <Text>Safe Component</Text>
      </View>
    );

    // Test ComponentErrorBoundary
    render(
      <ComponentErrorBoundary>
        <SafeComponent />
      </ComponentErrorBoundary>
    );
    expect(screen.getByText('Safe Component')).toBeTruthy();

    // Test PageErrorBoundary - render fresh
    render(
      <PageErrorBoundary>
        <SafeComponent />
      </PageErrorBoundary>
    );
    expect(screen.getByText('Safe Component')).toBeTruthy();

    // Test CriticalErrorBoundary - render fresh
    render(
      <CriticalErrorBoundary>
        <SafeComponent />
      </CriticalErrorBoundary>
    );
    expect(screen.getByText('Safe Component')).toBeTruthy();
  });
});

describe('ErrorBoundary Integration', () => {
  it('integrates with ProductionLogger', () => {
    const { Logger } = require('../../../utils/ProductionLogger');

    render(
      <ErrorBoundary name="TestBoundary">
        <View testID="test-component">
          <Text>Test Component</Text>
        </View>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test Component')).toBeTruthy();
    // Logger should not be called when there's no error
    expect(Logger.error).not.toHaveBeenCalled();
  });

  it('handles nested ErrorBoundaries', () => {
    const SafeComponent = () => (
      <View testID="nested-component">
        <Text>Nested Component</Text>
      </View>
    );

    render(
      <ErrorBoundary name="OuterBoundary">
        <ErrorBoundary name="InnerBoundary">
          <SafeComponent />
        </ErrorBoundary>
      </ErrorBoundary>
    );

    expect(screen.getByText('Nested Component')).toBeTruthy();
  });
});
