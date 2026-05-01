# Subscription Flow Diagrams
**Visual Guide to All Subscription Scenarios**

## 1. 3-Day Trial Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    3-DAY TRIAL LIFECYCLE                        │
└─────────────────────────────────────────────────────────────────┘

DAY 0: TRIAL START
┌──────────────┐
│ User Selects │
│ Spark Trial  │
└──────┬───────┘
       │
       ├──► Apple: Process .freetrial purchase
       │
       ├──► App: TrialManagementService.createTrial()
       │    ┌─────────────────────────────────┐
       │    │ tier: 'free_trial'              │
       │    │ trial_chosen_tier: 'spark'      │
       │    │ playbooks_limit: 2              │
       │    │ devotionals_limit: 2            │
       │    │ trial_end_date: NOW + 3 days    │
       │    └─────────────────────────────────┘
       │
       └──► User gets 2 playbooks + 2 devotionals


DAY 0-3: TWO PATHS

PATH A: USER CANCELS                 PATH B: USER DOES NOTHING
┌─────────────────────┐             ┌──────────────────────┐
│ iOS Settings →      │             │ Let trial run out    │
│ Cancel Subscription │             └──────────┬───────────┘
└─────────┬───────────┘                        │
          │                                    │
          ├──► Apple Webhook:                 │
          │    DID_CHANGE_RENEWAL_STATUS      │
          │    (AUTO_RENEW_DISABLED)          │
          │                                    │
          ├──► Handler Action:                 │
          │    trial_cancelled_date: NOW       │
          │    Keep tier until trial_end_date  │
          │                                    │
          └──► User Experience:                 │
               - Keeps 2/2 limits until Day 3  │
               - Can finish remaining usage    │
                                                │
DAY 3: EXPIRATION                    DAY 3: AUTO-CONVERSION
┌─────────────────────┐             ┌──────────────────────┐
│ trial_end_date      │             │ Apple: Charge user   │
│ expires             │             │ for first month      │
└─────────┬───────────┘             └──────────┬───────────┘
          │                                    │
          ├──► Revert to Seeker               ├──► Apple Webhook:
          │    tier: 'seeker'                 │    DID_RENEW
          │    playbooks_limit: 0             │    (offerType: 1)
          │    devotionals_limit: 0           │
          │                                    ├──► Handler Action:
          │                                    │    tier: 'spark'
          │                                    │    playbooks_limit: 10
          │                                    │    devotionals_limit: 10
          │                                    │    subscription_end_date:
          │                                    │      NOW + 30 days
          │                                    │
          └──► User is free tier              └──► User is paid subscriber
```

---

## 2. Monthly Subscription Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              MONTHLY SUBSCRIPTION (Spark $4.99/mo)              │
└─────────────────────────────────────────────────────────────────┘

DAY 0: SUBSCRIPTION START
┌──────────────────────────┐
│ User: Subscribe to Spark │
│ Monthly ($4.99)          │
└───────────┬──────────────┘
            │
            ├──► tier: 'spark'
            │    playbooks_limit: 10
            │    devotionals_limit: 10
            │    subscription_end_date: NOW + 30 days
            │
            └──► User gets 8/8 per month


DAY 1-29: USAGE PERIOD
┌────────────────────────┐
│ User generates content │
│ playbooks_used: 0→8    │
│ devotionals_used: 0→8  │
└────────────────────────┘


DAY 30: TWO PATHS

PATH A: AUTO-RENEWAL                PATH B: USER CANCELLED
┌─────────────────────┐             ┌──────────────────────┐
│ Apple: Charge $4.99 │             │ User cancelled on    │
│ for next month      │             │ Day 15               │
└─────────┬───────────┘             └──────────┬───────────┘
          │                                    │
          ├──► Apple Webhook:                 ├──► Webhook fired on Day 15:
          │    DID_RENEW                       │    DID_CHANGE_RENEWAL_STATUS
          │                                    │    (AUTO_RENEW_DISABLED)
          ├──► Handler Action:                 │
          │    playbooks_used: 0               ├──► Handler Action:
          │    devotionals_used: 0             │    auto_renew_enabled: false
          │    subscription_start_date: NOW    │    cancellation_date: Day 15
          │    subscription_end_date:          │    Keep tier until Day 30
          │      NOW + 30 days                 │
          │                                    ├──► User Experience Day 15-29:
          ├──► User Experience:                 │    - Still has Spark tier
          │    Fresh 10/10 limits              │    - Still has 10/10 limits
          │    New 30-day period               │    - Used 3/10 on Day 15
          │                                    │    - Can use 7 more until Day 30
          │                                    │    - NO MORE RESETS
DAY 60: RENEWAL AGAIN               │
┌─────────────────────┐             DAY 30: EXPIRATION
│ Repeat cycle        │             ┌──────────────────────┐
│ - Charge $4.99      │             │ subscription_end_date│
│ - Reset to 10/10    │             └──────────┬───────────┘
│ - New 30-day period │                        │
└─────────────────────┘                        │
                                               ├──► Apple Webhook:
Continues until cancelled...                   │    EXPIRED
                                               │
                                               ├──► Handler Action:
                                               │    tier: 'seeker'
                                               │    playbooks_limit: 0
                                               │    devotionals_limit: 0
                                               │
                                               └──► User loses access

┌───────────────────────────────────────────────────────────────┐
│ KEY POINT: After cancellation, NO MORE DID_RENEW webhooks    │
│ fire, therefore NO MORE USAGE RESETS happen.                  │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. Annual Subscription Flow

```
┌─────────────────────────────────────────────────────────────────┐
│           ANNUAL SUBSCRIPTION (Spark Annual $49.99/yr)          │
│              with MONTHLY USAGE REFRESHES                       │
└─────────────────────────────────────────────────────────────────┘

DAY 0: ANNUAL SUBSCRIPTION START
┌────────────────────────────┐
│ User: Subscribe to Spark   │
│ Annual ($49.99/year)       │
└────────────┬───────────────┘
             │
             ├──► tier: 'spark_annual'
             │    billing_cycle: 'annual'
             │    playbooks_limit: 10
             │    devotionals_limit: 10
             │    subscription_start_date: Day 0 (billing anchor)
             │    subscription_end_date: Day 365
             │    last_usage_reset: Day 0
             │
             └──► User gets 10/10 per month for 12 months


DAY 0-30: FIRST MONTH
┌────────────────────────┐
│ User uses 10/10 limits │
└────────────────────────┘


DAY 30: MONTHLY RESET (CLIENT-SIDE)
┌──────────────────────────────────┐
│ checkAndResetMonthlyUsage()      │
│ - Calculate: 30 days elapsed     │
│ - Reset: playbooks_used = 0      │
│ - Reset: devotionals_used = 0    │
│ - Update: last_usage_reset = Day 30
└──────────────┬───────────────────┘
               │
               └──► User gets fresh 10/10 for Month 2


DAY 60, 90, 120...330, 360: MONTHLY RESETS
┌──────────────────────────────────────────┐
│ Every 30 days:                           │
│ - Client checks days since billing anchor│
│ - If new 30-day period: Reset usage      │
│ - User always has fresh 10/10 each month  │
└──────────────────────────────────────────┘


DAY 180: USER CANCELS (MID-YEAR)
┌─────────────────────────────────┐
│ User cancels on Day 180         │
│ (6 months into annual)          │
└────────────┬────────────────────┘
             │
             ├──► Apple Webhook:
             │    DID_CHANGE_RENEWAL_STATUS
             │    (AUTO_RENEW_DISABLED)
             │
             ├──► Handler Action:
             │    auto_renew_enabled: false
             │    cancellation_date: Day 180
             │    ⚠️ KEEP tier: 'spark_annual'
             │    ⚠️ KEEP billing_cycle: 'annual'
             │
             └──► User Experience Day 180-365:
                  - Still has Spark Annual tier
                  - Still has 10/10 monthly limits
                  - Monthly resets CONTINUE


DAY 210, 240, 270...360: RESETS CONTINUE
┌───────────────────────────────────────────┐
│ ✅ Monthly resets STILL WORK              │
│ - checkAndResetMonthlyUsage() still runs  │
│ - User paid for full year, gets full year│
│ - Day 210: Reset to 10/10                 │
│ - Day 240: Reset to 10/10                 │
│ - Day 270: Reset to 10/10                 │
│ - ... continues until Day 365             │
└───────────────────────────────────────────┘


DAY 365: EXPIRATION
┌─────────────────────────────────┐
│ subscription_end_date reached   │
└────────────┬────────────────────┘
             │
             ├──► Apple Webhook:
             │    EXPIRED
             │
             ├──► Handler Action:
             │    tier: 'seeker'
             │    billing_cycle: null
             │    playbooks_limit: 0
             │    devotionals_limit: 0
             │
             └──► User loses access


IF NOT CANCELLED: DAY 365 RENEWAL
┌─────────────────────────────────┐
│ Apple: Charge $49.99 for Year 2 │
└────────────┬────────────────────┘
             │
             ├──► Apple Webhook:
             │    DID_RENEW
             │
             ├──► Handler Action:
             │    playbooks_used: 0
             │    devotionals_used: 0
             │    subscription_start_date: Day 365 (new anchor)
             │    subscription_end_date: Day 730
             │
             └──► Cycle repeats for Year 2

┌───────────────────────────────────────────────────────────────┐
│ KEY POINT: Annual subscriptions get monthly refreshes via     │
│ CLIENT-SIDE calculations (checkAndResetMonthlyUsage).         │
│ Cancellation does NOT stop monthly resets - user paid for    │
│ full year, so they get full year of monthly refreshes.       │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Refund Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        REFUND SCENARIO                          │
└─────────────────────────────────────────────────────────────────┘

BEFORE REFUND: Active Subscription
┌─────────────────────────────────┐
│ User: Spark Annual              │
│ Day 180 of 365                  │
│ playbooks_limit: 10             │
│ devotionals_limit: 10           │
│ subscription_end_date: Day 365  │
└────────────┬────────────────────┘
             │
             │
USER REQUESTS REFUND
┌─────────────────────────────────┐
│ User contacts Apple Support     │
│ Apple: Reviews request          │
│ Apple: ✅ Approves refund       │
└────────────┬────────────────────┘
             │
             │
IMMEDIATE WEBHOOK
┌─────────────────────────────────┐
│ Apple Webhook: REFUND           │
│ ⚠️ NO GRACE PERIOD              │
│ ⚠️ IMMEDIATE ACTION             │
└────────────┬────────────────────┘
             │
             ├──► Handler Action:
             │    tier: 'seeker' ⚠️
             │    billing_cycle: null
             │    playbooks_limit: 0 ⚠️
             │    devotionals_limit: 0 ⚠️
             │    smart_journaling_enabled: false
             │    subscription_end_date: NOW ⚠️
             │    refund_date: NOW
             │    status: 'refunded'
             │
             └──► User Experience:
                  - IMMEDIATE loss of access
                  - No remaining usage honored
                  - No pro-rated access (even if 6 months left)
                  - Downgraded to Seeker (0/0)
                  - All paid features disabled


COMPARISON: Cancellation vs Refund
┌────────────────────────────────────────────────────────────────┐
│ CANCELLATION (Auto-Renew Disabled):                           │
│ ✅ Keep access until subscription_end_date                    │
│ ✅ Keep monthly refreshes (annual)                            │
│ ✅ Honor remaining usage                                       │
│ ✅ User gets what they paid for                               │
│                                                                │
│ REFUND (Money returned):                                       │
│ ❌ IMMEDIATE loss of access                                    │
│ ❌ No monthly refreshes                                        │
│ ❌ No remaining usage                                          │
│ ❌ Downgrade to Seeker instantly                               │
└────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ KEY POINT: Refunds are immediate and total. User loses all   │
│ access instantly, even if they had months remaining.         │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. Payment Failure & Grace Period

```
┌─────────────────────────────────────────────────────────────────┐
│                   PAYMENT FAILURE SCENARIO                      │
└─────────────────────────────────────────────────────────────────┘

DAY 30: RENEWAL ATTEMPT
┌─────────────────────────────────┐
│ Apple: Attempt to charge $4.99  │
│ User's card: DECLINED ❌        │
└────────────┬────────────────────┘
             │
             │
IMMEDIATE WEBHOOK
┌─────────────────────────────────┐
│ Apple Webhook:                  │
│ DID_FAIL_TO_RENEW               │
└────────────┬────────────────────┘
             │
             ├──► Handler Action:
             │    billing_issue: true ⚠️
             │    grace_period_end_date: NOW + 3 days
             │    Keep tier: 'spark' ✅
             │    Keep limits: 10/10 ✅
             │
             └──► User Experience:
                  - Keeps Spark tier badge ✅
                  - CANNOT generate playbooks ❌
                  - CANNOT generate devotionals ❌
                  - Can view existing content ✅
                  - See billing issue warning


DAY 30-33: GRACE PERIOD (3 DAYS)
┌─────────────────────────────────────────┐
│ User has 3 days to fix payment          │
│                                          │
│ Generation Blocked Logic:                │
│ if (billing_issue === true &&           │
│     grace_period_end_date > NOW) {      │
│   can_generate_playbook: false          │
│   can_generate_devotional: false        │
│ }                                        │
└─────────────┬───────────────────────────┘
              │
              │
TWO OUTCOMES:

PATH A: PAYMENT FIXED              PATH B: GRACE PERIOD EXPIRES
┌─────────────────────┐           ┌──────────────────────┐
│ User updates card   │           │ Day 33: grace_period_│
│ Apple: Retry charge │           │ end_date reached     │
│ Payment: SUCCESS ✅ │           └──────────┬───────────┘
└─────────┬───────────┘                      │
          │                                  │
          ├──► Apple Webhook:                ├──► Apple Webhook:
          │    DID_RENEW                     │    GRACE_PERIOD_EXPIRED
          │                                  │
          ├──► Handler Action:                ├──► Handler Action:
          │    billing_issue: false          │    tier: 'seeker'
          │    grace_period_end_date: null   │    billing_issue: false
          │    playbooks_used: 0             │    grace_period_end_date: null
          │    devotionals_used: 0           │    playbooks_limit: 0
          │                                  │    devotionals_limit: 0
          ├──► User Experience:                │
          │    - Generation enabled ✅       ├──► User Experience:
          │    - Fresh 10/10 limits           │    - Downgraded to Seeker
          │    - Continue subscription       │    - Lost all access
          │                                  │
          └──► Back to normal               └──► Must re-subscribe

┌───────────────────────────────────────────────────────────────┐
│ KEY POINT: Grace period keeps tier badge but blocks          │
│ generation. User has 3 days to fix payment or lose access.   │
└───────────────────────────────────────────────────────────────┘
```

---

## 6. Complete Decision Tree

```
┌─────────────────────────────────────────────────────────────────┐
│              SUBSCRIPTION STATE DECISION TREE                   │
└─────────────────────────────────────────────────────────────────┘

                        ┌─────────────┐
                        │   USER      │
                        │  SUBSCRIBES │
                        └──────┬──────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
         ┌──────▼──────┐              ┌──────▼──────┐
         │ Free Trial  │              │ Paid Tier   │
         │  (3 days)   │              │ (Immediate) │
         └──────┬──────┘              └──────┬──────┘
                │                             │
        ┌───────┴────────┐            ┌──────┴──────┐
        │                │            │             │
    ┌───▼────┐     ┌────▼────┐   ┌───▼────┐   ┌────▼────┐
    │Cancel? │     │Convert? │   │Monthly │   │Annual   │
    └───┬────┘     └────┬────┘   └───┬────┘   └────┬────┘
        │               │            │             │
    ┌───▼────┐     ┌────▼────┐       │             │
    │Keep til│     │Upgrade  │       │             │
    │Day 3   │     │to Paid  │       │             │
    └───┬────┘     └────┬────┘       │             │
        │               │            │             │
        │               └────────┬───┴─────────────┘
        │                        │
        │                   ┌────▼────────┐
        │                   │  ACTIVE     │
        │                   │ SUBSCRIPTION│
        │                   └────┬────────┘
        │                        │
        │          ┌─────────────┼─────────────┐
        │          │             │             │
        │     ┌────▼─────┐  ┌────▼─────┐  ┌───▼────┐
        │     │  Renew   │  │ Cancel   │  │Payment │
        │     │ Success  │  │          │  │ Failed │
        │     └────┬─────┘  └────┬─────┘  └───┬────┘
        │          │             │            │
        │     ┌────▼─────┐  ┌────▼─────┐  ┌───▼────────┐
        │     │Reset     │  │Keep til  │  │Grace Period│
        │     │Usage     │  │End Date  │  │  (3 days)  │
        │     └────┬─────┘  └────┬─────┘  └───┬────────┘
        │          │             │            │
        │          │             │        ┌───┴────┐
        │          │             │        │        │
        │          │             │   ┌────▼───┐ ┌──▼────┐
        │          │             │   │Fixed?  │ │Expired│
        │          │             │   └────┬───┘ └───┬───┘
        │          │             │        │         │
        │          └─────┬───────┘        │         │
        │                │                │         │
        │                └────────┬───────┘         │
        │                         │                 │
        └─────────────────────────┼─────────────────┘
                                  │
                           ┌──────▼───────┐
                           │   EXPIRED    │
                           │  or REFUND   │
                           └──────┬───────┘
                                  │
                           ┌──────▼───────┐
                           │   SEEKER     │
                           │  (0/0 Free)  │
                           └──────────────┘
```

---

## Summary Table

| Event | Trigger | Tier Change | Usage Reset | Monthly Refresh | Access Duration |
|-------|---------|-------------|-------------|-----------------|-----------------|
| **Trial Start** | Purchase | seeker → free_trial | Yes | No | 3 days |
| **Trial Cancel** | User action | None | No | No | Until trial_end_date |
| **Trial Convert** | Day 3 auto | free_trial → paid | Yes | Yes (per cycle) | 30 days or 365 days |
| **Monthly Renew** | Day 30 auto | None | Yes (webhook) | Yes | +30 days |
| **Annual Renew** | Day 365 auto | None | Yes (webhook) | Yes (client-side) | +365 days |
| **Monthly Cancel** | User action | None | **Stops** | **No** | Until period end |
| **Annual Cancel** | User action | None | **Continues** | **Yes** | Until year end |
| **Payment Fail** | Auto | None | No | Paused | Grace period (3d) |
| **Grace Expire** | Auto | paid → seeker | Yes | No | 0 (immediate) |
| **Refund** | Apple approval | paid → seeker | N/A | No | 0 (immediate) |
| **Expired** | Auto | paid → seeker | Yes | No | 0 (immediate) |

---

**Document Version:** 1.0  
**Created:** December 13, 2024  
**Companion to:** STOREKIT_FLOW_ANALYSIS.md
