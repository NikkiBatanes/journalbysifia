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
  TouchableOpacity,
  View,
} from 'react-native';
import Share from 'react-native-share';
import ViewShot, { captureRef } from 'react-native-view-shot';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ENV } from '../config/environment';
import { NewSubscriptionService } from '../services/NewSubscriptionService';
import { Colors } from '../theme/colors';
import { getFontFamily } from '../theme/fonts';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { Logger } from '../utils/ProductionLogger';
import ThemedText from './common/ThemedText';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 72, 300);
const CARD_HEIGHT = CARD_WIDTH * 1.25;

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
  userId: string;
  onClose: () => void;
  onUpgrade: () => void;
}

const TruthToCarryShareComposer: React.FC<TruthToCarryShareComposerProps> = ({
  visible,
  text,
  userId,
  onClose,
  onUpgrade,
}) => {
  const insets = useSafeAreaInsets();
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const cardRefs = useRef<Array<ViewShot | null>>([]);
  const pendingUpgrade = useRef(false);
  const [templates, setTemplates] = useState<ShareTemplate[]>(buildTemplates);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSeeker, setIsSeeker] = useState<boolean | null>(null);
  const [sharingAction, setSharingAction] = useState<string | null>(null);

  const openComposer = useCallback(() => {
    closing.current = false;
    sheetAnim.setValue(0);
    Animated.spring(sheetAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [sheetAnim]);

  useEffect(() => {
    if (!visible) { return; }

    setTemplates(buildTemplates());
    setSelectedIndex(0);
    setIsSeeker(null);

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
  }, [userId, visible]);

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

    const content = (
      <View style={styles.cardContent}>
        <View style={styles.cardLabelRow}>
          <View style={[styles.cardLabelRule, { backgroundColor: watermarkColor }]} />
          <ThemedText weight="semiBold" style={[styles.cardLabel, { color: watermarkColor }]}>siFia REFLECTION</ThemedText>
        </View>
        <ThemedText weight="semiBold" style={[styles.shareText, textStyle]}>{text}</ThemedText>
        <View style={styles.watermarkRow}>
          {isSeeker ? (
            <>
              <Image
                source={require('../../assets/icons/siFia-logo-white.png')}
                resizeMode="contain"
                style={[styles.watermarkLogo, { tintColor: watermarkColor }]}
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
  }, [isSeeker, text]);

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
              transform: [{ translateY: sheetAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [SCREEN_HEIGHT, 0],
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
          <View style={styles.pagination}>
            <View style={styles.paginationTrack}>
              <View
                style={[
                  styles.paginationFill,
                  { width: `${((selectedIndex + 1) / templates.length) * 100}%` },
                ]}
              />
            </View>
          </View>

          <FlatList
            data={templates}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id}
            renderItem={renderCard}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            style={styles.carousel}
            getItemLayout={(_, index) => ({ length: CARD_WIDTH, offset: CARD_WIDTH * index, index })}
            onMomentumScrollEnd={event => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH);
              setSelectedIndex(Math.min(Math.max(nextIndex, 0), templates.length - 1));
              triggerLightHaptic();
            }}
          />

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
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    borderRadius: 22,
  },
  carouselPage: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
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
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardLabelRule: {
    width: 24,
    height: 2,
    borderRadius: 1,
  },
  cardLabel: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
  },
  shareText: {
    color: Colors.hopeWhite,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    paddingHorizontal: 2,
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
  pagination: {
    alignItems: 'center',
    paddingTop: 9,
    paddingBottom: 10,
  },
  paginationTrack: {
    width: 64,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  paginationFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: Colors.alertCoral,
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
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 16,
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
