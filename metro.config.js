const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  server: {
    port: 8081,
    // Enable Fast Refresh for instant reloads
    enhanceMiddleware: (middleware) => {
      return middleware;
    },
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
    // Enable Fast Refresh
    babelTransformerPath: require.resolve('react-native/Libraries/JavaScriptCore/Polyfills'),
  },
  // Add asset extensions
  resolver: {
    assetExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
  },
  // Enable Fast Refresh
  resetCache: true,
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
