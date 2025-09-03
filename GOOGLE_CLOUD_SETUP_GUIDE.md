# Google Cloud Console Setup Guide

## 🎯 **You Need 3 OAuth Clients (Not Just 1!)**

### **Current Setup:**
- ✅ **Web Client**: `1062728638095-qqvkdh9rnp0v5ql2jnb0kcj6h9kf9dq3.apps.googleusercontent.com` (for Supabase)

### **Missing Setup:**
- ❌ **iOS Client**: Needed for iOS app
- ❌ **Android Client**: Needed for Android app

---

## 📱 **Step 1: Create iOS OAuth Client**

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. **Application type**: Choose **"iOS"**
4. **Name**: `siFia iOS`
5. **Bundle ID**: `app.sifia.com`
6. Click **"CREATE"**
7. **Copy the iOS Client ID** (you'll need this)

**Important**: iOS clients don't have client secrets - this is normal!

---

## 🤖 **Step 2: Create Android OAuth Client**

1. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. **Application type**: Choose **"Android"**
3. **Name**: `siFia Android`
4. **Package name**: `app.sifia.com`
5. **SHA-1 certificate fingerprint**: 
   - For debug: Run `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
   - Copy the SHA1 fingerprint
6. Click **"CREATE"**
7. **Copy the Android Client ID**

---

## 🔧 **Step 3: Update Your App Configuration**

### **iOS Configuration** (already done):
- ✅ URL scheme added to Info.plist
- ✅ iOS Client ID will be used in code

### **Android Configuration** (you'll need to do):
- Add SHA-1 fingerprint to Google Cloud Console
- Update Android configuration files

---

## 🌐 **Step 4: Keep All 3 Clients**

**For Supabase (Backend)**:
- Use your **Web Client** with client secret

**For iOS App**:
- Use the new **iOS Client ID** (no secret needed)

**For Android App**:
- Use the new **Android Client ID** (no secret needed)

---

## 🎯 **Why You Need All 3:**

1. **Web Client**: Supabase backend authentication
2. **iOS Client**: Native iOS Google Sign-In
3. **Android Client**: Native Android Google Sign-In

This is the standard setup for React Native apps with Supabase!
