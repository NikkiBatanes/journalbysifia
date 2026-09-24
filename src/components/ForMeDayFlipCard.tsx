import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {format} from 'date-fns';

import ForMeDayShareCard, {
  MILESTONE_PALETTES,
  type ForMeDayShareData,
} from './ForMeDayShareCard';
import ThemedText from './common/ThemedText';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {triggerLightHaptic} from '../utils/haptics';

interface Props {
  data: ForMeDayShareData;
  testimony: string;
  writtenAt?: string;
  width: number;
}

const ForMeDayFlipCard: React.FC<Props> = ({data, testimony, writtenAt, width}) => {
  const frontHeight = width * 1.25;
  const maximumBackHeight = Math.min(width * 1.65, 680);
  const flipProgress = useRef(new Animated.Value(0)).current;
  const cardHeight = useRef(new Animated.Value(frontHeight)).current;
  const [showingTestimony, setShowingTestimony] = useState(false);
  const [testimonyContentHeight, setTestimonyContentHeight] = useState(0);
  const palette = MILESTONE_PALETTES[0];
  const scale = width / 300;
  const paragraphs = useMemo(
    () => testimony
      .split(/\n\s*\n/)
      .map(paragraph => paragraph.trim())
      .filter(Boolean),
    [testimony],
  );
  const writtenDate = writtenAt ? new Date(writtenAt) : null;
  const writtenLabel = writtenDate && Number.isFinite(writtenDate.getTime())
    ? `Written ${format(writtenDate, 'MMM d, yyyy · h:mm a')}`
    : null;
  const backHeight = Math.max(
    frontHeight,
    Math.min(maximumBackHeight, testimonyContentHeight || frontHeight),
  );
  const testimonyScrolls = testimonyContentHeight > backHeight + 1;

  useEffect(() => {
    Animated.timing(cardHeight, {
      toValue: showingTestimony ? backHeight : frontHeight,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [backHeight, cardHeight, frontHeight, showingTestimony]);

  const setCardSide = (showTestimony: boolean) => {
    triggerLightHaptic();
    setShowingTestimony(showTestimony);
    Animated.spring(flipProgress, {
      toValue: showTestimony ? 1 : 0,
      friction: 9,
      tension: 58,
      useNativeDriver: true,
    }).start();
  };

  const frontRotate = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipProgress.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipProgress.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <View style={{width}}>
      <Animated.View
        style={[
          styles.card,
          {
            width,
            height: cardHeight,
            backgroundColor: palette.background,
          },
        ]}>
        <Animated.View
          pointerEvents={showingTestimony ? 'none' : 'auto'}
          accessibilityElementsHidden={showingTestimony}
          importantForAccessibility={showingTestimony ? 'no-hide-descendants' : 'auto'}
          style={[
            styles.face,
            {
              width,
              height: frontHeight,
              opacity: frontOpacity,
              transform: [{perspective: 1200}, {rotateY: frontRotate}],
            },
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show your testimony"
            onPress={() => setCardSide(true)}>
            <ForMeDayShareCard data={data} width={width} height={frontHeight} />
          </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents={showingTestimony ? 'auto' : 'none'}
          accessibilityElementsHidden={!showingTestimony}
          importantForAccessibility={showingTestimony ? 'auto' : 'no-hide-descendants'}
          style={[
            styles.face,
            styles.backFace,
            {
              width,
              height: backHeight,
              opacity: backOpacity,
              backgroundColor: palette.background,
              transform: [{perspective: 1200}, {rotateY: backRotate}],
            },
          ]}>
          <View
            pointerEvents="none"
            style={[
              styles.insetBorder,
              {
                top: 8 * scale,
                right: 8 * scale,
                bottom: 8 * scale,
                left: 8 * scale,
                borderColor: palette.border,
                borderRadius: 12 * scale,
              },
            ]}
          />
          <ScrollView
            nestedScrollEnabled
            directionalLockEnabled
            scrollEnabled={testimonyScrolls}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.backContent,
              {
                minHeight: frontHeight,
                padding: 20 * scale,
              },
            ]}
            onContentSizeChange={(_contentWidth, contentHeight) => {
              if (Math.abs(contentHeight - testimonyContentHeight) > 1) {
                setTestimonyContentHeight(contentHeight);
              }
            }}>
            <View style={styles.backHeader}>
              <Text
                allowFontScaling={false}
                style={[
                  styles.keepsakeLabel,
                  {
                    color: palette.accent,
                    fontSize: 7 * scale,
                    lineHeight: 11 * scale,
                    letterSpacing: 1.2 * scale,
                  },
                ]}>
                MY NEW LIFE DAY
              </Text>
              <Text
                allowFontScaling={false}
                style={[
                  styles.keepsakeLabel,
                  {color: palette.accent, fontSize: 12 * scale},
                ]}>
                ✧
              </Text>
            </View>

            <View style={[styles.testimonyHeadingWrap, {marginTop: 28 * scale}]}>
              <Text
                allowFontScaling={false}
                style={[
                  styles.testimonyHeading,
                  {
                    color: palette.foreground,
                    fontSize: 17 * scale,
                    lineHeight: 23 * scale,
                  },
                ]}>
                Your testimony
              </Text>
              {writtenLabel ? (
                <View
                  accessibilityLabel={writtenLabel}
                  style={[
                    styles.writtenPill,
                    {
                      backgroundColor: palette.glow,
                      borderColor: palette.border,
                      marginTop: 11 * scale,
                      paddingHorizontal: 10 * scale,
                      paddingVertical: 5 * scale,
                    },
                  ]}>
                  <Ionicons
                    name="time-outline"
                    size={10 * scale}
                    color={palette.accent}
                  />
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.writtenPillText,
                      {
                        color: palette.foreground,
                        fontSize: 8 * scale,
                        lineHeight: 11 * scale,
                      },
                    ]}>
                    {writtenLabel}
                  </Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.headingRule,
                  {
                    backgroundColor: palette.border,
                    marginTop: 16 * scale,
                    marginBottom: 18 * scale,
                  },
                ]}
              />
            </View>

            <View style={styles.testimonyBody}>
              {paragraphs.map((paragraph, index) => (
                <Text
                  allowFontScaling={false}
                  key={`${index}:${paragraph.slice(0, 20)}`}
                  style={[
                    styles.testimonyText,
                    {
                      color: palette.foreground,
                      fontSize: 13 * scale,
                      lineHeight: 21 * scale,
                    },
                    index > 0 && {marginTop: 14 * scale},
                  ]}>
                  {paragraph}
                </Text>
              ))}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Show My New Life Day milestone"
              activeOpacity={0.7}
              onPress={() => setCardSide(false)}
              style={[styles.showFrontButton, {marginTop: 28 * scale}]}>
              <Ionicons name="refresh-outline" size={14 * scale} color={palette.accent} />
              <Text
                allowFontScaling={false}
                style={[
                  styles.showFrontText,
                  {color: palette.accent, fontSize: 7 * scale},
                ]}>
                SHOW MILESTONE
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Animated.View>

      <View style={styles.hintRow}>
        <Ionicons
          name={showingTestimony ? 'swap-vertical-outline' : 'refresh-outline'}
          size={14}
          color={Colors.sage}
        />
        <ThemedText style={styles.hintText}>
          {showingTestimony
            ? testimonyScrolls
              ? 'Scroll to read your testimony'
              : 'Your testimony'
            : 'Tap the card to show your testimony'}
        </ThemedText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    backfaceVisibility: 'hidden',
  },
  backFace: {
    overflow: 'hidden',
  },
  insetBorder: {
    position: 'absolute',
    zIndex: 1,
    borderWidth: 1,
  },
  backContent: {
    flexGrow: 1,
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  keepsakeLabel: {
    fontFamily: Fonts.semiBold,
  },
  testimonyHeadingWrap: {
    alignItems: 'center',
  },
  testimonyHeading: {
    fontFamily: Platform.select({
      ios: 'Georgia-BoldItalic',
      android: 'serif',
      default: 'Georgia',
    }),
    fontStyle: 'italic',
    fontWeight: '700',
    textAlign: 'center',
  },
  headingRule: {
    width: 34,
    height: StyleSheet.hairlineWidth,
  },
  testimonyBody: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  writtenPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  writtenPillText: {
    fontFamily: Fonts.medium,
  },
  testimonyText: {
    fontFamily: Fonts.lora.regular,
    textAlign: 'left',
  },
  showFrontButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  showFrontText: {
    fontFamily: Fonts.semiBold,
    letterSpacing: 1.1,
  },
  hintRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
  },
  hintText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.sage,
  },
});

export default ForMeDayFlipCard;
