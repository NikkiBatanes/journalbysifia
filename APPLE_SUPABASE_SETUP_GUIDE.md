# 🍎 Apple Sign-In Configuration Guide for Supabase

## **STEP 1: Gather Apple Developer Information**

### **1.1 Get Your Team ID**
1. Go to [Apple Developer Console](https://developer.apple.com/account/)
2. Click **"Membership"** in the left sidebar
3. Copy your **Team ID** (10-character string like `ABC123DEFG`)

### **1.2 Get Your Key ID**
1. In Apple Developer Console, go to **"Certificates, Identifiers & Profiles"**
2. Click **"Keys"** in the sidebar
3. Find your Sign in with Apple key (the one you downloaded the .p8 file for)
4. Copy the **Key ID** (10-character string like `XYZ789ABCD`)

### **1.3 Get Your Bundle ID**
1. Go to **"Identifiers"** in Apple Developer Console
2. Find your siFia app identifier
3. Copy your **Bundle ID** (should be something like `com.yourcompany.sifia`)

### **1.4 Prepare Your .p8 Key Content**
1. Locate your downloaded `.p8` file on your computer
2. Open it with a text editor (TextEdit, VSCode, etc.)
3. Copy the **ENTIRE content** including header and footer:
   ```
   -----BEGIN PRIVATE KEY-----
   MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
   [multiple lines of encoded key data]
   ...xyz123ABC
   -----END PRIVATE KEY-----
   ```

---

## **STEP 2: Configure Supabase Apple Provider (Updated Method)**

### **2.1 Access Your Supabase Project**
1. Go to [supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your **siFia project**

### **2.2 Navigate to Authentication**
1. In the left sidebar, click **"Authentication"**
2. Click the **"Providers"** tab at the top
3. Scroll down to find **"Apple"** in the list

### **2.3 Enable Apple Provider**
1. Click the **toggle switch** next to Apple to enable it
2. The Apple configuration form will appear

### **2.4 NEW APPROACH: Use Client-Side Authentication**
Since Supabase now expects JWT tokens, we'll configure Apple Sign-In to work client-side:

**Client ID (iOS Bundle ID):**
```
[Your Bundle ID from Step 1.3, e.g., com.yourcompany.sifia]
```

**Client Secret:** 
```
Leave this EMPTY or use "not_required"
```

**Redirect URL:**
```
https://[your-project-id].supabase.co/auth/v1/callback
```

### **2.5 Alternative: Generate JWT Secret (Advanced)**
If Supabase requires a JWT secret, you need to generate one using your .p8 key:

1. **Install JWT generation tool:**
```bash
npm install -g jsonwebtoken
```

2. **Create a JWT token using Node.js:**
```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

// Read your .p8 file
const privateKey = fs.readFileSync('path/to/your/AuthKey_XXXXXXXXXX.p8', 'utf8');

// Generate JWT
const token = jwt.sign({
  iss: 'YOUR_TEAM_ID',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (6 * 30 * 24 * 60 * 60), // 6 months
  aud: 'https://appleid.apple.com',
  sub: 'YOUR_CLIENT_ID'
}, privateKey, {
  algorithm: 'ES256',
  header: {
    kid: 'YOUR_KEY_ID'
  }
});

console.log(token);
```

### **2.6 Save Configuration**
1. Click **"Save"** button at the bottom
2. You should see a green success message

---

## **STEP 3: Configure Service ID (Important!)**

### **3.1 Create/Update Service ID in Apple Developer**
1. Go back to Apple Developer Console
2. Navigate to **"Certificates, Identifiers & Profiles"**
3. Click **"Identifiers"** → **"Services IDs"**
4. Create a new Service ID or edit existing one
5. Enable **"Sign in with Apple"**
6. Click **"Configure"**

### **3.2 Add Supabase Redirect URL**
In the Service ID configuration:

**Primary App ID:** Select your main app identifier

**Return URLs:** Add this exact URL (replace with your project ID):
```
https://[your-supabase-project-id].supabase.co/auth/v1/callback
```

Example:
```
https://abcdefghijklmnop.supabase.co/auth/v1/callback
```

### **3.3 Save Service ID**
1. Click **"Save"** in the Service ID configuration
2. Click **"Continue"** and **"Save"** again

---

## **STEP 4: Test Configuration**

### **4.1 Verify in Supabase**
1. Go back to Supabase Dashboard
2. Authentication → Providers → Apple
3. Ensure all fields are filled and saved
4. Status should show as "Enabled"

### **4.2 Test Authentication Flow**
1. Build and run your iOS app
2. Try Apple Sign-In button
3. Check Supabase Dashboard → Authentication → Users for new user

---

## **STEP 5: Troubleshooting Common Issues**

### **Issue: "Invalid client_id"**
- **Solution:** Double-check your Bundle ID matches exactly in both Apple Developer and Supabase

### **Issue: "Invalid redirect_uri"**
- **Solution:** Ensure the Supabase redirect URL is added to your Service ID Return URLs

### **Issue: "Invalid private key"**
- **Solution:** Make sure you copied the ENTIRE .p8 file content including header/footer lines

### **Issue: Authentication works but user data is missing**
- **Solution:** Check that you requested the correct scopes (email, fullName) in your app code

---

## **STEP 6: Environment Variables**

Create a `.env` file in your project root with:

```bash
# Copy from .env.example and fill in your actual values
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_BUNDLE_ID=com.yourcompany.sifia
```

---

## **VERIFICATION CHECKLIST**

- ✅ Team ID copied from Apple Developer Membership
- ✅ Key ID copied from the specific .p8 key
- ✅ Bundle ID matches your app identifier exactly
- ✅ Entire .p8 file content pasted (including BEGIN/END lines)
- ✅ Apple provider enabled in Supabase
- ✅ Service ID configured with correct redirect URL
- ✅ Environment variables set up
- ✅ iOS app can trigger Apple Sign-In

---

## **Next Steps After Configuration**

1. Test Apple Sign-In on iOS device/simulator
2. Verify user creation in Supabase Dashboard
3. Test sign-out functionality
4. Configure Google Sign-In (separate process)
5. Deploy to production with proper environment variables

---

**Need Help?** 
- Check Supabase logs in Dashboard → Logs
- Check iOS device logs in Xcode console
- Verify all IDs match exactly between Apple Developer and Supabase
