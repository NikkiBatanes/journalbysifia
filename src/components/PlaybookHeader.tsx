import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, SafeAreaView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme';
import { opacity } from 'react-native-reanimated/lib/typescript/Colors';

interface PlaybookHeaderProps {
  title: string;
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
}) => {
  // Split title at colons that are followed by a space (to avoid splitting Bible references like 'John 3:16')
  const titleLines = title.split(/(?<=[^0-9]):(?=[^0-9])/).map(part => part.trim()).filter(part => part.length > 0);

  const bgColor = backgroundColor || Colors.hopeWhite;
  const txtColor = textColor || Colors.anchorBlue;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: bgColor }]}> 
      <View style={[styles.headerContainer, { backgroundColor: bgColor }]}>
        <View style={styles.headerCenter}>
          {onPlaybookLabelPress ? (
            <TouchableOpacity style={styles.row} onPress={onPlaybookLabelPress} activeOpacity={0.7}>
              <Text style={[styles.playbookLabel, { color: txtColor }]}>PLAYBOOK</Text>
              <Ionicons name="chevron-down" size={15} color={txtColor} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ) : (
            <View style={styles.row}>
              <Text style={[styles.playbookLabel, { color: txtColor }]}>PLAYBOOK</Text>
              <Ionicons name="chevron-down" size={15} color={txtColor} style={{ marginLeft: 4 }} />
            </View>
          )}

          {/* Collapsible user input card between PLAYBOOK and title */}
          {showUserInput && userInput ? (
            <View style={styles.userInputCardHeader}>
              <Text style={[styles.userInputTextHeader, { color: txtColor }]}>{userInput}</Text>
            </View>
          ) : null}

          {titleLines.map((line, index) => (
            <Text 
              key={index} 
              style={[
                styles.title, 
                { color: txtColor },
                index > 0 && { marginTop: -4 }
              ]}
            >
              {line}{index < titleLines.length - 1 ? ':' : ''}
            </Text>
          ))}
          {subtitle ? <Text style={[styles.subtitle, { color: txtColor }]}>{subtitle.toUpperCase()}</Text> : null}
          <View style={styles.progressRow}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${(progress / totalTasks) * 100}%` }]} />
            </View>
            <Text style={[styles.progressText, { color: txtColor }]}>{progress}/{totalTasks} Tasks</Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.hopeWhite,
    width: '100%',
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
    paddingBottom: 12,
    paddingHorizontal: 22,
    backgroundColor: Colors.hopeWhite,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
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
    letterSpacing: 1,
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
    marginHorizontal: 8,
    minWidth: 60, // Ensure consistent width for the text
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    padding: 1,
    marginLeft: 'auto', // Push to the right
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
