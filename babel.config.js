module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        blacklist: null,
        whitelist: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
        safe: false,
        allowUndefined: true,
      },
    ],
    'react-native-reanimated/plugin', // MUST be last
  ],
};
