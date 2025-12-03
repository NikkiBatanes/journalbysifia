import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, TouchableOpacityProps } from 'react-native';
import { format } from 'date-fns';
import { Playbook } from '../interfaces/playbook';
import { Colors } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { progressBarStyles } from '../styles/ProgressBarStyles';
import { getCompletedStepsCount } from '../utils/taskUtils';
import ThemedText from './common/ThemedText';

interface PlaybookCardProps extends TouchableOpacityProps {
  playbook: Playbook;
  onPress?: () => void;
  containerStyle?: ViewStyle;
  contentStyle?: ViewStyle;
  titleStyle?: TextStyle;
  dateStyle?: TextStyle;
  showProgressBar?: boolean;
}

const getProgressBarStyle = (progress: number): ViewStyle => ({
  width: `${progress}%` as any, // Using any to bypass the DimensionValue type restriction
  minWidth: progress > 0 ? 1 : 0,
});

const PlaybookCard: React.FC<PlaybookCardProps> = React.memo(({
  playbook,
  onPress,
  containerStyle,
  contentStyle,
  titleStyle,
  dateStyle,
  showProgressBar = true,
  style,
  ...props
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const formattedDate = useMemo(() => {
    const date = new Date(playbook.createdAt || '');
    const currentYear = new Date().getFullYear();
    const year = date.getFullYear();
    const formatString = year === currentYear ? 'EEEE, MMMM d' : 'EEEE, MMMM d, yyyy';
    return format(date, formatString).toUpperCase();
  }, [playbook.createdAt]);
  // Use shared utility for task stats (matches detail screen)
  const { completed, total } = useMemo(() => getCompletedStepsCount(playbook.actionSteps), [playbook.actionSteps]);

  const progress = useMemo(() => total > 0 ? Math.max(0, Math.min(100, (completed / total) * 100)) : 0, [completed, total]);
  const progressBarFillStyle = getProgressBarStyle(progress);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, containerStyle, style]}
      {...props}
    >
      <View style={[styles.cardContent, contentStyle]}>
        <View style={styles.titleContainer}>
          <ThemedText weight="bold" style={[styles.date, dateStyle]}>
            {formattedDate}
          </ThemedText>
          <View style={styles.titleRow}>
            <ThemedText weight="bold" style={[styles.title, titleStyle]} numberOfLines={1}>
              {playbook.title}
            </ThemedText>
          </View>
        </View>

        {showProgressBar && (
          <View style={progressBarStyles.container}>
            <View style={progressBarStyles.row}>
              <View style={progressBarStyles.progressWrapper}>
                <View style={progressBarStyles.barBg}>
                  <View
                    key={`progress-${progress}`}
                    style={[
                      progressBarStyles.barFill,
                      progressBarFillStyle,
                    ]}
                  />
                </View>
              </View>
              <View style={progressBarStyles.textContainer}>
                <ThemedText style={progressBarStyles.text} numberOfLines={1}>
                  {completed}/{total} Steps
                </ThemedText>
              </View>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

PlaybookCard.displayName = 'PlaybookCard';

const createStyles = (_theme: any) => StyleSheet.create({
  card: {
    // Use a translucent surface that contrasts on anchor blue backgrounds
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: 20,
    padding: 12,
    width: '100%',
    height: 88, // Match the swipeable container height
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  titleContainer: {
    marginBottom: 4,
    width: '100%',
    flexShrink: 1,
  },
  date: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 1,
  },
  title: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 20,
    paddingVertical: 1,
    flexShrink: 1,
    minWidth: 0, // Allow text to shrink properly
  },
});

export default PlaybookCard;
