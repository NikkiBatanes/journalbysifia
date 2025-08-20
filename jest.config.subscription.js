module.exports = {
  preset: 'react-native',
  testMatch: ['<rootDir>/src/__tests__/subscription/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/subscription/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': 'babel-jest',
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/services/NewSubscriptionService.ts',
    'src/services/FamilySubscriptionService.ts',
    'src/services/DiscountCodeService.ts',
    'src/services/PlatformPaymentService.ts',
    'src/services/AppleStoreKitService.ts',
    'src/services/GooglePlayBillingService.ts',
    'src/hooks/useNewSubscription.ts',
    'src/hooks/useFamilySubscription.ts',
    'src/hooks/useDiscountCode.ts',
    'src/hooks/usePlatformPayment.ts',
  ],
  coverageDirectory: 'coverage/subscription',
  coverageReporters: ['text', 'lcov', 'html'],
  testEnvironment: 'node',
};
