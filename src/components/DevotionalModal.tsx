import React, { useState, useRef } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, Dimensions, Animated, Easing, ActivityIndicator } from 'react-native';
import { Colors, defaultFontFamily } from '../theme';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useDevotional } from '../context/DevotionalContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DurationOption {
  days: number;
  title: string;
  description: string;
}

const DURATION_OPTIONS: DurationOption[] = [
  {
    days: 1,
    title: '1-Day Devotional',
    description: 'Perfect for a quick lift of faith',
  },
  {
    days: 3,
    title: '3-Day Devotional',
    description: 'Great for a focused mid-week refresh',
  },
  {
    days: 5,
    title: '5-Day Devotional',
    description: 'Ideal for a deeper dive into your journey',
  },
  {
    days: 7,
    title: '7-Day Devotional',
    description: 'A full week of spiritual growth',
  },
];

interface DevotionalModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDuration?: (days: number) => void;
  userStruggle?: string;
  playbookInfo?: string;
  playbookId?: string;
  userInput?: string;
  onDevotionalCreated?: (devotionalId: string) => void;
}

const DevotionalModal: React.FC<DevotionalModalProps> = ({
  visible,
  onClose,
  onSelectDuration,
  playbookInfo,
  playbookId,
  userInput,
  onDevotionalCreated,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const { createDevotional, isLoading, error } = useDevotional();
  const rotateAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [isVisible, setIsVisible] = useState(false);
  const [showPlaybookInfo, setShowPlaybookInfo] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [ellipsis, setEllipsis] = useState('');
  const contentRef = React.useRef<View>(null);
  const checkmarkAnim = useRef(new Animated.Value(0)).current;

  // Success state and checkmark animation
  const [isSuccess, setIsSuccess] = useState(false);
  // Animation for the overlay (fade in/out)
  // Fade animation for backdrop dim
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const measureContent = () => {
    if (contentRef.current) {
      contentRef.current.measureInWindow((_x, _y, _width, height) => {
        setContentHeight(height);
      });
    }
  };

  // Animate the ellipsis
  React.useEffect(() => {
    if (!isLoading) {return;}

    const timer = setInterval(() => {
      setEllipsis((prev: string) => {
        if (prev.length >= 3) {return '';}
        return prev + '.';
      });
    }, 300);

    return () => clearInterval(timer);
  }, [isLoading]);

  React.useEffect(() => {
    let isMounted = true;
    let animation: Animated.CompositeAnimation | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (visible) {
      setIsVisible(true);
      // Small delay to ensure content is measured
      timer = setTimeout(() => {
        measureContent();
      }, 10);

      // Fade in backdrop and slide up modal
      animation = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
        }),
      ]);
      animation.start();
    } else {
      // Calculate the distance to slide down (full screen height + modal height + some extra)
      const slideDownDistance = Dimensions.get('window').height + 100; // Ensure it goes completely off screen

      // Fade out backdrop quickly while sliding down
      animation = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 100, // Very fast fade out
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: slideDownDistance,
          duration: 300, // Slide down duration
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
      ]);

      animation.start(({ finished }) => {
        if (finished && isMounted) {
          setIsVisible(false);
          // Reset translateY for next open
          translateY.setValue(SCREEN_HEIGHT);
        }
      });
    }


    return () => {
      isMounted = false;
      if (animation) {
        animation.stop();
      }
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [visible, contentHeight, fadeAnim, translateY]);

  const togglePlaybookInfo = () => {
    const toValue = showPlaybookInfo ? 0 : 1;
    setShowPlaybookInfo(!showPlaybookInfo);

    Animated.spring(rotateAnim, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  };

  const handleSelectDuration = async (days: number) => {
    try {
      setSelectedDuration(days);

      if (onSelectDuration) {
        onSelectDuration(days);
        return;
      }

      // If no onSelectDuration provided, handle devotional creation here
      if (playbookId && userInput) {
        const devotional = await createDevotional({
          duration: days,
          playbookId,
          userInput,
        });

        if (devotional && onDevotionalCreated) {
          setIsSuccess(true);
          Animated.timing(checkmarkAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
        setTimeout(() => {
          // Delay before modal swipes down
          setTimeout(() => {
            handleClose(); // Starts sliding down (150ms duration)
            // Navigate immediately after modal starts closing
            onDevotionalCreated(devotional.id);
            // Reset animation state after navigation
            setTimeout(() => {
              setIsSuccess(false);
              checkmarkAnim.setValue(0);
            }, 150); // Match slide down duration
          }, 350); // Wait 350ms before starting close
        }, 280); // Checkmark animates in for 280ms
        }
      }
    } catch (err) {
      console.error('Error creating devotional:', err);
    }
  };

  const handleClose = () => {
    // Calculate the distance to slide down (full screen height + modal height + some extra)
    const slideDownDistance = Dimensions.get('window').height + 100; // Ensure it goes completely off screen

    // Fade out backdrop quickly while sliding down
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100, // Very fast fade out
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: slideDownDistance,
        duration: 150, // Faster slide down duration
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
        // Reset translateY for next open
        translateY.setValue(SCREEN_HEIGHT);
      }
    });
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });


  if (!isVisible && !visible) {return null;}

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.backdrop,
            { opacity: fadeAnim },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>
        <Animated.View
          ref={contentRef}
          style={[
            styles.modalContainer,
            { transform: [{ translateY }] },
          ]}
          onLayout={measureContent}
        >
          <View style={styles.headerContainer}>
            <View style={styles.handle} />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons name="close" size={24} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>

          <View style={styles.contentWrapper}>
            <View style={styles.fixedContent}>
              <Text style={styles.title}>Create Your Personalized Devotional</Text>
              <View style={styles.subtitleContainer}>
                <Text style={styles.subtitle}>
                  Based on what you've shared, we'll craft a devotional tailored to your journey.
                </Text>
              </View>
            </View>

            <View style={styles.scrollableContent}>
              {playbookInfo && (
                <View style={styles.playbookInfoContainer}>
                  <TouchableOpacity
                    style={styles.playbookInfoHeader}
                    onPress={togglePlaybookInfo}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.playbookInfoLabel}>WHAT YOU SHARED</Text>
                    <Animated.View style={{ transform: [{ rotate }] }}>
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={Colors.hopeWhite}
                      />
                    </Animated.View>
                  </TouchableOpacity>

                  <View style={[
                    styles.playbookInfoContent,
                    showPlaybookInfo ? styles.playbookInfoContentExpanded : styles.playbookInfoContentCollapsed,
                  ]}>
                    <Text style={styles.playbookInfoText}>{userInput || playbookInfo}</Text>
                  </View>
                </View>
              )}

              <View style={styles.optionsContainer}>
  <Text style={styles.durationPrompt}>Select a devotional duration:</Text>
  {(isLoading || isSuccess) ? (
    <View style={styles.loadingContainer}>
      {!isSuccess ? (
        <>
          <ActivityIndicator size="large" color={Colors.hopeWhite} />
          <Text style={styles.loadingText}>
            {selectedDuration ? `Creating your ${selectedDuration}-day devotional${ellipsis}` : `Creating your devotional${ellipsis}`}
          </Text>
        </>
      ) : (
        <>
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                transform: [{ scale: checkmarkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
                opacity: checkmarkAnim,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={64} color={Colors.growthGreen || '#4BB543'}/>
          </Animated.View>
          <Text style={styles.loadingText}>Devotional Created!</Text>
        </>
      )}
    </View>
  ) : error ? (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={handleClose}
      >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.optionsContainer}>
      {DURATION_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.days}
          style={styles.optionButton}
          onPress={() => handleSelectDuration(option.days)}
          disabled={isLoading}
        >
          <Text style={styles.optionDays}>{option.days} DAY</Text>
          <Text style={styles.optionTitle}>{option.title}</Text>
          <Text style={styles.optionDescription}>
            {option.description}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )}
  <Text style={styles.footerText}>
    God's Word is a lamp to your feet and a light to your path.{'\n'}Let this devotional help you walk closer with Him.
  </Text>
</View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  checkmarkContainer: {
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    padding: 20,
    paddingBottom: 40, // Increased bottom padding for better spacing
    maxHeight: '85%',
    minHeight: 300, // Ensure minimum height for smooth animation
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    width: '100%',
    left: 0,
    right: 0,
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
  },
  headerContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 16,
    alignSelf: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 0,
  },
  title: {
    fontSize: 18,
    fontFamily: defaultFontFamily.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 0.2,
    paddingHorizontal: 10,
    width: '100%',
    flexShrink: 1,
    includeFontPadding: false,
    alignSelf: 'center',
    maxWidth: '100%',
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  subtitleContainer: {
    marginBottom: 0,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: defaultFontFamily.semiBold,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 0,
    lineHeight: 24,
  },
  durationPrompt: {
    fontSize: 13,
    fontFamily: defaultFontFamily.semiBold,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'left',
    lineHeight: 20,
    marginBottom: 4, // Reduced from 12px to 4px
    paddingHorizontal: 4,
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionDays: {
    fontSize: 12,
    fontFamily: defaultFontFamily.semiBold,
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: defaultFontFamily.semiBold,
    color: Colors.hopeWhite,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    fontFamily: defaultFontFamily.semiBold,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 16,
  },
  playbookInfoContainer: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  playbookInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  playbookInfoLabel: {
    color: Colors.hopeWhite,
    fontFamily: defaultFontFamily.semiBold,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 1,
    opacity: 1,
    marginVertical: 2,
    textTransform: 'uppercase',
  },
  fixedContent: {
    width: '100%',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  scrollableContent: {
    flex: 1,
    paddingHorizontal: 4,
    paddingBottom: 20,
  },
  playbookInfoContent: {
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  playbookInfoContentExpanded: {
    maxHeight: 1000, // Arbitrarily large value to allow content to expand
    paddingBottom: 12,
  },
  playbookInfoContentCollapsed: {
    maxHeight: 0,
    paddingBottom: 0,
  },
  playbookInfoText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: defaultFontFamily.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  footerText: {
    fontSize: 13,
    fontFamily: defaultFontFamily.semiBold,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 10,
  },
  loadingText: {
    color: Colors.hopeWhite,
    fontFamily: defaultFontFamily.semiBold,
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.3)',
    marginVertical: 10,
  },
  errorText: {
    color: Colors.hopeWhite,
    fontFamily: defaultFontFamily.semiBold,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.hopeWhite,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  retryButtonText: {
    color: Colors.anchorBlue,
    fontFamily: defaultFontFamily.semiBold,
    fontSize: 14,
  },
});

export default DevotionalModal;
