# 🛡️ Error Boundary Integration Guide

## Quick Start

### **Option 1: Wrap Individual Screens** (Recommended)

```typescript
// In your navigation stack (e.g., RootStackNavigator.tsx)
import OnboardingErrorBoundary from '../components/OnboardingErrorBoundary';

<Stack.Screen name="OnboardingPersonalization">
  {(props) => (
    <OnboardingErrorBoundary
      onReset={() => {
        props.navigation.reset({
          index: 0,
          routes: [{ name: 'OnboardingWelcome' }],
        });
      }}
    >
      <OnboardingPersonalizationScreen {...props} />
    </OnboardingErrorBoundary>
  )}
</Stack.Screen>
```

### **Option 2: Wrap Entire Onboarding Stack**

```typescript
// Wrap the entire onboarding navigator
const OnboardingNavigator = () => {
  return (
    <OnboardingErrorBoundary
      onReset={() => {
        // Reset to welcome screen
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'OnboardingWelcome' }],
        });
      }}
      fallbackMessage="We're having trouble with your onboarding. Let's start fresh."
    >
      <Stack.Navigator>
        <Stack.Screen name="OnboardingSplash" component={OnboardingSplashScreen} />
        <Stack.Screen name="OnboardingPersonalization" component={OnboardingPersonalizationScreen} />
        {/* ... other screens */}
      </Stack.Navigator>
    </OnboardingErrorBoundary>
  );
};
```

### **Option 3: Multiple Boundaries for Granular Control**

```typescript
// Different error boundaries for different sections
<Stack.Navigator>
  {/* Splash has its own boundary */}
  <Stack.Screen name="OnboardingSplash">
    {(props) => (
      <OnboardingErrorBoundary
        onReset={() => props.navigation.replace('OnboardingWelcome')}
        fallbackMessage="Having trouble loading. Let's try the welcome screen."
      >
        <OnboardingSplashScreen {...props} />
      </OnboardingErrorBoundary>
    )}
  </Stack.Screen>

  {/* Personalization has its own boundary */}
  <Stack.Screen name="OnboardingPersonalization">
    {(props) => (
      <OnboardingErrorBoundary
        onReset={() => props.navigation.goBack()}
        fallbackMessage="Let's go back and try again."
      >
        <OnboardingPersonalizationScreen {...props} />
      </OnboardingErrorBoundary>
    )}
  </Stack.Screen>

  {/* Generation has its own boundary */}
  <Stack.Screen name="OnboardingPlaybookGeneration">
    {(props) => (
      <OnboardingErrorBoundary
        onReset={() => props.navigation.replace('OnboardingPersonalization')}
        fallbackMessage="Playbook generation failed. Let's try again."
      >
        <OnboardingPlaybookGenerationScreen {...props} />
      </OnboardingErrorBoundary>
    )}
  </Stack.Screen>
</Stack.Navigator>
```

## 🎨 Custom Error Messages

```typescript
// Personalized messages for different screens
const errorMessages = {
  splash: "We're having trouble loading. This usually resolves quickly.",
  personalization: "Let's try that again. Your progress is saved.",
  generation: "Playbook generation hit a snag. We'll get it right this time.",
  ready: "Almost there! Let's reload your playbook.",
};

<OnboardingErrorBoundary
  fallbackMessage={errorMessages.personalization}
  onReset={handleReset}
>
  <OnboardingPersonalizationScreen />
</OnboardingErrorBoundary>
```

## 🔧 Advanced Usage

### **With Analytics Integration**

```typescript
// Extend the error boundary to send analytics
<OnboardingErrorBoundary
  onReset={() => {
    analytics.track('onboarding_error_recovery', {
      screen: 'personalization',
      action: 'user_retry',
    });
    navigation.reset({ index: 0, routes: [{ name: 'OnboardingWelcome' }] });
  }}
>
  <OnboardingPersonalizationScreen />
</OnboardingErrorBoundary>
```

### **With State Preservation**

```typescript
const [savedState, setSavedState] = useState(null);

<OnboardingErrorBoundary
  onReset={() => {
    // Restore saved state before resetting
    if (savedState) {
      restoreOnboardingState(savedState);
    }
    navigation.reset({ index: 0, routes: [{ name: 'OnboardingPersonalization' }] });
  }}
>
  <OnboardingPersonalizationScreen
    onStateChange={(state) => setSavedState(state)}
  />
</OnboardingErrorBoundary>
```

## 📊 Monitoring & Logging

### **Add to componentDidCatch**

Edit `OnboardingErrorBoundary.tsx`:

```typescript
componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
  // Existing logging
  console.error('[OnboardingErrorBoundary] Error caught:', error);
  
  // Add analytics
  analytics.trackError('onboarding_error', {
    error: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    errorCount: this.state.errorCount + 1,
    screen: this.props.screenName, // Add screenName prop
    userId: this.props.userId, // Add userId prop
  });
  
  // Add crash reporting (e.g., Sentry)
  Sentry.captureException(error, {
    contexts: {
      react: {
        componentStack: errorInfo.componentStack,
      },
    },
    tags: {
      screen: 'onboarding',
      errorCount: this.state.errorCount + 1,
    },
  });
}
```

## 🧪 Testing Error Boundaries

### **Manual Testing**

```typescript
// Add a test button to trigger errors (dev mode only)
{__DEV__ && (
  <TouchableOpacity
    onPress={() => {
      throw new Error('Test error for error boundary');
    }}
    style={styles.testButton}
  >
    <Text>Test Error Boundary</Text>
  </TouchableOpacity>
)}
```

### **Automated Testing**

```typescript
// Jest test example
import { render } from '@testing-library/react-native';
import OnboardingErrorBoundary from '../OnboardingErrorBoundary';

const ThrowError = () => {
  throw new Error('Test error');
};

test('error boundary catches errors and shows fallback', () => {
  const { getByText } = render(
    <OnboardingErrorBoundary>
      <ThrowError />
    </OnboardingErrorBoundary>
  );
  
  expect(getByText('Something went wrong')).toBeTruthy();
  expect(getByText('Try Again')).toBeTruthy();
});
```

## 🎯 Best Practices

1. **Use specific error messages** for each screen
2. **Provide clear recovery actions** (Try Again, Go Back, Restart)
3. **Track error patterns** with analytics
4. **Test error scenarios** regularly
5. **Monitor error rates** in production
6. **Update error messages** based on user feedback

## ⚠️ Common Pitfalls

### ❌ Don't Do This
```typescript
// Wrapping too high - loses context
<OnboardingErrorBoundary>
  <App />
</OnboardingErrorBoundary>
```

### ✅ Do This Instead
```typescript
// Wrap at appropriate levels
<App>
  <OnboardingErrorBoundary>
    <OnboardingFlow />
  </OnboardingErrorBoundary>
  <MainErrorBoundary>
    <MainApp />
  </MainErrorBoundary>
</App>
```

## 📱 Production Checklist

- [ ] Error boundaries added to all onboarding screens
- [ ] Custom error messages configured
- [ ] Analytics integration complete
- [ ] Crash reporting configured (Sentry/Bugsnag)
- [ ] Error recovery flows tested
- [ ] User-facing error messages reviewed
- [ ] Error rate monitoring dashboard setup
- [ ] Fallback UI matches app design system

## 🚀 Deployment

After integration:

1. **Test thoroughly** in development
2. **Deploy to staging** first
3. **Monitor error rates** closely
4. **Collect user feedback** on error messages
5. **Iterate on recovery flows** based on data

---

**Remember**: Error boundaries are your last line of defense. Use them wisely! 🛡️
