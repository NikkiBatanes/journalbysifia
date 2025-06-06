import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, SafeAreaView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated from 'react-native-reanimated';
import { Colors } from '../theme';
import { opacity } from 'react-native-reanimated/lib/typescript/Colors';

interface PlaybookHeaderProps {
  title: string;
  showTitle?: boolean;
  subtitle?: string;
  progress: number;
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
  /**
   * Optional animated style for the chevron icon (e.g. from react-native-reanimated)
   */
  chevronAnimatedStyle?: any;
}

const PlaybookHeader: React.FC<PlaybookHeaderProps> = ({
  title,
  subtitle,
  progress,
  totalTasks,
  onBack,
  showToggle = false,
  viewMode,
  onToggleView,
  profileImageUri,
  showProfileImage = false,
  onPlaybookLabelPress,
  showUserInput,
  userInput,
  backgroundColor,
  textColor,
  alignTasksLeft = false,
  userInputBackgroundColor,
  userInputBorderColor,
  userInputTextColor,
  chevronAnimatedStyle,
  showTitle = true,
}) => {
  // Split title at colons that are followed by a space (to avoid splitting Bible references like 'John 3:16')
  const titleLines = title.split(/(?<=[^0-9]):(?=[^0-9])/).map(part => part.trim()).filter(part => part.length > 0);

  const bgColor = backgroundColor || Colors.hopeWhite;
  const txtColor = textColor || Colors.anchorBlue;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.headerContainer, { backgroundColor: bgColor }]}>
        <View style={styles.headerCenter}>
          {onPlaybookLabelPress ? (
  <TouchableOpacity style={styles.row} onPress={onPlaybookLabelPress} activeOpacity={0.7}>
    <Text style={[styles.playbookLabel, { color: txtColor }]}>PLAYBOOK</Text>
    {chevronAnimatedStyle ? (
      <Animated.View style={chevronAnimatedStyle}>
        <Ionicons name="chevron-down" size={15} color={txtColor} />
      </Animated.View>
    ) : (
      <Ionicons name="chevron-down" size={15} color={txtColor} style={{ marginLeft: 4 }} />
    )}
  </TouchableOpacity>
) : (
  <View style={styles.row}>
    <Text style={[styles.playbookLabel, { color: txtColor }]}>PLAYBOOK</Text>
    {chevronAnimatedStyle ? (
      <Animated.View style={chevronAnimatedStyle}>
        <Ionicons name="chevron-down" size={15} color={txtColor} />
      </Animated.View>
    ) : (
      <Ionicons name="chevron-down" size={15} color={txtColor} style={{ marginLeft: 4 }} />
    )}
  </View>
)}

          {/* Collapsible user input card between PLAYBOOK and title */}
          {showUserInput && userInput ? (
            <View
              style={[
                styles.userInputCardHeader,
                userInputBackgroundColor && { backgroundColor: userInputBackgroundColor },
                userInputBorderColor && { borderColor: userInputBorderColor, borderWidth: 1 },
              ]}
            >
              <Text style={[styles.userInputTextHeader, userInputTextColor ? { color: userInputTextColor } : { color: txtColor }]}>{userInput}</Text>
            </View>
          ) : null}

          {titleLines.map((line, index) => (
            <Text
              key={index}
              style={[
                styles.title,
                { color: txtColor },
                index > 0 && { marginTop: -4 },
              ]}
            >
              {line}{index < titleLines.length - 1 ? ':' : ''}
            </Text>
          ))}
          {subtitle ? <Text style={[styles.subtitle, { color: txtColor }]}>{subtitle.toUpperCase()}</Text> : null}
          <View style={[styles.progressRow, alignTasksLeft && styles.progressRowLeftAligned]}>
            <View style={[styles.progressBarBg, bgColor === Colors.anchorBlue && { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <View style={[styles.progressBarFill, { width: `${(progress / totalTasks) * 100}%` }]} />
            </View>
            <Text style={[styles.progressText, {
              color: txtColor,
              marginLeft: 8,
              minWidth: 80,
              textAlign: alignTasksLeft ? 'left' : 'center',
            }]}>
              {progress}/{totalTasks} Tasks
            </Text>
            {showToggle && (
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={() => onToggleView && onToggleView('stack')}
                >
                  <View style={[styles.iconContainer, viewMode === 'stack' && styles.iconContainerActive]}>
                    <Ionicons name="albums" size={20} color={viewMode === 'stack' ? Colors.hopeWhite : Colors.trustGrey} style={{ transform: [{ rotate: '180deg' }] }} />
                  </View>
                </TouchableOpacity>
                <View style={styles.toggleDivider} />
                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={() => onToggleView && onToggleView('document')}
                >
                  <View style={[styles.iconContainer, viewMode === 'document' && styles.iconContainerActive]}>
                    <MaterialCommunityIcons name="view-agenda" size={20} color={viewMode === 'document' ? Colors.hopeWhite : Colors.trustGrey} />
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          {onBack && (
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 16, left: 16, right: 16, bottom: 16 }}>
              <Ionicons name="arrow-back" size={26} color={Colors.anchorBlue} />
            </TouchableOpacity>
          )}
          {showProfileImage && profileImageUri && (
            <Image source={{ uri: profileImageUri }} style={styles.profileImage} resizeMode="cover" />
          )}
        </View>
      </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'transparent',
    width: '100%',
    paddingTop: 0, // Remove any default padding that might interfere
  },
  container: {
    width: '100%',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    backgroundColor: Colors.hopeWhite,
    // Add shadow for better visual separation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInputCardHeader: {
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(26, 60, 109, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    width: '100%',
    minHeight: 24,
    flexShrink: 1,
  },
  userInputTextHeader: {
    fontSize: 13,
    color: Colors.anchorBlue,
    fontWeight: '400',
    letterSpacing: 0.1,
    lineHeight: 18, // Ensure consistent line height for multi-line text
  },
  headerContainer: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 22,
    backgroundColor: 'transparent', // Make container transparent to show parent's background
    borderBottomWidth: 0, // Remove border as we're using shadow now
    width: '100%',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    width: '100%',
    alignItems: 'flex-start',
  },
  headerRight: {
    position: 'absolute',
    right: 16,
    top: 24,
    width: 44, // Standard touch target size
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
    color: Colors.anchorBlue,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'left',
    marginTop: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.anchorBlue,
    textAlign: 'left',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.trustGrey,
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
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
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
    color: Colors.trustGrey,
    fontWeight: '600',
    marginLeft: 8,
    marginRight: 0,
    textAlign: 'left',
    minWidth: 60, // Ensure consistent width for the text
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
  iconContainer: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    padding: 5,
    marginHorizontal: 1, // Reduced horizontal margin between icons
  },
  iconContainerActive: {
    backgroundColor: Colors.faithGold,
  },
  toggleDivider: {
    width: 0,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});

export default PlaybookHeader;
