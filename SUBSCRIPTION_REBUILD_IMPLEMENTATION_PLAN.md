# Complete Subscription System Rebuild - Implementation Plan

## **Overview**
Complete removal and rebuild of the subscription system with freemium Seeker tier, enterprise-grade family subscriptions, and Apple/Google Play Store integration.

---

## **Phase 1: Database Schema & Core Infrastructure (25%)**

### **1.1 New Database Schema Design (8%)**
- **Remove existing subscription tables**: `subscriptions`, `user_subscriptions`, `usage_tracking`
- **Create new subscription schema**:
  ```sql
  -- New subscription tiers enum
  CREATE TYPE subscription_tier_new AS ENUM (
    'seeker',           -- Freemium: 0/0 limits after trial
    'free_trial',       -- 2/2 free for 3 days
    'spark',            -- 8 playbooks/devotionals + smart journaling
    'growth',           -- 20 playbooks/devotionals
    'transformation',   -- Unlimited (no dashboard counts)
    'family'            -- Unlimited for up to 6 members
  );

  -- Main subscriptions table
  CREATE TABLE user_subscriptions_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    tier subscription_tier_new NOT NULL DEFAULT 'seeker',
    status TEXT NOT NULL DEFAULT 'active', -- active, cancelled, expired
    
    -- Trial and subscription dates
    trial_start_date TIMESTAMPTZ,
    trial_end_date TIMESTAMPTZ,
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    
    -- Payment integration
    platform TEXT, -- 'apple', 'google', null for free tiers
    platform_subscription_id TEXT, -- Apple/Google subscription ID
    platform_transaction_id TEXT,
    
    -- Family subscription support
    family_group_id UUID, -- Links family members
    family_role TEXT DEFAULT 'member', -- 'admin', 'member'
    
    -- Usage limits and tracking
    playbooks_limit INTEGER NOT NULL DEFAULT 0,
    devotionals_limit INTEGER NOT NULL DEFAULT 0,
    playbooks_used INTEGER NOT NULL DEFAULT 0,
    devotionals_used INTEGER NOT NULL DEFAULT 0,
    smart_journaling_enabled BOOLEAN NOT NULL DEFAULT false,
    
    -- Discount codes
    discount_code TEXT,
    discount_applied_amount DECIMAL(10,2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Family groups table
  CREATE TABLE family_subscription_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES user_profiles(id),
    group_name TEXT NOT NULL,
    max_members INTEGER NOT NULL DEFAULT 6,
    current_members INTEGER NOT NULL DEFAULT 1,
    platform_subscription_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Discount codes table
  CREATE TABLE discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    discount_percentage DECIMAL(5,2),
    discount_amount DECIMAL(10,2),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    max_uses INTEGER,
    current_uses INTEGER NOT NULL DEFAULT 0,
    applicable_tiers subscription_tier_new[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

### **1.2 Migration Scripts (5%)**
- **Safe data migration** from old to new schema
- **Preserve existing user data** and subscription states
- **Rollback procedures** for safe deployment

### **1.3 Core Subscription Service (12%)**
- **New SubscriptionService** with clean architecture
- **Tier limit enforcement** and usage tracking
- **Family subscription management** methods
- **Apple/Google Play Store integration** foundation

---

## **Phase 2: Freemium Seeker Tier Implementation (20%)**

### **2.1 Seeker Tier Logic (10%)**
- **Default user creation** as Seeker tier
- **Onboarding playbook access** (1 playbook only)
- **Post-trial downgrade** logic to Seeker (0/0 limits)
- **Dashboard UI updates** for Seeker state

### **2.2 Trial System Overhaul (10%)**
- **3-day free trial** with 2/2 limits
- **Trial expiration handling** and automatic downgrade
- **Trial-to-paid conversion** flows
- **Trial cancellation** handling

---

## **Phase 3: Payment Integration & Store Management (15%)**

### **3.1 Apple Pay Integration (8%)**
- **StoreKit integration** for subscription management
- **Receipt validation** and subscription status sync
- **Restore purchases** functionality
- **Subscription upgrade/downgrade** flows

### **3.2 Google Play Store Integration (7%)**
- **Google Play Billing** integration
- **Purchase verification** and status sync
- **Subscription lifecycle** management
- **Cross-platform subscription** handling

---

## **Phase 4: Family Subscription Enterprise Features (15%)**

### **4.1 Family Group Management (8%)**
- **Family admin dashboard** for member management
- **Invitation system** for family members
- **Member role management** (admin vs member)
- **Usage tracking** across family members

### **4.2 Enterprise-Grade Features (7%)**
- **Member limit enforcement** (max 6 members)
- **Family billing** and subscription sharing
- **Admin controls** for member removal/addition
- **Family usage analytics** and reporting

---

## **Phase 5: Discount Code System (10%)**

### **5.1 Dynamic Discount Generation (5%)**
- **Post-cancellation discount** code generation
- **Personalized discount** offers based on tier
- **Time-limited discount** code validity

### **5.2 Discount Code Integration (5%)**
- **Apple/Google Play discount** code application
- **User profile discount** management
- **Discount tracking** and analytics

---

## **Phase 6: UI/UX Updates (10%)**

### **6.1 Dashboard Updates (5%)**
- **Tier-specific UI** (counts/badges for Spark/Growth only)
- **Subscription status** display
- **Family subscription** indicators
- **Usage progress** bars and limits

### **6.2 Onboarding Screen Updates (5%)**
- **Sales offer screen** updates for new tiers
- **Trial offer screen** modifications
- **Payment confirmation** screen integration
- **Seeker onboarding** flow

---

## **Phase 7: Testing & Optimization (5%)**

### **7.1 Comprehensive Testing (3%)**
- **Unit tests** for all subscription logic
- **Integration tests** for payment flows
- **Family subscription** testing scenarios
- **Edge case handling** (expired trials, failed payments)

### **7.2 Performance Optimization (2%)**
- **Database query optimization** for subscription checks
- **Caching strategies** for tier limits
- **Real-time subscription** status updates

---

## **Implementation Timeline & Dependencies**

| Phase | Duration | Dependencies | Risk Level |
|-------|----------|--------------|------------|
| Phase 1 | 2-3 weeks | Database access, schema design approval | **High** |
| Phase 2 | 1-2 weeks | Phase 1 completion | **Medium** |
| Phase 3 | 2-3 weeks | Apple/Google developer accounts | **High** |
| Phase 4 | 1-2 weeks | Phase 1, 2 completion | **Medium** |
| Phase 5 | 1 week | Phase 3 completion | **Low** |
| Phase 6 | 1-2 weeks | All core phases complete | **Low** |
| Phase 7 | 1 week | All phases complete | **Low** |

**Total Estimated Timeline: 8-12 weeks**

---

## **Safe Code Removal Strategy**

### **Files to Remove/Replace:**
1. **Current subscription service files** (if they exist)
2. **Old subscription database** queries and migrations
3. **Stripe integration** code and dependencies
4. **Legacy trial logic** in onboarding screens

### **Files to Modify:**
1. **OnboardingSalesOfferScreen.tsx** - Update tier offerings and pricing
2. **OnboardingTrialOfferScreen.tsx** - New 3-day trial logic
3. **OnboardingPaymentConfirmationScreen.tsx** - Apple/Google Pay integration
4. **DashboardHomeScreen.tsx** - Tier-specific UI updates
5. **UserProfileScreen.tsx** - Subscription management UI

### **Rollback Plan:**
- **Feature flags** for gradual rollout
- **Database backup** before migration
- **Parallel system** running during transition
- **Immediate rollback** procedures documented

---

## **Success Metrics**

- **Zero subscription conflicts** (no dual creation issues)
- **Seamless trial-to-paid** conversion (>85% success rate)
- **Family subscription** management working for 6 members
- **Apple/Google Play** integration 100% functional
- **Dashboard UI** correctly reflects all tier states
- **Performance** maintained (<500ms subscription checks)

---

## **Next Steps**

1. **Review and approve** this implementation plan
2. **Set up development environment** with Apple/Google Play test accounts
3. **Begin Phase 1** with database schema design
4. **Establish testing protocols** for each phase
5. **Create feature flags** for safe deployment

This plan ensures a complete, enterprise-ready subscription system that meets all your requirements while maintaining compatibility with the existing onboarding flow.
