import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Share from 'react-native-share';
import ViewShot, { captureRef } from 'react-native-view-shot';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil, PencilOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ENV } from '../config/environment';
import { NewSubscriptionService } from '../services/NewSubscriptionService';
import { Colors } from '../theme/colors';
import { getFontFamily } from '../theme/fonts';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { Logger } from '../utils/ProductionLogger';
import ThemedText from './common/ThemedText';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_VIEWPORT_WIDTH = Math.min(SCREEN_WIDTH, 480);
const CARD_WIDTH = Math.min(CAROUSEL_VIEWPORT_WIDTH - 72, 300);
const CARD_HEIGHT = CARD_WIDTH * 1.25;
const CARD_GAP = 12;
const CAROUSEL_ITEM_WIDTH = CARD_WIDTH + CARD_GAP;
const CAROUSEL_SIDE_INSET = (CAROUSEL_VIEWPORT_WIDTH - CAROUSEL_ITEM_WIDTH) / 2;

type ShareTextAlign = 'left' | 'center' | 'right';
type ShareTextSize = 'small' | 'standard' | 'large';
type ShareTypography = 'classic' | 'modern' | 'script';

const TEXT_SIZE_SCALE: Record<ShareTextSize, number> = {
  small: 0.84,
  standard: 1,
  large: 1.16,
};

const TYPOGRAPHY_OPTIONS: Array<{ id: ShareTypography; label: string }> = [
  { id: 'classic', label: 'Classic' },
  { id: 'modern', label: 'Modern' },
  { id: 'script', label: 'Script' },
];

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

interface TruthToCarryShareComposerProps {
  visible: boolean;
  text: string;
  textColor?: string;
  lineHeightMultiplier?: number;
  noSplit?: boolean;
  userId: string;
  onClose: () => void;
  onUpgrade: () => void;
}

const TruthToCarryShareComposer: React.FC<TruthToCarryShareComposerProps> = ({
  visible,
  text,
  textColor,
  lineHeightMultiplier,
  noSplit,
  userId,
  onClose,
  onUpgrade,
}) => {
  const insets = useSafeAreaInsets();
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const editorAnim = useRef(new Animated.Value(0)).current;
  const watermarkUpsellAnim = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const cardRefs = useRef<Array<ViewShot | null>>([]);
  const carouselRef = useRef<FlatList<ShareTemplate>>(null);
  const pendingUpgrade = useRef(false);
  const [templates, setTemplates] = useState<ShareTemplate[]>(buildTemplates);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSeeker, setIsSeeker] = useState<boolean | null>(null);
  const [textSize, setTextSize] = useState<ShareTextSize>('standard');
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
    setIsSeeker(null);
    setTextSize('standard');
    setTypography('classic');
    setTextAlign('center');
    setEditorOpen(false);
    editorAnim.setValue(0);
    watermarkUpsellAnim.setValue(0);
    requestAnimationFrame(() => carouselRef.current?.scrollToOffset({ offset: 0, animated: false }));

    let cancelled = false;
    if (userId) {
      NewSubscriptionService.getUserSubscription(userId)
        .then(subscription => {
          if (!cancelled) {
            setIsSeeker(subscription.tier === 'seeker');
          }
        })
        .catch(() => {
          if (!cancelled) {
            setIsSeeker(true);
          }
        });
    } else {
      setIsSeeker(true);
    }

    return () => {
      cancelled = true;
    };
  }, [editorAnim, userId, visible, watermarkUpsellAnim]);

  useEffect(() => {
    if (isSeeker !== true) {
      watermarkUpsellAnim.setValue(0);
      return;
    }
    Animated.timing(watermarkUpsellAnim, {
      toValue: 1,
      duration: 320,
      delay: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [isSeeker, watermarkUpsellAnim]);

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

  const closeComposer = useCallback((afterClose?: () => void) => {
    if (closing.current) { return; }
    closing.current = true;
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) { closing.current = false; return; }
      pendingUpgrade.current = !!afterClose && Platform.OS === 'ios';
      onClose();
      if (afterClose && Platform.OS !== 'ios') {
        setTimeout(afterClose, 350);
      }
    });
  }, [onClose, sheetAnim]);

  const captureSelectedCard = useCallback(async (asDataUri = false) => {
    const selectedCard = cardRefs.current[selectedIndex];
    if (!selectedCard?.capture) {
      throw new Error('Share card is not ready');
    }
    // iOS SMS requires data URLs for attachments; More requires them to honor filename.
    const uri = asDataUri
      ? await captureRef(selectedCard, {
        format: 'png', quality: 1, result: 'data-uri', width: 1080, height: 1350,
      })
      : await selectedCard.capture();
    if (!uri) {
      throw new Error('Share card capture returned no image');
    }
    return asDataUri || uri.startsWith('file://') ? uri : `file://${uri}`;
  }, [selectedIndex]);

  const runShareAction = useCallback(async (
    action: string,
    share: (uri: string) => Promise<unknown>
  ) => {
    if (sharingAction || isSeeker === null) { return; }
    triggerLightHaptic();
    setSharingAction(action);
    try {
      const uri = await captureSelectedCard(
        Platform.OS === 'ios' && (action === 'messages' || action === 'more')
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
  }, [captureSelectedCard, isSeeker, sharingAction]);

  const shareToInstagram = useCallback(() => runShareAction('instagram', uri => Share.shareSingle({
    social: Share.Social.INSTAGRAM_STORIES,
    appId: ENV.FACEBOOK_APP_ID,
    backgroundImage: uri,
  } as any)), [runShareAction]);

  const shareToFacebook = useCallback(async () => {
    if (Platform.OS === 'ios') {
      const canOpenFacebookStories = await Linking.canOpenURL('facebook-stories://share').catch(() => false);
      if (!canOpenFacebookStories) {
        Alert.alert(
          'Facebook Stories unavailable',
          'Make sure Facebook is installed, then rebuild siFia so the Facebook Stories configuration is included.'
        );
        return;
      }
    }

    return runShareAction('facebook', uri => Share.shareSingle({
      social: Share.Social.FACEBOOK_STORIES,
      appId: ENV.FACEBOOK_APP_ID,
      backgroundImage: uri,
    } as any));
  }, [runShareAction]);

  const shareToMessages = useCallback(() => runShareAction('messages', uri => Share.shareSingle({
    social: Share.Social.SMS,
    // SmsShare.m adds a missing recipient (nil) to an NSArray, crashing iOS.
    // An empty string leaves recipient selection to the Messages composer.
    recipient: '',
    url: uri,
    type: 'image/png',
    message: 'A siFia reflection from my Playbook — https://www.sifia.app',
  } as any)), [runShareAction]);

  const shareMore = useCallback(() => runShareAction('more', uri => Share.open({
    title: 'Share your siFia reflection',
    subject: 'A reflection from siFia',
    message: 'A siFia reflection from my Playbook — https://www.sifia.app',
    url: uri,
    type: 'image/png',
    filename: Platform.OS === 'ios' ? 'siFia-reflection.png' : 'siFia-reflection',
    failOnCancel: false,
  })), [runShareAction]);

  const handleUpgrade = useCallback(() => {
    closeComposer(onUpgrade);
  }, [closeComposer, onUpgrade]);

  const handleDismiss = useCallback(() => {
    if (pendingUpgrade.current) {
      pendingUpgrade.current = false;
      onUpgrade();
    }
  }, [onUpgrade]);

  const renderCard = useCallback(({ item, index }: { item: ShareTemplate; index: number }) => {
    if (isSeeker === null) {
      return (
        <View style={styles.carouselPage}>
          <View style={[styles.shareCard, styles.templateLoading]}>
            <ActivityIndicator color={Colors.alertCoral} />
          </View>
        </View>
      );
    }

    const isAnchorBlue = !item.image;
    const watermarkColor = isAnchorBlue ? Colors.alertCoral : Colors.hopeWhite;
    const textLength = text.trim().length;
    const textStyle = textLength > 260
      ? styles.shareTextSmall
      : textLength > 170
        ? styles.shareTextMedium
        : styles.shareTextLarge;
    const baseText = StyleSheet.flatten(textStyle);
    const sizeScale = TEXT_SIZE_SCALE[textSize];
    const shareParts = noSplit
      ? [text.trim()]
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
        : {
          primary: 'AlexBrush-Regular',
          supporting: getFontFamily('lora', 'regular'),
        };
    const scriptBoost = typography === 'script' ? 1.5 : 1;
    const primaryFontSize = (baseText?.fontSize ?? 17) * sizeScale * scriptBoost;
    const primaryLineHeight = (baseText?.lineHeight ?? 24) * sizeScale * scriptBoost * (lineHeightMultiplier ?? 1);
    const primaryTextStyle = {
      fontFamily: typographyStyle.primary,
      fontSize: primaryFontSize,
      lineHeight: primaryLineHeight,
      textAlign,
    };
    const supportingRatio = typography === 'script' ? 0.55 : 0.67;
    const supportingTextStyle = {
      fontFamily: typographyStyle.supporting,
      fontSize: Math.max(11, primaryFontSize * supportingRatio),
      lineHeight: Math.max(16, primaryLineHeight * supportingRatio),
      textAlign,
    };

    const content = (
      <View style={styles.cardContent}>

        <View style={styles.shareCopy}>
          <Text style={[styles.shareText, { color: Colors.hopeWhite }, primaryTextStyle]}>{primaryText || text}</Text>
          {supportingText ? (
            <>
              <View style={[styles.supportingRule, textAlign === 'left' && styles.supportingRuleLeft, textAlign === 'right' && styles.supportingRuleRight]} />
              <Text style={[styles.shareText, styles.supportingText, { color: textColor ?? 'rgba(255,255,255,0.88)' }, supportingTextStyle]}>{supportingText}</Text>
            </>
          ) : null}
        </View>
        <View style={styles.watermarkRow}>
          {isSeeker ? (
            <>
              <Image
                source={require('../../assets/icons/siFia-logo-white.png')}
                resizeMode="contain"
                style={styles.watermarkLogo}
              />
              <ThemedText weight="medium" style={[styles.watermarkUrl, { color: watermarkColor }]}>www.sifia.app</ThemedText>
            </>
          ) : null}
        </View>
      </View>
    );

    return (
      <View style={styles.carouselPage}>
        <View style={styles.shareCard}>
          <ViewShot
            ref={ref => { cardRefs.current[index] = ref; }}
            options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1350 }}
            style={styles.captureCard}
          >
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
          </ViewShot>
        </View>
      </View>
    );
  }, [isSeeker, text, textAlign, textSize, typography, textColor, lineHeightMultiplier, noSplit]);

  const shareActions = [
    { id: 'instagram', label: 'Instagram', icon: 'logo-instagram', onPress: shareToInstagram },
    { id: 'facebook', label: 'Facebook', icon: 'logo-facebook', onPress: shareToFacebook },
    { id: 'messages', label: 'Message', icon: 'chatbubble-outline', onPress: shareToMessages },
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
      onDismiss={handleDismiss}
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
              <ThemedText weight="bold" style={styles.title}>Share your reflection</ThemedText>
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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={editorOpen ? 'Close post editor' : 'Edit post style'}
            accessibilityState={{ expanded: editorOpen }}
            activeOpacity={0.72}
            onPress={toggleEditor}
            style={[styles.editFloatingButton, editorOpen && styles.editFloatingButtonActive]}
          >
            {editorOpen ? (
              <PencilOff size={18} color={Colors.alertCoral} />
            ) : (
              <Pencil size={18} color={Colors.hopeWhite} />
            )}
          </TouchableOpacity>
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
            getItemLayout={(_, index) => ({ length: CAROUSEL_ITEM_WIDTH, offset: CAROUSEL_ITEM_WIDTH * index, index })}
            onMomentumScrollEnd={event => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / CAROUSEL_ITEM_WIDTH);
              setSelectedIndex(Math.min(Math.max(nextIndex, 0), templates.length - 1));
              triggerLightHaptic();
            }}
          />
          </View>

          <Animated.View
            pointerEvents={editorOpen ? 'auto' : 'none'}
            accessibilityElementsHidden={!editorOpen}
            importantForAccessibility={editorOpen ? 'auto' : 'no-hide-descendants'}
            style={[
              styles.editorPanel,
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
              <View style={styles.utilityGroup}>
                <View style={styles.iconSegments}>
                  {(['small', 'standard', 'large'] as ShareTextSize[]).map((size, index) => (
                    <TouchableOpacity
                      key={size}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${size} text size`}
                      accessibilityState={{ selected: textSize === size }}
                      onPress={() => {
                        setTextSize(size);
                        triggerLightHaptic();
                      }}
                      style={[styles.iconSegmentButton, textSize === size && styles.iconSegmentButtonActive]}
                    >
                      <ThemedText weight="semiBold" style={[styles.sizeGlyph, { fontSize: 11 + index * 2 }, textSize === size && styles.segmentTextActive]}>A</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
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
                        color={textAlign === align ? Colors.alertCoral : 'rgba(255,255,255,0.62)'}
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
                style={[styles.action, isSeeker === null && styles.actionDisabled]}
                onPress={action.onPress}
                disabled={!!sharingAction || isSeeker === null}
                accessibilityLabel={action.label}
              >
                <View style={styles.actionIcon}>
                  {sharingAction === action.id ? (
                    <ActivityIndicator size="small" color={Colors.alertCoral} />
                  ) : (
                    <Ionicons name={action.icon as any} size={21} color={Colors.hopeWhite} />
                  )}
                </View>
                <ThemedText style={styles.actionLabel}>{action.label}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {isSeeker ? (
            <Animated.View
              style={[
                styles.upgradeReveal,
                {
                  maxHeight: watermarkUpsellAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 90] }),
                  marginTop: watermarkUpsellAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }),
                  opacity: watermarkUpsellAnim,
                  transform: [{
                    translateY: watermarkUpsellAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
                  }],
                },
              ]}
            >
              <TouchableOpacity style={styles.upgradeRow} onPress={handleUpgrade} activeOpacity={0.75}>
                <View style={styles.upgradeIcon}>
                  <Ionicons name="eye-off-outline" size={18} color={Colors.alertCoral} />
                </View>
                <View style={styles.upgradeCopy}>
                  <ThemedText weight="semiBold" style={styles.upgradeTitle}>Hide the siFia watermark</ThemedText>
                  <ThemedText style={styles.upgradeSubtitle}>Available with Growth</ThemedText>
                </View>
                <View style={styles.growthPill}>
                  <ThemedText weight="semiBold" style={styles.growthPillText}>Get Growth</ThemedText>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : null}
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
  cardBrandMark: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: 44,
    height: 18,
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
    backgroundColor: Colors.anchorBlue,
  },
  templateLoading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  cardBackground: {
    flex: 1,
  },
  anchorBackground: {
    backgroundColor: Colors.anchorBlue,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 22,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  watermarkLogo: {
    width: 58,
    height: 22,
  },
  watermarkUrl: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.2,
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
    borderColor: 'rgba(255,107,107,0.38)',
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
    borderBottomColor: Colors.alertCoral,
  },
  segmentText: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    lineHeight: 15,
  },
  segmentTextActive: {
    color: Colors.alertCoral,
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
  sizeGlyph: {
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 17,
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
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.22)',
  },
  upgradeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,107,0.12)',
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
    backgroundColor: Colors.alertCoral,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  growthPillText: {
    color: Colors.anchorBlue,
    fontFamily: getFontFamily('lexend', 'semiBold'),
    fontSize: 10,
    lineHeight: 13,
  },
});

export default TruthToCarryShareComposer;
