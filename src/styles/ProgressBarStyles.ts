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
    marginRight: 12, // Consistent spacing between bar and text
    minWidth: 250, // Increased minimum width for longer progress bar
  },
  barBg: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 4,
    minWidth: 8, // Ensure minimum width for visibility
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
