import { useState, useEffect } from 'react';

export const useAppFonts = () => {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadFonts = async () => {
      try {
        // For React Native without Expo, we'll use the fonts that are already linked
        // in the native projects. Make sure you've followed the linking steps for your fonts.
        // The fonts should be defined in your app.json or info.plist (iOS) and styles.xml (Android)

        // For now, we'll just set fontsLoaded to true since the fonts should be loaded natively
        setFontsLoaded(true);
      } catch (e) {
        console.error('Error loading fonts:', e);
        setError(e as Error);
      }
    };

    loadFonts();
  }, []);

  return { fontsLoaded, error };
};
