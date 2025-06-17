import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { Colors } from '../theme';
import { Typography as TypographyStyles } from '../theme/typography';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Devotional } from '../interfaces/devotional';

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

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.in(Easing.ease),
    }).start(() => {
      onClose();
      setRating(0);
    });
  };

  const handleRatingSubmit = async () => {
    if (rating > 0) {
      await onRatingSubmit(rating);
    } else {
      // If no rating selected, just close the modal
      handleClose();
    }
  };

  const renderStars = () => {
    return Array(5).fill(0).map((_, index) => (
      <TouchableOpacity
        key={index}
        onPress={() => setRating(index + 1)}
        style={styles.starContainer}
      >
        <Ionicons
          name={index < rating ? 'star' : 'star-outline'}
          size={36}
          color={Colors.faithGold}
        />
      </TouchableOpacity>
    ));
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

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.textDark} />
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

                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleRatingSubmit}
                >
                  <Text style={styles.submitButtonText}>
                    Submit Rating
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.dayIndicator}>
                  Day {currentDayNumber} of {totalDays}
                </Text>
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

                <Text style={styles.progressText}>
                  {completedDays}/{totalDays} Days Completed
                </Text>

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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.hopeWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    height: SCREEN_HEIGHT * 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeButton: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
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
    color: Colors.anchorBlue,
    marginTop: 20,
  },
  congratsSubtitle: {
    ...TypographyStyles.interRegular,
    fontSize: 18,
    color: Colors.trustGrey,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  checkContainer: {
    marginVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    width: '100%',
    marginTop: 20,
  },
  progressBackground: {
    height: 12,
    backgroundColor: Colors.trustGrey,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
  },
  progressText: {
    ...TypographyStyles.interRegular,
    fontSize: 16,
    color: Colors.trustGrey,
    marginTop: 12,
    fontWeight: '500',
  },
  dayIndicator: {
    ...TypographyStyles.interRegular,
    fontSize: 16,
    color: Colors.trustGrey,
    marginBottom: 12,
    fontWeight: '500',
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
    fontSize: 18,
    color: Colors.anchorBlue,
    marginTop: 30,
    marginBottom: 16,
    fontWeight: '500',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
  },
  starContainer: {
    padding: 8,
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
