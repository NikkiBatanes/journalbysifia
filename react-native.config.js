module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['assets/fonts/'],
  dependencies: {
    'react-native-config': {
      platforms: {
        ios: null, // disable iOS platform, other platforms will still autolink if provided
      },
    },
  },
};
