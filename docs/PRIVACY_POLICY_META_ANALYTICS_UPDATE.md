# Privacy Policy Update - Meta Analytics & Advertising Measurement

**Date:** May 29, 2026

## Purpose
Update the privacy policy at https://sifia.app/legal/privacy to properly disclose:
- Use of Meta (Facebook) analytics and advertising measurement tools
- Specific events tracked: app installs, registrations, trial starts, purchases
- Current advertiser ID collection status (disabled)
- Data collection practices

---

## Section to Add/Update in Privacy Policy

### Add to "Data Collection" or "Analytics and Advertising" Section

**Recommended new section to add:**

```
### Analytics and Advertising Measurement

We use analytics and advertising measurement tools, including Meta (Facebook) App Events, to understand how users interact with siFia and to measure the effectiveness of our marketing efforts.

**What We Track:**
- App installations and launches
- User registrations and sign-ups
- Free trial activations
- In-app purchases and subscriptions

**What We Don't Track:**
- We do NOT intentionally send your email address or name to Meta
- We do NOT collect or use your Advertising ID (IDFA on iOS, GAID on Android)
- Advertiser ID collection is currently disabled in our app

**How This Data Is Used:**
- To measure the effectiveness of our advertising campaigns
- To understand user acquisition sources
- To improve app performance and user experience
- For fraud prevention and security purposes

**Your Control:**
- You can opt out of personalized advertising in your device settings
- iOS users: Settings > Privacy > Advertising > Limit Ad Tracking
- Android users: Google Settings > Ads > Opt out of interest-based ads
```

---

## Alternative: Update Existing "Third-Party Services" Section

If your privacy policy already has a third-party services section, add this:

```
### Meta (Facebook) App Events

We use Meta's App Events SDK to measure app performance and advertising effectiveness. This allows us to track:

- App installs and launches
- User registrations
- Trial starts
- Purchases and subscriptions

**Important Privacy Notes:**
- We do not send personal information like email addresses or names to Meta
- We do not collect or use Advertising IDs (IDFA/GAID)
- Advertiser ID collection is disabled in our app configuration
- This helps us measure campaign performance without compromising your privacy

For more information about Meta's data practices, visit: https://www.facebook.com/about/privacy
```

---

## Update "Last Updated" Date

```
Last Updated: May 29, 2026
```

---

## Summary of Changes

✅ **Added Meta analytics disclosure** - Properly discloses use of Meta App Events
✅ **Listed specific events tracked** - Installs, registrations, trials, purchases
✅ **Clarified what is NOT tracked** - Email, name, Advertising IDs
✅ **Disclosed advertiser ID status** - Currently disabled for privacy
✅ **Added user control information** - How to opt out of personalized ads
✅ **Updated date** - May 29, 2026

---

## Implementation Steps

1. Log into your website CMS/editor (WordPress, Webflow, etc.)
2. Navigate to the Privacy Policy page at https://sifia.app/legal/privacy
3. Add the new "Analytics and Advertising Measurement" section OR update the "Third-Party Services" section
4. Update the "Last Updated" date to May 29, 2026
5. Save and publish the changes
6. Test that the changes are visible on the live site

---

## Why This Update Is Important

**Matches App Behavior:**
- Your app sends Meta events for install/launch, registration, trial start, purchase
- Your privacy policy now accurately reflects this

**Compliance:**
- Apple App Store requires privacy policies to match actual data collection
- Google Play Data Safety requires disclosure of analytics/advertising tools
- Meta requires proper disclosure when using App Events

**Privacy-First Approach:**
- Clearly states advertiser ID collection is disabled
- Explicitly states email/name are NOT sent to Meta
- Provides user control information

---

## Next Steps After Privacy Policy Update

Once your privacy policy is updated, you should also:

1. **App Store Connect Privacy Labels:**
   - Review and update if needed to reflect Meta analytics usage
   - Ensure data collection disclosures match your privacy policy

2. **Google Play Data Safety:**
   - Update Data Safety section to disclose analytics/advertising measurement
   - List Meta as a third-party analytics provider if required

3. **Consider Future ATT Implementation:**
   - If you later enable `META_ADVERTISER_ID_COLLECTION_ENABLED=true`
   - You'll need to add App Tracking Transparency (ATT) prompt on iOS
   - Update privacy policy to reflect advertiser ID collection

---

## Current App Configuration (Reference)

Your current `.env` configuration:
```
META_ADVERTISER_ID_COLLECTION_ENABLED=false
```

This is the correct privacy-first approach for now. Only enable advertiser ID collection when:
- Privacy policy is updated (done with this change)
- App Store privacy labels are updated
- Google Play Data Safety is updated
- ATT prompt is implemented on iOS
- You're ready for more precise ad attribution

---

## Resources

- Apple Privacy Guidelines: https://developer.apple.com/app-store/user-privacy-and-data-use/
- Meta App Events Documentation: https://developers.facebook.com/docs/app-events/getting-started-app-events-ios
- Google Play Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
