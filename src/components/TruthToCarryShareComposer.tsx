import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  ImageBackground,
  ImageSourcePropType,
  Linking,
  Modal,
  PanResponder,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Share from 'react-native-share';
import ViewShot, { captureRef } from 'react-native-view-shot';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import { Pencil, PencilOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ENV } from '../config/environment';
import { Colors } from '../theme/colors';
import { getFontFamily } from '../theme/fonts';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { Logger } from '../utils/ProductionLogger';
import ThemedText from './common/ThemedText';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_VIEWPORT_WIDTH = Math.min(SCREEN_WIDTH, 480);
const CARD_WIDTH = Math.min(CAROUSEL_VIEWPORT_WIDTH - 72, 300);
const CARD_HEIGHT = CARD_WIDTH * 1.25;
const STORY_CARD_HEIGHT = CARD_WIDTH * 16 / 9;
const CAPTURE_SCALE = Math.max(1, 1080 / (CARD_WIDTH * PixelRatio.get()));
const POST_CAPTURE_WIDTH = CARD_WIDTH * CAPTURE_SCALE;
const POST_CAPTURE_HEIGHT = CARD_HEIGHT * CAPTURE_SCALE;
const STORY_CAPTURE_WIDTH = CARD_WIDTH * CAPTURE_SCALE;
const STORY_CAPTURE_HEIGHT = STORY_CARD_HEIGHT * CAPTURE_SCALE;
const CARD_GAP = 12;
const CAROUSEL_ITEM_WIDTH = CARD_WIDTH + CARD_GAP;
const CAROUSEL_SIDE_INSET = (CAROUSEL_VIEWPORT_WIDTH - CAROUSEL_ITEM_WIDTH) / 2;
const SHARE_ACCENT = Colors.hopeWhite;

type ShareTextAlign = 'left' | 'center' | 'right';
type ShareTypography = 'classic' | 'modern' | 'script' | 'handwritten';

const MIN_TEXT_SCALE = 0.4;
const MAX_TEXT_SCALE = 1.18;
const TEXT_SCALE_STEP = 0.04;

const TYPOGRAPHY_OPTIONS: Array<{ id: ShareTypography; label: string }> = [
  { id: 'classic', label: 'Classic' },
  { id: 'modern', label: 'Modern' },
  { id: 'script', label: 'Script' },
  { id: 'handwritten', label: 'Handwritten' },
];

const toDisplayCase = (value: string): string =>
  value.toLowerCase().replace(/\b[a-z]/g, char => char.toUpperCase());

const PHOTO_TEMPLATES: ImageSourcePropType[] = [
  require('../../assets/images/share/sifiashare_1.png'),
  require('../../assets/images/share/sifiashare_2.png'),
  require('../../assets/images/share/sifiashare_3.png'),
  require('../../assets/images/share/sifiashare_4.png'),
  require('../../assets/images/share/sifiashare_5.png'),
  require('../../assets/images/share/sifiashare_6.png'),
  require('../../assets/images/share/sifiashare_7.png'),
  require('../../assets/images/share/sifiashare_8.png'),
  require('../../assets/images/share/sifiashare_9.png'),
  require('../../assets/images/share/sifiashare_10.png'),
  require('../../assets/images/share/sifiashare_11.png'),
  require('../../assets/images/share/sifiashare_12.png'),
  require('../../assets/images/share/sifiashare_13.png'),
  require('../../assets/images/share/sifiashare_14.png'),
  require('../../assets/images/share/sifiashare_15.png'),
  require('../../assets/images/share/sifiashare_16.png'),
  require('../../assets/images/share/sifiashare_17.png'),
  require('../../assets/images/share/sifiashare_18.png'),
  require('../../assets/images/share/sifiashare_19.png'),
  require('../../assets/images/share/sifiashare_20.png'),
];

interface ShareTemplate {
  id: string;
  image?: ImageSourcePropType;
}

const buildTemplates = (): ShareTemplate[] => {
  const shuffled = [...PHOTO_TEMPLATES];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return [
    { id: 'anchor-blue' },
    ...shuffled.map((image, index) => ({ id: `photo-${index + 1}`, image })),
  ];
};

export interface MorningSummaryShareData {
  feeling?: string;
  feelingIcon?: string;
  feelingIconType?: 'ionicons' | 'material' | 'fontawesome';
  feelingVerse?: string;
  feelingVerseReference?: string;
  focus?: string;
  focusIcon?: string;
  focusIconType?: 'ionicons' | 'material' | 'fontawesome';
  focusReflection?: string;
  prioritiesCount: number;
  todosCount: number;
  psalmNumber?: number;
  psalmRead?: boolean;
  observations: string[];
  reminder: string;
}

interface TruthToCarryShareComposerProps {
  visible: boolean;
  text: string;
  textColor?: string;
  lineHeightMultiplier?: number;
  noSplit?: boolean;
  variant?: 'text' | 'morning-summary';
  morningSummary?: MorningSummaryShareData;
  onClose: () => void;
}

const ShareSummaryIcon = ({ icon, iconType }: { icon?: string; iconType?: MorningSummaryShareData['feelingIconType'] }) => {
  if (!icon || !iconType) { return null; }
  if (iconType === 'material') {
    return <MaterialCommunityIcons name={icon as any} size={10} color={Colors.sage} />;
  }
  if (iconType === 'fontawesome') {
    return <FontAwesome6 name={icon as any} size={9} color={Colors.sage} />;
  }
  return <Ionicons name={icon as any} size={10} color={Colors.sage} />;
};

const TruthToCarryShareComposer: React.FC<TruthToCarryShareComposerProps> = ({
  visible,
  text,
  textColor,
  lineHeightMultiplier,
  noSplit,
  variant = 'text',
  morningSummary,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const editorAnim = useRef(new Animated.Value(0)).current;
  const textScaleAnim = useRef(new Animated.Value(1)).current;
  const liveTextScale = useRef(1);
  const closing = useRef(false);
  const cardRefs = useRef<Array<ViewShot | null>>([]);
  const storyCardRefs = useRef<Array<ViewShot | null>>([]);
  const carouselRef = useRef<FlatList<ShareTemplate>>(null);
  const sizeSliderWidth = useRef(112);
  const [templates, setTemplates] = useState<ShareTemplate[]>(buildTemplates);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const lastScrollHapticIndex = useRef(0);
  const [showWatermark, setShowWatermark] = useState<boolean | null>(true);
  const [textScale, setTextScale] = useState(1);
  const [typography, setTypography] = useState<ShareTypography>('classic');
  const [textAlign, setTextAlign] = useState<ShareTextAlign>('center');
  const [editorOpen, setEditorOpen] = useState(false);
  const [sharingAction, setSharingAction] = useState<string | null>(null);

  const openComposer = useCallback(() => {
    closing.current = false;
    sheetAnim.setValue(0);
    Animated.timing(sheetAnim, {
      toValue: 1,
      duration: 340,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [sheetAnim]);

  useEffect(() => {
    if (!visible) { return; }

    setTemplates(buildTemplates());
    setSelectedIndex(0);
    lastScrollHapticIndex.current = 0;
    setShowWatermark(null);
    setShowWatermark(true);
    setTextScale(1);
    liveTextScale.current = 1;
    textScaleAnim.setValue(1);
    setTypography('classic');
    setTextAlign('center');
    setEditorOpen(false);
    editorAnim.setValue(0);
    requestAnimationFrame(() => carouselRef.current?.scrollToOffset({ offset: 0, animated: false }));

  }, [editorAnim, textScaleAnim, visible]);

  const toggleWatermark = useCallback(() => {
    if (showWatermark === null) { return; }
    triggerLightHaptic();
    setShowWatermark(current => !current);
  }, [showWatermark]);

  const toggleEditor = useCallback(() => {
    const opening = !editorOpen;
    triggerLightHaptic();
    setEditorOpen(opening);
    Animated.timing(editorAnim, {
      toValue: opening ? 1 : 0,
      duration: opening ? 240 : 180,
      easing: opening ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [editorAnim, editorOpen]);

  const updateTextScale = useCallback((locationX: number) => {
    const ratio = Math.max(0, Math.min(1, locationX / sizeSliderWidth.current));
    const nextScale = MIN_TEXT_SCALE + ratio * (MAX_TEXT_SCALE - MIN_TEXT_SCALE);
    liveTextScale.current = nextScale;
    textScaleAnim.setValue(nextScale);
  }, [textScaleAnim]);

  const finishTextScaleAdjustment = useCallback(() => {
    setTextScale(liveTextScale.current);
    triggerLightHaptic();
  }, []);

  const sizeSliderResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => updateTextScale(event.nativeEvent.locationX),
    onPanResponderMove: event => updateTextScale(event.nativeEvent.locationX),
    onPanResponderRelease: finishTextScaleAdjustment,
    onPanResponderTerminate: finishTextScaleAdjustment,
  }), [finishTextScaleAdjustment, updateTextScale]);

  const adjustTextScale = useCallback((direction: number) => {
    const nextScale = Math.max(
      MIN_TEXT_SCALE,
      Math.min(MAX_TEXT_SCALE, liveTextScale.current + direction * TEXT_SCALE_STEP)
    );
    liveTextScale.current = nextScale;
    textScaleAnim.setValue(nextScale);
    setTextScale(nextScale);
    triggerLightHaptic();
  }, [textScaleAnim]);

  const textScaleProgress = textScaleAnim.interpolate({
    inputRange: [MIN_TEXT_SCALE, MAX_TEXT_SCALE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const closeComposer = useCallback(() => {
    if (closing.current) { return; }
    closing.current = true;
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) { closing.current = false; return; }
      onClose();
    });
  }, [onClose, sheetAnim]);

  const captureSelectedCard = useCallback(async (
    asDataUri = false,
    imageFormat: 'post' | 'story' = 'post'
  ) => {
    const selectedCard = imageFormat === 'story'
      ? storyCardRefs.current[selectedIndex]
      : cardRefs.current[selectedIndex];
    if (!selectedCard?.capture) {
      throw new Error('Share card is not ready');
    }
    // iOS SMS requires data URLs for attachments; More requires them to honor filename.
    const uri = asDataUri
      ? await captureRef(selectedCard, {
        format: 'png', quality: 1, result: 'data-uri',
      })
      : await selectedCard.capture();
    if (!uri) {
      throw new Error('Share card capture returned no image');
    }
    return asDataUri || uri.startsWith('file://') ? uri : `file://${uri}`;
  }, [selectedIndex]);

  const runShareAction = useCallback(async (
    action: string,
    share: (uri: string) => Promise<unknown>,
    imageFormat: 'post' | 'story' = 'post'
  ) => {
    if (sharingAction || showWatermark === null) { return; }
    triggerLightHaptic();
    setSharingAction(action);
    try {
      const uri = await captureSelectedCard(
        Platform.OS === 'ios' && (action === 'messages' || action === 'more'),
        imageFormat
      );
      await share(uri);
      triggerSuccessHaptic();
    } catch (error: any) {
      const message = String(error?.message || 'Unknown share error');
      if (!message.toLowerCase().includes('cancel') && message !== 'User did not share') {
        Logger.error(
          '[TruthToCarryShareComposer] Share action failed',
          error instanceof Error ? error : new Error(message),
          { component: 'TruthToCarryShareComposer', action, code: error?.code, nativeError: error?.nativeErrorMessage }
        );
        Alert.alert('Unable to share', __DEV__ ? message : 'Please try again.');
      }
    } finally {
      setSharingAction(null);
    }
  }, [captureSelectedCard, showWatermark, sharingAction]);

  const shareToInstagram = useCallback(() => runShareAction('instagram', uri => Share.shareSingle({
    social: Share.Social.INSTAGRAM_STORIES,
    appId: ENV.FACEBOOK_APP_ID,
    backgroundImage: uri,
  } as any), 'story'), [runShareAction]);

  const shareToFacebook = useCallback(async () => {
    if (Platform.OS === 'ios') {
      const canOpenFacebookStories = await Linking.canOpenURL('facebook-stories://share').catch(() => false);
      if (!canOpenFacebookStories) {
        Alert.alert(
          'Facebook Stories unavailable',
          'Make sure Facebook is installed, then rebuild Journal by siFia so the Facebook Stories configuration is included.'
        );
        return;
      }
    }

    return runShareAction('facebook', uri => Share.shareSingle({
      social: Share.Social.FACEBOOK_STORIES,
      appId: ENV.FACEBOOK_APP_ID,
      backgroundImage: uri,
    } as any), 'story');
  }, [runShareAction]);

  const shareToMessages = useCallback(() => runShareAction('messages', uri => Share.shareSingle({
    social: Share.Social.SMS,
    // SmsShare.m adds a missing recipient (nil) to an NSArray, crashing iOS.
    // An empty string leaves recipient selection to the Messages composer.
    recipient: '',
    url: uri,
    type: 'image/png',
    message: variant === 'morning-summary'
      ? 'My morning with Journal by siFia — https://www.journalby.sifia.app'
      : 'A Journal by siFia reflection from my Playbook — https://www.journalby.sifia.app',
  } as any)), [runShareAction, variant]);

  const shareMore = useCallback(() => runShareAction('more', uri => Share.open({
    title: variant === 'morning-summary' ? 'Share your Journal by siFia morning' : 'Share your Journal by siFia reflection',
    subject: variant === 'morning-summary' ? 'My morning with Journal by siFia' : 'A reflection from Journal by siFia',
    message: variant === 'morning-summary'
      ? 'My morning with Journal by siFia — https://www.journalby.sifia.app'
      : 'A Journal by siFia reflection from my Playbook — https://www.journalby.sifia.app',
    url: uri,
    type: 'image/png',
    filename: Platform.OS === 'ios'
      ? `journal-by-siFia-${variant === 'morning-summary' ? 'morning' : 'reflection'}.png`
      : `journal-by-siFia-${variant === 'morning-summary' ? 'morning' : 'reflection'}`,
    failOnCancel: false,
  })), [runShareAction, variant]);

  const shareAsText = useCallback(async () => {
    if (sharingAction || showWatermark === null) { return; }
    triggerLightHaptic();
    setSharingAction('text');
    try {
      await Share.open({
        title: variant === 'morning-summary' ? 'Share your Journal by siFia morning' : 'Share your Journal by siFia reflection',
        subject: variant === 'morning-summary' ? 'My morning with Journal by siFia' : 'A reflection from Journal by siFia',
        message: text,
        failOnCancel: false,
      });
      triggerSuccessHaptic();
    } catch (error: any) {
      const message = String(error?.message || 'Unknown share error');
      if (!message.toLowerCase().includes('cancel') && message !== 'User did not share') {
        Logger.error(
          '[TruthToCarryShareComposer] Share as text failed',
          error instanceof Error ? error : new Error(message),
          { component: 'TruthToCarryShareComposer', action: 'text', code: error?.code, nativeError: error?.nativeErrorMessage }
        );
        Alert.alert('Unable to share', __DEV__ ? message : 'Please try again.');
      }
    } finally {
      setSharingAction(null);
    }
  }, [sharingAction, showWatermark, text, variant]);

  const renderCard = useCallback(({ item, index }: { item: ShareTemplate; index: number }) => {
    if (showWatermark === null) {
      return (
        <View style={styles.carouselPage}>
          <View style={[styles.shareCard, styles.templateLoading]}>
            <ActivityIndicator color={SHARE_ACCENT} />
          </View>
        </View>
      );
    }

    const textLength = text.trim().length;
    const textStyle = textLength > 260
      ? styles.shareTextSmall
      : textLength > 170
        ? styles.shareTextMedium
        : styles.shareTextLarge;
    const baseText = StyleSheet.flatten(textStyle);
    const shouldNormalizeCase = noSplit && (typography === 'script' || typography === 'handwritten');
    const displayText = shouldNormalizeCase ? toDisplayCase(text.trim()) : text.trim();
    const shareParts = noSplit
      ? [displayText]
      : text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
    const primaryText = shareParts[0] || '';
    const supportingText = noSplit ? '' : shareParts.slice(1).join('\n\n');
    const typographyStyle = typography === 'classic'
      ? {
        primary: getFontFamily('lora', 'bold'),
        supporting: getFontFamily('lora', 'regular'),
      }
      : typography === 'modern'
        ? {
          primary: getFontFamily('poppins', 'semiBold'),
          supporting: getFontFamily('poppins', 'regular'),
        }
        : typography === 'script'
          ? {
            primary: 'OleoScriptSwashCaps-Bold',
            supporting: getFontFamily('lora', 'regular'),
          }
          : {
            primary: 'IndieFlower',
            supporting: getFontFamily('lora', 'regular'),
          };
    const scriptBoost = typography === 'script' || typography === 'handwritten' ? 1.5 : 1;
    const primaryBaseFontSize = (baseText?.fontSize ?? 17) * scriptBoost;
    const primaryBaseLineHeight = (baseText?.lineHeight ?? 24) * scriptBoost * (lineHeightMultiplier ?? 1);
    const primaryFontSize = Animated.multiply(textScaleAnim, primaryBaseFontSize);
    const primaryLineHeight = Animated.multiply(textScaleAnim, primaryBaseLineHeight);
    const primaryTextStyle = {
      fontFamily: typographyStyle.primary,
      fontSize: primaryFontSize,
      lineHeight: primaryLineHeight,
      textAlign,
    };
    const supportingRatio = typography === 'script' ? 0.55 : 0.67;
    const scriptureRefScale = textColor === SHARE_ACCENT ? 0.85 : 1;
    const supportingBaseFontSize = Math.max(10, primaryBaseFontSize * supportingRatio * scriptureRefScale);
    const supportingBaseLineHeight = Math.max(14, primaryBaseLineHeight * supportingRatio * scriptureRefScale);
    const supportingTextStyle = {
      fontFamily: typographyStyle.supporting,
      fontSize: Animated.multiply(textScaleAnim, supportingBaseFontSize),
      lineHeight: Animated.multiply(textScaleAnim, supportingBaseLineHeight),
      textAlign,
    };

    const watermark = showWatermark ? (
      <View style={styles.watermarkRow}>
        <Image
          source={require('../../assets/images/journalbysifia.png')}
          resizeMode="contain"
          style={styles.watermarkLogo}
          accessibilityLabel="Journal by siFia logo"
        />
        <ThemedText style={styles.watermarkUrl}>www.journalby.sifia.app</ThemedText>
      </View>
    ) : null;

    const renderContent = (includeWatermark = true) => variant === 'morning-summary' && morningSummary ? (
      <View style={styles.morningCardContent}>
        <View style={styles.morningPage} accessibilityLabel="Morning summary share card">
          <View style={styles.morningHeader}>
            <View style={styles.morningHeaderIcon}>
              <Ionicons name="sunny-outline" size={15} color={Colors.hopeWhite} />
            </View>
            <View style={styles.morningHeaderCopy}>
              <ThemedText weight="bold" style={styles.morningTitle}>You’re ready for today.</ThemedText>
              <ThemedText style={styles.morningSubtitle}>Your morning reflection is saved.</ThemedText>
            </View>
          </View>

          <ThemedText weight="semiBold" style={styles.morningEyebrow}>TODAY AT A GLANCE</ThemedText>
          <View style={styles.morningGlanceGrid}>
            <View style={[styles.morningGlanceColumn, styles.morningGlanceColumnBorder]}>
              <ThemedText style={styles.morningLabel}>Feeling</ThemedText>
              <View style={styles.morningValueRow}>
                <ShareSummaryIcon icon={morningSummary.feelingIcon} iconType={morningSummary.feelingIconType} />
                <ThemedText numberOfLines={1} weight="semiBold" style={styles.morningValue}>{morningSummary.feeling || '—'}</ThemedText>
              </View>
              {morningSummary.feelingVerse ? (
                <>
                  <ThemedText numberOfLines={3} style={styles.morningVerse}>“{morningSummary.feelingVerse}”</ThemedText>
                  <ThemedText numberOfLines={1} weight="medium" style={styles.morningReference}>{morningSummary.feelingVerseReference}</ThemedText>
                </>
              ) : null}
            </View>
            <View style={styles.morningGlanceColumn}>
              <ThemedText style={styles.morningLabel}>Focus</ThemedText>
              <View style={styles.morningValueRow}>
                <ShareSummaryIcon icon={morningSummary.focusIcon} iconType={morningSummary.focusIconType} />
                <ThemedText numberOfLines={1} weight="semiBold" style={styles.morningValue}>{morningSummary.focus || 'Open'}</ThemedText>
              </View>
              {morningSummary.focusReflection ? (
                <ThemedText numberOfLines={4} style={styles.morningReflection}>{morningSummary.focusReflection}</ThemedText>
              ) : null}
            </View>
          </View>
          <View style={styles.morningTodayRow}>
            <ThemedText style={styles.morningLabel}>Today</ThemedText>
            <ThemedText weight="semiBold" style={styles.morningTodayValue}>
              {morningSummary.prioritiesCount} {morningSummary.prioritiesCount === 1 ? 'priority' : 'priorities'} · {morningSummary.todosCount} {morningSummary.todosCount === 1 ? 'to-do' : 'to-dos'}
            </ThemedText>
          </View>

          <View style={styles.morningPsalmCard}>
            <View style={styles.morningPsalmHeader}>
              <View>
                <ThemedText weight="semiBold" style={styles.morningEyebrow}>MORNING PSALM</ThemedText>
                <ThemedText weight="bold" style={styles.morningPsalmTitle}>{morningSummary.psalmNumber ? `Psalm ${morningSummary.psalmNumber}` : 'Psalm'}</ThemedText>
              </View>
              <View style={styles.morningReadStatus}>
                <View style={[styles.morningReadIcon, !morningSummary.psalmRead && styles.morningReadIconInactive]}>
                  {morningSummary.psalmRead ? <Ionicons name="checkmark" size={8} color={Colors.hopeWhite} /> : <MaterialCommunityIcons name="progress-star" size={8} color={Colors.sage} />}
                </View>
                <ThemedText weight="semiBold" style={styles.morningReadText}>{morningSummary.psalmRead ? 'Full chapter read' : 'Reading in progress'}</ThemedText>
              </View>
            </View>
            <View style={styles.morningPraiseSection}>
              <View style={styles.morningPraiseTitleRow}>
                <Ionicons name="musical-notes" size={10} color={Colors.sage} />
                <ThemedText weight="bold" style={styles.morningPraiseTitle}>Pause and Praise</ThemedText>
              </View>
              <ThemedText style={styles.morningPrompt}>What you saw about God</ThemedText>
              <ThemedText numberOfLines={2} weight="bold" style={styles.morningAnswer}>
                {morningSummary.observations.length ? morningSummary.observations.join(' · ') : 'Nothing selected'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.morningAsYouGo}>
            <ThemedText weight="semiBold" style={styles.morningEyebrow}>AS YOU GO</ThemedText>
            <ThemedText weight="bold" style={styles.morningReminder}>{morningSummary.reminder}</ThemedText>
          </View>
        </View>
        {includeWatermark ? watermark : null}
      </View>
    ) : (
      <View style={styles.cardContent}>
        <View style={styles.shareCopy}>
          <Animated.Text style={[styles.shareText, { color: Colors.hopeWhite }, primaryTextStyle]}>{primaryText || displayText}</Animated.Text>
          {supportingText ? (
            <>
              <View style={[styles.supportingRule, textAlign === 'left' && styles.supportingRuleLeft, textAlign === 'right' && styles.supportingRuleRight]} />
              <Animated.Text style={[styles.shareText, styles.supportingText, { color: textColor ?? 'rgba(255,255,255,0.88)' }, supportingTextStyle]}>{supportingText}</Animated.Text>
            </>
          ) : null}
        </View>
        {includeWatermark ? watermark : null}
      </View>
    );
    const content = renderContent();
    const storyContent = renderContent(false);

    return (
      <View style={styles.carouselPage}>
        <View style={styles.shareCard}>
          <View style={styles.captureCard}>
            {item.image ? (
              <ImageBackground source={item.image} resizeMode="cover" style={styles.cardBackground}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.48)']}
                  style={StyleSheet.absoluteFill}
                />
                {content}
              </ImageBackground>
            ) : (
              <View style={[styles.cardBackground, styles.anchorBackground]}>
                {content}
              </View>
            )}
          </View>
        </View>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ViewShot
            ref={ref => { cardRefs.current[index] = ref; }}
            options={{ format: 'png', quality: 1, result: 'tmpfile', fileName: 'journal-post-share' }}
            style={styles.postCaptureCard}
          >
            {item.image ? (
              <ImageBackground source={item.image} resizeMode="cover" style={styles.postCaptureContent}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.48)']}
                  style={StyleSheet.absoluteFill}
                />
                {content}
              </ImageBackground>
            ) : (
              <View style={[styles.postCaptureContent, styles.anchorBackground]}>
                {content}
              </View>
            )}
          </ViewShot>
          <ViewShot
            ref={ref => { storyCardRefs.current[index] = ref; }}
            options={{ format: 'png', quality: 1, result: 'tmpfile', fileName: 'journal-story-share' }}
            style={styles.storyCaptureCard}
          >
            {item.image ? (
              <ImageBackground source={item.image} resizeMode="cover" style={[styles.storyCaptureContent, styles.storyBackground]}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.48)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.storyContentFrame}>{storyContent}</View>
                <View style={styles.storyWatermark}>{watermark}</View>
              </ImageBackground>
            ) : (
              <View style={[styles.storyCaptureContent, styles.anchorBackground, styles.storyBackground]}>
                <View style={styles.storyContentFrame}>{storyContent}</View>
                <View style={styles.storyWatermark}>{watermark}</View>
              </View>
            )}
          </ViewShot>
        </View>
      </View>
    );
  }, [showWatermark, text, textAlign, typography, textColor, lineHeightMultiplier, noSplit, textScaleAnim, variant, morningSummary]);

  const shareActions = [
    { id: 'instagram', label: 'Instagram', icon: 'logo-instagram', onPress: shareToInstagram },
    { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', onPress: shareToFacebook },
    { id: 'messages', label: 'Message', icon: 'chatbubble-outline', onPress: shareToMessages },
    { id: 'text', label: 'Text', icon: 'text', onPress: shareAsText },
    { id: 'more', label: 'More', icon: 'ellipsis-horizontal', onPress: shareMore },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent={Platform.OS === 'android'}
      navigationBarTranslucent={Platform.OS === 'android'}
      hardwareAccelerated={Platform.OS === 'android'}
      onShow={openComposer}
      onRequestClose={() => closeComposer()}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeComposer()}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: sheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          />
        </Pressable>
        <Animated.View
          style={[
            styles.modalContent,
            {
              maxHeight: SCREEN_HEIGHT - Math.max(insets.top, 16) - 12,
              paddingBottom: Math.max(insets.bottom, 16),
              opacity: sheetAnim.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [0, 1, 1],
              }),
              transform: [{ translateY: sheetAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [80, 0],
              }) }],
            },
          ]}
        >
          <View style={styles.header}>
            <View>
              <ThemedText weight="bold" style={styles.title}>{variant === 'morning-summary' ? 'Share your morning' : 'Share your reflection'}</ThemedText>
              <ThemedText style={styles.subtitle}>Choose a template</ThemedText>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => closeComposer()} accessibilityLabel="Close share composer">
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
          <View style={styles.carouselWrap}>
          {variant === 'text' ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={editorOpen ? 'Close post editor' : 'Edit post style'}
              accessibilityState={{ expanded: editorOpen }}
              activeOpacity={0.72}
              onPress={toggleEditor}
              style={[styles.editFloatingButton, editorOpen && styles.editFloatingButtonActive]}
            >
              {editorOpen ? (
                <PencilOff size={18} color={SHARE_ACCENT} />
              ) : (
                <Pencil size={18} color={Colors.hopeWhite} />
              )}
            </TouchableOpacity>
          ) : null}
          <FlatList
            ref={carouselRef}
            data={templates}
            horizontal
            accessibilityLabel="Swipe left or right to choose a template"
            snapToInterval={CAROUSEL_ITEM_WIDTH}
            snapToAlignment="start"
            decelerationRate="fast"
            bounces={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: CAROUSEL_SIDE_INSET }}
            keyExtractor={item => item.id}
            renderItem={renderCard}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            style={styles.carousel}
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({ length: CAROUSEL_ITEM_WIDTH, offset: CAROUSEL_ITEM_WIDTH * index, index })}
            onScroll={event => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / CAROUSEL_ITEM_WIDTH);
              if (nextIndex !== lastScrollHapticIndex.current) {
                lastScrollHapticIndex.current = nextIndex;
                triggerLightHaptic();
              }
            }}
            onMomentumScrollEnd={event => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / CAROUSEL_ITEM_WIDTH);
              setSelectedIndex(Math.min(Math.max(nextIndex, 0), templates.length - 1));
            }}
          />
          </View>

          <Animated.View
            pointerEvents={editorOpen ? 'auto' : 'none'}
            accessibilityElementsHidden={!editorOpen}
            importantForAccessibility={editorOpen ? 'auto' : 'no-hide-descendants'}
            style={[
              styles.editorPanel,
              variant !== 'text' && styles.hidden,
              {
                maxHeight: editorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }),
                marginBottom: editorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }),
                opacity: editorAnim,
                transform: [{
                  translateY: editorAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
                }],
              },
            ]}
          >
            <View style={styles.editorSection}>
              <View style={styles.segmentedControl}>
                {TYPOGRAPHY_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${option.label} text style`}
                    accessibilityState={{ selected: typography === option.id }}
                    onPress={() => {
                      setTypography(option.id);
                      triggerLightHaptic();
                    }}
                    style={[styles.segmentButton, typography === option.id && styles.segmentButtonActive]}
                  >
                    <ThemedText weight="semiBold" style={[styles.segmentText, typography === option.id && styles.segmentTextActive]}>
                      {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.editorUtilityRow}>
              <View style={[styles.utilityGroup, styles.sizeSliderGroup]}>
                <ThemedText weight="semiBold" style={[styles.sizeGlyph, styles.sizeGlyphSmall]}>A</ThemedText>
                <View
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel="Text size"
                  accessibilityValue={{
                    min: Math.round(MIN_TEXT_SCALE * 100),
                    max: Math.round(MAX_TEXT_SCALE * 100),
                    now: Math.round(textScale * 100),
                    text: `${Math.round(textScale * 100)} percent`,
                  }}
                  accessibilityActions={[{ name: 'decrement' }, { name: 'increment' }]}
                  onAccessibilityAction={event => adjustTextScale(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
                  onLayout={event => { sizeSliderWidth.current = Math.max(event.nativeEvent.layout.width, 1); }}
                  style={styles.sizeSlider}
                  {...sizeSliderResponder.panHandlers}
                >
                  <View style={styles.sizeSliderTrack}>
                    <Animated.View
                      style={[
                        styles.sizeSliderFill,
                        { width: textScaleProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 112] }) },
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.sizeSliderThumb,
                        { transform: [{ translateX: textScaleProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 112] }) }] },
                      ]}
                    />
                  </View>
                </View>
                <ThemedText weight="semiBold" style={[styles.sizeGlyph, styles.sizeGlyphLarge]}>A</ThemedText>
              </View>

              <View style={styles.utilityGroup}>
                <View style={styles.iconSegments}>
                  {(['left', 'center', 'right'] as ShareTextAlign[]).map(align => (
                    <TouchableOpacity
                      key={align}
                      accessibilityRole="button"
                      accessibilityLabel={`Align text ${align}`}
                      accessibilityState={{ selected: textAlign === align }}
                      onPress={() => {
                        setTextAlign(align);
                        triggerLightHaptic();
                      }}
                      style={[styles.iconSegmentButton, textAlign === align && styles.iconSegmentButtonActive]}
                    >
                      <MaterialCommunityIcons
                        name={`format-align-${align}`}
                        size={15}
                        color={textAlign === align ? SHARE_ACCENT : 'rgba(255,255,255,0.62)'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>

          <ThemedText weight="semiBold" style={styles.sectionLabel}>Share to</ThemedText>
          <View style={styles.actionsRow}>
            {shareActions.map(action => (
              <TouchableOpacity
                key={action.id}
                style={[styles.action, showWatermark === null && styles.actionDisabled]}
                onPress={action.onPress}
                disabled={!!sharingAction || showWatermark === null}
                accessibilityLabel={action.label}
              >
                <View style={styles.actionIcon}>
                  {sharingAction === action.id ? (
                    <ActivityIndicator size="small" color={SHARE_ACCENT} />
                  ) : (
                    <Ionicons name={action.icon as any} size={21} color={Colors.hopeWhite} />
                  )}
                </View>
                <ThemedText style={styles.actionLabel}>{action.label}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.upgradeReveal}>
            <TouchableOpacity
              style={styles.upgradeRow}
              onPress={toggleWatermark}
              activeOpacity={0.75}
              accessibilityRole="switch"
              accessibilityLabel="Show Journal by siFia watermark"
              accessibilityState={{ checked: !!showWatermark }}
            >
              <View style={styles.upgradeIcon}>
                <Ionicons name="eye-off-outline" size={18} color={SHARE_ACCENT} />
              </View>
              <View style={styles.upgradeCopy}>
                <ThemedText weight="semiBold" style={styles.upgradeTitle}>Journal by siFia watermark</ThemedText>
                <ThemedText style={styles.upgradeSubtitle}>{showWatermark ? 'Shown on this post' : 'Hidden from this post'}</ThemedText>
              </View>
              <View style={[styles.watermarkSwitch, showWatermark && styles.watermarkSwitchOn]}>
                <View style={[styles.watermarkSwitchThumb, showWatermark && styles.watermarkSwitchThumbOn]} />
              </View>
            </TouchableOpacity>
          </View>
          </ScrollView>
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
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: Colors.modalBlue,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 20,
  },
  modalScroll: {
    flexShrink: 1,
  },
  modalScrollContent: {
    paddingBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 14,
  },
  title: {
    color: Colors.hopeWhite,
    fontSize: 20,
    lineHeight: 26,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  carousel: {
    width: CAROUSEL_VIEWPORT_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
  },
  carouselWrap: {
    width: '100%',
    marginBottom: 14,
    position: 'relative',
  },
  carouselPage: {
    width: CAROUSEL_ITEM_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
  },
  shareCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: Colors.sage,
  },
  templateLoading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  postCaptureCard: {
    position: 'absolute',
    left: -Math.max(SCREEN_WIDTH, POST_CAPTURE_WIDTH) * 3,
    top: 0,
    width: POST_CAPTURE_WIDTH,
    height: POST_CAPTURE_HEIGHT,
    overflow: 'hidden',
    backgroundColor: Colors.sage,
  },
  postCaptureContent: {
    position: 'absolute',
    left: (POST_CAPTURE_WIDTH - CARD_WIDTH) / 2,
    top: (POST_CAPTURE_HEIGHT - CARD_HEIGHT) / 2,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    transform: [{ scale: CAPTURE_SCALE }],
  },
  storyCaptureCard: {
    position: 'absolute',
    left: -Math.max(SCREEN_WIDTH, STORY_CAPTURE_WIDTH) * 3,
    top: POST_CAPTURE_HEIGHT + 20,
    width: STORY_CAPTURE_WIDTH,
    height: STORY_CAPTURE_HEIGHT,
    overflow: 'hidden',
    backgroundColor: Colors.sage,
  },
  storyCaptureContent: {
    position: 'absolute',
    left: (STORY_CAPTURE_WIDTH - CARD_WIDTH) / 2,
    top: (STORY_CAPTURE_HEIGHT - STORY_CARD_HEIGHT) / 2,
    width: CARD_WIDTH,
    height: STORY_CARD_HEIGHT,
    transform: [{ scale: CAPTURE_SCALE }],
  },
  storyBackground: {
    justifyContent: 'center',
  },
  storyContentFrame: {
    width: '100%',
    height: CARD_HEIGHT,
  },
  storyWatermark: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 36,
  },
  cardBackground: {
    flex: 1,
  },
  anchorBackground: {
    backgroundColor: Colors.sage,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 22,
  },
  morningCardContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  morningPage: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: Colors.lightBackground,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  morningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },
  morningHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
  },
  morningHeaderCopy: {
    flex: 1,
  },
  morningTitle: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
  },
  morningSubtitle: {
    color: Colors.textGray,
    fontSize: 8,
    lineHeight: 11,
    marginTop: 1,
  },
  morningEyebrow: {
    color: Colors.sageMuted,
    fontSize: 6,
    lineHeight: 8,
    letterSpacing: 1.1,
  },
  morningGlanceGrid: {
    flexDirection: 'row',
    marginTop: 6,
  },
  morningGlanceColumn: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 9,
  },
  morningGlanceColumnBorder: {
    paddingLeft: 0,
    paddingRight: 9,
    borderRightWidth: 1,
    borderRightColor: Colors.cardBorder,
  },
  morningLabel: {
    color: Colors.textGray,
    fontSize: 7,
    lineHeight: 9,
    marginBottom: 2,
  },
  morningValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  morningValue: {
    flexShrink: 1,
    color: Colors.text,
    fontSize: 9,
    lineHeight: 12,
  },
  morningVerse: {
    color: Colors.textGray,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    fontSize: 6,
    lineHeight: 8,
    marginTop: 4,
  },
  morningReference: {
    color: Colors.sageMuted,
    fontSize: 5,
    lineHeight: 7,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  morningReflection: {
    color: Colors.textGray,
    fontSize: 6,
    lineHeight: 8,
    marginTop: 4,
  },
  morningTodayRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 7,
    paddingTop: 6,
  },
  morningTodayValue: {
    color: Colors.text,
    fontSize: 9,
    lineHeight: 12,
  },
  morningPsalmCard: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginTop: 9,
  },
  morningPsalmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  morningPsalmTitle: {
    color: Colors.text,
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
  },
  morningReadStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  morningReadIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morningReadIconInactive: {
    backgroundColor: 'rgba(82, 106, 91, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.22)',
  },
  morningReadText: {
    color: Colors.sage,
    fontSize: 6,
    lineHeight: 8,
  },
  morningPraiseSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 7,
    paddingTop: 7,
  },
  morningPraiseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  morningPraiseTitle: {
    color: Colors.text,
    fontSize: 9,
    lineHeight: 12,
  },
  morningPrompt: {
    color: Colors.textGray,
    fontSize: 6,
    lineHeight: 8,
    marginBottom: 2,
  },
  morningAnswer: {
    color: Colors.text,
    fontSize: 10,
    lineHeight: 13,
  },
  morningAsYouGo: {
    alignItems: 'center',
    marginTop: 9,
  },
  morningReminder: {
    color: Colors.text,
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
    marginTop: 3,
  },
  hidden: {
    display: 'none',
  },

  shareText: {
    color: Colors.hopeWhite,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    paddingHorizontal: 2,
  },
  shareCopy: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
  },
  supportingRule: {
    width: 28,
    height: 1,
    marginVertical: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
  supportingRuleLeft: {
    alignSelf: 'flex-start',
  },
  supportingRuleRight: {
    alignSelf: 'flex-end',
  },
  supportingText: {
    color: 'rgba(255,255,255,0.88)',
  },
  shareTextLarge: {
    fontSize: 20,
    lineHeight: 28,
  },
  shareTextMedium: {
    fontSize: 17,
    lineHeight: 24,
  },
  shareTextSmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  watermarkRow: {
    minHeight: 22,
    flexDirection: 'row',
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  watermarkLogo: {
    width: 32,
    height: 32,
  },
  watermarkUrl: {
    color: Colors.hopeWhite,
    fontSize: 8,
    lineHeight: 11,
    letterSpacing: 0.1,
  },
  editFloatingButton: {
    position: 'absolute',
    top: 12,
    right: (CAROUSEL_VIEWPORT_WIDTH - CARD_WIDTH) / 2 + 12,
    zIndex: 5,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,24,46,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  editFloatingButtonActive: {
    backgroundColor: 'rgba(10,24,46,0.86)',
    borderColor: 'rgba(255,254,250,0.38)',
  },
  editorPanel: {
    marginHorizontal: 18,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  editorSection: {
    gap: 7,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  segmentButton: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentButtonActive: {
    borderBottomColor: SHARE_ACCENT,
  },
  segmentText: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    lineHeight: 15,
  },
  segmentTextActive: {
    color: SHARE_ACCENT,
  },
  editorUtilityRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  utilityGroup: {
    alignItems: 'center',
  },
  sizeSliderGroup: {
    flexDirection: 'row',
    gap: 7,
  },
  sizeSlider: {
    width: 112,
    height: 34,
    justifyContent: 'center',
  },
  sizeSliderTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  sizeSliderFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: SHARE_ACCENT,
  },
  sizeSliderThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    backgroundColor: SHARE_ACCENT,
  },
  iconSegments: {
    flexDirection: 'row',
    alignSelf: 'center',
    padding: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  iconSegmentButton: {
    width: 34,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSegmentButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  watermarkToggleRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 22,
    marginBottom: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  watermarkToggleCopy: {
    flex: 1,
    paddingRight: 12,
  },
  watermarkToggleTitle: {
    color: Colors.hopeWhite,
    fontSize: 11,
    lineHeight: 15,
  },
  watermarkToggleSubtitle: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 1,
  },
  watermarkSwitch: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  watermarkSwitchOn: {
    backgroundColor: SHARE_ACCENT,
  },
  watermarkSwitchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.hopeWhite,
    transform: [{ translateX: 0 }],
  },
  watermarkSwitchThumbOn: {
    transform: [{ translateX: 18 }],
    backgroundColor: Colors.darkBackground,
  },
  sizeGlyph: {
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 17,
  },
  sizeGlyphSmall: {
    fontSize: 10,
  },
  sizeGlyphLarge: {
    fontSize: 16,
  },
  sectionLabel: {
    color: Colors.hopeWhite,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 22,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  action: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 6,
  },
  upgradeReveal: {
    overflow: 'hidden',
    marginTop: 10,
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  upgradeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,254,250,0.12)',
  },
  upgradeCopy: {
    flex: 1,
    marginLeft: 10,
  },
  upgradeTitle: {
    color: Colors.hopeWhite,
    fontSize: 12,
    lineHeight: 16,
  },
  upgradeSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 1,
  },
  growthPill: {
    backgroundColor: SHARE_ACCENT,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  growthPillText: {
    color: Colors.hopeWhite,
    fontFamily: getFontFamily('lexend', 'semiBold'),
    fontSize: 10,
    lineHeight: 13,
  },
});

export default TruthToCarryShareComposer;
