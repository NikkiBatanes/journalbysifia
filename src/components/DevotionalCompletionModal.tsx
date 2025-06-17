import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { Colors } from '../theme';
import { Typography as TypographyStyles } from '../theme/typography';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Devotional } from '../interfaces/devotional';
import { extractCleanTitle } from '../utils/titleUtils';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DevotionalCompletionModalProps {
  visible: boolean;
  devotional: Devotional;
  currentDayNumber: number;
  completedDays: number;
  onContinue: () => void;
  onClose: () => void;
  onRatingSubmit: (rating: number) => Promise<void>;
}

const DevotionalCompletionModal: React.FC<DevotionalCompletionModalProps> = ({
  visible,
  devotional,
  currentDayNumber,
  completedDays: propCompletedDays,
  onContinue,
  onClose,
  onRatingSubmit,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const [rating, setRating] = useState(0);

  const isLastDay = devotional &&
    currentDayNumber === devotional.totalDays;

  const completedDays = propCompletedDays;
  const totalDays = devotional?.totalDays || 0;
  const progress = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;

  useEffect(() => {
    if (visible) {
      // Reset animations when modal becomes visible
      slideAnim.setValue(SCREEN_HEIGHT);
      progressAnim.setValue(0);
      checkAnim.setValue(0);

      // Start slide-up animation
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();

      // Start progress bar animation after a delay
      setTimeout(() => {
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 1000,
          useNativeDriver: false,
          easing: Easing.out(Easing.ease),
        }).start();
      }, 500);

      // Start checkmark animation after progress animation
      setTimeout(() => {
        Animated.timing(checkAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.bounce,
        }).start();
      }, 1500);
    }
  }, [visible, slideAnim, progressAnim, checkAnim, progress]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.in(Easing.ease),
    }).start(() => {
      onClose();
      setRating(0);
    });
  }, [onClose, slideAnim]);

  const handleRatingSubmit = useCallback(async (selectedRating: number) => {
    if (selectedRating > 0) {
      try {
        await onRatingSubmit(selectedRating);
        // Use setTimeout to defer the close to the next tick
        setTimeout(handleClose, 0);
      } catch (error) {
        console.error('Error submitting rating:', error);
      }
    }
  }, [onRatingSubmit, handleClose]);

  const handleStarPress = useCallback((index: number) => {
    const selectedRating = index + 1;
    // Only update the UI state immediately
    setRating(selectedRating);
    // Handle the async submission separately
    handleRatingSubmit(selectedRating).catch(console.error);
  }, [handleRatingSubmit]);

  const renderStars = () => {
    return (
      <View style={styles.starsRow}>
        {Array(5).fill(0).map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleStarPress(index)}
            style={styles.starButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={index < rating ? 'star' : 'star-outline'}
              size={24}
              color={Colors.faithGold}
              style={styles.starIcon}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const checkScale = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const checkOpacity = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Get the current day's data
  const currentDay = devotional.days.find(day => day.dayNumber === currentDayNumber);

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, { opacity: visible ? 1 : 0 }]} />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>

          <View style={styles.contentContainer}>
            {isLastDay ? (
              <>
                <Text style={styles.congratsTitle}>
                  Congratulations!
                </Text>
                <Text style={styles.congratsSubtitle}>
                  You've completed the entire devotional!
                </Text>
                {devotional.title && (
                  <View style={styles.titleContainer}>
                    <Text style={styles.devotionalTitle} numberOfLines={2}>
                      {devotional.totalDays > 1 
                        ? `${extractCleanTitle(devotional.title)}: ${currentDay?.title || ''}`
                        : extractCleanTitle(devotional.title)}
                    </Text>
                  </View>
                )}
                <Animated.View
                  style={[
                    styles.checkContainer,
                    {
                      opacity: checkOpacity,
                      transform: [{ scale: checkScale }],
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={80}
                    color={Colors.growthGreen}
                  />
                </Animated.View>

                <Text style={styles.dayIndicator}>
                  {completedDays}/{totalDays} Days Completed
                </Text>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBackground}>
                    <Animated.View
                      style={[
                        styles.progressFill,
                        { width: progressWidth },
                      ]}
                    />
                  </View>
                </View>

                <Text style={styles.ratingTitle}>
                  How would you rate this devotional?
                </Text>

                <View style={styles.starsContainer}>
                  {renderStars()}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.devotionalTitle}>
                  {devotional.totalDays > 1 && currentDay
                    ? `${extractCleanTitle(devotional.title)}: ${currentDay.title}`
                    : extractCleanTitle(devotional.title)}
                </Text>
                {devotional.totalDays > 1 && (
                  <Text style={styles.dayIndicator}>
                    Day {currentDayNumber} of {totalDays}
                  </Text>
                )}
                <Text style={styles.completedText}>
                  Completed!
                </Text>

                <Animated.View
                  style={[
                    styles.checkContainer,
                    {
                      opacity: checkOpacity,
                      transform: [{ scale: checkScale }],
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={80}
                    color={Colors.growthGreen}
                  />
                </Animated.View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBackground}>
                    <Animated.View
                      style={[
                        styles.progressFill,
                        { width: progressWidth },
                      ]}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={onContinue}
                >
                  <Text style={styles.continueButtonText}>
                    Continue to Next Day
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    padding: 10,
    paddingBottom: 40,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeButton: {
    padding: 8,
    alignSelf: 'flex-end',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dayTitle: {
    ...TypographyStyles.interSemiBold,
    fontSize: 24,
    color: Colors.textDark,
    marginTop: 20,
  },
  completedText: {
    ...TypographyStyles.interRegular,
    fontSize: 18,
    color: Colors.growthGreen,
    marginTop: 8,
    fontWeight: '500',
  },
  congratsTitle: {
    ...TypographyStyles.interBold,
    fontSize: 28,
    color: Colors.hopeWhite,
    marginTop: 24,
    marginBottom: 4,
    lineHeight: 34,
    textAlign: 'center',
  },
  congratsSubtitle: {
    ...TypographyStyles.interRegular,
    fontSize: 18,
    color: Colors.hopeWhite,
    marginTop: 0,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.9,
  },
  checkContainer: {
    marginTop: 10,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    width: '80%',
    marginTop: 10,
    marginBottom: 30,
  },
  progressBackground: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
  },
  progressText: {
    ...TypographyStyles.interSemiBold,
    fontSize: 18,
    color: Colors.anchorBlue,
    marginTop: 16,
    fontWeight: '600',
  },
  dayIndicator: {
    ...TypographyStyles.interSemiBold,
    fontSize: 20,
    color: Colors.hopeWhite,
    marginBottom: 16,
    fontWeight: '600',
    opacity: 0.9,
  },
  devotionalTitle: {
    ...TypographyStyles.interSemiBold,
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 22,
  },
  titleContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    width: '100%',
    alignSelf: 'center',
  },
  continueButton: {
    backgroundColor: Colors.growthGreen,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
  },
  continueButtonText: {
    ...TypographyStyles.interSemiBold,
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  ratingTitle: {
    ...TypographyStyles.interRegular,
    fontSize: 14,
    color: Colors.hopeWhite,
    marginTop: 10,
    marginBottom: 0,
    fontWeight: '400',
    lineHeight: 22,
    opacity: 0.9,
    textAlign: 'center',
  },
  starsContainer: {
    marginVertical: 12,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starButton: {
    padding: 6,
    borderRadius: 12,
  },
  starIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  submitButton: {
    backgroundColor: Colors.faithGold,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  submitButtonText: {
    ...TypographyStyles.interSemiBold,
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default DevotionalCompletionModal;
