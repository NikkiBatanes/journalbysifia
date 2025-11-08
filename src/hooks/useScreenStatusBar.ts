import { StatusBar, Platform } from 'react-native';
import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export type StatusBarStylePref = 'light' | 'dark' | 'auto';

function hexToRgb(hex?: string): { r: number; g: number; b: number } | null {
  if (!hex) {return null;}
  const cleaned = hex.replace('#', '').trim();
  const full = cleaned.length === 3
    ? cleaned.split('').map((c) => c + c).join('')
    : cleaned;
  if (full.length !== 6) {return null;}
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) {return null;}
  return { r, g, b };
}

function getLuminance(rgb: { r: number; g: number; b: number }): number {
  // Relative luminance per WCAG
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function chooseStyleFromColor(backgroundColor?: string): 'light' | 'dark' {
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) {return 'dark';} // default to dark-content on invalid color (safe for light UIs)
  const lum = getLuminance(rgb);
  // Threshold: if background is dark (low luminance), use light-content
  return lum < 0.5 ? 'light' : 'dark';
}

/**
 * useScreenStatusBar
 * Sets the StatusBar style when a screen is focused.
 * - style 'light' => light-content (white icons/text)
 * - style 'dark'  => dark-content (black icons/text)
 * - style 'auto'  => inferred from backgroundColor luminance
 * Optionally set Android backgroundColor.
 */
export const resolveStatusBarStyle = (
  style: StatusBarStylePref = 'auto',
  backgroundColor?: string
): 'light-content' | 'dark-content' => {
  const resolvedStyle = style === 'auto' ? chooseStyleFromColor(backgroundColor) : style;
  return resolvedStyle === 'light' ? 'light-content' : 'dark-content';
};

export function useScreenStatusBar(style: StatusBarStylePref = 'auto', backgroundColor?: string) {
  useFocusEffect(
    useCallback(() => {
      const barStyle = resolveStatusBarStyle(style, backgroundColor);
      StatusBar.setBarStyle(barStyle, true);
      if (Platform.OS === 'android' && backgroundColor) {
        StatusBar.setBackgroundColor(backgroundColor, true);
      }
      return () => {
        // no-op cleanup; let next screen override
      };
    }, [style, backgroundColor])
  );
}
