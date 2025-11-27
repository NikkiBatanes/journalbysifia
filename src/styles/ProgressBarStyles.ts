import { StyleSheet } from 'react-native';
import { Colors } from '../theme';

export const progressBarStyles = StyleSheet.create({
  container: {
    marginTop: 4,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 20, // Keep the current height for progress bar visibility
  },
  progressWrapper: {
    flex: 1,
    marginRight: 8,
    minWidth: 150, // Increased minimum width for better space utilization
    maxWidth: '85%', // Increased from 70% to use more container width
  },
  barBg: {
    width: '100%',
    height: 10, // Keep the current progress bar height as requested
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 5, // Keep current border radius
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 3,
    shadowColor: Colors.growthGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  textContainer: {
    minWidth: 55, // Reduced to give more space to progress bar
    maxWidth: 70, // Reduced maximum width
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0, // Prevent text container from shrinking too much
  },
  text: {
    fontSize: 10, // Keep current font size
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'right',
    flexShrink: 1,
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 14,
  },
});
