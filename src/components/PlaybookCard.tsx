import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, TouchableOpacityProps } from 'react-native';
import { format } from 'date-fns';
import { Playbook } from '../interfaces/playbook';
import { Colors, Fonts } from '../theme';
import { progressBarStyles } from '../styles/ProgressBarStyles';

interface PlaybookCardProps extends TouchableOpacityProps {
  playbook: Playbook;
  onPress?: () => void;
  containerStyle?: ViewStyle;
  contentStyle?: ViewStyle;
  titleStyle?: TextStyle;
  dateStyle?: TextStyle;
  showProgressBar?: boolean;
}

const PlaybookCard: React.FC<PlaybookCardProps> = ({
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
  const formattedDate = format(new Date(playbook.createdAt || ''), 'EEEE, MMM d, yyyy').toUpperCase();
  const completedSteps = playbook.actionSteps.filter(step => step.completed).length;
  const totalSteps = playbook.actionSteps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, containerStyle, style]}
      {...props}
    >
      <View style={[styles.cardContent, contentStyle]}>
        <View style={styles.titleContainer}>
          <Text style={[styles.date, dateStyle]}>
            {formattedDate}
          </Text>
          <View style={styles.titleRow}>
            <Text style={[styles.title, titleStyle]} numberOfLines={1}>
              {playbook.title}
            </Text>
          </View>
        </View>
        
        {showProgressBar && (
          <View style={progressBarStyles.container}>
            <View style={progressBarStyles.row}>
              <View style={progressBarStyles.progressWrapper}>
                <View style={progressBarStyles.barBg}>
                  <View
                    style={[
                      progressBarStyles.barFill,
                      { width: `${progress}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={progressBarStyles.textContainer}>
                <Text style={progressBarStyles.text}>
                  {completedSteps}/{totalSteps} tasks
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
  },
  titleContainer: {
    marginBottom: 10,
    width: '100%',
  },
  date: {
    fontSize: 10,
    fontFamily: Fonts.bold,
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
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    lineHeight: 24,
    paddingVertical: 1,
    fontWeight: '700',
    flexShrink: 1,
  },
});

export default PlaybookCard;
