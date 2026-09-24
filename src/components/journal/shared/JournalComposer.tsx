import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {Pencil} from 'lucide-react-native';
import ThemedText from '../../common/ThemedText';
import {Colors} from '../../../theme/colors';
import {
  triggerLightHaptic,
  triggerSelectionHaptic,
} from '../../../utils/haptics';
import {
  noteBlockPreferences,
  useNoteBlockPreferences,
} from '../../../services/noteBlockPreferences';
import {
  JOURNAL_BLOCKS,
  NOTE_BLOCK_CATEGORIES,
  NOTE_BLOCK_REGISTRY,
  JournalBlockIcon,
  isJournalBlockKind,
  type SelectableJournalBlockKind,
} from './journalBlocks';
import {NoteBlockCatalogPreview} from './NoteBlockCatalogPreview';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const createJournalPickerEntrance = (
  animations: readonly Animated.Value[],
) =>
  Animated.stagger(
    52,
    animations.map(animation =>
      Animated.spring(animation, {
        toValue: 1,
        tension: 140,
        friction: 7,
        useNativeDriver: true,
      }),
    ),
  );

export const JournalPickerMenu = <T extends string>({
  items,
  animations,
  onSelect,
  tone = 'default',
}: {
  items: readonly {key: T; label: string; icon: React.ReactNode}[];
  animations: Animated.Value[];
  onSelect: (key: T) => void;
  tone?: 'default' | 'onDark';
}) => {
  const [allBlocksOpen, setAllBlocksOpen] = useState(false);
  const pendingSelectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sheetClosingRef = useRef(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(48)).current;
  const browseAnimation = useRef(new Animated.Value(0)).current;
  const preferences = useNoteBlockPreferences();
  const enabledKindSet = useMemo(
    () => new Set(preferences.enabledKinds),
    [preferences.enabledKinds],
  );
  const favoriteKindSet = useMemo(
    () => new Set(preferences.favoriteKinds),
    [preferences.favoriteKinds],
  );
  const visibleItems = useMemo(() => {
    const filtered = items.filter(
      item =>
        !isJournalBlockKind(item.key) ||
        item.key === 'text' ||
        enabledKindSet.has(item.key),
    );
    return filtered.length ? filtered : items.slice(0, 1);
  }, [enabledKindSet, items]);
  const initialItems = useMemo(() => {
    const favorites = preferences.favoriteKinds
      .map(kind => visibleItems.find(item => item.key === kind))
      .filter((item): item is (typeof visibleItems)[number] => Boolean(item));
    return favorites.length ? favorites : visibleItems.slice(0, 5);
  }, [preferences.favoriteKinds, visibleItems]);
  useEffect(() => {
    browseAnimation.stopAnimation();
    browseAnimation.setValue(0);
    const entrance = Animated.sequence([
      Animated.delay(290 + Math.max(0, initialItems.length - 1) * 52),
      Animated.timing(browseAnimation, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [browseAnimation, initialItems.length]);
  const itemMetadata = useMemo(
    () =>
      visibleItems.map(item => {
        const definition = isJournalBlockKind(item.key)
          ? NOTE_BLOCK_REGISTRY[item.key]
          : null;
        return {
          ...item,
          label: definition?.pickerLabel || item.label,
          description:
            definition?.description || 'Add this block to your note.',
          category: definition?.category || 'writing',
        };
      }),
    [visibleItems],
  );
  useEffect(() => {
    if (!allBlocksOpen) {
      return;
    }
    backdropOpacity.stopAnimation();
    sheetTranslateY.stopAnimation();
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(48);
    const frame = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 170,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => cancelAnimationFrame(frame);
  }, [allBlocksOpen, backdropOpacity, sheetTranslateY]);
  useEffect(
    () => () => {
      if (pendingSelectionTimerRef.current) {
        clearTimeout(pendingSelectionTimerRef.current);
      }
      backdropOpacity.stopAnimation();
      sheetTranslateY.stopAnimation();
    },
    [backdropOpacity, sheetTranslateY],
  );
  const openAllBlocks = () => {
    if (allBlocksOpen) {
      return;
    }
    sheetClosingRef.current = false;
    triggerLightHaptic();
    setAllBlocksOpen(true);
  };
  const closeAllBlocks = (
    onComplete?: () => void,
    shouldTriggerHaptic = !onComplete,
  ) => {
    if (sheetClosingRef.current) {
      return;
    }
    sheetClosingRef.current = true;
    if (shouldTriggerHaptic) {
      triggerLightHaptic();
    }
    backdropOpacity.stopAnimation();
    sheetTranslateY.stopAnimation();
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 48,
        duration: 210,
        useNativeDriver: true,
      }),
    ]).start(() => {
      sheetClosingRef.current = false;
      setAllBlocksOpen(false);
      if (onComplete) {
        pendingSelectionTimerRef.current = setTimeout(() => {
          pendingSelectionTimerRef.current = null;
          onComplete();
        }, 50);
      }
    });
  };
  const selectItem = (key: T) => {
    if (!allBlocksOpen) {
      onSelect(key);
      return;
    }
    closeAllBlocks(() => onSelect(key), false);
  };
  const isFavorite = (key: T) =>
    isJournalBlockKind(key) &&
    key !== 'text' &&
    favoriteKindSet.has(key as SelectableJournalBlockKind);
  const toggleFavorite = (key: T) => {
    if (
      !isJournalBlockKind(key) ||
      key === 'text' ||
      !NOTE_BLOCK_REGISTRY[key].selectable
    ) {
      return;
    }
    triggerSelectionHaptic();
    noteBlockPreferences
      .toggleFavoriteKind(key as SelectableJournalBlockKind)
      .catch(() => undefined);
  };

  return (
    <>
      <View accessibilityLabel="Quick note blocks" style={styles.pickerBar}>
        <View style={styles.pickerBarHeader}>
          <Animated.View
            style={{
              opacity: browseAnimation,
              transform: [
                {
                  scale: browseAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Browse all note blocks"
              onPress={openAllBlocks}
              style={[
                styles.browseButton,
                tone === 'onDark' && styles.browseButtonOnDark,
              ]}>
              <Ionicons
                name="grid-outline"
                size={14}
                color={tone === 'onDark' ? Colors.hopeWhite : Colors.sage}
              />
              <ThemedText
                weight="bold"
                style={[
                  styles.browseButtonText,
                  tone === 'onDark' && styles.browseButtonTextOnDark,
                ]}>
                Browse
              </ThemedText>
            </TouchableOpacity>
          </Animated.View>
        </View>
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickBlockRow}>
          {initialItems.map((item, index) => {
            const animation = animations[index];
            const definition = isJournalBlockKind(item.key)
              ? NOTE_BLOCK_REGISTRY[item.key]
              : null;
            return (
              <Animated.View
                key={item.key}
                style={
                  animation
                    ? {
                        opacity: animation.interpolate({
                          inputRange: [0, 0.45, 1],
                          outputRange: [0, 1, 1],
                          extrapolate: 'clamp',
                        }),
                        transform: [
                          {
                            scale: animation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.72, 1],
                              extrapolateLeft: 'clamp',
                              extrapolateRight: 'extend',
                            }),
                          },
                        ],
                      }
                    : undefined
                }>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${
                    definition?.pickerLabel || item.label
                  } block`}
                  accessibilityHint={`Long press to ${
                    isFavorite(item.key) ? 'remove from' : 'add to'
                  } favorites`}
                  style={[
                    styles.quickBlock,
                    tone === 'onDark' && styles.quickBlockOnDark,
                  ]}
                  onPress={() => selectItem(item.key)}
                  onLongPress={() => toggleFavorite(item.key)}>
                  <View
                    style={[
                      styles.quickBlockIcon,
                      tone === 'onDark' && styles.quickBlockIconOnDark,
                    ]}>
                    {item.icon}
                  </View>
                  <ThemedText
                    weight="bold"
                    numberOfLines={1}
                    style={[
                      styles.quickBlockText,
                      tone === 'onDark' && styles.quickBlockTextOnDark,
                    ]}>
                    {definition?.pickerLabel || item.label}
                  </ThemedText>
                  {isFavorite(item.key) && (
                    <Ionicons name="star" size={11} color={Colors.faithGold} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>

      <Modal
        animationType="none"
        transparent
        statusBarTranslucent
        visible={allBlocksOpen}
        onRequestClose={() => closeAllBlocks()}>
        <View style={styles.sheetRoot}>
          <Animated.View
            style={[styles.sheetBackdrop, {opacity: backdropOpacity}]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close all note blocks"
              style={StyleSheet.absoluteFill}
              onPress={() => closeAllBlocks()}
            />
          </Animated.View>
          <Animated.View
            accessibilityLabel="Note block browser sheet"
            style={[
              styles.sheet,
              tone === 'onDark' && styles.sheetOnDark,
              {transform: [{translateY: sheetTranslateY}]},
            ]}>
            <View
              style={[
                styles.sheetHandle,
                tone === 'onDark' && styles.sheetHandleOnDark,
              ]}
            />
            <View
              style={[
                styles.sheetHeader,
                tone === 'onDark' && styles.sheetHeaderOnDark,
              ]}>
              <View style={styles.sheetTitleGroup}>
                <ThemedText
                  weight="bold"
                  style={[
                    styles.sheetTitle,
                    tone === 'onDark' && styles.sheetTitleOnDark,
                  ]}>
                  Add a note block
                </ThemedText>
                <ThemedText
                  style={[
                    styles.sheetSubtitle,
                    tone === 'onDark' && styles.sheetSubtitleOnDark,
                  ]}>
                  Tap to add. Long press to add or remove a favorite.
                </ThemedText>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close note block browser"
                style={[
                  styles.sheetClose,
                  tone === 'onDark' && styles.sheetCloseOnDark,
                ]}
                onPress={() => closeAllBlocks()}>
                <Ionicons
                  name="close"
                  size={19}
                  color={tone === 'onDark' ? Colors.hopeWhite : Colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}>
              <View
                style={[
                  styles.catalogSummary,
                  tone === 'onDark' && styles.catalogSummaryOnDark,
                ]}>
                <Ionicons name="star" size={18} color={Colors.faithGold} />
                <ThemedText
                  weight="semiBold"
                  style={[
                    styles.catalogSummaryText,
                    tone === 'onDark' && styles.catalogSummaryTextOnDark,
                  ]}>
                  {itemMetadata.filter(item => isFavorite(item.key)).length}{' '}
                  favorites selected
                </ThemedText>
              </View>
              {NOTE_BLOCK_CATEGORIES.map(category => {
                const categoryItems = itemMetadata.filter(
                  item => item.category === category.id,
                );
                if (!categoryItems.length) {
                  return null;
                }
                return (
                  <View key={category.id} style={styles.categorySection}>
                    <ThemedText
                      weight="bold"
                      style={[
                        styles.categoryLabel,
                        tone === 'onDark' && styles.categoryLabelOnDark,
                      ]}>
                      {category.label.toUpperCase()}
                    </ThemedText>
                    <View style={styles.categoryGrid}>
                      {[0, 1].map(columnIndex => (
                        <View key={columnIndex} style={styles.catalogColumn}>
                          {categoryItems
                            .filter((_, index) => index % 2 === columnIndex)
                            .map(item => {
                              const favorite = isFavorite(item.key);
                              const definition = isJournalBlockKind(item.key)
                                ? NOTE_BLOCK_REGISTRY[item.key]
                                : null;
                              return (
                                <TouchableOpacity
                                  key={item.key}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Add ${item.label} block`}
                                  accessibilityHint={`Long press to ${
                                    favorite ? 'remove from' : 'add to'
                                  } favorites`}
                                  activeOpacity={0.82}
                                  style={[
                                    styles.catalogTile,
                                    tone === 'onDark' &&
                                      styles.catalogTileOnDark,
                                    favorite && styles.catalogTileFavorite,
                                    favorite &&
                                      tone === 'onDark' &&
                                      styles.catalogTileFavoriteOnDark,
                                  ]}
                                  onPress={() => selectItem(item.key)}
                                  onLongPress={() => toggleFavorite(item.key)}>
                                  <View style={styles.catalogTileHeading}>
                                    <ThemedText
                                      numberOfLines={1}
                                      weight="semiBold"
                                      style={[
                                        styles.catalogTileTitle,
                                        tone === 'onDark' &&
                                          styles.catalogTileTitleOnDark,
                                        favorite &&
                                          styles.catalogTileTitleFavorite,
                                        favorite &&
                                          tone === 'onDark' &&
                                          styles.catalogTileTitleFavoriteOnDark,
                                      ]}>
                                      {item.label}
                                    </ThemedText>
                                    <Ionicons
                                      name={favorite ? 'star' : 'star-outline'}
                                      size={17}
                                      color={
                                        favorite
                                          ? Colors.faithGold
                                          : tone === 'onDark'
                                          ? 'rgba(255,255,255,0.66)'
                                          : Colors.textGray
                                      }
                                    />
                                  </View>
                                  {definition ? (
                                    <NoteBlockCatalogPreview
                                      definition={definition}
                                      tone={tone}
                                    />
                                  ) : (
                                    <ThemedText
                                      style={[
                                        styles.catalogFallback,
                                        tone === 'onDark' &&
                                          styles.catalogFallbackOnDark,
                                      ]}>
                                      {item.description}
                                    </ThemedText>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

export const JournalBlockPickerMenu = <T extends keyof typeof JOURNAL_BLOCKS>({
  kinds,
  animations,
  onSelect,
}: {
  kinds: readonly T[];
  animations: Animated.Value[];
  onSelect: (kind: T) => void;
}) => (
  <JournalPickerMenu
    items={kinds.map(kind => ({
      key: kind,
      label: JOURNAL_BLOCKS[kind].pickerLabel,
      icon: (
        <JournalBlockIcon
          config={JOURNAL_BLOCKS[kind]}
          size={16}
          color={Colors.sage}
        />
      ),
    }))}
    animations={animations}
    onSelect={onSelect}
  />
);

export const JournalComposerBar = ({
  onBack,
  onWrite,
  onAdd,
  onNext,
  addOpen,
  plusRotation,
  pickerColorAnim,
  actionAnimations,
  nextIcon = 'chevron-forward',
  backLabel = 'Back',
  nextLabel = 'Next',
  nextDisabled = false,
  writeDisabled = false,
  tone = 'default',
}: {
  onBack: () => void;
  onWrite: () => void;
  onAdd: () => void;
  onNext: () => void;
  addOpen: boolean;
  plusRotation: Animated.Value;
  pickerColorAnim: Animated.Value;
  actionAnimations: Animated.Value[];
  nextIcon?: string;
  backLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  writeDisabled?: boolean;
  tone?: 'default' | 'onDark';
}) => (
  <View style={styles.floatingActions}>
    <Animated.View
      style={[
        styles.circleWrapper,
        {
          opacity: actionAnimations[0],
          transform: [
            {
              scale: actionAnimations[0].interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        style={[
          styles.backButton,
          tone === 'onDark' && styles.backButtonOnDark,
        ]}
        onPress={() => {
          triggerLightHaptic();
          onBack();
        }}>
        <Ionicons
          name="chevron-back"
          size={17}
          color={tone === 'onDark' ? Colors.hopeWhite : Colors.sage}
        />
      </TouchableOpacity>
    </Animated.View>
    <Animated.View
      style={[
        styles.writeWrapper,
        {
          opacity: actionAnimations[1],
          transform: [
            {
              scale: actionAnimations[1].interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Write"
        disabled={writeDisabled}
        style={[
          styles.writeButton,
          tone === 'onDark' && styles.writeButtonOnDark,
          writeDisabled && styles.disabledButton,
        ]}
        onPress={onWrite}>
        <Pencil size={16} color={Colors.hopeWhite} />
        <ThemedText weight="bold" style={styles.writeText}>
          Write
        </ThemedText>
      </TouchableOpacity>
    </Animated.View>
    <Animated.View
      style={[
        styles.circleWrapper,
        {
          opacity: actionAnimations[2],
          transform: [
            {
              scale: actionAnimations[2].interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}>
      <AnimatedTouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={
          addOpen ? 'Close note type picker' : 'Choose a note type'
        }
        style={[
          styles.circleButton,
          {
            backgroundColor: pickerColorAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [
                tone === 'onDark' ? '#64796C' : Colors.sage,
                tone === 'onDark' ? '#64796C' : Colors.text,
              ],
            }),
          },
        ]}
        onPress={onAdd}>
        <Animated.View
          style={{
            transform: [
              {
                rotate: plusRotation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '45deg'],
                }),
              },
            ],
          }}>
          <Ionicons name="add" size={24} color={Colors.hopeWhite} />
        </Animated.View>
      </AnimatedTouchableOpacity>
    </Animated.View>
    <Animated.View
      style={[
        styles.circleWrapper,
        {
          opacity: actionAnimations[3],
          transform: [
            {
              scale: actionAnimations[3].interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        disabled={nextDisabled}
        style={[
          styles.circleButton,
          tone === 'onDark' && styles.actionButtonOnDark,
        ]}
        onPress={onNext}>
        <Ionicons name={nextIcon as any} size={21} color={Colors.hopeWhite} />
      </TouchableOpacity>
    </Animated.View>
  </View>
);

const styles = StyleSheet.create({
  pickerBar: {
    alignSelf: 'stretch',
    marginHorizontal: -18,
    marginBottom: 8,
    paddingTop: 8,
    paddingBottom: 7,
  },
  pickerBarHeader: {
    minHeight: 30,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  browseButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: Colors.anchorBlueLight,
  },
  browseButtonOnDark: {backgroundColor: 'rgba(255,255,255,0.14)'},
  browseButtonText: {fontSize: 12, color: Colors.sage},
  browseButtonTextOnDark: {color: Colors.hopeWhite},
  quickBlockRow: {gap: 7, paddingHorizontal: 10, paddingTop: 7},
  quickBlock: {
    minWidth: 92,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    backgroundColor: Colors.lightBackground,
  },
  quickBlockOnDark: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#5E7A6B',
  },
  quickBlockIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: Colors.anchorBlueLight,
  },
  quickBlockIconOnDark: {backgroundColor: Colors.hopeWhite},
  quickBlockText: {maxWidth: 104, fontSize: 12, color: Colors.text},
  quickBlockTextOnDark: {color: Colors.hopeWhite},
  sheetRoot: {flex: 1, justifyContent: 'flex-end'},
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,28,23,0.48)',
  },
  sheet: {
    maxHeight: '82%',
    paddingTop: 8,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: Colors.lightBackground,
    shadowColor: Colors.text,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: -5},
    elevation: 18,
  },
  sheetOnDark: {backgroundColor: Colors.sage},
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    marginBottom: 7,
    borderRadius: 2,
    backgroundColor: Colors.cardBorder,
  },
  sheetHandleOnDark: {backgroundColor: 'rgba(255,255,255,0.38)'},
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 7,
    paddingBottom: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  sheetHeaderOnDark: {borderBottomColor: 'rgba(255,255,255,0.16)'},
  sheetTitleGroup: {flex: 1},
  sheetTitle: {fontSize: 20, color: Colors.text},
  sheetTitleOnDark: {color: Colors.hopeWhite},
  sheetSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textGray,
  },
  sheetSubtitleOnDark: {color: 'rgba(255,255,255,0.7)'},
  sheetClose: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: Colors.cardBackground,
  },
  sheetCloseOnDark: {backgroundColor: 'rgba(255,255,255,0.12)'},
  sheetContent: {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34},
  catalogSummary: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 3,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: Colors.anchorBlueLight,
  },
  catalogSummaryOnDark: {backgroundColor: '#5E7A6B'},
  catalogSummaryText: {fontSize: 12, lineHeight: 17, color: Colors.sage},
  catalogSummaryTextOnDark: {color: Colors.hopeWhite},
  categorySection: {marginTop: 19},
  categoryLabel: {
    marginBottom: 8,
    marginLeft: 3,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.sage,
  },
  categoryLabelOnDark: {color: Colors.anchorBlueLight},
  categoryGrid: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  catalogColumn: {flex: 1, gap: 10},
  catalogTile: {
    width: '100%',
    padding: 9,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
  },
  catalogTileOnDark: {
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: '#5E7A6B',
  },
  catalogTileFavorite: {
    padding: 8,
    borderWidth: 2,
    borderColor: Colors.sage,
    backgroundColor: Colors.anchorBlueLight,
  },
  catalogTileFavoriteOnDark: {
    borderColor: Colors.hopeWhite,
    backgroundColor: '#587264',
  },
  catalogTileHeading: {
    height: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  catalogTileTitle: {flex: 1, fontSize: 11, lineHeight: 15, color: Colors.text},
  catalogTileTitleOnDark: {color: Colors.hopeWhite},
  catalogTileTitleFavorite: {color: Colors.sage},
  catalogTileTitleFavoriteOnDark: {color: Colors.hopeWhite},
  catalogFallback: {
    minHeight: 72,
    padding: 9,
    borderRadius: 11,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textGray,
    backgroundColor: Colors.lightBackground,
  },
  catalogFallbackOnDark: {color: Colors.textGray},
  floatingTools: {
    width: '100%',
    marginBottom: 9,
    alignItems: 'flex-end',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  floatingTool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingLeft: 8,
    paddingRight: 18,
    borderWidth: 1,
    borderColor: Colors.sage,
    borderRadius: 28,
    backgroundColor: Colors.cardBackground,
    shadowColor: Colors.text,
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: {width: 0, height: 2},
    elevation: 3,
  },
  floatingToolIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.anchorBlueLight,
  },
  floatingToolText: {fontSize: 15, color: Colors.text},
  floatingToolOnDark: {
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  floatingToolIconOnDark: {backgroundColor: 'rgba(255,255,255,0.12)'},
  floatingToolTextOnDark: {color: Colors.hopeWhite},
  floatingActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleWrapper: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  writeWrapper: {flex: 1, height: 48},
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: Colors.cardBackground,
  },
  writeButton: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: Colors.sage,
    shadowColor: Colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  writeText: {fontSize: 13, color: Colors.hopeWhite},
  circleButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: Colors.sage,
    shadowColor: Colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  disabledButton: {opacity: 0.4},
  backButtonOnDark: {backgroundColor: '#64796C'},
  writeButtonOnDark: {backgroundColor: '#6B7F73'},
  actionButtonOnDark: {backgroundColor: '#64796C'},
});
