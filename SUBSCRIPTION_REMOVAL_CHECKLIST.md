# Subscription System Removal Checklist

## **Files to Remove Completely**
- [ ] `test-database-race-prevention.js` (83 subscription references)
- [ ] `test-dual-creation-fix.js` (71 subscription references) 
- [ ] `test-all-subscription-tiers.js` (58 subscription references)
- [ ] `test-react-native-asyncstorage.js` (38 subscription references)
- [ ] `fix-database-duplicates.js` (28 subscription references)
- [ ] `test-spark-subscription.js` (28 subscription references)
- [ ] `debug-spark-subscription.js` (22 subscription references)
- [ ] `debug-dual-subscription-issue.js` (15 subscription references)
- [ ] `test-subscription-system.js` (11 subscription references)

## **Files to Modify - Remove Subscription Logic**

### **Core Services (High Priority)**
- [ ] `src/hooks/useUserState.ts` (28 references) - Remove subscription state management
- [ ] `src/services/retentionService.ts` (31 references) - Remove subscription-based retention logic
- [ ] `src/services/enhancedGenerationService.ts` (25 references) - Remove subscription checks
- [ ] `src/services/analyticsService.ts` (17 references) - Remove subscription analytics
- [ ] `src/hooks/useFeatureAccess.ts` (14 references) - Replace with new tier system
- [ ] `src/services/tierRestrictionService.ts` (8 references) - Complete rewrite for new tiers

### **UI Components (Medium Priority)**
- [ ] `src/components/AdminDashboard.tsx` (41 references) - Remove old subscription management
- [ ] `src/screens/UserProfileScreen.tsx` (31 references) - Update subscription display
- [ ] `src/screens/DashboardHomeScreen.tsx` (29 references) - Update tier-based UI

### **Onboarding Screens (High Priority)**
- [ ] `src/screens/onboarding/OnboardingTrialOfferScreen.tsx` (3 references) - Update for 3-day trial
- [ ] `src/screens/onboarding/OnboardingSplashScreen.tsx` (1 reference) - Remove subscription checks

### **Other Services (Low Priority)**
- [ ] `src/services/enhancedGenerationServiceV2.ts` (11 references)
- [ ] `src/services/queueService.ts` (11 references)
- [ ] `src/services/exportService.ts` (6 references)
- [ ] `src/services/enhancedQueueService.ts` (5 references)
- [ ] `src/services/intelligenceService.ts` (5 references)

## **Database Schema Removal**
- [ ] Drop `subscriptions` table (if exists)
- [ ] Drop `user_subscriptions` table (if exists) 
- [ ] Drop `usage_tracking` table (if exists)
- [ ] Remove subscription-related functions from analytics_functions.sql
- [ ] Remove subscription_tier enum (old version)

## **Dependencies to Remove**
- [ ] Stripe SDK dependencies (if any)
- [ ] Old subscription-related npm packages
- [ ] Subscription-related environment variables

## **New Files to Create**
- [ ] `src/services/NewSubscriptionService.ts` - Core subscription logic
- [ ] `src/hooks/useNewSubscription.ts` - New subscription state management
- [ ] `src/types/subscription.ts` - New subscription type definitions
- [ ] `database/new_subscription_schema.sql` - New database schema
- [ ] `database/migration_old_to_new.sql` - Migration script

## **Testing Strategy**
- [ ] Remove all old subscription test files
- [ ] Create new test suite for new subscription system
- [ ] Test local development without app store dependencies
- [ ] Verify onboarding flow compatibility

## **Rollback Plan**
- [ ] Backup current database schema
- [ ] Create feature flag for new vs old system
- [ ] Document rollback procedures
- [ ] Test rollback in development environment
