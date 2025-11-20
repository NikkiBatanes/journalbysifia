import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, TouchableOpacity, Animated, StyleProp, ViewStyle, TextStyle, Alert, Clipboard, Platform, ActionSheetIOS } from 'react-native';
import { triggerLightHaptic, triggerMediumHaptic } from '../utils/haptics';

import { Colors } from '../theme';
import { Playbook } from '../interfaces/playbook';
import ThemedText from './common/ThemedText';

interface PlaybookInfoSectionProps {
  playbook: Playbook;
  showUserInput: boolean;
  setShowUserInput: (show: boolean) => void;
  chevronStyle: StyleProp<ViewStyle>;
  styles: { [key: string]: ViewStyle | TextStyle };
  viewMode: 'stack' | 'document';
  setViewMode: (mode: 'stack' | 'document') => void;
  onEditUserInput?: () => void;
}

const PlaybookInfoSection: React.FC<PlaybookInfoSectionProps> = ({
  playbook,
  showUserInput,
  setShowUserInput,
  chevronStyle,
  styles,
  viewMode,
  setViewMode,
  onEditUserInput,
}) => {
  // Calculate completed tasks from actionSteps
  const completedTasks = playbook.actionSteps.filter(step => step.completed).length;

  // Handle two-line title format from the playbook
  const titleLines = playbook.title.split('\n').map(line => line.trim()).filter(line => line);
  const firstLine = titleLines[0] || '';
  const secondLine = titleLines[1] || '';

  return (
    <View style={styles.playbookInfoContainer}>
      <View style={styles.playbookHeader}>
        <TouchableOpacity
          style={styles.playbookLabelRow}
          onPress={() => setShowUserInput(!showUserInput)}
          activeOpacity={0.7}
        >
          <ThemedText weight="semiBold" style={styles.playbookLabel}>PLAYBOOK</ThemedText>
          <Animated.View style={chevronStyle}>
            <Ionicons
              name="chevron-down"
              size={15}
              color={Colors.anchorBlue}
            />
          </Animated.View>
        </TouchableOpacity>
        {/* User Input Card - Collapsible */}
        {showUserInput && playbook.userInput && (
          <TouchableOpacity
            style={styles.userInputCard}
            onLongPress={() => {
              triggerMediumHaptic();
              if (Platform.OS === 'ios') {
                const options = ['Copy', ...(onEditUserInput ? ['Edit'] : []), 'Cancel'];
                const cancelButtonIndex = options.length - 1;
                ActionSheetIOS.showActionSheetWithOptions(
                  { options, cancelButtonIndex },
                  (buttonIndex) => {
                    if (buttonIndex === 0) {
                      Clipboard.setString(playbook.userInput!);
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
                  { text: 'Copy', onPress: () => { Clipboard.setString(playbook.userInput!); triggerLightHaptic(); Alert.alert('Copied', 'Your text has been copied to the clipboard.'); } },
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
            <ThemedText weight="regular" style={styles.userInputText}>
              {playbook.userInput}
            </ThemedText>
          </TouchableOpacity>
        )}
        <ThemedText weight="bold" style={styles.playbookTitle}>
          {firstLine}
        </ThemedText>
        {secondLine ? (
          <ThemedText weight="bold" style={styles.playbookTitleSecondLine}>
            {secondLine}
          </ThemedText>
        ) : null}
        {/* Creation Date */}
        <ThemedText weight="regular" style={styles.creationDate}>
          {new Date(playbook.createdAt || new Date()).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }).toUpperCase()}
        </ThemedText>
        {/* Progress and View Toggle Row */}
        <View style={styles.progressAndViewRow}>
          {/* Progress bar and text */}
          <View style={styles.progressContainer}>
            <View style={styles.progressRow}>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${playbook.progress || 0}%` },
                  ]}
                />
              </View>
              <ThemedText weight="semiBold" style={styles.progressText}>
                {completedTasks}/{playbook.totalTasks || 0} Steps
              </ThemedText>
            </View>
          </View>
          {/* View mode toggles */}
          <View style={styles.viewToggleContainer}>
            <TouchableOpacity
              style={styles.viewToggle}
              onPress={() => setViewMode('stack')}
            >
              <View style={[styles.iconContainer, viewMode === 'stack' && styles.iconContainerActive]}>
                <Ionicons
                  name="albums"
                  size={20}
                  color={viewMode === 'stack' ? Colors.hopeWhite : Colors.trustGrey}
                  style={{ transform: [{ rotate: '180deg' }] }}
                />
              </View>
            </TouchableOpacity>
            <View style={styles.viewToggleDivider} />
            <TouchableOpacity
              style={styles.viewToggle}
              onPress={() => setViewMode('document')}
            >
              <View style={[styles.iconContainer, viewMode === 'document' && styles.iconContainerActive]}>
                <MaterialCommunityIcons
                  name="view-agenda"
                  size={20}
                  color={viewMode === 'document' ? Colors.hopeWhite : Colors.trustGrey}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

export default PlaybookInfoSection;
