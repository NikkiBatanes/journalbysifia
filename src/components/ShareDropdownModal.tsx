import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  Platform,
  Share,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedText from './common/ThemedText';
import { Colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ShareDropdownModalProps {
  visible: boolean;
  onClose: () => void;
  onExportPDF: () => void;
  playbookTitle?: string;
  shareText?: string;
  shareContext?: 'playbook' | 'devotional';
  devotionalShareData?: {
    totalDays: number;
    dayNumber: number;
    title: string;
  };
  isCompletion?: boolean; // Indicates if sharing from completion page
}

const ShareDropdownModal: React.FC<ShareDropdownModalProps> = ({
  visible,
  onClose,
  onExportPDF,
  playbookTitle,
  shareText,
  shareContext = 'playbook',
  devotionalShareData,
  isCompletion = false,
}) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  const handleShareSiFia = async () => {
    triggerLightHaptic();

    const appUrl = 'https://apps.apple.com/us/app/sifia/id6751785713';
    const defaultShareText = `I used siFia to process a real-life moment with prayer and Scripture today. Try it here: ${appUrl}`;

    let finalShareText = shareText;

    if (shareContext === 'devotional' && devotionalShareData) {
      const { totalDays, dayNumber, title } = devotionalShareData;
      const isSeries = totalDays > 1;
      const isSingleDay = totalDays === 1;

      if (isCompletion) {
        // Completion page share text
        if (isSingleDay) {
          finalShareText = `I finished a personalized ${totalDays}-day devotional in siFia on Day 1 and spent time in prayer, reflection, and Scripture. Try it here: ${appUrl}`;
        } else {
          finalShareText = `I finished a personalized ${totalDays}-day devotional series in siFia today and spent time in prayer, reflection, and Scripture. Try it here: ${appUrl}`;
        }
      } else {
        // Detail page share text
        finalShareText = `I created a personalized ${totalDays}-day devotional${isSeries ? ' series' : ''} in siFia to spend time in prayer, reflection, and Scripture. Today I'm on Day ${dayNumber}: ${title}. Try it here: ${appUrl}`;
      }
    } else if (shareContext === 'devotional') {
      finalShareText = `I finished a devotional in siFia today and spent time in prayer and Scripture. Try it here: ${appUrl}`;
    } else {
      finalShareText = defaultShareText;
    }

    try {
      await Share.share({
        message: finalShareText,
        url: appUrl,
      });
      triggerSuccessHaptic();
      onClose();
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleExportPDF = () => {
    triggerLightHaptic();
    onClose();
    onExportPDF();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.dropdownContainer,
            {
              bottom: insets.bottom + 16,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.dropdownContent}>
              <View style={styles.dropdownHeader}>
                <ThemedText weight="semiBold" style={styles.dropdownTitle}>
                  Share
                </ThemedText>
                <TouchableOpacity 
                  onPress={onClose} 
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={handleShareSiFia}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownItemIconContainer}>
                  <Ionicons name="share-social-outline" size={24} color={Colors.alertCoral} />
                </View>
                <View style={styles.dropdownItemTextContainer}>
                  <ThemedText weight="semiBold" style={styles.dropdownItemTitle}>
                    Share siFia with friends
                  </ThemedText>
                  <ThemedText style={styles.dropdownItemSubtitle}>
                    Share the app with your friends
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={handleExportPDF}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownItemIconContainer}>
                  <Ionicons name="document-outline" size={24} color={Colors.alertCoral} />
                </View>
                <View style={styles.dropdownItemTextContainer}>
                  <ThemedText weight="semiBold" style={styles.dropdownItemTitle}>
                    Export as PDF
                  </ThemedText>
                  <ThemedText style={styles.dropdownItemSubtitle}>
                    Export this playbook as a PDF file
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  dropdownContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 400,
    alignSelf: 'center',
  },
  dropdownContent: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    gap: 8,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
  },
  dropdownTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
    padding: 16,
    gap: 12,
  },
  dropdownItemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownItemTextContainer: {
    flex: 1,
  },
  dropdownItemTitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  dropdownItemSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});

export default ShareDropdownModal;
