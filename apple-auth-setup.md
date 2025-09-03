# Apple Authentication Setup Guide

## Required Information for Supabase Configuration

### 1. From Apple Developer Console:
- **Team ID**: Found in Apple Developer → Membership details
- **Key ID**: The ID of your .p8 key (10-character string)
- **Bundle ID**: Your app's bundle identifier (e.g., com.yourcompany.sifia)
- **Private Key**: Contents of your .p8 file

### 2. Supabase Configuration Steps:

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable "Apple" provider
3. Fill in the required fields:
   - **Team ID**: [Your Apple Team ID]
   - **Key ID**: [Your .p8 Key ID]  
   - **Private Key**: [Contents of your .p8 file]
   - **Bundle ID**: [Your app bundle ID]

### 3. Redirect URL:
Use this exact URL in Supabase:
```
https://[your-project-id].supabase.co/auth/v1/callback
```

### 4. Service ID Configuration:
In Apple Developer Console:
- Create a Service ID
- Configure it with your Supabase redirect URL
- Enable "Sign in with Apple" for web authentication

## Next Steps After Supabase Setup:
1. Install React Native packages
2. Configure iOS project settings
3. Implement authentication service
