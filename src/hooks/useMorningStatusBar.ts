import { useCallback } from 'react';
import { StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

// Owned by the flow navigator so moving between steps never restores the bar.
export function useMorningStatusBar() {
  useFocusEffect(
    useCallback(() => {
      const entry = StatusBar.pushStackEntry({
        hidden: true,
        animated: false,
        barStyle: 'dark-content',
      });

      return () => StatusBar.popStackEntry(entry);
    }, [])
  );
}
