# 🚀 Phase 1: Enterprise Infrastructure Setup

## 🎯 Goal: Production-Ready Monitoring & Security

Transform your trial system into enterprise-grade infrastructure with monitoring, error tracking, and security hardening.

---

## 📊 Step 1: Error Monitoring & Performance (Sentry)

### **Install Sentry**
```bash
npm install @sentry/react-native @sentry/cli
# For iOS
cd ios && pod install
```

### **Configure Sentry**
```typescript
// src/config/sentry.ts
import * as Sentry from '@sentry/react-native';
import { getEnvironmentConfig } from './environment';

const env = getEnvironmentConfig();

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
  beforeSend(event) {
    // Filter out sensitive data
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});

// Custom error tracking for trial system
export const trackTrialError = (error: Error, context: any) => {
  Sentry.withScope((scope) => {
    scope.setTag('feature', 'trial_system');
    scope.setContext('trial_context', context);
    Sentry.captureException(error);
  });
};

// Performance monitoring
export const trackTrialPerformance = (operation: string) => {
  return Sentry.startTransaction({
    name: `trial_${operation}`,
    op: 'trial_operation',
  });
};
```

### **Add to Environment**
```bash
# Add to .env
SENTRY_DSN=your_sentry_dsn_here
```

---

## 📱 Step 2: User Analytics (Firebase)

### **Install Firebase**
```bash
npm install @react-native-firebase/app @react-native-firebase/analytics @react-native-firebase/crashlytics
cd ios && pod install
```

### **Configure Analytics**
```typescript
// src/services/analyticsService.ts
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';

export class EnterpriseAnalytics {
  
  // Trial-specific events
  static async trackTrialStarted(userId: string) {
    await analytics().logEvent('trial_started', {
      user_id: userId,
      trial_duration: 3,
      timestamp: new Date().toISOString(),
    });
  }

  static async trackTrialExpired(userId: string, convertedToPaid: boolean) {
    await analytics().logEvent('trial_expired', {
      user_id: userId,
      converted: convertedToPaid,
      timestamp: new Date().toISOString(),
    });
  }

  static async trackFeatureLocked(userId: string, feature: string) {
    await analytics().logEvent('feature_locked', {
      user_id: userId,
      feature_name: feature,
      timestamp: new Date().toISOString(),
    });
  }

  static async trackUpgradePromptShown(userId: string, feature: string, tier: string) {
    await analytics().logEvent('upgrade_prompt_shown', {
      user_id: userId,
      feature_name: feature,
      recommended_tier: tier,
      timestamp: new Date().toISOString(),
    });
  }

  // Revenue tracking
  static async trackSubscriptionStarted(userId: string, tier: string, amount: number) {
    await analytics().logEvent('purchase', {
      currency: 'USD',
      value: amount,
      items: [{
        item_id: tier,
        item_name: `siFia ${tier} subscription`,
        item_category: 'subscription',
        quantity: 1,
        price: amount,
      }],
    });
  }

  // User behavior
  static async trackContentGenerated(userId: string, contentType: string) {
    await analytics().logEvent('content_generated', {
      user_id: userId,
      content_type: contentType,
      timestamp: new Date().toISOString(),
    });
  }

  // Performance tracking
  static async trackAppPerformance(metric: string, value: number) {
    await analytics().logEvent('app_performance', {
      metric_name: metric,
      metric_value: value,
      timestamp: new Date().toISOString(),
    });
  }

  // Error tracking
  static async trackError(error: Error, context: any) {
    crashlytics().recordError(error);
    crashlytics().setAttributes(context);
  }
}
```

---

## 🔐 Step 3: Security Hardening

### **Install Security Packages**
```bash
npm install react-native-keychain react-native-device-info
npm install @react-native-community/netinfo
cd ios && pod install
```

### **Secure Storage Service**
```typescript
// src/services/secureStorageService.ts
import * as Keychain from 'react-native-keychain';
import DeviceInfo from 'react-native-device-info';

export class SecureStorageService {
  
  // Secure token storage
  static async storeAuthToken(token: string): Promise<void> {
    try {
      await Keychain.setInternetCredentials(
        'siFia_auth',
        'auth_token',
        token,
        {
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
          authenticationType: Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS,
        }
      );
    } catch (error) {
      console.error('Failed to store auth token securely:', error);
      throw error;
    }
  }

  static async getAuthToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getInternetCredentials('siFia_auth');
      return credentials ? credentials.password : null;
    } catch (error) {
      console.error('Failed to retrieve auth token:', error);
      return null;
    }
  }

  // Device fingerprinting for security
  static async getDeviceFingerprint(): Promise<string> {
    const deviceId = await DeviceInfo.getUniqueId();
    const deviceName = await DeviceInfo.getDeviceName();
    const systemVersion = DeviceInfo.getSystemVersion();
    const appVersion = DeviceInfo.getVersion();
    
    return `${deviceId}_${deviceName}_${systemVersion}_${appVersion}`;
  }

  // Detect security risks
  static async checkDeviceSecurity(): Promise<SecurityStatus> {
    const isEmulator = await DeviceInfo.isEmulator();
    const isJailbroken = await DeviceInfo.isJailBroken();
    const hasGooglePlayServices = await DeviceInfo.hasGms();
    
    return {
      isSecure: !isEmulator && !isJailbroken,
      isEmulator,
      isJailbroken,
      hasGooglePlayServices,
      riskLevel: (isEmulator || isJailbroken) ? 'high' : 'low',
    };
  }
}

interface SecurityStatus {
  isSecure: boolean;
  isEmulator: boolean;
  isJailbroken: boolean;
  hasGooglePlayServices: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}
```

### **API Security Middleware**
```typescript
// src/services/secureApiClient.ts
import { supabase } from './supabaseClient';
import { SecureStorageService } from './secureStorageService';
import { EnterpriseAnalytics } from './analyticsService';

export class SecureApiClient {
  
  static async makeSecureRequest(endpoint: string, options: any = {}) {
    try {
      // Device security check
      const securityStatus = await SecureStorageService.checkDeviceSecurity();
      
      if (!securityStatus.isSecure) {
        await EnterpriseAnalytics.trackError(
          new Error('Insecure device detected'),
          { securityStatus, endpoint }
        );
        throw new Error('Device security check failed');
      }

      // Add device fingerprint to requests
      const deviceFingerprint = await SecureStorageService.getDeviceFingerprint();
      
      const response = await supabase.functions.invoke(endpoint, {
        ...options,
        headers: {
          ...options.headers,
          'X-Device-Fingerprint': deviceFingerprint,
          'X-App-Version': DeviceInfo.getVersion(),
        },
      });

      return response;
      
    } catch (error) {
      await EnterpriseAnalytics.trackError(error as Error, { endpoint, options });
      throw error;
    }
  }
}
```

---

## ⚡ Step 4: Performance Optimization

### **Install Performance Packages**
```bash
npm install react-native-fast-image
npm install @react-native-community/netinfo
cd ios && pod install
```

### **Performance Monitoring Service**
```typescript
// src/services/performanceService.ts
import { EnterpriseAnalytics } from './analyticsService';
import NetInfo from '@react-native-community/netinfo';

export class PerformanceService {
  
  // App startup time tracking
  static startupStartTime = Date.now();
  
  static trackAppStartup() {
    const startupTime = Date.now() - this.startupStartTime;
    EnterpriseAnalytics.trackAppPerformance('app_startup_time', startupTime);
  }

  // API response time tracking
  static async trackApiCall<T>(
    apiCall: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await apiCall();
      const responseTime = Date.now() - startTime;
      
      await EnterpriseAnalytics.trackAppPerformance(
        `api_${operationName}_response_time`,
        responseTime
      );
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      await EnterpriseAnalytics.trackAppPerformance(
        `api_${operationName}_error_time`,
        responseTime
      );
      
      throw error;
    }
  }

  // Network quality monitoring
  static async trackNetworkQuality() {
    const netInfo = await NetInfo.fetch();
    
    await EnterpriseAnalytics.trackAppPerformance('network_quality', {
      type: netInfo.type,
      isConnected: netInfo.isConnected,
      isInternetReachable: netInfo.isInternetReachable,
      strength: netInfo.details?.strength || 0,
    });
  }

  // Memory usage tracking
  static trackMemoryUsage() {
    if (__DEV__) {
      const memoryInfo = (performance as any).memory;
      if (memoryInfo) {
        EnterpriseAnalytics.trackAppPerformance('memory_used', memoryInfo.usedJSHeapSize);
        EnterpriseAnalytics.trackAppPerformance('memory_total', memoryInfo.totalJSHeapSize);
      }
    }
  }
}
```

---

## 🔧 Step 5: Enhanced Trial System Integration

### **Update Trial Hook with Enterprise Features**
```typescript
// src/hooks/useEnterpriseTrialAccess.ts
import { useSimpleTrialAccess } from './useSimpleTrialAccess';
import { EnterpriseAnalytics } from '../services/analyticsService';
import { PerformanceService } from '../services/performanceService';
import { SecureStorageService } from '../services/secureStorageService';

export const useEnterpriseTrialAccess = (userId?: string) => {
  const trialAccess = useSimpleTrialAccess(userId);

  // Enhanced trial start with analytics
  const startTrialWithAnalytics = async () => {
    try {
      // Security check
      const securityStatus = await SecureStorageService.checkDeviceSecurity();
      
      if (!securityStatus.isSecure) {
        throw new Error('Device security check failed');
      }

      // Start trial with performance tracking
      await PerformanceService.trackApiCall(
        () => trialAccess.startTrial(),
        'start_trial'
      );

      // Track analytics
      if (userId) {
        await EnterpriseAnalytics.trackTrialStarted(userId);
      }

    } catch (error) {
      await EnterpriseAnalytics.trackError(error as Error, { userId, action: 'start_trial' });
      throw error;
    }
  };

  // Enhanced feature access check
  const checkFeatureAccessWithAnalytics = async (feature: string) => {
    const hasAccess = trialAccess.featureAccess[feature as keyof typeof trialAccess.featureAccess];
    
    if (!hasAccess && userId) {
      await EnterpriseAnalytics.trackFeatureLocked(userId, feature);
    }
    
    return hasAccess;
  };

  return {
    ...trialAccess,
    startTrialWithAnalytics,
    checkFeatureAccessWithAnalytics,
  };
};
```

---

## 📊 Step 6: Enterprise Dashboard Setup

### **Create Analytics Dashboard Component**
```typescript
// src/components/EnterpriseDashboard.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

interface DashboardMetrics {
  activeTrials: number;
  trialConversions: number;
  conversionRate: number;
  mrr: number;
  churnRate: number;
  topFeatures: string[];
}

export const EnterpriseDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    loadDashboardMetrics();
  }, []);

  const loadDashboardMetrics = async () => {
    // Load from your analytics service
    // This would typically come from your backend analytics API
    setMetrics({
      activeTrials: 150,
      trialConversions: 38,
      conversionRate: 25.3,
      mrr: 12500,
      churnRate: 4.2,
      topFeatures: ['Smart Journaling', 'Playbooks', 'Devotionals'],
    });
  };

  if (!metrics) return <Text>Loading dashboard...</Text>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>siFia Enterprise Dashboard</Text>
      
      <View style={styles.metricsGrid}>
        <MetricCard title="Active Trials" value={metrics.activeTrials.toString()} />
        <MetricCard title="Trial Conversions" value={metrics.trialConversions.toString()} />
        <MetricCard title="Conversion Rate" value={`${metrics.conversionRate}%`} />
        <MetricCard title="Monthly Revenue" value={`$${metrics.mrr.toLocaleString()}`} />
        <MetricCard title="Churn Rate" value={`${metrics.churnRate}%`} />
      </View>
    </ScrollView>
  );
};

const MetricCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricTitle}>{title}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  metricCard: { 
    backgroundColor: '#f8f9fa', 
    padding: 16, 
    borderRadius: 8, 
    minWidth: '45%' 
  },
  metricTitle: { fontSize: 14, color: '#666', marginBottom: 8 },
  metricValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
});
```

---

## 🎯 Phase 1 Completion Checklist

### **✅ Monitoring Setup**
- [ ] Sentry configured for error tracking
- [ ] Firebase Analytics tracking trial events
- [ ] Performance monitoring in place
- [ ] Custom dashboard created

### **✅ Security Hardening**
- [ ] Secure storage for sensitive data
- [ ] Device fingerprinting implemented
- [ ] Security risk detection active
- [ ] API security middleware deployed

### **✅ Performance Optimization**
- [ ] App startup time tracking
- [ ] API response time monitoring
- [ ] Network quality assessment
- [ ] Memory usage tracking

### **✅ Enhanced Trial System**
- [ ] Analytics integrated into trial flow
- [ ] Security checks on trial start
- [ ] Performance tracking for trial operations
- [ ] Enterprise dashboard operational

---

## 📈 Expected Results After Phase 1

- 🔍 **Complete visibility** into app performance and user behavior
- 🛡️ **Enterprise-grade security** protecting user data
- ⚡ **Optimized performance** with monitoring and alerts
- 📊 **Data-driven insights** for trial optimization

**Ready for Phase 2?** Your infrastructure is now enterprise-ready for scaling! 🚀
