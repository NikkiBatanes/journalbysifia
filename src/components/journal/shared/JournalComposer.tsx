import React from 'react';
import {Animated, StyleSheet, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {Pencil} from 'lucide-react-native';
import ThemedText from '../../common/ThemedText';
import {Colors} from '../../../theme/colors';
import {
  JOURNAL_BLOCKS,
  JournalBlockIcon,
  type JournalBlockKind,
} from './journalBlocks';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const JournalPickerMenu = <T extends string,>({
  items,
  animations,
  onSelect,
  tone = 'default',
}: {
  items: readonly {key: T; label: string; icon: React.ReactNode}[];
  animations: Animated.Value[];
  onSelect: (key: T) => void;
  tone?: 'default' | 'onDark';
}) => (
  <View style={styles.floatingTools}>
    {items.map((item, index) => (
      <Animated.View
        key={item.key}
        style={{
          opacity: animations[index],
          transform: [
            {
              translateY: animations[index].interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
            {
              scale: animations[index].interpolate({
                inputRange: [0, 1],
                outputRange: [0.94, 1],
              }),
            },
          ],
        }}>
        <TouchableOpacity
          accessibilityRole="button"
          style={[
            styles.floatingTool,
            tone === 'onDark' && styles.floatingToolOnDark,
          ]}
          onPress={() => onSelect(item.key)}>
          <View
            style={[
              styles.floatingToolIcon,
              tone === 'onDark' && styles.floatingToolIconOnDark,
            ]}>
            {item.icon}
          </View>
          <ThemedText
            weight="bold"
            style={[
              styles.floatingToolText,
              tone === 'onDark' && styles.floatingToolTextOnDark,
            ]}>
            {item.label}
          </ThemedText>
        </TouchableOpacity>
      </Animated.View>
    ))}
  </View>
);

export const JournalBlockPickerMenu = ({
  kinds,
  animations,
  onSelect,
}: {
  kinds: readonly Exclude<JournalBlockKind, 'text' | 'section'>[];
  animations: Animated.Value[];
  onSelect: (kind: Exclude<JournalBlockKind, 'text' | 'section'>) => void;
}) => (
  <JournalPickerMenu
    items={kinds.map(kind => ({
      key: kind,
      label: JOURNAL_BLOCKS[kind].label,
      icon: (
        <JournalBlockIcon
          config={JOURNAL_BLOCKS[kind]}
          size={13}
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
        style={[styles.backButton, tone === 'onDark' && styles.backButtonOnDark]}
        onPress={onBack}>
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
          tone === 'onDark' && styles.actionButtonOnDark,
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
                tone === 'onDark' ? 'rgba(255,255,255,0.15)' : Colors.sage,
                Colors.text,
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
        style={[styles.circleButton, tone === 'onDark' && styles.actionButtonOnDark]}
        onPress={onNext}>
        <Ionicons name={nextIcon as any} size={21} color={Colors.hopeWhite} />
      </TouchableOpacity>
    </Animated.View>
  </View>
);

const styles = StyleSheet.create({
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
    minHeight: 34,
    paddingLeft: 5,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: Colors.sage,
    borderRadius: 17,
    backgroundColor: Colors.cardBackground,
    shadowColor: Colors.text,
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: {width: 0, height: 2},
    elevation: 3,
  },
  floatingToolIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Colors.anchorBlueLight,
  },
  floatingToolText: {fontSize: 10, letterSpacing: 0.7, color: Colors.text},
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
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: Colors.sage,
    shadowColor: Colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  disabledButton: {opacity: 0.4},
  backButtonOnDark: {backgroundColor: 'rgba(255,255,255,0.1)'},
  actionButtonOnDark: {backgroundColor: 'rgba(255,255,255,0.15)'},
});
