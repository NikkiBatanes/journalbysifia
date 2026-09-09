import React from 'react';
import { View, StyleSheet, TouchableOpacity, Clipboard, Alert, Image, SafeAreaView, Platform, ActionSheetIOS } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';

import { Colors, Fonts } from '../theme';
import ThemedText from './common/ThemedText';

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
  showUserInput?: boolean;
  userInput?: string;
  backgroundColor?: string;
  textColor?: string;
  onEditUserInput?: () => void;
  alignTasksLeft?: boolean;
  userInputBackgroundColor?: string;
  userInputBorderColor?: string;
  userInputTextColor?: string;
  onProfilePress?: () => void;
  onExportPress?: () => void;
  showProgressRow?: boolean;
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
  showUserInput,
  userInput,
  backgroundColor = Colors.sage,
  textColor = Colors.hopeWhite,
  onEditUserInput,
  alignTasksLeft = false,
  userInputBackgroundColor,
  userInputBorderColor,
  userInputTextColor,
  onProfilePress,
  onExportPress,
  showProgressRow = true,
}) => {
  // Split title at newlines to handle title and subtitle on separate lines
  const titleLines = title.split('\n').map(part => (part || '').trim()).filter(part => part.length > 0);

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
      backgroundColor: userInputBackgroundColor || 'Colors.sage',
      borderColor: userInputBorderColor || 'rgba(255, 255, 255, 0.2)',
    },
    userInputText: {
      color: userInputTextColor || textColor,
    },
    userInputLabel: {
      color: textColor,
    },
    progressBarBg: {
      backgroundColor: backgroundColor === Colors.sage
        ? 'rgba(255,255,255,0.15)'
        : 'rgba(26, 60, 109, 0.1)',
    },
    progressBarFill: {
      width: `${Math.max(0, Math.min(100, progress))}%` as unknown as number,
    },
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, dynamicStyles.container]}>
        <View style={[styles.headerContainer, dynamicStyles.headerContainer]}>
          <View style={styles.headerCenter}>
            {showUserInput && userInput && (
              <TouchableOpacity
                style={[styles.userInputCard, dynamicStyles.userInputCard]}
                onLongPress={() => {
                  triggerMediumHaptic();
                  if (Platform.OS === 'ios') {
                    const options = ['Copy', ...(onEditUserInput ? ['Edit'] : []), 'Cancel'];
                    const cancelButtonIndex = options.length - 1;
                    ActionSheetIOS.showActionSheetWithOptions(
                      { options, cancelButtonIndex },
                      (buttonIndex) => {
                        if (buttonIndex === 0) {
                          Clipboard.setString(userInput);
                          triggerLightHaptic();
                          Alert.alert('Copied', 'Your text has been copied to the clipboard.');
                        } else if (buttonIndex === 1 && onEditUserInput) {
                          triggerLightHaptic();
                          onEditUserInput();
                        }
                      }
                    );
                  } else {
                    const buttons: any[] = [
                      { text: 'Copy', onPress: () => { Clipboard.setString(userInput); triggerLightHaptic(); Alert.alert('Copied', 'Your text has been copied to the clipboard.'); } },
                    ];
                    if (onEditUserInput) {
                      buttons.push({ text: 'Edit', onPress: () => { triggerLightHaptic(); onEditUserInput(); } });
                    }
                    buttons.push({ text: 'Cancel', style: 'cancel' });
                    Alert.alert('User Input', 'Choose an action', buttons);
                  }
                }}
                activeOpacity={0.9}
              >
                <ThemedText weight="semiBold" style={[styles.userInputLabel, dynamicStyles.userInputLabel]}>
                  The moment you brought in:
                </ThemedText>
                <ThemedText weight="regular" style={[styles.userInputText, dynamicStyles.userInputText]}>
                  {userInput}
                </ThemedText>
              </TouchableOpacity>
            )}

            {titleLines.map((line, index) => (
              <ThemedText
                key={index}
                weight="bold"
                style={[
                  styles.title,
                  dynamicStyles.title,
                  index > 0 && styles.titleLineSpacing,
                ]}
              >
                {line}
              </ThemedText>
            ))}

            {subtitle && (
              <ThemedText weight="semiBold" style={[styles.subtitle, dynamicStyles.subtitle]}>
                {subtitle.toUpperCase()}
              </ThemedText>
            )}

            {showProgressRow && (
              <View style={[
                styles.progressRow,
                alignTasksLeft && styles.progressRowLeftAligned,
              ]}>
                <View style={styles.progressLeft}>
                  <View style={[styles.progressBarBg, dynamicStyles.progressBarBg]}>
                    <View style={[styles.progressBarFill, dynamicStyles.progressBarFill]} />
                  </View>
                  <ThemedText weight="semiBold" style={[styles.progressText, dynamicStyles.progressText]}>
                    {completedTasks}/{totalTasks} Steps Explored
                  </ThemedText>
                </View>

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
            )}
            {onExportPress && (
              <TouchableOpacity
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  onExportPress();
                }}
                activeOpacity={0.8}
                style={styles.exportIconButton}
              >
                <Ionicons
                  name="share-outline"
                  size={18}
                  color={Colors.hopeWhite}
                />
              </TouchableOpacity>
            )}
          </View>

          {(showProfileImage) && (
            <View style={styles.headerRight}>
              {showProfileImage && (
                <TouchableOpacity onPress={onProfilePress} activeOpacity={0.7}>
                  {profileImageUri ? (
                    <Image
                      source={{ uri: profileImageUri }}
                      style={styles.profileImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.profileImage, styles.defaultProfileImage]}>
                      <Ionicons name="person" size={20} color="#FFFEFA" />
                    </View>
                  )}
                </TouchableOpacity>
              )}
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
    backgroundColor: Colors.sage,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingTop: 0,
    paddingBottom: 4,
    paddingHorizontal: 22,
    backgroundColor: 'transparent',
    width: '100%',
  },
  headerCenter: {
    width: '100%',
    alignItems: 'center',
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
  exportIconButton: {
    padding: 4,
    marginLeft: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  playbookLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    textAlign: 'left',
    marginTop: 2,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  title: {
    fontSize: 18,
    // fontFamily handled by ThemedText weight="bold"
    textAlign: 'center',
    marginTop: 2,
  },
  titleLineSpacing: {
    marginTop: -4,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 2,
    // fontFamily handled by ThemedText weight="semiBold"
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
  progressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressRowLeftAligned: {
    justifyContent: 'flex-start',
  },
  progressBarBg: {
    flex: 0,
    width: 150,
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
    // fontFamily handled by ThemedText weight="semiBold"
    marginLeft: 0,
    marginRight: 8,
    minWidth: 80,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: 'transparent',
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
    width: '100%',
    minHeight: 24,
    flexShrink: 1,
    position: 'relative',
  },
  userInputText: {
    fontSize: 13,
    // fontFamily handled by ThemedText weight="regular"
    letterSpacing: 0.1,
    lineHeight: 18,
    paddingRight: 32,
  },
  userInputLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  editIconButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  defaultProfileImage: {
    backgroundColor: '#7C837D',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PlaybookHeader;
