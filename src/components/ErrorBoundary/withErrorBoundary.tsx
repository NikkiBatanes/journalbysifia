/**
 * withErrorBoundary - HOC to wrap screens with error boundary
 * Makes it easy to add error handling to any screen component
 * Usage: export default withErrorBoundary(MyScreen, 'MyScreen');
 */

import React, { ComponentType } from 'react';
import ScreenErrorBoundary from './ScreenErrorBoundary';

export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  screenName: string
): ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ScreenErrorBoundary screenName={screenName}>
      <Component {...props} />
    </ScreenErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${screenName})`;

  return WrappedComponent;
}
