// Test setup for subscription system tests

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  NativeModules: {},
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
}));

// Mock react-native-iap
jest.mock('react-native-iap', () => ({
  initConnection: jest.fn(),
  endConnection: jest.fn(),
  getProducts: jest.fn(),
  getSubscriptions: jest.fn(),
  requestPurchase: jest.fn(),
  requestSubscription: jest.fn(),
  finishTransaction: jest.fn(),
  validateReceiptIos: jest.fn(),
  validateReceiptAndroid: jest.fn(),
  purchaseErrorListener: jest.fn(),
  purchaseUpdatedListener: jest.fn(),
  getAvailablePurchases: jest.fn(),
}));

// Mock Supabase client
jest.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(),
          lt: jest.fn(() => ({
            select: jest.fn(),
          })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(),
        })),
      })),
    })),
  },
}));

// Mock authentication context
jest.mock('../../context/IndustryStandardAuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
    },
    isAuthenticated: true,
  })),
}));

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock Date for consistent testing
const mockDate = new Date('2024-01-15T10:00:00Z');
global.Date = jest.fn(() => mockDate) as any;
global.Date.now = jest.fn(() => mockDate.getTime());
global.Date.UTC = Date.UTC;
global.Date.parse = Date.parse;
global.Date.prototype = Date.prototype;

// Test data factories
export const createMockSubscription = (overrides = {}) => ({
  id: 'sub-123',
  user_id: 'user-123',
  tier: 'spark',
  status: 'active',
  playbooks_limit: 8,
  devotionals_limit: 8,
  playbooks_used: 0,
  devotionals_used: 0,
  smart_journaling_enabled: true,
  trial_start_date: null,
  trial_end_date: null,
  subscription_start_date: '2024-01-01T00:00:00Z',
  subscription_end_date: '2024-02-01T00:00:00Z',
  platform: null,
  platform_subscription_id: null,
  platform_transaction_id: null,
  family_group_id: null,
  family_role: 'member',
  discount_code: null,
  discount_applied_amount: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockFamilyGroup = (overrides = {}) => ({
  id: 'family-123',
  admin_user_id: 'user-123',
  group_name: 'Test Family',
  max_members: 6,
  current_members: 1,
  platform_subscription_id: 'sub-123',
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  members: [],
  ...overrides,
});

export const createMockDiscountCode = (overrides = {}) => ({
  id: 'discount-123',
  code: 'TESTCODE',
  discount_percentage: 20,
  discount_amount: null,
  valid_from: '2024-01-01T00:00:00Z',
  valid_until: '2024-02-01T00:00:00Z',
  max_uses: 10,
  current_uses: 0,
  applicable_tiers: ['spark', 'growth'],
  created_at: '2024-01-01T00:00:00Z',
  is_active: true,
  ...overrides,
});

export const createMockProduct = (overrides = {}) => ({
  productId: 'com.yourcompany.sifia.spark.monthly',
  price: '9.99',
  currency: 'USD',
  localizedPrice: '$9.99',
  title: 'Spark Monthly',
  description: 'Spark subscription',
  tier: 'spark',
  ...overrides,
});

// Test helpers
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockSupabaseResponse = (data: any, error: any = null) => ({
  data,
  error,
});

export const mockSupabaseChain = (methods: Record<string, any>) => {
  const chain = {};
  Object.keys(methods).forEach(method => {
    chain[method] = jest.fn(() => {
      if (methods[method] && typeof methods[method] === 'object') {
        return mockSupabaseChain(methods[method]);
      }
      return Promise.resolve(methods[method]);
    });
  });
  return chain;
};
