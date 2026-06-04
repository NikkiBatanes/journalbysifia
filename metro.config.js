const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const {withSentryConfig} = require('@sentry/react-native/metro');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

const config = {
  server: {
    port: 8081,
    // Disable x-forwarded-host middleware as it's not needed for local development
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  // Configure for react-native-svg (Lucide icons)
  resolver: {
    assetExts: defaultConfig.resolver.assetExts.filter(ext => ext !== 'svg'),
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'],
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'lucide-react-native') {
        return {
          type: 'sourceFile',
          filePath: path.join(
            __dirname,
            'node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
          ),
        };
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = withSentryConfig(
  mergeConfig(defaultConfig, config),
);
