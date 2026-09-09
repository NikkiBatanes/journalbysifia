import React, { useRef, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Modal, View, TouchableOpacity, ScrollView, StyleSheet, Animated, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';
import { TIMEBLOCK_CATEGORIES, TimeBlockCategory } from './TimeBlockCategories';
import { triggerLightHaptic, triggerSelectionHaptic } from '../../utils/haptics';

interface TimeBlockCategoryModalProps {
  visible: boolean;
  selectedCategory: string;
  onSelect: (category: TimeBlockCategory) => void;
  onCancel: () => void;
}

// StepFadeIn component
const StepFadeIn: React.FC<{ delay?: number; children: React.ReactNode; style?: any }> = ({ delay = 0, children, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 340,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 55,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

const TimeBlockCategoryModal: React.FC<TimeBlockCategoryModalProps> = ({
  visible,
  selectedCategory,
  onSelect,
  onCancel,
}) => {
  const [showAllCategories, setShowAllCategories] = React.useState(false);
  const [isOtherSelected, setIsOtherSelected] = React.useState(false);
  const [customCategory, setCustomCategory] = React.useState('');
  const [localSelectedCategory, setLocalSelectedCategory] = React.useState<string | null>(null);
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const insets = useSafeAreaInsets();

  const buttonScale = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;
  const chooseAgainScale = useRef(new Animated.Value(0)).current;

  const displayedCategories = showAllCategories ? TIMEBLOCK_CATEGORIES : TIMEBLOCK_CATEGORIES.slice(0, 12);

  // Reset local state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setLocalSelectedCategory(selectedCategory);
      setIsOtherSelected(selectedCategory === 'Other');
    } else {
      setLocalSelectedCategory(null);
      setIsOtherSelected(false);
      setCustomCategory('');
    }
  }, [visible, selectedCategory]);

  useEffect(() => {
    if (localSelectedCategory) {
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: false,
      }).start();
    } else {
      buttonScale.setValue(0);
    }
  }, [localSelectedCategory, buttonScale]);

  useEffect(() => {
    if (selectedCategory === 'Other') {
      setIsOtherSelected(true);
    } else {
      setIsOtherSelected(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (isOtherSelected) {
      Animated.spring(chooseAgainScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: false,
      }).start();
    } else {
      chooseAgainScale.setValue(0);
    }
  }, [isOtherSelected, chooseAgainScale]);

  const handleToggleShowAll = () => {
    triggerLightHaptic();
    Animated.timing(buttonOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setShowAllCategories(!showAllCategories);
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleChooseAgain = () => {
    triggerLightHaptic();
    setIsOtherSelected(false);
    onSelect(null as any);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.stepContainer}>
          <ScrollView
            style={styles.stepScroll}
            contentContainerStyle={[styles.stepContent, { paddingTop: insets.top + 8, paddingBottom: 30 }]}
            showsVerticalScrollIndicator={false}
          >
            <StepFadeIn delay={0}>
              <View style={styles.focusLabelContainer}>
                <MaterialIcons name="filter-center-focus" size={16} color={Colors.alertCoral} style={styles.labelIcon} />
                <ThemedText weight="semiBold" style={styles.focusLabel}>SELECT CATEGORY</ThemedText>
              </View>
            </StepFadeIn>

            <StepFadeIn delay={80}>
              <View style={styles.titleRow}>
                <ThemedText weight="semiBold" style={styles.stepTitle}>
                  {isOtherSelected ? 'What is your category?' : 'Choose your category'}
                </ThemedText>
              </View>
            </StepFadeIn>

            {isOtherSelected && (
              <StepFadeIn delay={160}>
                <View style={styles.customInputContainer}>
                  <TextInput
                    style={[styles.customInput, { fontFamily: getFontFamily(fontKey, 'regular') }]}
                    placeholder="Type your category"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={customCategory}
                    onChangeText={setCustomCategory}
                    multiline
                    autoFocus
                    keyboardAppearance="dark"
                  />
                </View>
              </StepFadeIn>
            )}

            {!isOtherSelected && (
              <StepFadeIn delay={160} style={styles.categoriesGrid}>
              {displayedCategories.map((category) => {
                const isSelected = localSelectedCategory === category.name;
                return (
                  <TouchableOpacity
                    key={category.name}
                    style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                    onPress={() => {
                      triggerSelectionHaptic();
                      if (category.name === 'Other') {
                        setLocalSelectedCategory('Other');
                        setIsOtherSelected(true);
                      } else {
                        setLocalSelectedCategory(category.name);
                        onSelect(category);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.categoryIconContainer}>
                      <View style={[
                        styles.categoryIconCircle,
                        isSelected && styles.categoryIconCircleSelected,
                      ]}>
                        <Ionicons
                          name={category.icon as any}
                          size={18}
                          color={isSelected ? Colors.hopeWhite : Colors.alertCoral}
                        />
                      </View>
                    </View>
                    <ThemedText
                      weight="semiBold"
                      style={[styles.categoryName, isSelected && styles.categoryNameSelected]}
                    >
                      {category.name}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </StepFadeIn>
            )}

            {TIMEBLOCK_CATEGORIES.length > 12 && !isOtherSelected && (
              <StepFadeIn delay={240}>
                <Animated.View style={{ opacity: buttonOpacity }}>
                  <TouchableOpacity
                    style={styles.showMoreButton}
                    onPress={handleToggleShowAll}
                    activeOpacity={0.75}
                  >
                    <ThemedText style={styles.showMoreButtonText}>
                      {showAllCategories ? 'Show Less' : 'Show More'}
                    </ThemedText>
                  </TouchableOpacity>
                </Animated.View>
              </StepFadeIn>
            )}

            {isOtherSelected && (
              <StepFadeIn delay={240}>
                <Animated.View style={{ opacity: chooseAgainScale }}>
                  <TouchableOpacity
                    style={[styles.showMoreButton, { alignSelf: 'flex-end' }]}
                    onPress={handleChooseAgain}
                    activeOpacity={0.75}
                  >
                    <ThemedText style={styles.showMoreButtonText}>
                      Choose again
                    </ThemedText>
                  </TouchableOpacity>
                </Animated.View>
              </StepFadeIn>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Bottom button */}
          {localSelectedCategory && (!isOtherSelected || customCategory.trim() !== '') && (
            <Animated.View style={[styles.primaryButton, { bottom: insets.bottom + 20, transform: [{ scale: buttonScale }] }]}>
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  if (isOtherSelected && customCategory.trim() !== '') {
                    // Create a custom category object
                    const customCategoryObj: TimeBlockCategory = {
                      name: customCategory.trim(),
                      icon: 'ellipsis-horizontal',
                      color: '#7C837D',
                      description: 'Custom category',
                    };
                    onSelect(customCategoryObj);
                  }
                  onCancel();
                }}
                activeOpacity={0.7}
                style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Close button - top right */}
          <View style={[styles.closeButton, { top: insets.top + 8 }]}>
            <TouchableOpacity
              onPress={() => {
                triggerLightHaptic();
                onCancel();
              }}
              style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  stepContainer: {
    flex: 1,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 20,
  },
  focusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 32,
  },
  labelIcon: {
    marginTop: 1,
  },
  focusLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.hopeWhite,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 24,
    color: Colors.hopeWhite,
    lineHeight: 30,
    textAlign: 'center',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  categoryCard: {
    width: '31%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 12,
    marginBottom: 0,
    minHeight: 100,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.18)',
    borderColor: Colors.alertCoral,
  },
  categoryIconContainer: {
    marginBottom: 8,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.anchorBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconCircleSelected: {
    backgroundColor: Colors.alertCoral,
  },
  categoryName: {
    fontSize: 12,
    color: Colors.hopeWhite,
    marginBottom: 4,
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: Colors.hopeWhite,
  },
  categoryDescription: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 14,
    textAlign: 'center',
  },
  categoryDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  customInputContainer: {
    marginTop: 16,
    paddingHorizontal: 24,
  },
  customInputTitle: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
    fontWeight: '500',
  },
  customInput: {
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 18,
    color: Colors.hopeWhite,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  showMoreButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
  },
  showMoreButtonText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  primaryButton: {
    position: 'absolute',
    right: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 20,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
    zIndex: 100,
  },
});

export default TimeBlockCategoryModal;
export { TIMEBLOCK_CATEGORIES };
