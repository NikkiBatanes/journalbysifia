# Sentry Error Monitoring Setup

## 📊 Overview

Sentry provides real-time error monitoring and performance tracking for the siFia application. This setup ensures production issues are caught and resolved quickly.

---

## 🔧 Configuration

### **Environment Variables**

Add these to your `.env` file:

```bash
# Sentry Error Monitoring Configuration
SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
SENTRY_ORG=your-sentry-organization
SENTRY_PROJECT=siFia
```

### **Required GitHub Secrets**

Add these secrets to your GitHub repository:

```bash
SENTRY_AUTH_TOKEN    # Sentry authentication token
SENTRY_ORG          # Sentry organization slug
SENTRY_PROJECT      # Sentry project slug
```

---

## 🚀 Features

### **Error Tracking**
- ✅ **Automatic Crash Detection** - Native and JavaScript errors
- ✅ **Stack Trace Collection** - Detailed error context
- ✅ **User Context** - Track errors per user
- ✅ **Session Tracking** - User session health

### **Performance Monitoring**
- ✅ **Transaction Tracking** - API calls and user interactions
- ✅ **Slow Operations** - Performance bottleneck detection
- ✅ **Release Health** - Compare app versions
- ✅ **Source Maps** - Debug minified code

### **Security Features**
- ✅ **PII Filtering** - Remove sensitive data
- ✅ **Error Filtering** - Ignore common issues
- ✅ **Environment Isolation** - Separate dev/prod data

---

## 📱 Integration Points

### **App Initialization**
```typescript
// App.tsx
import { initializeSentry } from './src/config/sentry';

// Initialize Sentry before app starts
initializeSentry();
```

### **User Context**
```typescript
// When user logs in
import { setSentryUser } from './src/config/sentry';

setSentryUser(userId, email);
```

### **Manual Error Reporting**
```typescript
import { captureSentryException } from './src/config/sentry';

try {
  // Your code here
} catch (error) {
  captureSentryException(error, { 
    component: 'UserProfile',
    action: 'updateProfile' 
  });
}
```

### **Performance Tracking**
```typescript
import { startSentrySpan } from './src/config/sentry';

// Track API calls
startSentrySpan('api-call', 'http.client', async () => {
  const response = await fetch('/api/user');
  return response.json();
});
```

---

## 📊 Dashboard Setup

### **Key Metrics to Monitor**

#### **Error Rate**
- Monitor error frequency over time
- Set alerts for error spikes
- Track error resolution time

#### **Performance**
- App startup time
- API response times
- User interaction delays

#### **Release Health**
- Compare error rates between versions
- Track adoption of new releases
- Monitor crash-free users

#### **User Impact**
- Most affected users
- Error frequency per user
- Session health metrics

---

## 🔍 Troubleshooting

### **Common Issues**

#### **Sentry Not Receiving Errors**
```bash
# Check environment variables
echo $SENTRY_DSN

# Verify DSN format
# Should be: https://[public-key]@[sentry-domain]/[project-id]
```

#### **Source Maps Not Working**
```bash
# Ensure source maps are uploaded
# Check CI/CD pipeline logs
# Verify Sentry release creation
```

#### **Too Many Errors**
```bash
# Review ignoreErrors configuration
# Add error filtering rules
# Implement better error boundaries
```

#### **Performance Data Missing**
```bash
# Check tracesSampleRate setting
# Verify transaction instrumentation
# Review span configuration
```

---

## 📈 Best Practices

### **Error Handling**
```typescript
// Use error boundaries
import ErrorBoundary from './src/components/ErrorBoundary';

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// Log meaningful errors
captureSentryException(error, {
  userId: user.id,
  feature: 'playbook-generation',
  context: 'ai-service-call'
});
```

### **Performance Monitoring**
```typescript
// Track key user flows
startSentrySpan('playbook-generation', 'ui.action', async () => {
  await generatePlaybook();
});

// Monitor API performance
startSentrySpan('api-request', 'http.client', async () => {
  return apiClient.post('/playbooks', data);
});
```

### **User Context**
```typescript
// Set rich user context
setSentryUser(userId, email);

// Add custom breadcrumbs
addSentryBreadcrumb('User logged in', 'auth', {
  method: 'email',
  timestamp: Date.now()
});
```

---

## 🔔 Alerting Setup

### **Recommended Alerts**

#### **Critical Errors**
- App crash rate > 1%
- Login failures > 5%
- Payment errors > 2%

#### **Performance Issues**
- API response time > 3 seconds
- App startup time > 5 seconds
- Database query time > 1 second

#### **Release Issues**
- New version error rate increase > 20%
- Crash-free users < 95%
- Adoption rate < 10% after 7 days

---

## 📊 Monitoring Dashboard

### **Essential Widgets**

#### **Overview**
- Error rate chart
- Performance metrics
- User activity
- Release health

#### **Issues**
- Active errors list
- Error frequency
- User impact
- Resolution status

#### **Performance**
- Transaction duration
- Slow operations
- User satisfaction
- Release comparisons

---

## 🔧 Configuration Options

### **Sentry Init Options**
```typescript
Sentry.init({
  dsn: ENV.SENTRY_DSN,
  environment: ENV.isProduction ? 'production' : 'development',
  tracesSampleRate: ENV.isProduction ? 0.1 : 1.0,
  enableAutoSessionTracking: true,
  enableNative: true,
  release: `siFia@${version}`,
  dist: buildNumber,
});
```

### **Error Filtering**
```typescript
// Ignore common errors
ignoreErrors: [
  'Network request failed',
  'The action',
  'Aborted',
  'cancelled',
],
```

### **Data Sanitization**
```typescript
// Remove sensitive data
beforeSend(event, hint) {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }
  return event;
}
```

---

## 📱 Platform-Specific Setup

### **iOS Configuration**
```bash
# iOS native integration
cd ios
pod install

# Update Info.plist if needed
# Add Sentry native SDK configuration
```

### **Android Configuration**
```bash
# Android native integration
cd android

# Update build.gradle
# Add Sentry native SDK configuration
```

---

## 🚀 Production Deployment

### **Pre-Deployment Checklist**
- [ ] Sentry DSN configured
- [ ] Source maps enabled
- [ ] Error boundaries implemented
- [ ] Performance tracking added
- [ ] Alert rules configured
- [ ] Team notifications set

### **Post-Deployment**
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify user context
- [ ] Review release health
- [ ] Update alert thresholds

---

## 📞 Support

### **Getting Help**
1. Check [Sentry Documentation](https://docs.sentry.io/)
2. Review error logs in Sentry dashboard
3. Check CI/CD pipeline logs
4. Verify environment configuration

### **Contact Information**
- **Sentry Support:** support@sentry.io
- **Documentation:** https://docs.sentry.io/
- **Status Page:** https://status.sentry.io/

---

**Last Updated:** 2025-11-24
**Version:** 1.0.0
