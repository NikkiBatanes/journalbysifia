# Store Configuration Guide for siFia Subscriptions

This guide provides step-by-step instructions for configuring Apple App Store Connect and Google Play Console for siFia's subscription system.

## Apple App Store Connect Configuration

### 1. Create Subscription Group

1. **Navigate to App Store Connect**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Select your siFia app
   - Go to **Features** > **In-App Purchases**

2. **Create Subscription Group**
   - Click **"+"** next to **Subscription Groups**
   - **Reference Name**: `siFia Premium Subscriptions`
   - **Display Name**: `siFia Premium`
   - Click **Create**

### 2. Create Individual Subscriptions

Create the following subscriptions in the `siFia Premium Subscriptions` group:

#### Spark Tier
- **Product ID**: `com.sifia.spark.monthly`
- **Reference Name**: `Spark Monthly`
- **Subscription Duration**: 1 Month
- **Subscription Group Level**: 4 (lowest tier)

- **Product ID**: `com.sifia.spark.annual`
- **Reference Name**: `Spark Annual`
- **Subscription Duration**: 1 Year
- **Subscription Group Level**: 4

#### Growth Tier
- **Product ID**: `com.sifia.growth.monthly`
- **Reference Name**: `Growth Monthly`
- **Subscription Duration**: 1 Month
- **Subscription Group Level**: 3

- **Product ID**: `com.sifia.growth.annual`
- **Reference Name**: `Growth Annual`
- **Subscription Duration**: 1 Year
- **Subscription Group Level**: 3
- **Mark as Popular**: ✅ Yes

#### Transformation Tier
- **Product ID**: `com.sifia.transformation.monthly`
- **Reference Name**: `Transformation Monthly`
- **Subscription Duration**: 1 Month
- **Subscription Group Level**: 2

- **Product ID**: `com.sifia.transformation.annual`
- **Reference Name**: `Transformation Annual`
- **Subscription Duration**: 1 Year
- **Subscription Group Level**: 2

#### Family Tier
- **Product ID**: `com.sifia.family.monthly`
- **Reference Name**: `Family Monthly`
- **Subscription Duration**: 1 Month
- **Subscription Group Level**: 1 (highest tier)

- **Product ID**: `com.sifia.family.annual`
- **Reference Name**: `Family Annual`
- **Subscription Duration**: 1 Year
- **Subscription Group Level**: 1

### 3. Pricing Configuration

Set prices for each subscription according to your pricing strategy:

| Tier | Monthly Price | Annual Price | Annual Savings |
|------|---------------|--------------|----------------|
| Spark | $6.99 | $49.99 | 40% |
| Growth | $12.99 | $129.99 | 17% |
| Transformation | $24.99 | $249.99 | 17% |
| Family | $34.99 | $349.99 | 17% |

### 4. Subscription Descriptions

For each subscription, add:

#### Spark
- **Display Name**: "Spark"
- **Description**: "For consistent encouragement"
- **Features**:
  - 8 playbooks & 8 devotionals each month
  - Gentle reminders to keep you on track
  - Track your progress week by week

#### Growth
- **Display Name**: "Growth"
- **Description**: "For deeper transformation"
- **Features**:
  - 20 playbooks & 20 devotionals each month
  - Advanced reflection prompts
  - Seasonal challenges for breakthrough

#### Transformation
- **Display Name**: "Transformation"
- **Description**: "For complete spiritual renewal"
- **Features**:
  - Unlimited playbooks & devotionals
  - Personal spiritual mentor access
  - Custom prayer & meditation guides
  - Priority support & guidance

#### Family
- **Display Name**: "Family"
- **Description**: "For the whole family's growth"
- **Features**:
  - Everything in Transformation
  - Up to 6 family member accounts
  - Family devotionals & activities
  - Parental guidance resources

### 5. Review Information

For each subscription, add:
- **Screenshot**: Upload app screenshots showing the subscription benefits
- **Review Notes**: "siFia subscription for spiritual growth and devotional content"

## Google Play Console Configuration

### 1. Create Subscription Products

1. **Navigate to Google Play Console**
   - Go to [Google Play Console](https://play.google.com/console)
   - Select your siFia app
   - Go to **Monetize** > **Products** > **Subscriptions**

2. **Create Base Subscription**
   - Click **Create subscription**
   - **Product ID**: Use the same IDs as iOS but without the `com.sifia.` prefix:
     - `spark_monthly`
     - `spark_annual`
     - `growth_monthly`
     - `growth_annual`
     - `transformation_monthly`
     - `transformation_annual`
     - `family_monthly`
     - `family_annual`

### 2. Configure Base Plans

For each subscription, create base plans:

#### Monthly Subscriptions
- **Base plan ID**: `monthly-plan`
- **Billing period**: 1 month
- **Price**: Set according to pricing table above
- **Auto-renewing**: Yes

#### Annual Subscriptions
- **Base plan ID**: `annual-plan`
- **Billing period**: 1 year
- **Price**: Set according to pricing table above
- **Auto-renewing**: Yes

### 3. Subscription Details

For each subscription, configure:

#### Spark
- **Name**: "Spark"
- **Description**: "For consistent encouragement - 8 playbooks & devotionals monthly, progress tracking, gentle reminders"

#### Growth
- **Name**: "Growth"
- **Description**: "For deeper transformation - 20 playbooks & devotionals monthly, advanced prompts, seasonal challenges"

#### Transformation
- **Name**: "Transformation"
- **Description**: "For complete spiritual renewal - Unlimited content, mentor access, custom guides, priority support"

#### Family
- **Name**: "Family"
- **Description**: "For the whole family's growth - Everything in Transformation plus 6 family accounts and family content"

### 4. Replacement Mode Configuration

In Google Play Console, set default replacement modes:

1. Go to **Subscriptions** > **Settings**
2. **Default replacement mode**: `Charge immediately` (equivalent to `CHARGE_FULL_PRICE`)
3. **Alternative**: `Charge at next billing date` (equivalent to `WITHOUT_PRORATION`)

### 5. Offers Configuration (Optional)

Create introductory offers:
- **Free Trial**: 3 days for Growth tier
- **Introductory Price**: 50% off first month for new users

## Testing Configuration

### Apple App Store

1. **Create Sandbox Users**
   - Go to **Users and Access** > **Sandbox**
   - Create test users for different regions
   - Test upgrade/downgrade flows

2. **Test Subscription Groups**
   - Verify only one subscription can be active per group
   - Test upgrade paths (immediate with proration)
   - Test downgrade paths (deferred to next billing cycle)

### Google Play Store

1. **Create Test Accounts**
   - Add test accounts in **Setup** > **License testing**
   - Test different replacement modes
   - Verify proration calculations

2. **Test Subscription Changes**
   - Test immediate upgrades with proration
   - Test deferred downgrades
   - Verify proper billing cycles

## Webhook Configuration

### Apple App Store Server Notifications

1. **Configure Server-to-Server Notifications**
   - Go to **App Information** > **App Store Server Notifications**
   - **Server URL**: `https://your-api.com/webhooks/apple`
   - **Bundle ID**: Your app's bundle ID

2. **Handle Notification Types**:
   - `DID_CHANGE_RENEWAL_STATUS`
   - `SUBSCRIBED`
   - `DID_RENEW`
   - `EXPIRED`

### Google Play Developer Notifications

1. **Configure Real-time Developer Notifications**
   - Go to **Monetization setup** > **Real-time developer notifications**
   - **Topic name**: Create a Cloud Pub/Sub topic
   - **Endpoint**: `https://your-api.com/webhooks/google`

2. **Handle Notification Types**:
   - `SUBSCRIPTION_PURCHASED`
   - `SUBSCRIPTION_RENEWED`
   - `SUBSCRIPTION_CANCELED`
   - `SUBSCRIPTION_EXPIRED`

## Compliance Checklist

### Apple App Store
- ✅ All subscriptions in single group
- ✅ Proper level ranking (1-4)
- ✅ Clear subscription descriptions
- ✅ No custom proration logic
- ✅ Upgrade/downgrade paths configured
- ✅ Sandbox testing completed

### Google Play Store
- ✅ Base plans configured correctly
- ✅ Replacement modes set appropriately
- ✅ Product IDs match app implementation
- ✅ Pricing matches Apple Store
- ✅ Testing accounts configured
- ✅ Webhook endpoints configured

## Production Deployment

### Pre-Launch Checklist

1. **Code Review**
   - ✅ SKU constants match store configuration
   - ✅ Replacement mode logic implemented
   - ✅ Error handling for failed purchases
   - ✅ Webhook handlers implemented

2. **Store Review**
   - ✅ All subscriptions approved in App Store Connect
   - ✅ All subscriptions published in Google Play Console
   - ✅ App metadata includes subscription information
   - ✅ Privacy policy updated for subscriptions

3. **Testing**
   - ✅ End-to-end subscription flow tested
   - ✅ Upgrade/downgrade scenarios verified
   - ✅ Receipt validation working
   - ✅ Webhook processing functional

### Launch Day

1. **Monitor Metrics**
   - Subscription conversion rates
   - Failed purchase attempts
   - Upgrade/downgrade patterns
   - Revenue recognition

2. **Support Readiness**
   - Customer service trained on subscription policies
   - Refund process documented
   - Escalation procedures in place

## Troubleshooting

### Common Issues

1. **"Product not found" errors**
   - Verify SKU constants match store configuration
   - Check subscription status in store consoles
   - Ensure app version includes subscription code

2. **Failed upgrades**
   - Verify replacement mode configuration
   - Check current subscription token validity
   - Review webhook processing logs

3. **Proration discrepancies**
   - Apple handles proration automatically
   - Google requires proper replacement mode
   - Verify billing cycle calculations

### Support Resources

- [Apple Subscription Documentation](https://developer.apple.com/app-store/subscriptions/)
- [Google Play Billing Documentation](https://developer.android.com/google/play/billing)
- [RevenueCat Integration Guide](https://www.revenuecat.com/docs/)

---

**Last Updated**: January 2025
**Version**: 1.0
**Maintained by**: siFia Development Team
