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
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // No 'x-forwarded-host' exists for local development
        if (req.url.startsWith('/assets/') || req.url === '/') {
          req.headers['x-forwarded-host'] = '192.168.1.7:8081';
        }
        return middleware(req, res, next);
      };
    },
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
