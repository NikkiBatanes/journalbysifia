/**
 * Jest Setup File
 * Mocks and global test configuration
 */

/* eslint-env jest */

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  mergeItem: jest.fn(() => Promise.resolve()),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    reset: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
    removeListener: jest.fn(),
    setParams: jest.fn(),
    dispatch: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
    name: 'MockRoute',
    key: 'mock-key',
  }),
  useFocusEffect: jest.fn(),
  NavigationContainer: ({ children }) => children,
  createNavigationContainerRef: jest.fn(() => ({
    navigate: jest.fn(),
    reset: jest.fn(),
    goBack: jest.fn(),
    getRootState: jest.fn(() => ({ routes: [] })),
    getCurrentRoute: jest.fn(() => ({ name: 'MockRoute' })),
  })),
}));

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn((callback) => callback({})),
  configureScope: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  flush: jest.fn(() => Promise.resolve(true)),
  close: jest.fn(() => Promise.resolve(true)),
}));

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

// Mock react-native-config
jest.mock('react-native-config', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  OPENAI_API_KEY: 'test-openai-key',
}));

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
    error: null,
  })),
  QueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
  })),
  QueryClientProvider: ({ children }) => children,
}));

// Suppress console warnings in tests - preserve original methods
const originalConsole = { ...console };
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(), // Also suppress logs in tests
  info: jest.fn(),
  debug: jest.fn(),
};

// Restore original console after tests
afterAll(() => {
  global.console = originalConsole;
});

// Mock performance API - preserve original if it exists
const originalPerformance = global.performance;
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
};

// Restore original performance after tests
afterAll(() => {
  if (originalPerformance) {
    global.performance = originalPerformance;
  } else {
    delete global.performance;
  }
});
