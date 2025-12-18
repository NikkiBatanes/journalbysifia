# What’s New (1.3.2)

- **Purchases are more reliable**: Improved Apple subscription syncing so upgrades/trials reflect correctly in the app.
- **Better onboarding offer experience**: Updated Trial Offer copy and layout to make pricing clearer.
- **UI improvements across devices**: Better layout on small iPhones and improved logo sizing/positioning across devices.

---

# Testing Notes (1.3.2)

## Purchases are more reliable

### Backend / webhook verification (internal)
- This improvement is primarily validated via **Apple server-to-server events (webhooks)** and backend subscription sync.
- QA does not need to run end-to-end purchase flows for this item.
- Verify via backend logs/monitoring (where available):
  - Receipt validation / subscription sync logs
  - Webhook handler logs for renewals, upgrades, billing retries
  - Confirm the user’s tier/status updates correctly after webhook processing

## Better onboarding offer experience

### Onboarding paywall
- The onboarding paywall was simplified and now shows a **single tier** by default (instead of **three tiers**).
- Steps to verify:
  - Install/open the app.
  - Create a new account (or log out and sign up again).
  - Complete the onboarding flow until you reach the subscription offer / paywall screen.
  - Confirm the paywall presents **1 tier** (not a list of 3 tiers).

## UI improvements across devices

### Small phone layout
- Test on iPhone SE / 12 mini (or smallest device available).
- Complete the onboarding flow on a small phone.
- Verify primary CTA buttons are fully visible and tappable throughout onboarding.
- Verify text does not overflow/cut off on onboarding screens.

### Logo sizing/positioning
- Verify logo sizing/positioning looks consistent across common phone sizes.
- If you can, spot-check iPad for spacing/positioning regressions.
