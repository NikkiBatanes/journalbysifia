# siFia Deployment Guide

## 🚀 **Complete Deployment Checklist**

### **Phase 1: Database Setup**

#### **1. Supabase Configuration**

```bash
# 1. Go to your Supabase project dashboard
# 2. Navigate to SQL Editor
# 3. Copy and paste the entire supabase_database_schema.sql file
# 4. Execute the script
```

#### **2. Verify Database Setup**

```sql
-- Check if all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'user_profiles', 'subscriptions', 'usage_tracking', 
    'user_events', 'content_library', 'journal_templates', 
    'payment_transactions', 'ab_test_assignments'
  );

-- Verify journal templates were inserted
SELECT name, category, is_premium FROM journal_templates;

-- Test the user signup trigger
-- (This will happen automatically when users sign up)
```

#### **3. Enable Realtime (Optional)**

```sql
-- Enable realtime for subscription updates
ALTER PUBLICATION supabase_realtime ADD TABLE subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE usage_tracking;
```

### **Phase 2: Environment Variables**

#### **Frontend (.env)**

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Payment Configuration - US Market
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_key
STRIPE_SECRET_KEY=sk_live_your_stripe_secret

# Payment Configuration - Philippines Market
PAYMONGO_PUBLIC_KEY=pk_live_your_paymongo_key
PAYMONGO_SECRET_KEY=sk_live_your_paymongo_secret

# App Configuration
APP_ENV=production
API_BASE_URL=https://your-api-domain.com

# Analytics (Optional)
MIXPANEL_TOKEN=your_mixpanel_token
GOOGLE_ANALYTICS_ID=your_ga_id
```

#### **Backend/Edge Functions (.env)**

```bash
# Supabase Service Role (for backend operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Webhook Secrets
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
PAYMONGO_WEBHOOK_SECRET=your_paymongo_webhook_secret

# External APIs
IPAPI_KEY=your_ip_geolocation_key (optional)
```

### **Phase 3: Payment Provider Setup**

#### **Stripe (US Market)**

1. **Create Products and Prices**

```javascript
// Run this script in Stripe CLI or dashboard
const products = [
  {
    name: 'siFia Starter',
    description: 'Essential spiritual growth tools',
    prices: [
      { amount: 699, currency: 'usd', interval: 'month' },
      { amount: 4999, currency: 'usd', interval: 'year' }
    ]
  },
  {
    name: 'siFia Growth',
    description: 'Enhanced AI-powered spiritual guidance',
    prices: [
      { amount: 1299, currency: 'usd', interval: 'month' },
      { amount: 12999, currency: 'usd', interval: 'year' }
    ]
  },
  {
    name: 'siFia Transformation',
    description: 'Advanced personalized spiritual coaching',
    prices: [
      { amount: 2499, currency: 'usd', interval: 'month' },
      { amount: 24999, currency: 'usd', interval: 'year' }
    ]
  },
  {
    name: 'siFia Family',
    description: 'Spiritual growth for the whole family',
    prices: [
      { amount: 3499, currency: 'usd', interval: 'month' },
      { amount: 34999, currency: 'usd', interval: 'year' }
    ]
  }
];
```

2. **Configure Webhooks**

```
Webhook URL: https://your-domain.com/api/webhooks/stripe
Events to listen for:
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_succeeded
- invoice.payment_failed
```

#### **PayMongo (Philippines Market)**

1. **Create Products**

```javascript
// PayMongo product creation
const products = [
  {
    name: 'siFia Starter',
    description: 'Essential spiritual growth tools',
    amount: 19900, // ₱199.00
    currency: 'PHP'
  },
  {
    name: 'siFia Growth', 
    description: 'Enhanced AI-powered spiritual guidance',
    amount: 34900, // ₱349.00
    currency: 'PHP'
  },
  // ... other tiers
];
```

2. **Enable Payment Methods**

```
- Credit/Debit Cards
- GCash
- PayMaya
- Online Banking
- 7-Eleven (Over-the-counter)
```

### **Phase 4: Code Integration**

#### **1. Install Dependencies**

```bash
npm install @tanstack/react-query @supabase/supabase-js
npm install @stripe/stripe-react-native  # For US payments
npm install react-native-paymongo        # For PH payments
```

#### **2. Update App.tsx**

```tsx
// src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrialStatusBanner } from './components/TrialStatusBanner';
import { supabase } from './lib/supabase';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <TrialStatusBanner />
        <RootNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  );
}
```

#### **3. Add Trial Logic to Key Screens**

```tsx
// src/screens/HomeScreen.tsx
import { useTrialAccess } from '../hooks/useTrialAccess';

export const HomeScreen = () => {
  const { hasActiveAccess, daysRemaining } = useTrialAccess();

  return (
    <View>
      {hasActiveAccess && (
        <Text>🎉 Trial: {daysRemaining} days remaining</Text>
      )}
      {/* Rest of home screen */}
    </View>
  );
};
```

#### **4. Protect Premium Features**

```tsx
// src/screens/SmartJournalingScreen.tsx
import { useFeatureAccess } from '../hooks/useTrialAccess';
import { FeatureLockOverlay } from '../components/FeatureLockOverlay';

export const SmartJournalingScreen = () => {
  const { hasAccess } = useFeatureAccess('smartJournalingEnabled');
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleFeatureAccess = () => {
    if (!hasAccess) {
      setShowUpgrade(true);
      return;
    }
    // Proceed with feature
  };

  return (
    <View>
      <Button onPress={handleFeatureAccess} title="Start Smart Journaling" />
      
      <FeatureLockOverlay
        visible={showUpgrade}
        feature="smartJournaling"
        onClose={() => setShowUpgrade(false)}
      />
    </View>
  );
};
```

### **Phase 5: Testing**

#### **1. Trial Flow Testing**

```bash
# Test checklist:
□ New user signup automatically starts trial
□ Trial countdown shows correct days remaining
□ All premium features work during trial
□ Features lock after trial expiration
□ Upgrade prompts appear when features are blocked
□ Analytics events are tracked
```

#### **2. Payment Testing**

```bash
# Stripe test cards (US)
4242424242424242  # Visa success
4000000000000002  # Visa decline

# PayMongo test cards (PH)
4343434343434345  # Visa success
4000000000000119  # Visa decline
```

#### **3. Database Testing**

```sql
-- Test trial expiration
UPDATE subscriptions 
SET trial_ends_at = NOW() - INTERVAL '1 hour'
WHERE user_id = 'test_user_id';

-- Run expiration check
SELECT check_trial_expirations();

-- Verify status updated
SELECT tier, status, trial_ends_at FROM subscriptions 
WHERE user_id = 'test_user_id';
```

### **Phase 6: Analytics Setup**

#### **1. Conversion Tracking**

```typescript
// Track key events
const trackTrialEvent = (event: string, metadata?: any) => {
  // Supabase event
  supabase.from('user_events').insert({
    user_id: user.id,
    event_type: 'trial',
    event_name: event,
    metadata
  });

  // External analytics
  analytics.track(event, metadata);
};

// Usage examples
trackTrialEvent('trial_started');
trackTrialEvent('feature_blocked', { feature: 'smart_journaling' });
trackTrialEvent('upgrade_clicked', { from_feature: 'playbooks' });
trackTrialEvent('subscription_created', { tier: 'starter' });
```

#### **2. Revenue Monitoring**

```sql
-- Daily revenue query
SELECT 
  DATE(created_at) as date,
  currency,
  COUNT(*) as transactions,
  SUM(amount) / 100.0 as revenue
FROM payment_transactions 
WHERE status = 'succeeded'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), currency
ORDER BY date DESC;
```

### **Phase 7: Launch Preparation**

#### **1. Pre-Launch Checklist**

```bash
□ Database schema deployed
□ All environment variables set
□ Payment providers configured
□ Webhook endpoints tested
□ Trial logic thoroughly tested
□ Analytics tracking verified
□ Error monitoring setup
□ Performance monitoring setup
□ Backup strategy in place
```

#### **2. Launch Day Monitoring**

```bash
# Key metrics to watch:
- Trial signup rate
- Feature usage during trial
- Trial-to-paid conversion rate
- Payment success rate
- Error rates
- App performance
```

#### **3. Post-Launch Optimization**

```bash
# Week 1: Monitor and fix critical issues
# Week 2: Analyze trial conversion data
# Week 3: A/B test trial duration (3 vs 7 days)
# Week 4: Optimize upgrade prompts based on data
```

### **Phase 8: Scaling Considerations**

#### **1. Database Optimization**

```sql
-- Add partitioning for large tables
CREATE TABLE user_events_2024 PARTITION OF user_events
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Archive old events
DELETE FROM user_events 
WHERE created_at < NOW() - INTERVAL '1 year';
```

#### **2. Caching Strategy**

```typescript
// Cache subscription data
const getCachedSubscription = async (userId: string) => {
  const cached = await redis.get(`subscription:${userId}`);
  if (cached) return JSON.parse(cached);
  
  const subscription = await getSubscription(userId);
  await redis.setex(`subscription:${userId}`, 300, JSON.stringify(subscription));
  return subscription;
};
```

#### **3. Rate Limiting**

```typescript
// Limit trial signups per IP
const rateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 trials per IP per day
  message: 'Too many trial signups from this IP'
});
```

## 🎯 **Success Metrics**

### **Target KPIs**
- **Trial Conversion Rate**: 25-35%
- **Feature Engagement**: 80%+ trial users use premium features
- **Time to First Premium Feature**: <24 hours
- **Monthly Churn Rate**: <5%
- **Customer Lifetime Value**: >$100

### **Revenue Targets**
- **Month 1**: $10K MRR
- **Month 3**: $50K MRR  
- **Month 6**: $150K MRR
- **Month 12**: $500K MRR

This deployment guide ensures a smooth launch of the siFia subscription and trial system with proper monitoring and optimization strategies! 🚀
