import { StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme';

export const progressBarStyles = StyleSheet.create({
  container: {
    marginTop: 8,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  progressWrapper: {
    flex: 1,
    marginRight: 16, // Increased spacing between bar and text
    minWidth: '75%', // Use percentage for better responsiveness
    maxWidth: '85%', // Limit maximum width
  },
  barBg: {
    width: '100%',
    height: 10, // Slightly thicker bar
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 5,
    shadowColor: Colors.growthGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  textContainer: {
    width: 60, // Fixed width for text container
    alignItems: 'flex-end',
    marginLeft: 'auto', // Push to the far right
  },
  text: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'right',
    minWidth: 60, // Ensure minimum width for text
  },
});
