# API Documentation

## 🌐 Base Configuration

### Endpoints
```
Production: https://aesmrjinczhknchlrsmt.supabase.co
Development: [Your dev Supabase URL]
```

### Authentication
All API requests require authentication via Supabase session tokens.

```typescript
headers: {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${session.access_token}`
}
```

## 📱 Core Services

### 1. Authentication Service
**File:** `src/context/AuthContext.tsx`

#### Sign In
```typescript
await signIn(email: string, password: string)
```

#### Sign Up
```typescript
await signUp(email: string, password: string, displayName: string)
```

#### Sign Out
```typescript
await signOut()
```

---

### 2. Playbook API
**File:** `src/services/modernPlaybookApi.ts`

#### Generate Playbook
```typescript
generatePlaybook({
  userInput: string,
  userName: string,
  bibleVersion?: string,
  userId?: string,
  dateOfBirth?: string
}): Promise<Playbook>
```

**Response:**
```typescript
{
  id: string,
  title: string,
  summary: string,
  affirmations: string[],
  challenges: Challenge[],
  created_at: string
}
```

#### Get User Playbooks
```typescript
getUserPlaybooks(userId: string): Promise<Playbook[]>
```

#### Delete Playbook
```typescript
deletePlaybook(playbookId: string): Promise<void>
```

---

### 3. Devotional API
**File:** `src/services/modernDevotionalApi.ts`

#### Generate Devotional
```typescript
generateDevotional({
  duration: number,
  playbookId?: string,
  userInput?: string,
  bibleVersion?: string
}): Promise<Devotional>
```

**Response:**
```typescript
{
  id: string,
  title: string,
  content: string,
  duration: number,
  scripture_references: string[],
  created_at: string
}
```

---

### 4. Subscription Service
**File:** `src/services/NewSubscriptionService.ts`

#### Get User Subscription
```typescript
getUserSubscription(userId: string): Promise<Subscription>
```

**Response:**
```typescript
{
  user_id: string,
  tier: 'seeker' | 'spark' | 'growth' | 'transformation',
  status: 'active' | 'cancelled' | 'expired',
  limits: {
    playbooks: number,
    devotionals: number,
    playbooks_limit: number,
    devotionals_limit: number
  }
}
```

#### Upgrade Subscription
```typescript
upgradeSubscription(
  userId: string,
  newTier: SubscriptionTier
): Promise<void>
```

---

### 5. Apple StoreKit Service
**File:** `src/services/AppleStoreKitService.ts`

#### Initialize
```typescript
await AppleStoreKitService.getInstance().initialize()
```

#### Get Available Products
```typescript
getAvailableProducts(): Promise<Product[]>
```

#### Purchase Subscription
```typescript
purchaseSubscription(
  productId: string,
  userId: string
): Promise<PurchaseResult>
```

#### Restore Purchases
```typescript
restorePurchases(userId: string): Promise<RestoreResult>
```

---

## 🔐 Security

### Rate Limiting
- API calls: 100 requests/minute per user
- Playbook generation: 10 requests/hour
- Devotional generation: 20 requests/hour

### Error Handling
All services implement:
- Automatic retry (3 attempts)
- Circuit breaker pattern
- Timeout protection (120s for generation)
- Graceful degradation

### Error Codes
```typescript
{
  'AUTH_ERROR': 'Authentication failed',
  'RATE_LIMIT': 'Too many requests',
  'TIMEOUT': 'Request timeout',
  'NETWORK_ERROR': 'Network connection failed',
  'VALIDATION_ERROR': 'Invalid input data'
}
```

---

## 📊 Response Formats

### Success Response
```json
{
  "data": { ... },
  "error": null
}
```

### Error Response
```json
{
  "data": null,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": { ... }
  }
}
```

---

## 🧪 Testing

### Test Credentials (Development Only)
```
Email: test@sifia.app
Password: TestPassword123!
```

### Mock Data
Test data available in `__tests__` directories

---

## 📈 Performance

### Timeouts
- Standard API calls: 30s
- AI Generation (Playbook): 120s
- AI Generation (Devotional): 120s
- Database queries: 10s

### Caching
- User session: In-memory + AsyncStorage
- Playbooks: AsyncStorage
- Subscription status: 5-minute cache

---

## 🔄 Versioning

Current API Version: **v1**

Breaking changes will be communicated via:
1. Email notification (2 weeks notice)
2. In-app notification
3. API deprecation headers

---

## 📞 Support

### API Issues
- Check error logs in console
- Review network tab in debugger
- Contact backend team with request ID

### Rate Limiting
- Implement exponential backoff
- Cache responses when possible
- Use request deduplication

---

**Last Updated:** 2025-11-24
**Version:** 1.0.0
