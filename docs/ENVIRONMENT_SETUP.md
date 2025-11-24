# Environment Setup Guide

## 🔐 Required Environment Variables

### Critical (Required for App to Function)

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Example:
# SUPABASE_URL=https://xxxxx.supabase.co
# SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Optional (Feature-Specific)

```bash
# OpenAI Configuration (for AI features)
OPENAI_API_KEY=your_openai_api_key

# Payment Configuration - US Market
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_key

# Payment Configuration - Philippines Market
PAYMONGO_PUBLIC_KEY=pk_live_your_paymongo_key

# App Configuration
APP_ENV=production
API_BASE_URL=https://api.sifia.app

# Feature Flags
ENABLE_TRIAL_SYSTEM=true
ENABLE_ANALYTICS=true
```

## 📝 Setup Instructions

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Fill in Required Values

Edit `.env` and replace placeholder values with your actual credentials:

```bash
# ❌ DON'T USE PLACEHOLDERS
SUPABASE_URL=your_supabase_project_url

# ✅ USE ACTUAL VALUES
SUPABASE_URL=https://aesmrjinczhknchlrsmt.supabase.co
```

### 3. Verify Configuration

The app will validate environment variables on startup. If any required variables are missing, you'll see:

```
❌ CRITICAL: Missing required environment variables. 
App cannot function without SUPABASE_URL and SUPABASE_ANON_KEY.
```

## 🔒 Security Best Practices

### DO ✅
- Store `.env` file locally only (already in `.gitignore`)
- Use different keys for development and production
- Rotate keys regularly (every 90 days)
- Use environment-specific Supabase projects
- Keep production keys in secure vault (1Password, AWS Secrets Manager)

### DON'T ❌
- Commit `.env` file to git
- Share keys via email or Slack
- Use production keys in development
- Hardcode keys in source code
- Store keys in screenshots or documentation

## 🚀 Deployment Environments

### Development
```bash
APP_ENV=development
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=dev_key_here
```

### Staging
```bash
APP_ENV=staging
SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_ANON_KEY=staging_key_here
```

### Production
```bash
APP_ENV=production
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=prod_key_here
```

## 🔧 Platform-Specific Setup

### iOS (Xcode)
1. Environment variables are loaded via `react-native-config`
2. Run `cd ios && pod install` after adding new variables
3. Clean build folder: `Cmd+Shift+K`
4. Rebuild app

### Android (Android Studio)
1. Environment variables are loaded via `react-native-config`
2. Clean build: `./gradlew clean`
3. Rebuild app

## 🐛 Troubleshooting

### App crashes on startup
**Cause:** Missing required environment variables

**Solution:**
1. Check `.env` file exists in project root
2. Verify all required variables are set
3. Restart Metro bundler: `npm start -- --reset-cache`

### Environment variables not updating
**Cause:** Metro cache or native build cache

**Solution:**
```bash
# Clear Metro cache
npm start -- --reset-cache

# iOS: Clean build
cd ios && rm -rf build && pod install && cd ..

# Android: Clean build
cd android && ./gradlew clean && cd ..
```

### "SUPABASE_URL is undefined"
**Cause:** Environment not loaded properly

**Solution:**
1. Verify `react-native-config` is installed
2. Check `.env` file format (no quotes around values)
3. Restart app completely

## 📞 Support

For environment setup issues:
1. Check this guide first
2. Review error logs in console
3. Contact DevOps team with error details

---

**Last Updated:** 2025-11-24
**Version:** 1.0.0
