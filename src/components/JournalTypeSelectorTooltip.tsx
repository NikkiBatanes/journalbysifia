/**
 * JournalTypeSelectorTooltip
 * iMessage-style inline reaction picker for smart journaling types
 * Displays 4 journal type options in a horizontal pill above the subtask
 * with blur effect on other items (similar to iMessage emoji reactions)
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  Clipboard,
  Alert,
  Share,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import ThemedText from './common/ThemedText';

export type JournalType = 'reflection' | 'prayer' | 'gratitude' | 'timeblock';

interface JournalTypeOption {
  type: JournalType;
  icon: string;
  color: string;
}

interface JournalTypeSelectorTooltipProps {
  visible: boolean;
  onSelect: (type: JournalType) => void;
  onClose: () => void;
  subtaskText?: string; // The subtask text to display in focus
}

const JOURNAL_TYPE_OPTIONS: JournalTypeOption[] = [
  {
    type: 'reflection',
    icon: 'head-lightbulb',
    color: Colors.reflectionBlue,
  },
  {
    type: 'prayer',
    icon: 'hands-pray',
    color: Colors.prayerPurple,
  },
  {
    type: 'gratitude',
    icon: 'heart',
    color: Colors.gratitudeRed,
  },
  {
    type: 'timeblock',
    icon: 'clock',
    color: Colors.timeblockGreen,
  },
];

const JournalTypeSelectorTooltip: React.FC<JournalTypeSelectorTooltipProps> = ({
  visible,
  onSelect,
  onClose,
  subtaskText,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // For display only: strip surrounding straight or curly quotes from the text
  const displayText = React.useMemo(() => {
    if (!subtaskText) { return ''; }
    const trimmed = subtaskText.trim();
    // Remove matching leading/trailing quotes like "text", “text”, ‘text’
    const match = trimmed.match(/^(["'“”])(.*)(["'“”])$/);
    if (match && match[2]) {
      return match[2];
    }
    return trimmed;
  }, [subtaskText]);

  useEffect(() => {
    if (visible) {
      // iMessage-style pop animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleSelect = (type: JournalType) => {
    triggerLightHaptic();
    onSelect(type);
  };

  const handleBackdropPress = () => {
    triggerLightHaptic();
    onClose();
  };

  const handleCopy = () => {
    if (subtaskText) {
      Clipboard.setString(subtaskText);
      triggerSuccessHaptic();
      Alert.alert('Copied', 'Subtask text copied to clipboard');
    }
  };

  const handleShare = async () => {
    if (!subtaskText) {return;}
    try {
      triggerLightHaptic();
      await Share.share({
        message: subtaskText,
      });
    } catch (error) {
      // Best-effort share; surface a gentle error if something goes wrong
      Alert.alert('Unable to share', 'There was a problem sharing this text.');
    }
  };

  if (!visible) {return null;}

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Blur overlay - similar to iMessage */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleBackdropPress}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="dark"
            blurAmount={10}
            reducedTransparencyFallbackColor="rgba(0,0,0,0.6)"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.androidBlur]} />
        )}

        {/* Focused subtask text - stays sharp while background blurs */}
        {displayText && (
          <Animated.View
            style={[
              styles.focusedSubtaskContainer,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.focusedSubtaskBubble}>
              <ThemedText weight="medium" style={styles.focusedSubtaskText}>
                {displayText}
              </ThemedText>
            </View>
          </Animated.View>
        )}

        {/* iMessage-style horizontal pill picker */}
        <Animated.View
          style={[
            styles.pickerPill,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {JOURNAL_TYPE_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option.type}
              style={[
                styles.iconButton,
                index < JOURNAL_TYPE_OPTIONS.length - 1 && styles.iconButtonBorder,
              ]}
              onPress={() => handleSelect(option.type)}
              activeOpacity={0.6}
            >
              <View style={[styles.iconCircle, { backgroundColor: option.color }]}>
                <MaterialCommunityIcons
                  name={option.icon}
                  size={18}
                  color={Colors.hopeWhite}
                />
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Utility buttons below picker */}
        <Animated.View
          style={[
            styles.utilityButtonsContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.utilityButton}
            onPress={handleCopy}
            activeOpacity={0.7}
          >
            <Ionicons name="copy-outline" size={20} color={Colors.hopeWhite} />
            <ThemedText weight="medium" style={styles.utilityButtonText}>
              Copy
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.utilityButton}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Ionicons name="share-outline" size={20} color={Colors.hopeWhite} />
            <ThemedText weight="medium" style={styles.utilityButtonText}>
              Share
            </ThemedText>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  androidBlur: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  focusedSubtaskContainer: {
    position: 'absolute',
    top: '30%',
    width: '85%',
    alignItems: 'center',
    marginBottom: 100, // Space for picker pill below
  },
  focusedSubtaskBubble: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    maxWidth: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  focusedSubtaskText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 22,
  },
  pickerPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(50, 50, 50, 0.95)',
    borderRadius: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    top: '50%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  iconButtonBorder: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 8,
    paddingRight: 16,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  utilityButtonsContainer: {
    position: 'absolute',
    top: '62%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  utilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    gap: 6,
  },
  utilityButtonText: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
});

export default JournalTypeSelectorTooltip;
