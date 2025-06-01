import { useState, useEffect } from 'react';
import * as Font from 'expo-font';
import { Fonts } from '../theme/fonts';

export const useAppFonts = () => {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState<Error | null>(null);

  useEffect(() => {
    const loadFonts = async () => {
      try {
        await Font.loadAsync({
          // Inter fonts (from react-native-vector-icons)
          'Inter_400Regular': require('@expo-google-fonts/inter/Inter_400Regular.ttf'),
          'Inter_500Medium': require('@expo-google-fonts/inter/Inter_500Medium.ttf'),
          'Inter_600SemiBold': require('@expo-google-fonts/inter/Inter_600SemiBold.ttf'),
          'Inter_700Bold': require('@expo-google-fonts/inter/Inter_700Bold.ttf'),
          
          // Playfair Display fonts
          'PlayfairDisplay-Regular': require('@expo-google-fonts/playfair-display/PlayfairDisplay_400Regular.ttf'),
          'PlayfairDisplay-Bold': require('@expo-google-fonts/playfair-display/PlayfairDisplay_700Bold.ttf'),
        });
        
        setFontsLoaded(true);
      } catch (error) {
        console.error('Error loading fonts:', error);
        setFontError(error as Error);
      }
    };

    loadFonts();
  }, []);

  return { fontsLoaded, fontError };
};
