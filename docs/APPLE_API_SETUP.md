# Apple Transaction History API Setup

## Overview
This allows you to query Apple's **PRODUCTION** API in real-time to check if users actually paid, then automatically upgrade them.

---

## Step 1: Generate Apple API Keys

### 1. Go to App Store Connect
https://appstoreconnect.apple.com/access/api

### 2. Create API Key
- Click **Keys** → **App Store Connect API**
- Click **+** (Generate API Key)
- Name: "Transaction History API"
- Access: **Admin** or **App Manager**
- Click **Generate**

### 3. Download Private Key
- Download the `.p8` file (AuthKey_XXXXXXXX.p8)
- **IMPORTANT**: This downloads only once - save it securely
- Note the **Key ID** (e.g., `ABC123XYZ`)
- Note the **Issuer ID** (at top of page, e.g., `12345678-1234-1234-1234-123456789012`)

---

## Step 2: Add Credentials to Supabase

### Via Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/aesmrjinczhknchlrsmt
2. Click: **Settings** → **Edge Functions** → **Secrets**
3. Add these secrets:

**APPLE_KEY_ID**:
```
ABC123XYZ
```

**APPLE_ISSUER_ID**:
```
12345678-1234-1234-1234-123456789012
```

**APPLE_PRIVATE_KEY**:
```
-----BEGIN PRIVATE KEY-----
[Paste entire content of .p8 file here]
-----END PRIVATE KEY-----
```

### Via CLI
```bash
supabase secrets set APPLE_KEY_ID=ABC123XYZ
supabase secrets set APPLE_ISSUER_ID=12345678-1234-1234-1234-123456789012
supabase secrets set APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
[paste .p8 content]
-----END PRIVATE KEY-----"
```

---

## Step 3: Install JWT Library for Proper Token Generation

The current function has simplified JWT generation. You need a proper JWT library.

### Option A: Use Deno JWT Library (Recommended)
Update the function to use: https://deno.land/x/djwt

```typescript
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts";

// Generate JWT token for Apple API
const jwtToken = await create(
  { alg: "ES256", kid: appleKeyId },
  {
    iss: appleIssuerId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    aud: "appstoreconnect-v1",
  },
  applePrivateKey
);
```

### Option B: Use External JWT Service
Generate tokens via external service and pass to function.

---

## Step 4: Deploy the Function

```bash
cd /Users/nikkimaebatanes/CascadeProjects/siFia
supabase functions deploy sync-apple-transactions
```

---

## Step 5: Run the Sync

### Manual Run (Recommended First Time)
```bash
curl -X POST "https://aesmrjinczhknchlrsmt.supabase.co/functions/v1/sync-apple-transactions" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Response Example
```json
{
  "success": true,
  "checked": 5,
  "upgraded": 2,
  "results": [
    {
      "user_id": "075a3764-...",
      "success": true,
      "action": "no_payment",
      "message": "Only trial transactions - user did not pay"
    },
    {
      "user_id": "abc123-...",
      "success": true,
      "action": "upgraded",
      "from_tier": "seeker",
      "to_tier": "growth",
      "product_id": "app.sifia.com.growth.monthly",
      "billing_cycle": "monthly"
    }
  ]
}
```

---

## Step 6: Schedule Automatic Sync (Optional)

### Via Supabase Cron (Coming Soon)
When Supabase supports cron for Edge Functions, schedule to run daily.

### Via External Cron
Use services like:
- **Render Cron Jobs**
- **GitHub Actions** (scheduled workflow)
- **AWS EventBridge**

Schedule daily at midnight:
```yaml
# .github/workflows/sync-apple.yml
name: Sync Apple Transactions
on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync Apple Transactions
        run: |
          curl -X POST "${{ secrets.SUPABASE_FUNCTION_URL }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

---

## How It Works

### 1. Find Suspicious Users
- Users with `original_transaction_id`
- Currently on `seeker` or `free_trial` tier
- Trial ended in the past

### 2. Query Apple API
For each user:
- Call: `GET /inApps/v1/history/{originalTransactionId}`
- Uses **PRODUCTION** API (not sandbox)
- Real-time data (no 2-day delay)

### 3. Check Transactions
- Decodes all signed transactions
- Filters for paid products (non-freetrial)
- Checks if user actually paid

### 4. Auto-Upgrade
If paid:
- Upgrade to correct tier (`growth`, `spark`, `transformation`)
- Set subscription dates
- Reset usage counters
- Mark as converted

If not paid:
- Leave on `seeker` tier
- Log reason (no payment, trial expired)

---

## Sandbox vs Production Detection

The function automatically detects environment:
- Transaction IDs starting with `2` or `4` → Sandbox API
- Transaction IDs starting with `1` or `5` → Production API

---

## Troubleshooting

### Error: "Missing Apple API credentials"
- Check Supabase secrets are set
- Verify key names match exactly

### Error: "Apple API returned 401"
- JWT token generation failed
- Check private key format
- Verify Key ID and Issuer ID are correct

### Error: "Apple API returned 404"
- `original_transaction_id` doesn't exist in Apple
- User may have deleted app/subscription

### No Users Upgraded
**Possible reasons**:
1. Users genuinely didn't pay (only started trial)
2. Users cancelled before trial ended
3. Apple hasn't processed payments yet

**How to verify**:
- Check Apple Financial Reports for actual revenue
- If reports show revenue but no upgrades, there's an API issue

---

## Security Notes

1. **Never commit** `.p8` file to git
2. **Store** private key in Supabase secrets only
3. **Rotate** API keys if compromised
4. **Limit** API key access to necessary permissions

---

## Next Steps After Setup

1. **Test with one user first**: Check logs to ensure API calls work
2. **Run full sync**: Process all suspicious users
3. **Schedule daily runs**: Keep database in sync with Apple
4. **Monitor results**: Check how many users get upgraded

This replaces all manual SQL updates with automated Apple API sync.
