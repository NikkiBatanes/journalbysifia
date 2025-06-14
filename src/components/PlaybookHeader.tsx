import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, SafeAreaView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated from 'react-native-reanimated';
import { Colors } from '../theme';

interface PlaybookHeaderProps {
  title: string;
  showTitle?: boolean;
  subtitle?: string;
  progress: number;
  completedTasks: number;
  totalTasks: number;
  onBack?: () => void;
  showToggle?: boolean;
  viewMode?: 'stack' | 'document';
  onToggleView?: (mode: 'stack' | 'document') => void;
  profileImageUri?: string;
  showProfileImage?: boolean;
  onPlaybookLabelPress?: () => void;
  showUserInput?: boolean;
  userInput?: string;
  backgroundColor?: string;
  textColor?: string;
  alignTasksLeft?: boolean;
  userInputBackgroundColor?: string;
  userInputBorderColor?: string;
  userInputTextColor?: string;
  chevronAnimatedStyle?: any;
}

const PlaybookHeader: React.FC<PlaybookHeaderProps> = ({
  title,
  subtitle,
  progress,
  completedTasks,
  totalTasks,
  showToggle = false,
  viewMode,
  onToggleView,
  profileImageUri,
  showProfileImage = false,
  onPlaybookLabelPress,
  showUserInput,
  userInput,
  backgroundColor = Colors.hopeWhite,
  textColor = Colors.anchorBlue,
  alignTasksLeft = false,
  userInputBackgroundColor,
  userInputBorderColor,
  userInputTextColor,
  chevronAnimatedStyle,
}) => {
  // Split title at newlines to handle title and subtitle on separate lines
  const titleLines = title.split('\n').map(part => part.trim()).filter(part => part.length > 0);

  // Generate dynamic styles
  const dynamicStyles = {
    container: {
      backgroundColor,
    },
    headerContainer: {
      backgroundColor,
    },
    playbookLabel: {
      color: textColor,
    },
    title: {
      color: textColor,
    },
    subtitle: {
      color: textColor,
    },
    progressText: {
      color: textColor,
      textAlign: alignTasksLeft ? 'left' as const : 'center' as const,
    },
    userInputCard: {
      backgroundColor: userInputBackgroundColor || 'rgba(26, 60, 109, 0.1)',
      borderColor: userInputBorderColor || 'rgba(26, 60, 109, 0.2)',
    },
    userInputText: {
      color: userInputTextColor || textColor,
    },
    progressBarBg: {
      backgroundColor: backgroundColor === Colors.anchorBlue
        ? 'rgba(255,255,255,0.15)'
        : 'rgba(26, 60, 109, 0.1)',
    },
    progressBarFill: {
      width: `${progress}%`,
    },
  };

  const renderChevron = () => (
    chevronAnimatedStyle ? (
      <Animated.View style={chevronAnimatedStyle}>
        <Ionicons name="chevron-down" size={15} color={textColor} />
      </Animated.View>
    ) : (
      <Ionicons
        name="chevron-down"
        size={15}
        color={textColor}
        style={styles.chevronIcon}
      />
    )
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, dynamicStyles.container]}>
        <View style={[styles.headerContainer, dynamicStyles.headerContainer]}>
          <View style={styles.headerCenter}>
            {onPlaybookLabelPress ? (
              <TouchableOpacity
                style={styles.row}
                onPress={onPlaybookLabelPress}
                activeOpacity={0.7}
              >
                <Text style={[styles.playbookLabel, dynamicStyles.playbookLabel]}>
                  PLAYBOOK
                </Text>
                {renderChevron()}
              </TouchableOpacity>
            ) : (
              <View style={styles.row}>
                <Text style={[styles.playbookLabel, dynamicStyles.playbookLabel]}>
                  PLAYBOOK
                </Text>
                {renderChevron()}
              </View>
            )}

            {showUserInput && userInput && (
              <View style={[styles.userInputCard, dynamicStyles.userInputCard]}>
                <Text style={[styles.userInputText, dynamicStyles.userInputText]}>
                  {userInput}
                </Text>
              </View>
            )}

            {titleLines.map((line, index) => (
              <Text
                key={index}
                style={[
                  styles.title,
                  dynamicStyles.title,
                  index > 0 && styles.titleLineSpacing,
                ]}
              >
                {line}
              </Text>
            ))}

            {subtitle && (
              <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
                {subtitle.toUpperCase()}
              </Text>
            )}

            <View style={[
              styles.progressRow,
              alignTasksLeft && styles.progressRowLeftAligned,
            ]}>
              <View style={[styles.progressBarBg, dynamicStyles.progressBarBg]}>
                <View style={[styles.progressBarFill, dynamicStyles.progressBarFill]} />
              </View>
              <Text style={[styles.progressText, dynamicStyles.progressText]}>
                {completedTasks}/{totalTasks} Tasks
              </Text>

              {showToggle && onToggleView && (
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => onToggleView('stack')}
                  >
                    <View style={[
                      styles.iconContainer,
                      viewMode === 'stack' && styles.iconContainerActive,
                    ]}>
                      <Ionicons
                        name="albums"
                        size={20}
                        color={viewMode === 'stack' ? Colors.hopeWhite : Colors.trustGrey}
                        style={styles.rotatedIcon}
                      />
                    </View>
                  </TouchableOpacity>
                  <View style={styles.toggleDivider} />
                  <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => onToggleView('document')}
                  >
                    <View style={[
                      styles.iconContainer,
                      viewMode === 'document' && styles.iconContainerActive,
                    ]}>
                      <MaterialCommunityIcons
                        name="view-agenda"
                        size={20}
                        color={viewMode === 'document' ? Colors.hopeWhite : Colors.trustGrey}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {showProfileImage && profileImageUri && (
            <View style={styles.headerRight}>
              <Image
                source={{ uri: profileImageUri }}
                style={styles.profileImage}
                resizeMode="cover"
              />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'transparent',
    width: '100%',
    paddingTop: 0,
  },
  container: {
    width: '100%',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    backgroundColor: Colors.hopeWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingTop: 5,
    paddingBottom: 16,
    paddingHorizontal: 22,
    backgroundColor: 'transparent',
    width: '100%',
  },
  headerCenter: {
    width: '100%',
    alignItems: 'flex-start',
  },
  headerRight: {
    position: 'absolute',
    right: 16,
    top: 24,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  playbookLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'left',
    marginTop: 2,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'left',
    marginTop: 2,
  },
  titleLineSpacing: {
    marginTop: -4,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 2,
    fontWeight: '600',
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 2,
    width: '100%',
    justifyContent: 'space-between',
  },
  progressRowLeftAligned: {
    justifyContent: 'flex-start',
  },
  progressBarBg: {
    flex: 1,
    maxWidth: 200,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    minWidth: 80,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    padding: 1,
  },
  toggleBtn: {
    padding: 1,
  },
  toggleDivider: {
    width: 0,
  },
  iconContainer: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    padding: 5,
    marginHorizontal: 1,
  },
  iconContainerActive: {
    backgroundColor: Colors.faithGold,
  },
  rotatedIcon: {
    transform: [{ rotate: '180deg' }],
  },
  userInputCard: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    width: '100%',
    minHeight: 24,
    flexShrink: 1,
  },
  userInputText: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});

export default PlaybookHeader;
