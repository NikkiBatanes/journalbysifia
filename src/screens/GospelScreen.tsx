import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GOSPEL_PAGES, GOSPEL_PRAYER, GOSPEL_RESPONSE_ASSURANCE, LISTEN_FIRST_QUESTIONS } from '../data/gospelContent';
import {
  GospelPerson,
  GospelResponse,
  GospelShareEvent,
  GospelShareMethod,
  gospelStorage,
} from '../storage/gospelStorage';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { useTheme } from '../theme/ThemeContext';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import HeaderBackButton from '../components/common/HeaderBackButton';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { scheduleForMeDayReminder } from '../services/forMeDayService';
import { toLocalDateString } from '../utils/date';
import { playGospelOpeningSound } from '../utils/soundUtils';
import PrayerHandsIcon from '../components/common/PrayerHandsIcon';
import { gospelShareService, GospelShareLink, SharedGospelResponse } from '../services/gospelShareService';
import {recordGospelAcceptanceAsAnsweredPrayer} from '../services/gospelAcceptancePrayerService';
import {returnToMainTab} from '../navigation/returnToMainTab';
import {queueSelfGospelAcceptanceImpact} from '../services/journalImpactAnalyticsService';

type ViewName = 'home' | 'mode' | 'together-person' | 'listen' | 'player' | 'promise' | 'response' | 'prayer' | 'assurance-intro' | 'assurance' | 'birthday' | 'next-steps' | 'spiritual-birthday' | 'other' | 'people' | 'add-person-name' | 'add-person-prayer' | 'send' | 'shared-responses';
type Mode = 'app_self' | 'app_together';
type ResponseFilter = 'all' | 'praying' | 'others';

const RESPONSE_OPTIONS: Array<{ value: GospelResponse; label: string }> = [
  { value: 'trusted_jesus_today', label: 'Yes. I want to trust and follow Jesus.' },
  { value: 'has_questions', label: 'I have questions.' },
  { value: 'not_ready', label: "I'm not ready yet." },
  { value: 'already_follows_jesus', label: 'I already trust and follow Jesus.' },
];

const ASSURANCE_ITEMS = [
  {
    id: 'forgiven',
    icon: 'cross-outline',
    title: 'Forgiven',
    truth: 'All of your sins are paid for and forgiven.',
    detail: 'Past, present, and future sins',
    verse: 'And then he says: I will not remember their sins and evil deeds any longer.',
    reference: 'Hebrews 10:17',
  },
  {
    id: 'new-life',
    icon: 'leaf-outline',
    title: 'New life',
    truth: 'You are a new person in God’s eyes. A new life has begun for you.',
    verse: 'Anyone who is joined to Christ is a new being; the old is gone, the new has come.',
    reference: '2 Corinthians 5:17',
  },
  {
    id: 'child-of-god',
    icon: 'heart-outline',
    title: 'Child of God',
    truth: 'You became a child of God.',
    verse: 'Some, however, did receive him and believed in him; so he gave them the right to become God’s children.',
    reference: 'John 1:12',
  },
] as const;

const FIRST_STEPS = [
  ['Pray every day', 'Talk with God.'],
  ['Read the Bible', 'Begin with the Gospel of John.'],
  ['Join a discipleship group', 'Grow alongside other believers.'],
  ['Attend a Bible-believing church', 'Learn, worship, and live in community.'],
  ['Share the Gospel', 'Tell family, friends, and others the good news.'],
] as const;

const GOSPEL_BACKGROUNDS: Record<string, number> = {
  intro: require('../../assets/images/gospel/01-best-decision.png'),
  love: require('../../assets/images/gospel/02-god-loves-you.png'),
  sin: require('../../assets/images/gospel/03-sin-separates-us.png'),
  death: require('../../assets/images/gospel/03-sin-separates-us.png'),
  'death-kinds': require('../../assets/images/gospel/04-consequence-of-sin.png'),
  effort: require('../../assets/images/gospel/05-human-efforts-cannot-save.png'),
  jesus: require('../../assets/images/gospel/06-jesus-is-the-only-way.png'),
  'only-way': require('../../assets/images/gospel/06-jesus-is-the-only-way.png'),
  risen: require('../../assets/images/gospel/06-jesus-is-the-only-way.png'),
  faith: require('../../assets/images/gospel/06-jesus-is-the-only-way.png'),
  'faith-followup': require('../../assets/images/gospel/07-faith-in-jesus.png'),
  understanding: require('../../assets/images/gospel/07-faith-in-jesus.png'),
  trust: require('../../assets/images/gospel/07-faith-in-jesus.png'),
  'assurance-intro': require('../../assets/images/gospel/08-new-life-with-jesus.png'),
  assurance: require('../../assets/images/gospel/08-new-life-with-jesus.png'),
  birthday: require('../../assets/images/gospel/08-new-life-with-jesus.png'),
  'next-steps': require('../../assets/images/gospel/08-new-life-with-jesus.png'),
};

const GOSPEL_BACKGROUND_SOURCES = Object.values(GOSPEL_BACKGROUNDS);

const GOSPEL_SHARE_PROMPTS = [
  'They have questions',
  'They’re open to talk',
  'Invite them for coffee',
  'Share my story',
  'Send the Gospel link',
  'Pray for an opportunity',
] as const;

const prayerNoteForResponse = (response: GospelResponse): string => response === 'has_questions'
  ? 'They have questions after going through the Gospel. Pray for wisdom and follow up with care.'
  : 'They are not ready to trust Jesus yet. Keep praying and follow up with care.';

const formatGospelHistoryDate = (value?: string): string | null => {
  if (!value) {return null;}
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {return null;}
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === new Date().getFullYear() ? {} : {year: 'numeric'}),
  });
};

const formatPrayerStartedAt = (person: GospelPerson): string | null =>
  formatGospelHistoryDate(person.prayerStartedAt || person.createdAt);

const formatSpiritualBirthday = (value: string): string => {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {return value;}
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === new Date().getFullYear() ? {} : {year: 'numeric'}),
  });
};

const StaggeredItem = ({ children, delay, animationKey, reduceMotion, pushToBottom, fade }: { children: React.ReactNode; delay: number; animationKey: string; reduceMotion: boolean; pushToBottom: boolean; fade: boolean }) => {
  const motion = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const opacity = useRef(new Animated.Value(reduceMotion || !fade ? 1 : 0)).current;

  useEffect(() => {
    motion.setValue(reduceMotion ? 1 : 0);
    opacity.setValue(reduceMotion || !fade ? 1 : 0);
    if (reduceMotion) {return;}
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(motion, { toValue: 1, tension: 48, friction: 9, useNativeDriver: true }),
        ...(fade ? [Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true })] : []),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animationKey, delay, fade, motion, opacity, reduceMotion]);

  return (
    <Animated.View style={[pushToBottom && styles.staggerPushToBottom, {
      opacity,
      transform: [
        { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
      ],
    }]}>
      {children}
    </Animated.View>
  );
};

const StaggeredPage = ({ children, animationKey, reduceMotion }: { children: React.ReactNode; animationKey: string; reduceMotion: boolean }) => {
  const root = React.isValidElement(children) && children.type === React.Fragment
    ? (children.props as { children?: React.ReactNode }).children
    : children;
  return <>{React.Children.toArray(root).map((child, index) => {
    const childStyle = React.isValidElement(child)
      ? StyleSheet.flatten((child.props as { style?: object }).style) as { marginTop?: unknown } | undefined
      : undefined;
    return (
      <StaggeredItem key={`${animationKey}-${index}`} delay={index * 60} animationKey={animationKey} reduceMotion={reduceMotion} pushToBottom={childStyle?.marginTop === 'auto'} fade>
        {child}
      </StaggeredItem>
    );
  })}</>;
};

const DirectionalReveal = ({ children, animationKey, delay, fromX, reduceMotion }: { children: React.ReactNode; animationKey: string; delay: number; fromX: number; reduceMotion: boolean }) => {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    progress.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) {return;}
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(progress, { toValue: 1, tension: 64, friction: 10, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animationKey, delay, progress, reduceMotion]);
  return <Animated.View style={{ transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] }) }] }}>{children}</Animated.View>;
};

const RosePop = ({ children, animationKey, reduceMotion }: { children: React.ReactNode; animationKey: string; reduceMotion: boolean }) => {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    progress.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) {return;}
    const animation = Animated.sequence([
      Animated.delay(210),
      Animated.spring(progress, { toValue: 1, tension: 82, friction: 7, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animationKey, progress, reduceMotion]);
  return <Animated.View style={{ opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }] }}>{children}</Animated.View>;
};

const GospelScreen: React.FC<any> = ({ navigation, route }) => {
  const theme = useTheme();
  const font = { fontFamily: theme.fontFamily };
  const insets = useSafeAreaInsets();
  useScreenStatusBar('dark', '#FFFDF8');
  const [view, setView] = useState<ViewName>('home');
  const [, setHistory] = useState<ViewName[]>([]);
  const [mode, setMode] = useState<Mode>('app_self');
  const [listenIndex, setListenIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [response, setResponse] = useState<GospelResponse | null>(null);
  const [pickedChoice, setPickedChoice] = useState<number | null>(null);
  const [expandedAssurance, setExpandedAssurance] = useState<string | null>('forgiven');
  const [readingGuideExpanded, setReadingGuideExpanded] = useState(false);
  const [people, setPeople] = useState<GospelPerson[]>([]);
  const [shareEvents, setShareEvents] = useState<GospelShareEvent[]>([]);
  const [personName, setPersonName] = useState('');
  const [personNote, setPersonNote] = useState('');
  const [selectedSharePrompts, setSelectedSharePrompts] = useState<string[]>([]);
  const [sharedResponses, setSharedResponses] = useState<SharedGospelResponse[]>([]);
  const [loadingSharedResponses, setLoadingSharedResponses] = useState(false);
  const [sharingGospel, setSharingGospel] = useState(false);
  const [savingShare, setSavingShare] = useState(false);
  const [undoShareEvent, setUndoShareEvent] = useState<GospelShareEvent | null>(null);
  const [showShareCounter, setShowShareCounter] = useState(true);
  const [recipientId, setRecipientId] = useState<string | undefined>();
  const [lockedRecipientId, setLockedRecipientId] = useState<string | undefined>();
  const [togetherResponderName, setTogetherResponderName] = useState('');
  const [spiritualBirthdayDate, setSpiritualBirthdayDate] = useState(new Date());
  const [showSpiritualBirthdayPicker, setShowSpiritualBirthdayPicker] = useState(false);
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>('all');
  const [linkingResponseIds, setLinkingResponseIds] = useState<string[]>([]);
  const preparedShareLinks = useRef(new Map<string | undefined, Promise<GospelShareLink>>());
  const shareInProgress = useRef(false);
  const shareSaveInProgress = useRef(false);
  const undoShareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leafBloom = useRef(new Animated.Value(0)).current;
  const birdFlight = useRef(new Animated.Value(0)).current;
  const birthdayReveal = useRef(new Animated.Value(0)).current;
  const shareCounterLabelAnim = useRef(new Animated.Value(1)).current;
  const shareCounterVisibilityAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useFocusEffect(
    useCallback(() => {
      playGospelOpeningSound().catch(() => {});
    }, []),
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (view !== 'home') {return;}
    shareCounterLabelAnim.setValue(reduceMotion ? 0 : 1);
    if (reduceMotion) {return undefined;}
    const collapseTimer = setTimeout(() => {
      Animated.timing(shareCounterLabelAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 3600);
    return () => clearTimeout(collapseTimer);
  }, [reduceMotion, shareCounterLabelAnim, view]);

  useEffect(() => {
    const visible = view === 'home';
    if (reduceMotion) {
      shareCounterVisibilityAnim.setValue(visible ? 1 : 0);
      setShowShareCounter(visible);
      return undefined;
    }

    if (visible) {
      setShowShareCounter(true);
      shareCounterVisibilityAnim.setValue(0);
      const entrance = Animated.spring(shareCounterVisibilityAnim, {
        toValue: 1,
        tension: 62,
        friction: 7,
        useNativeDriver: true,
      });
      entrance.start();
      return () => entrance.stop();
    }

    const exit = Animated.sequence([
      Animated.spring(shareCounterVisibilityAnim, {
        toValue: 1.06,
        tension: 150,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.spring(shareCounterVisibilityAnim, {
        toValue: 0,
        tension: 72,
        friction: 9,
        overshootClamping: false,
        useNativeDriver: true,
      }),
    ]);
    exit.start(({finished}) => {
      if (finished) {setShowShareCounter(false);}
    });
    return () => exit.stop();
  }, [reduceMotion, shareCounterVisibilityAnim, view]);

  useEffect(() => () => {
    if (undoShareTimer.current) {clearTimeout(undoShareTimer.current);}
  }, []);

  useEffect(() => {
    if (view !== 'assurance-intro' && view !== 'assurance') {return;}
    const celebrating = view === 'assurance-intro';
    leafBloom.setValue(reduceMotion || !celebrating ? 1 : 0);
    birdFlight.setValue(reduceMotion || !celebrating ? 1 : 0);
    if (!celebrating) {return;}
    try { triggerSuccessHaptic(); } catch {}
    if (reduceMotion) {return;}
    const entrance = Animated.parallel([
      Animated.spring(leafBloom, {
        toValue: 1,
        tension: 38,
        friction: 8,
        overshootClamping: true,
        useNativeDriver: true,
      }),
      Animated.timing(birdFlight, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [birdFlight, leafBloom, reduceMotion, view]);

  useEffect(() => {
    if (view !== 'birthday') {return;}
    birthdayReveal.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) {return;}
    const animation = Animated.spring(birthdayReveal, { toValue: 1, tension: 42, friction: 8, overshootClamping: true, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [birthdayReveal, reduceMotion, view]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [listenIndex, pageIndex, view]);

  const withLightHaptic = useCallback((onPress: () => void) => () => {
    try { triggerLightHaptic(); } catch {}
    onPress();
  }, []);

  const go = useCallback((next: ViewName) => {
    setHistory(current => [...current, view]);
    setView(next);
  }, [view]);

  const exitGospel = useCallback(() => {
    if (route?.params?.returnTo === 'More') {
      returnToMainTab(navigation, 'More');
      return;
    }
    navigation.goBack();
  }, [navigation, route?.params?.returnTo]);

  const back = useCallback(() => {
    if (view === 'player' && pageIndex > 0) {
      setPageIndex(value => value - 1);
      return;
    }
    if (view === 'listen' && listenIndex > 0) {
      setListenIndex(value => value - 1);
      return;
    }
    setHistory(current => {
      if (!current.length) {
        exitGospel();
        return current;
      }
      const copy = [...current];
      setView(copy.pop() as ViewName);
      return copy;
    });
  }, [exitGospel, listenIndex, pageIndex, view]);

  const resetHome = useCallback(() => {
    setHistory([]);
    setView('home');
    setPageIndex(0);
    setListenIndex(0);
    setResponse(null);
    setRecipientId(undefined);
    setLockedRecipientId(undefined);
    setTogetherResponderName('');
    setSpiritualBirthdayDate(new Date());
    setShowSpiritualBirthdayPicker(false);
  }, []);

  const close = useCallback(() => {
    exitGospel();
  }, [exitGospel]);

  const loadPeople = useCallback(async () => setPeople(await gospelStorage.getPeople()), []);
  const loadShareEvents = useCallback(async () => setShareEvents(await gospelStorage.getShareEvents()), []);
  useEffect(() => {
    loadPeople();
    loadShareEvents();
  }, [loadPeople, loadShareEvents]);
  useEffect(() => { setPickedChoice(null); }, [pageIndex, view]);

  const todayShareCount = useMemo(() => {
    const today = toLocalDateString(new Date());
    return shareEvents.filter(event => toLocalDateString(new Date(event.sharedAt)) === today).length;
  }, [shareEvents]);

  const prepareShareLink = useCallback((personId?: string) => {
    const cached = preparedShareLinks.current.get(personId);
    if (cached) {
      return cached;
    }

    const request = gospelShareService.createLink(personId);
    preparedShareLinks.current.set(personId, request);
    request.catch(() => {
      // Allow the Share button to retry after a failed background request.
      if (preparedShareLinks.current.get(personId) === request) {
        preparedShareLinks.current.delete(personId);
      }
    });
    return request;
  }, []);

  useEffect(() => {
    if (view === 'send') {
      // Link creation needs a network round trip. Start it while the person is
      // reading this screen so the native share sheet can open immediately.
      prepareShareLink(recipientId);
    }
  }, [prepareShareLink, recipientId, view]);

  const openSend = (personId?: string) => {
    setRecipientId(personId);
    setLockedRecipientId(personId);
    go('send');
  };

  const startPlayer = (selectedMode: Mode) => {
    setMode(selectedMode);
    setPageIndex(0);
    if (selectedMode === 'app_together') {
      setListenIndex(0);
      go('listen');
    } else {
      go('player');
    }
  };

  const startTogether = (personId?: string, responderName = '') => {
    setRecipientId(personId);
    setTogetherResponderName(responderName.trim());
    startPlayer('app_together');
  };

  const continuePlayer = () => {
    if (pageIndex < GOSPEL_PAGES.length - 1) {
      setPageIndex(value => value + 1);
    } else {
      go('promise');
    }
  };

  const recordConfirmedShare = async (
    method: GospelShareMethod,
    personId?: string,
    responseDetails?: Pick<GospelShareEvent, 'response' | 'responderName' | 'spiritualBirthday'>,
  ) => {
    if (shareSaveInProgress.current) {return null;}
    shareSaveInProgress.current = true;
    setSavingShare(true);
    try {
      const event = await gospelStorage.recordShareEvent({method, personId, ...responseDetails});
      setShareEvents(current => [event, ...current]);
      if (undoShareTimer.current) {clearTimeout(undoShareTimer.current);}
      if (!responseDetails?.response) {
        setUndoShareEvent(event);
        undoShareTimer.current = setTimeout(() => {
          setUndoShareEvent(current => current?.id === event.id ? null : current);
          undoShareTimer.current = null;
        }, 6000);
      } else {
        setUndoShareEvent(null);
      }
      try { triggerSuccessHaptic(); } catch {}
      return event;
    } finally {
      shareSaveInProgress.current = false;
      setSavingShare(false);
    }
  };

  const finishGospelExperience = async (saveTogetherResponse = false, addToPrayerList = false) => {
    if (mode === 'app_together') {
      try {
        let trackedPersonId = recipientId;
        const responderName = people.find(item => item.id === recipientId)?.displayName || togetherResponderName.trim();
        if (addToPrayerList && !trackedPersonId && responderName && response) {
          const existingPerson = people.find(item => item.displayName.trim().toLocaleLowerCase() === responderName.toLocaleLowerCase());
          const trackedPerson = existingPerson || await gospelStorage.addPerson(
            responderName,
            prayerNoteForResponse(response),
          );
          trackedPersonId = trackedPerson.id;
          if (!existingPerson) {
            setPeople(current => [trackedPerson, ...current]);
          }
        }
        const event = await recordConfirmedShare('together', trackedPersonId, saveTogetherResponse && response ? {
          response,
          responderName: togetherResponderName || undefined,
          spiritualBirthday: response === 'trusted_jesus_today'
            ? toLocalDateString(new Date())
            : undefined,
        } : undefined);
        if (event && saveTogetherResponse && response === 'trusted_jesus_today') {
          const person = people.find(item => item.id === trackedPersonId);
          const acceptanceName = person?.displayName || responderName;
          if (acceptanceName) {
            try {
              await recordGospelAcceptanceAsAnsweredPrayer({
                gospelPersonId: person?.id || event.id,
                personName: acceptanceName,
                prayerStartedAt: person?.prayerStartedAt || person?.createdAt || event.sharedAt,
                acceptedAt: event.sharedAt,
              });
            } catch {
              Alert.alert('Response saved', 'The response was saved, but the answered prayer could not be added to your journal.');
            }
          }
        }
      } catch {
        Alert.alert('Unable to save this share', 'The Gospel walkthrough is complete, but its share could not be recorded.');
      }
    }
    resetHome();
  };

  const submitResponse = async () => {
    if (!response) {
      Alert.alert('Choose a response', 'Choose the response closest to where you are.');
      return;
    }
    if (response === 'trusted_jesus_today') {
      go('prayer');
      return;
    }
    if (response === 'already_follows_jesus' && mode === 'app_self') {
      const settings = await gospelStorage.getForMeDaySettings();
      if (!settings?.spiritualBirthday) {
        go('spiritual-birthday');
        return;
      }
      await gospelStorage.saveResponse(response, mode, settings.spiritualBirthday);
      go('other');
      return;
    }
    // A person using the owner's phone should not replace the owner's saved
    // response or spiritual birthday.
    if (mode === 'app_self') {
      await gospelStorage.saveResponse(response, mode);
    }
    go('other');
  };

  const finishAlreadyFollowingResponse = async (saveDate: boolean) => {
    const date = saveDate ? toLocalDateString(spiritualBirthdayDate) : undefined;
    await gospelStorage.saveResponse('already_follows_jesus', 'app_self', date);
    if (date) {
      await scheduleForMeDayReminder(await gospelStorage.getForMeDaySettings());
      try { triggerSuccessHaptic(); } catch {}
      navigation.replace('ForMeDay', {
        mode: 'celebrate',
        ...(route?.params?.returnTo === 'More' ? {returnTo: 'More'} : {}),
      });
      return;
    }
    go('other');
  };

  const saveTrustedResponse = async (saveDate: boolean) => {
    if (mode === 'app_self') {
      const date = saveDate ? toLocalDateString(new Date()) : undefined;
      const savedResponse = await gospelStorage.saveResponse('trusted_jesus_today', mode, date);
      await queueSelfGospelAcceptanceImpact(savedResponse.respondedAt);
      if (saveDate) {
        const settings = await gospelStorage.getForMeDaySettings();
        await scheduleForMeDayReminder(settings);
        try { triggerSuccessHaptic(); } catch {}
        navigation.replace('ForMeDay', {
          mode: 'celebrate',
          ...(route?.params?.returnTo === 'More' ? {returnTo: 'More'} : {}),
        });
        return;
      }
    }
    try { triggerSuccessHaptic(); } catch {}
    await finishGospelExperience(mode === 'app_together' && saveDate);
  };

  const addPerson = async () => {
    if (!personName.trim()) {
      Alert.alert('Add a name or initial', 'This can be as simple as one initial.');
      return;
    }
    const note = [...selectedSharePrompts, personNote.trim()]
      .filter(Boolean)
      .join(' · ');
    await gospelStorage.addPerson(personName, note);
    setPersonName('');
    setPersonNote('');
    setSelectedSharePrompts([]);
    await loadPeople();
    try { triggerSuccessHaptic(); } catch {}
    setHistory(current => current.slice(0, -2));
    setView('people');
  };

  const shareGospel = async () => {
    if (shareInProgress.current) {return;}
    shareInProgress.current = true;
    setSharingGospel(true);
    try {
      const link = await prepareShareLink(recipientId);
      const recipientName = people.find(person => person.id === recipientId)?.displayName.trim();
      const greeting = recipientName ? `Hey ${recipientName},` : 'Hey,';
      const message = `${greeting} because I care about you, I wanted to share something close to my heart. My hope in Jesus has changed my life, and this short guide explains where that hope comes from. There's no need to respond. I simply wanted you to have it.`;
      const result = await Share.share(Platform.OS === 'ios'
        ? {title: 'The Gospel', message, url: link.url}
        : {title: 'The Gospel', message: `${message} ${link.url}`});
      if (result.action === Share.sharedAction) {
        try {
          await recordConfirmedShare('link', recipientId);
        } catch {
          Alert.alert('Unable to save this share', 'The link was opened in the share menu, but its share could not be recorded.');
        }
        // Each recipient needs a separate link because a link accepts one
        // private response. Prepare the next one outside the next button tap.
        preparedShareLinks.current.delete(recipientId);
        prepareShareLink(recipientId);
      }
    } catch {
      Alert.alert('Unable to create a private link', 'Check your connection and make sure you are signed in, then try again.');
    } finally {
      shareInProgress.current = false;
      setSharingGospel(false);
    }
  };

  const saveOpenShare = async () => {
    try {
      await recordConfirmedShare('shared_openly');
    } catch {
      Alert.alert('Unable to save this share', 'Please try again.');
    }
  };

  const undoLastShare = async () => {
    if (!undoShareEvent || shareSaveInProgress.current) {return;}
    const event = undoShareEvent;
    shareSaveInProgress.current = true;
    setSavingShare(true);
    try {
      await gospelStorage.removeShareEvent(event.id);
      setShareEvents(current => current.filter(item => item.id !== event.id));
      if (undoShareTimer.current) {clearTimeout(undoShareTimer.current);}
      undoShareTimer.current = null;
      setUndoShareEvent(null);
      try { triggerLightHaptic(); } catch {}
    } catch {
      Alert.alert('Unable to undo this share', 'Please try again.');
    } finally {
      shareSaveInProgress.current = false;
      setSavingShare(false);
    }
  };

  const openSharedResponses = async (filter: ResponseFilter = 'all') => {
    setResponseFilter(filter);
    go('shared-responses');
    setLoadingSharedResponses(true);
    try {
      setSharedResponses(await gospelShareService.getSharedResponses());
    } catch {
      Alert.alert('Unable to load responses', 'Please check your connection and try again.');
    } finally {
      setLoadingSharedResponses(false);
    }
  };

  const addResponseToPrayerList = async (item: SharedGospelResponse) => {
    const responderName = item.responder_name?.trim();
    if (!responderName || linkingResponseIds.includes(item.id)) {return;}
    setLinkingResponseIds(current => [...current, item.id]);
    try {
      const existingPerson = people.find(person =>
        person.displayName.trim().toLocaleLowerCase() === responderName.toLocaleLowerCase(),
      );
      const person = existingPerson || await gospelStorage.addPerson(
        responderName,
        prayerNoteForResponse(item.response),
      );
      if (item.id.startsWith('local-')) {
        const eventId = item.id.slice('local-'.length);
        await gospelStorage.linkShareEventToPerson(eventId, person.id);
        setShareEvents(current => current.map(event => event.id === eventId
          ? {...event, personId: person.id}
          : event));
      } else {
        await gospelShareService.linkResponseToPerson(item.gospel_share_links.id, person.id);
        setSharedResponses(current => current.map(saved => saved.id === item.id
          ? {...saved, gospel_share_links: {...saved.gospel_share_links, person_id: person.id}}
          : saved));
      }
      if (!existingPerson) {
        setPeople(current => [person, ...current]);
      }
      try { triggerSuccessHaptic(); } catch {}
    } catch {
      Alert.alert('Unable to add this person', 'The response is still saved. Please try adding them to your prayer list again.');
    } finally {
      setLinkingResponseIds(current => current.filter(id => id !== item.id));
    }
  };

  const responseCopy = useMemo(() => {
    if (response === 'has_questions') {
      return ['Your questions matter.', 'You can keep exploring what the Bible says about Jesus before making a decision.'];
    }
    if (response === 'not_ready') {
      return ['Take the next honest step.', 'Keep considering who Jesus is and what it means to trust Him. You can return to the Gospel whenever you are ready.'];
    }
    return ['Keep preaching the Gospel to yourself.', 'The Gospel is not only how life with Jesus begins. Return to it each day and remember that your standing with God rests on Christ and His grace, not your performance.'];
  }, [response]);

  const gospelBackground = view === 'player'
    ? GOSPEL_BACKGROUNDS[GOSPEL_PAGES[pageIndex].id]
    : view === 'promise' || view === 'response' || view === 'prayer'
      ? GOSPEL_BACKGROUNDS.trust
      : view === 'assurance-intro' || view === 'assurance' || view === 'birthday' || view === 'next-steps'
        ? GOSPEL_BACKGROUNDS[view]
      : undefined;

  const gospelProgress = view === 'player'
    ? (pageIndex + 1) / (GOSPEL_PAGES.length + 2)
    : view === 'promise'
      ? (GOSPEL_PAGES.length + 1) / (GOSPEL_PAGES.length + 2)
      : view === 'response'
        ? 1
        : 0;
  const staggerKey = `${view}-${pageIndex}-${listenIndex}`;
  const staggerControl = (child: React.ReactNode, order = 0, key?: string) => (
    <StaggeredItem key={key || `${staggerKey}-control-${order}`} delay={100 + Math.min(order, 6) * 60} animationKey={staggerKey} reduceMotion={reduceMotion} pushToBottom={false} fade={false}>
      {child}
    </StaggeredItem>
  );

  const renderHeader = () => (
    <View pointerEvents="box-none" style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {view === 'home' ? <View style={styles.headerPlaceholder} /> : (
        <HeaderBackButton
          onPress={withLightHaptic(back)}
        />
      )}
      <View pointerEvents="none" style={styles.headerCenterSpacer}>
        {gospelProgress > 0 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${gospelProgress * 100}%` }]} />
          </View>
        ) : null}
      </View>
      <View style={styles.headerActions}>
        {showShareCounter ? (
          <Animated.View
            pointerEvents={view === 'home' ? 'auto' : 'none'}
            style={{
              opacity: shareCounterVisibilityAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {translateX: shareCounterVisibilityAnim.interpolate({inputRange: [0, 1], outputRange: [58, 0]})},
                {scale: shareCounterVisibilityAnim.interpolate({inputRange: [0, 1], outputRange: [0.58, 1]})},
              ],
            }}>
            <TouchableOpacity
              onPress={withLightHaptic(saveOpenShare)}
              style={[styles.shareCounterButton, savingShare && styles.actionDisabled]}
              activeOpacity={0.7}
              disabled={savingShare}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 4}}
              accessibilityRole="button"
              accessibilityState={{disabled: savingShare}}
              accessibilityLabel={`Record open Gospel share. ${todayShareCount} shared today`}>
              <MaterialCommunityIcons name="sprout" size={18} color={Colors.sage} />
              <Animated.View
                testID="gospel-share-label"
                style={{
                  overflow: 'hidden',
                  opacity: shareCounterLabelAnim,
                  maxWidth: shareCounterLabelAnim.interpolate({inputRange: [0, 1], outputRange: [0, 105]}),
                  marginLeft: shareCounterLabelAnim.interpolate({inputRange: [0, 1], outputRange: [0, 7]}),
                  marginRight: shareCounterLabelAnim.interpolate({inputRange: [0, 1], outputRange: [0, 7]}),
                }}>
                <Text style={[styles.shareCounterLabel, font]} numberOfLines={1}>Shared today</Text>
              </Animated.View>
              {todayShareCount > 0 ? <Text style={[styles.shareCounterText, font]}>{todayShareCount}</Text> : null}
            </TouchableOpacity>
          </Animated.View>
        ) : null}
        <TouchableOpacity
          onPress={withLightHaptic(close)}
          style={styles.headerButton}
          activeOpacity={0.7}
          hitSlop={{top: 8, bottom: 8, left: 4, right: 8}}
          accessibilityRole="button"
          accessibilityLabel="Close Gospel">
          <Ionicons name="close" size={17} color={Colors.sage} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const Action = ({ label, onPress, secondary = false, quiet = false, serifItalic = false, trailingArrow = false, trailingIcon, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; quiet?: boolean; serifItalic?: boolean; trailingArrow?: boolean; trailingIcon?: string; disabled?: boolean }) => {
    const arrowMatch = label.match(/\s*(→|↗)$/);
    const displayLabel = arrowMatch ? label.slice(0, arrowMatch.index).trimEnd() : label;
    const showArrow = trailingArrow || Boolean(arrowMatch);
    const isExternalArrow = arrowMatch?.[1] === '↗';

    return (
      <TouchableOpacity
        onPress={withLightHaptic(onPress)}
        style={[styles.action, secondary && styles.actionSecondary, quiet && styles.actionQuiet, disabled && styles.actionDisabled]}
        activeOpacity={0.72}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={displayLabel}>
        <Text style={[styles.actionText, secondary && styles.actionSecondaryText, quiet && styles.actionQuietText, font, serifItalic && styles.actionTextSerifItalic]}>{displayLabel}</Text>
        {trailingIcon || showArrow ? (
          <Ionicons
            name={trailingIcon || (isExternalArrow ? 'open-outline' : 'arrow-forward')}
            size={18}
            color={secondary ? Colors.sage : Colors.hopeWhite}
            style={styles.actionTrailingArrow}
          />
        ) : null}
      </TouchableOpacity>
    );
  };

  const Card = ({ icon, title, body, onPress }: { icon: string; title: string; body: string; onPress?: () => void }) => {
    const content = (
      <View style={styles.cardRow}>
        <View style={styles.iconBox}><Ionicons name={icon as any} size={21} color={Colors.sage} /></View>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, font]}>{title}</Text>
          <Text style={[styles.cardBody, font]}>{body}</Text>
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={20} color={Colors.sage} /> : null}
      </View>
    );
    return onPress ? <TouchableOpacity style={styles.card} onPress={withLightHaptic(onPress)} activeOpacity={0.72} accessibilityRole="button">{content}</TouchableOpacity> : <View style={styles.card}>{content}</View>;
  };

  const LifeMark = ({ showBirds = false }: { showBirds?: boolean }) => (
    <View style={styles.lifeMark}>
      {showBirds ? <>
        <Animated.View style={[styles.birdLeft, { transform: [{ translateX: birdFlight.interpolate({ inputRange: [0, 1], outputRange: [34, 0] }) }, { rotate: '-10deg' }] }]}><MaterialCommunityIcons name="bird" size={23} color="#30483A" /></Animated.View>
        <Animated.View style={[styles.birdRight, { transform: [{ translateX: birdFlight.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }, { scaleX: -1 }, { rotate: '-5deg' }] }]}><MaterialCommunityIcons name="bird" size={18} color="#30483A" /></Animated.View>
        <Animated.View style={[styles.birdFar, { transform: [{ translateX: birdFlight.interpolate({ inputRange: [0, 1], outputRange: [-22, 0] }) }, { scaleX: -1 }, { rotate: '8deg' }] }]}><MaterialCommunityIcons name="bird" size={13} color="#30483A" /></Animated.View>
      </> : null}
      <View style={styles.check}>
        <Animated.View style={{
          opacity: leafBloom,
          transform: [
            { scale: leafBloom.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            { rotate: leafBloom.interpolate({ inputRange: [0, 1], outputRange: ['-35deg', '0deg'] }) },
          ],
        }}>
          <Ionicons name="sunny" size={35} color={Colors.hopeWhite} />
        </Animated.View>
      </View>
    </View>
  );

  const renderContent = () => {
    if (view === 'home') {
      return <>
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, font]}>THE GOOD NEWS OF JESUS</Text>
          <Text style={[styles.heroTitle, font]}>Know the Gospel.{'\n'}Share the Gospel.</Text>
          <Text style={[styles.heroBody, font]}>Whether you're here for yourself or someone else, begin with the same good news.</Text>
        </View>
        <Card icon="heart-outline" title="Go through the Gospel" body="Read it yourself or walk through it with someone beside you." onPress={() => go('mode')} />
        <Card icon="people-outline" title="People I'm praying for" body="Remember people, conversations, and follow-up." onPress={() => go('people')} />
        <Card icon="heart-outline" title="Shared responses" body="See only responses people chose to share with you." onPress={() => openSharedResponses()} />
        <View style={styles.divider} />
        <Card icon="paper-plane-outline" title="Send the Gospel" body="Let someone read it privately on their own device." onPress={() => openSend()} />
        <Text style={[styles.privacy, font]}>No spiritual response is required to access or share the Gospel.</Text>
      </>;
    }

    if (view === 'mode') {
      return <>
        <Text style={[styles.eyebrowCenter, font]}>BEFORE WE BEGIN</Text>
        <Text style={[styles.title, styles.center, font]}>Who is going through this?</Text>
        <Text style={[styles.body, styles.center, font]}>This only changes how the conversation begins. The Gospel itself stays the same.</Text>
        <Card icon="person-outline" title="I'm reading for myself" body="I want to understand or return to the Gospel." onPress={() => startPlayer('app_self')} />
        <Card icon="people-outline" title="Someone is with me" body="We'll go through it together." onPress={() => go('together-person')} />
        <View style={styles.note}><Text style={[styles.noteText, font]}>When someone is with you, begin with three gentle questions so you can listen before presenting the Gospel.</Text></View>
      </>;
    }

    if (view === 'together-person') {
      return <>
        <Text style={[styles.eyebrowCenter, font]}>GO THROUGH IT TOGETHER</Text>
        <Text style={[styles.title, styles.center, font]}>Who is with you?</Text>
        <Text style={[styles.body, styles.center, font]}>Choose someone you’re praying for, or enter a name or initial. If they choose to save their response at the end, it will appear with today’s date.</Text>
        {people.map(person => (
          <Card
            key={person.id}
            icon="person-outline"
            title={person.displayName}
            body="Keep their response connected to their name."
            onPress={() => startTogether(person.id)}
          />
        ))}
        <TextInput
          accessibilityLabel="Name or initial for Gospel response"
          value={togetherResponderName}
          onChangeText={setTogetherResponderName}
          placeholder="Someone else’s name or initial..."
          placeholderTextColor="#7A857F"
          style={[styles.walkthroughInput, font]}
          keyboardAppearance="light"
          returnKeyType="next"
          onSubmitEditing={() => togetherResponderName.trim() && startTogether(undefined, togetherResponderName)}
        />
        <Action
          label="Begin together →"
          onPress={() => startTogether(undefined, togetherResponderName)}
          disabled={!togetherResponderName.trim()}
        />
        <Action label="Continue without a name" onPress={() => startTogether()} quiet />
      </>;
    }

    if (view === 'listen') {
      const isPermission = listenIndex === LISTEN_FIRST_QUESTIONS.length;
      return <>
        <Text style={[styles.eyebrowCenter, font]}>{isPermission ? 'NOW SHARE' : `LISTEN · ${listenIndex + 1} OF 3`}</Text>
        <Text style={[styles.title, styles.center, font]}>{isPermission ? 'Can I show you what the Bible says?' : LISTEN_FIRST_QUESTIONS[listenIndex]}</Text>
        <Text style={[styles.body, styles.center, font]}>{isPermission ? 'About God, our problem, what Jesus has done, and how we can receive eternal life.' : 'Let them answer honestly. You can talk about their answer before continuing.'}</Text>
        <Action label={isPermission ? 'Begin the Gospel →' : 'Continue →'} onPress={() => isPermission ? go('player') : setListenIndex(value => value + 1)} />
        <Text style={[styles.privacy, font]}>These listening answers are not saved.</Text>
      </>;
    }

    if (view === 'player') {
      const page = GOSPEL_PAGES[pageIndex];
      return <>
        {page.eyebrow ? <Text style={[styles.eyebrow, (page.centered || page.eyebrowCentered) && styles.center, font]}>{page.eyebrow}</Text> : null}
        {page.id === 'risen' ? (
          <DirectionalReveal animationKey={staggerKey} delay={0} fromX={30} reduceMotion={reduceMotion}><View style={styles.risenTitleBlock}>
            <View style={styles.risenTitleRow}>
              <Text style={[styles.risenTitleText, styles.risenJesusTitle]}>Jesus</Text>
              <RosePop animationKey={staggerKey} reduceMotion={reduceMotion}><View style={styles.risenRosePill}><Text style={styles.risenRoseText}>rose</Text></View></RosePop>
              <Text style={[styles.risenTitleText, font]}>from</Text>
            </View>
            <Text style={[styles.risenTitleText, font]}>the dead.</Text>
          </View></DirectionalReveal>
        ) : <Text style={[styles.title, page.centered && styles.center, font, page.serifTitle && styles.titleSerif, page.id === 'only-way' && styles.onlyWayTitle]}>
          {page.id === 'death-kinds' ? <>
            {'The Bible talks about different kinds of '}<Text style={styles.deathKindsTitleEmphasis}>death</Text>{'.'}
          </> : page.id === 'jesus' ? <>
            <Text style={styles.jesusTitleEmphasis}>Jesus Christ</Text>{" is God's only way to eternal life."}
          </> : page.id === 'faith' ? <>
            {'We must place our faith in '}<Text style={styles.jesusTitleEmphasis}>Jesus Christ</Text>{' to save us.'}
          </> : page.id === 'faith-followup' ? <>
            {'We are saved by God’s grace through faith in Jesus Christ '}<Text style={styles.faithAloneEmphasis}>alone</Text>{'.'}
          </> : page.title}
        </Text>}
        {page.body && page.id !== 'faith' ? page.id === 'risen' ? <DirectionalReveal animationKey={staggerKey} delay={110} fromX={30} reduceMotion={reduceMotion}><Text style={[styles.body, styles.center, font, styles.risenBody]}>
          {'His resurrection proves that\n'}<Text style={styles.risenBodyEmphasis}>{'He is'}</Text>{'\n'}<Text style={styles.risenBodyEmphasis}>{'the Son of God,\nthe Messiah,\nthe only Savior'}</Text>
        </Text></DirectionalReveal> : <Text style={[styles.body, page.centered && styles.center, font, page.id === 'effort' && styles.effortLead, page.id === 'jesus' && styles.jesusBody]}>
          {page.id === 'risen' ? <>
            {'His resurrection proves that\n'}<Text style={styles.risenBodyEmphasis}>{'He is'}</Text>{'\n'}<Text style={styles.risenBodyEmphasis}>{'the Son of God,\nthe Messiah,\nthe only Savior'}</Text>
          </> : page.body}
        </Text> : null}
        {page.id === 'only-way' && page.scriptures?.map(scripture => (
          <Text key={scripture.ref} style={styles.onlyWayVerse}>
            {'In '}<Text style={[styles.onlyWayReference, font]}>{scripture.ref.toUpperCase()}</Text>{`, ${scripture.text}`}
          </Text>
        ))}
        {page.id !== 'jesus' && page.id !== 'risen' && page.id !== 'faith' && page.id !== 'faith-followup' && page.id !== 'only-way' && page.id !== 'trust' && page.scriptures?.map(scripture => <View key={scripture.ref} style={styles.scriptureCard}>
          <Text style={styles.scriptureText}>{scripture.text}</Text>
          <Text style={[styles.scriptureRef, font]}>{scripture.ref.toUpperCase()}</Text>
        </View>)}
        {page.truths?.map((truth, index) => <View key={truth.ref} style={styles.truthCard}>
          <View style={styles.truthNumber}>
            <Text style={[styles.truthNumberText, font]}>{index + 1}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.truthTitle}>{truth.title}</Text>
            <Text style={styles.truthText}>{truth.text}</Text>
            <Text style={[styles.scriptureRef, styles.truthReference, font]}>{truth.ref.toUpperCase()}</Text>
          </View>
        </View>)}
        {page.id === 'effort' && page.points ? (
          <>
            <View style={styles.effortGrid}>
              {page.points.map((point, pointIndex) => (
                <View key={point.title} style={styles.effortColumnSlot}>
                  {staggerControl(<View style={styles.effortColumn}>
                    <Text style={[styles.effortTitle, font]}>{point.title}</Text>
                    <Text style={[styles.effortBody, font]}>{point.body}</Text>
                  </View>, pointIndex, `effort-${point.title}`)}
                </View>
              ))}
            </View>
            <Text style={[styles.effortLead, styles.effortQuestion]}>are the solution.</Text>
          </>
        ) : null}
        {page.id !== 'death-kinds' && page.id !== 'effort' && page.points?.map((point, index) => page.id === 'death' ? (
          <View key={point.title} style={styles.deathStatement}>
            <Text style={styles.deathVerse}>“For sin pays{'\n'}its wage—{'\n'}<Text style={styles.deathWord}>death;</Text>”</Text>
            {point.reference ? <Text style={[styles.deathReference, font]}>{point.reference.toUpperCase()}</Text> : null}
          </View>
        ) : page.id === 'sin' ? (
          <View key={point.title} style={styles.sinStatement}>
            <Text style={styles.sinStatementTitle}>
              <Text style={styles.sinStatementEveryone}>Everyone</Text>{'\n'}has sinned.
            </Text>
          </View>
        ) : <View key={point.title} style={styles.step}>
          {(page.points?.length ?? 0) > 1 && <View style={styles.stepNumber}><Text style={[styles.stepNumberText, font]}>{index + 1}</Text></View>}
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, font]}>{point.title}</Text>
            <Text style={[styles.cardBody, font]}>{point.body}</Text>
            {point.reference ? <Text style={[styles.reference, styles.pointRef, font]}>{point.reference}</Text> : null}
          </View>
        </View>)}
        {page.choices?.map((choice, choiceIndex) => {
          const answered = pickedChoice !== null;
          const isCorrect = choice.correct === true;
          const isSelected = pickedChoice === choiceIndex;
          const showFeedback = pickedChoice === choiceIndex && choice.feedback;
          const formulaTerm = choiceIndex === 0 ? 'good works' : 'nothing from us';
          return <TouchableOpacity key={choice.text} style={[styles.choice, page.id === 'understanding' && styles.formulaChoice, isSelected && styles.choiceSelected, page.id === 'understanding' && isSelected && (isCorrect ? styles.formulaChoiceCorrect : styles.formulaChoiceWrong)]} onPress={withLightHaptic(() => setPickedChoice(choiceIndex))} accessibilityRole="button">
            <View style={[styles.radio, isSelected && styles.radioSelected, page.id === 'understanding' && isSelected && !isCorrect && styles.radioWrong]} />
            <View style={styles.flex}>
              {page.id === 'understanding' ? <>
                <View style={styles.formulaStack}>
                  <Text style={styles.formulaFaith}>Faith in Jesus</Text>
                  <View style={styles.formulaLine}>
                    <Text style={[styles.formulaOperator, font]}>+</Text>
                    <Text style={[styles.formulaTerm, font]}>{formulaTerm}</Text>
                  </View>
                  <View style={styles.formulaDivider} />
                  <View style={styles.formulaLine}>
                    <Text style={[styles.formulaOperator, font]}>=</Text>
                    <Text style={styles.formulaResult}>salvation</Text>
                    {choice.detail ? <>
                      <Text style={[styles.formulaOperator, font]}>→</Text>
                      <Text style={[styles.formulaDetail, font]}>{choice.detail}</Text>
                    </> : null}
                  </View>
                </View>
              </> : <>
                <Text style={[styles.choiceText, (isCorrect && answered) && styles.choiceTextCorrect, font]}>{choice.text}</Text>
                {choice.detail ? <Text style={[styles.choiceDetail, font]}>{choice.detail}</Text> : null}
              </>}
              {showFeedback ? <Text style={[styles.choiceFeedback, isCorrect ? styles.choiceFeedbackRight : styles.choiceFeedbackWrong, page.id === 'understanding' && (isCorrect ? styles.formulaFeedbackRight : styles.formulaFeedbackWrong), font]}>{choice.feedback}</Text> : null}
            </View>
          </TouchableOpacity>;
        })}
        {page.references?.length ? <View style={styles.references}>{page.references.map(reference => <Text key={reference} style={[styles.reference, font]}>{reference}</Text>)}</View> : null}
        {page.note ? page.id === 'intro' ? (
          <View
            style={styles.introStatement}
            accessible
            accessibilityLabel={page.note}>
            <Text style={styles.introStatementText}>
              <Text style={styles.introStatementBold}>The Gospel</Text> speaks to a decision with
            </Text>
            <View style={styles.introStatementEnding}>
              {staggerControl(<View style={styles.eternalPill}>
                <Text style={styles.eternalPillText}>eternal</Text>
              </View>, 0)}
              <Text style={styles.introStatementText}>significance.</Text>
            </View>
          </View>
        ) : (page.id === 'effort' || page.id === 'understanding') ? null : <View style={styles.note}><Text style={[styles.noteText, page.noteCentered === false && styles.noteTextLeft, font]}>{page.note}</Text></View> : null}
        <View style={styles.playerAction}>
          {page.id === 'death-kinds' && page.points ? (
            <View style={styles.deathKindsGrid}>
              {page.points.map((point, pointIndex) => (
                <View key={point.title} style={styles.deathKindColumn}>
                  {staggerControl(<View style={styles.deathKindTitlePill}>
                    <Text style={[styles.deathKindTitle, font]}>{point.title.toUpperCase()}</Text>
                  </View>, pointIndex)}
                  {point.subtitle ? <Text style={styles.deathKindSubtitle}>{point.subtitle}</Text> : null}
                  <Text style={styles.deathKindVerse}>“{point.body}”</Text>
                  {point.reference ? <Text style={[styles.deathKindReference, font]}>{point.reference.toUpperCase()}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
          {page.id === 'sin' && page.points?.[0]?.reference ? (
            <Text style={styles.sinBottomVerse}>
              <Text style={[styles.sinBottomReference, font]}>{page.points[0].reference.toUpperCase()} </Text>
              says, “{page.points[0].body}”
            </Text>
          ) : null}
          {page.id === 'effort' ? (
            <Text style={styles.effortBottomStatement}>
              {'There is only '}<Text style={styles.effortBottomEmphasis}>one</Text>{' solution from '}<Text style={styles.effortBottomEmphasis}>God</Text>{'.'}
            </Text>
          ) : null}
          {(page.id === 'jesus' || page.id === 'risen' || page.id === 'faith' || page.id === 'faith-followup') && page.scriptures ? (
            <View style={styles.jesusBottomScripture}>
              {page.id === 'faith' && page.body ? <Text style={styles.faithBottomLead}>{page.body}</Text> : null}
              {page.scriptures.map(scripture => (
                page.id === 'risen' ? <DirectionalReveal key={scripture.ref} animationKey={staggerKey} delay={220} fromX={-30} reduceMotion={reduceMotion}>
                  <View>
                    <Text style={[styles.jesusBottomVerse, styles.risenBottomVerse]}>{scripture.text}</Text>
                    <Text style={[styles.jesusBottomReference, styles.risenBottomReference, font]}>{scripture.ref.toUpperCase()}</Text>
                  </View>
                </DirectionalReveal> : <View key={scripture.ref}>
                  <Text style={[styles.jesusBottomVerse, page.id === 'risen' && styles.risenBottomVerse]}>{scripture.text}</Text>
                  <Text style={[styles.jesusBottomReference, page.id === 'risen' && styles.risenBottomReference, font]}>{scripture.ref.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {page.id === 'understanding' && page.note ? (
            <Text style={styles.understandingBottomNote}>{page.note}</Text>
          ) : null}
          {page.id === 'trust' && page.scriptures ? (
            <View style={styles.trustScriptureGrid}>
              {page.scriptures.map(scripture => (
                <View key={scripture.ref} style={styles.trustScriptureColumn}>
                  <Text style={styles.trustScriptureVerse}>“{scripture.text}”</Text>
                  <Text style={[styles.trustScriptureReference, font]}>{scripture.ref.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {staggerControl(<Action label={page.cta || (pageIndex === GOSPEL_PAGES.length - 1 ? "I'm ready to respond →" : 'Continue →')} onPress={continuePlayer} serifItalic={page.id === 'jesus'} trailingArrow={page.id === 'jesus'} />, 4)}
        </View>
      </>;
    }

    if (view === 'promise') {
      return <>
        <Text style={[styles.eyebrowCenter, styles.responseFlowEyebrow, font]}>GOD'S PROMISE</Text>
        <Text style={[styles.promiseTitle, font]}>You can know today that you have eternal life.</Text>
        <Text style={styles.promiseSubtitle}>When you trust in Jesus.</Text>
        <View style={styles.promiseBottom}>
          <Text style={styles.promiseVerse}>{GOSPEL_RESPONSE_ASSURANCE.scripture.text}</Text>
          <Text style={[styles.promiseReference, font]}>{GOSPEL_RESPONSE_ASSURANCE.scripture.ref.toUpperCase()}</Text>
          {staggerControl(<Action label="What does this mean for me? →" onPress={() => go('response')} />, 3)}
        </View>
      </>;
    }

    if (view === 'response') {
      return <>
        <Text style={[styles.eyebrowCenter, styles.responseFlowEyebrow, font]}>THIS IS PERSONAL</Text>
        <Text style={[styles.responseConsequence, font]}>{GOSPEL_RESPONSE_ASSURANCE.consequence}</Text>
        <Text style={[styles.responseQuestion, font]}>
          {'Are you willing to make the decision to trust and follow '}<Text style={styles.responseDecisionEmphasis}><Text style={styles.responseJesus}>Jesus</Text>{' as your Lord and Savior?'}</Text>
        </Text>
        <View style={styles.responseActions}>
          <Text style={[styles.responseChoicePrompt, font]}>Choose what honestly describes where you are today.</Text>
          {RESPONSE_OPTIONS.map((option, optionIndex) => staggerControl(<TouchableOpacity style={[styles.choice, response === option.value && styles.choiceSelected]} onPress={withLightHaptic(() => setResponse(option.value))}>
            <View style={[styles.radio, response === option.value && styles.radioSelected]} />
            <Text style={[styles.choiceText, font]}>{option.label}</Text>
          </TouchableOpacity>, optionIndex, option.value))}
          {staggerControl(<Action label="Continue →" onPress={submitResponse} disabled={!response} />, 5)}
        </View>
      </>;
    }

    if (view === 'prayer') {
      return <>
        <Text style={[styles.eyebrowCenter, font]}>PRAY THIS ALOUD IN FAITH</Text>
        <Text style={[styles.title, styles.center, font]}>Talk to Jesus.</Text>
        <Text style={[styles.body, styles.center, font]}>Prayer doesn't earn salvation. If this expresses the faith of your heart, pray it aloud—confess with your mouth that Jesus is Lord. (Romans 10:9)</Text>
        <View style={styles.prayerBottom}>
          <View style={styles.prayerCard} accessible accessibilityLabel={GOSPEL_PRAYER}>
            <Text style={styles.prayerText}>
              <Text style={styles.prayerEmphasis}>Lord Jesus,</Text>
              {'\nthank You so much for loving me. I confess that I have sinned against you. Thank You for dying on the cross for my sins.\n\nToday, I put my trust in You as my Lord and Savior. I accept Your free gift of eternal life and '}
              <Text style={styles.prayerEmphasis}>I surrender my life to You</Text>
              {'.\n\nThank You for forgiving my sins. From this day on, '}
              <Text style={styles.prayerEmphasis}>I choose </Text>
              {'to follow You.'}
              <Text style={styles.prayerAmen}>{'\n\nAmen.'}</Text>
            </Text>
          </View>
          {staggerControl(<Action label="I trust Jesus today →" onPress={() => go('assurance-intro')} />, 3)}
        </View>
      </>;
    }

    if (view === 'assurance-intro') {
      return <>
        <LifeMark showBirds />
        <Text style={[styles.title, styles.center, font]}>Your eternal life with God begins today.</Text>
        <View style={styles.playerAction}>
          <Text style={styles.birthdayVerse}>I am writing this to you so that you may know that you have eternal life—you that believe in the Son of God.</Text>
          <Text style={[styles.birthdayVerseReference, font]}>1 JOHN 5:13</Text>
          {staggerControl(<Action label="Continue →" onPress={() => go('assurance')} />, 3)}
        </View>
      </>;
    }

    if (view === 'assurance') {
      return <>
        <LifeMark />
        <Text style={[styles.title, styles.center, font]}>Your eternal life with God begins today.</Text>
        <View style={styles.assuranceBottom}>
          {ASSURANCE_ITEMS.map(item => {
            const expanded = expandedAssurance === item.id;
            return staggerControl(
              <TouchableOpacity
                style={[styles.assuranceCard, expanded && styles.assuranceCardExpanded]}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={withLightHaptic(() => setExpandedAssurance(current => current === item.id ? null : item.id))}>
                <View style={styles.assuranceCardHeader}>
                  <View style={styles.iconBox}>
                    {item.id === 'forgiven'
                      ? <View style={styles.crossIcon} accessible={false}>
                          <View style={styles.crossIconVertical} />
                          <View style={styles.crossIconHorizontal} />
                        </View>
                      : <Ionicons name={item.icon} size={22} color={Colors.sage} />}
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.cardTitle, font]}>{item.title}</Text>
                    <Text style={[styles.assuranceTruth, font]}>{item.truth}</Text>
                    {'detail' in item ? <Text style={[styles.assuranceDetail, font]}>({item.detail})</Text> : null}
                  </View>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={Colors.sage} />
                </View>
                <View style={[styles.assuranceVerseBlock, !expanded && styles.assuranceVerseBlockCollapsed]}>
                  {expanded ? <Text style={styles.assuranceVerse}>{item.verse}</Text> : null}
                  <Text style={[styles.assuranceReference, !expanded && styles.assuranceReferenceCollapsed, font]}>{item.reference.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>, item.id === 'forgiven' ? 0 : item.id === 'new-life' ? 1 : 2, item.id);
          })}
          {staggerControl(<Action label="Continue →" onPress={() => go('next-steps')} />, 5)}
        </View>
      </>;
    }

    if (view === 'birthday') {
      const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      return <>
        <Animated.View style={[styles.birthdayCelebration, {
          transform: [{ translateY: birthdayReveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }]}>
          <Text style={[styles.eyebrow, styles.birthdayEyebrow, font]}>TODAY</Text>
          <Text style={styles.birthdayDeclaration}>
            <Text style={styles.birthdayDecision}>I trusted in Jesus to be my Lord and Savior</Text>
            {' and I accepted His '}<Text style={styles.birthdaySerifEmphasis}>free gift of eternal life</Text>
            {'. From now on, I will '}<Text style={styles.birthdaySerifEmphasis}>follow Jesus for the rest of my life</Text>{'.'}
          </Text>
        </Animated.View>
        <View style={styles.birthdayBottom}>
          <Text style={[styles.birthdayDatePrompt, font]}>{mode === 'app_together'
            ? 'They can choose to save this response and date for your follow-up.'
            : 'Save this date as a personal reminder of your commitment.'}</Text>
          <View style={styles.dateCard}>
            <Text style={[styles.dateCardLabel, font]}>DATE</Text>
            <Text style={[styles.dateCardValue, font]}>{today}</Text>
          </View>
          {mode === 'app_together'
            ? <>
                {staggerControl(<Action label="Save response & finish" onPress={() => saveTrustedResponse(true)} />, 3)}
                {staggerControl(<Action label="Finish without saving response" onPress={() => saveTrustedResponse(false)} quiet />, 4)}
              </>
            : <>
                {staggerControl(<Action label="Save & finish" onPress={() => saveTrustedResponse(true)} />, 3)}
                {staggerControl(<Action label="Finish without saving" onPress={() => saveTrustedResponse(false)} quiet />, 4)}
              </>}
        </View>
      </>;
    }

    if (view === 'next-steps') {
      return <>
        <Text style={[styles.growthTitle, styles.nextStepsTitle, font]}>You now have a very <Text style={styles.growthTitleEmphasis}>personal and permanent</Text> relationship with the Lord Jesus Christ.</Text>
        <View style={styles.growthContent}>
          {staggerControl(<Text style={[styles.growthLead, font]}>To grow in your relationship with Him:</Text>, 0, 'growth-lead')}
          {staggerControl(<View style={styles.growthItem}>
            <View style={styles.growthIcon}><PrayerHandsIcon size={23} color={Colors.sage} strokeWidth={1.8} /></View>
            <View style={styles.flex}>
              <Text style={[styles.growthItemTitle, font]}>Pray to Him every day</Text>
              <Text style={[styles.growthItemBody, font]}>This is how we talk to God.</Text>
            </View>
          </View>, 0.6, 'growth-prayer')}
          {staggerControl(<TouchableOpacity
            style={styles.growthItem}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityState={{ expanded: readingGuideExpanded }}
            onPress={withLightHaptic(() => setReadingGuideExpanded(current => !current))}>
            <View style={styles.growthIcon}><MaterialCommunityIcons name="book-open-page-variant-outline" size={23} color={Colors.sage} /></View>
            <View style={styles.flex}>
              <View style={styles.growthItemHeading}>
                <Text style={[styles.growthItemTitle, styles.flex, font]}>Read the Bible</Text>
                <Ionicons name={readingGuideExpanded ? 'chevron-up' : 'chevron-down'} size={19} color={Colors.sage} />
              </View>
              <Text style={[styles.growthItemBody, font]}>This is how God talks to you.</Text>
              {readingGuideExpanded ? <View style={styles.readingGuide}>
                <View style={styles.readingStep}>
                  <Ionicons name="bookmark-outline" size={15} color={Colors.sage} />
                  <Text style={[styles.readingStepText, font]}><Text style={styles.readingStepStrong}>Begin with John</Text>{' · The Gospel of John is a beautiful place to know Jesus.'}</Text>
                </View>
                <View style={styles.readingStep}>
                  <Ionicons name="calendar-outline" size={15} color={Colors.sage} />
                  <Text style={[styles.readingStepText, font]}><Text style={styles.readingStepStrong}>One chapter a day</Text>{' · Read slowly and consistently.'}</Text>
                </View>
                <View style={styles.readingStep}>
                  <Ionicons name="sparkles-outline" size={15} color={Colors.sage} />
                  <Text style={[styles.readingStepText, font]}><Text style={styles.readingStepStrong}>Ask the Holy Spirit</Text>{' · Pray for help to understand what you read.'}</Text>
                </View>
              </View> : null}
            </View>
          </TouchableOpacity>, 1.25, 'read-bible')}
          {FIRST_STEPS.slice(2).map(([title, body], index) => {
            const icons = ['account-group-outline', 'church', 'share-variant-outline'] as const;
            return staggerControl(<View style={styles.growthItem}><View style={styles.growthIcon}><MaterialCommunityIcons name={icons[index]} size={23} color={Colors.sage} /></View><View style={styles.flex}><Text style={[styles.growthItemTitle, font]}>{title}</Text><Text style={[styles.growthItemBody, font]}>{body}</Text></View></View>, index + 3, `growth-${title}`);
          })}
          {staggerControl(<Action label="Continue →" onPress={() => go('birthday')} />, 6, 'growth-continue')}
        </View>
      </>;
    }

    if (view === 'spiritual-birthday') {
      const selectedDate = spiritualBirthdayDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      return <>
        <Text style={[styles.eyebrowCenter, font]}>REMEMBER GOD'S GRACE</Text>
        <Text style={[styles.title, styles.center, font]}>Would you like to save your spiritual birthday?</Text>
        <Text style={[styles.body, styles.center, font]}>This is the day you said yes to Jesus and began following Him. Save it as a personal reminder of God’s grace in your life.</Text>
        <TouchableOpacity
          style={styles.dateCard}
          activeOpacity={0.76}
          accessibilityRole="button"
          accessibilityLabel={`Choose spiritual birthday. ${selectedDate}`}
          onPress={withLightHaptic(() => setShowSpiritualBirthdayPicker(current => !current))}>
          <View style={styles.spiritualBirthdayDateRow}>
            <View style={styles.flex}>
              <Text style={[styles.dateCardLabel, font]}>THE DAY I SAID YES</Text>
              <Text style={[styles.dateCardValue, font]}>{selectedDate}</Text>
            </View>
            <Ionicons name="calendar-outline" size={22} color={Colors.sage} />
          </View>
        </TouchableOpacity>
        {showSpiritualBirthdayPicker ? <View style={styles.spiritualBirthdayPicker}>
          <DateTimePicker
            value={spiritualBirthdayDate}
            minimumDate={new Date(1900, 0, 1)}
            maximumDate={new Date()}
            mode="date"
            display="spinner"
            style={styles.spiritualBirthdayDatePicker}
            textColor={Colors.text}
            themeVariant="light"
            onChange={(event, value) => {
              if (Platform.OS === 'android') {
                setShowSpiritualBirthdayPicker(false);
              }
              if (event.type !== 'dismissed' && value) {
                setSpiritualBirthdayDate(value);
              }
            }}
          />
        </View> : null}
        <View style={styles.spiritualBirthdayActions}>
          <Action label="Save my spiritual birthday" onPress={() => finishAlreadyFollowingResponse(true)} />
          <Action label="Not now" onPress={() => finishAlreadyFollowingResponse(false)} quiet />
        </View>
      </>;
    }

    if (view === 'other') {
      const responderName = people.find(person => person.id === recipientId)?.displayName || togetherResponderName.trim();
      const canAddToPrayerList = mode === 'app_together'
        && !recipientId
        && Boolean(responderName)
        && (response === 'has_questions' || response === 'not_ready');
      return <>
        <Text style={[styles.eyebrowCenter, font]}>{response === 'already_follows_jesus' ? 'GRACE FOR EVERY DAY' : 'THANK YOU FOR ANSWERING'}</Text>
        <Text style={[styles.title, styles.center, font]}>{responseCopy[0]}</Text>
        <Text style={[styles.body, styles.center, font]}>{responseCopy[1]}</Text>
        {response === 'already_follows_jesus'
          ? <View style={styles.gospelQuoteCard}>
              <View style={styles.gospelQuoteAccent} />
              <View style={styles.flex}>
                <Text style={styles.gospelQuoteText}>Preach the gospel to yourself every day.</Text>
                <Text style={styles.gospelQuoteAttribution}>JERRY BRIDGES · THE DISCIPLINE OF GRACE</Text>
              </View>
            </View>
          : response === 'has_questions'
            ? <Card
                icon="book-outline"
                title={mode === 'app_together' ? 'Questions can be a beginning.' : 'Keep seeking what is true.'}
                body={mode === 'app_together' ? 'Keep praying, listen well, and follow up as they continue exploring who Jesus is.' : 'Read Scripture, bring your questions to a mature Christian, and keep looking carefully at Jesus.'}
              />
            : <Card
                icon="heart-outline"
                title={mode === 'app_together' ? 'This is not the end of the story.' : 'Be honest about where you are.'}
                body={mode === 'app_together' ? 'Keep praying, stay present, and follow up with care. Their response can change over time.' : 'You can keep reading Scripture, ask questions, and talk with the person who shared this with you.'}
              />}
        {mode === 'app_self' && (response === 'has_questions' || response === 'not_ready')
          ? <Text style={[styles.privacy, font]}>Your response is saved on this device, so you can return to the Gospel from where you are today.</Text>
          : null}
        {mode === 'app_together' ? canAddToPrayerList ? <>
          <Action label={`Save response & keep praying for ${responderName}`} onPress={() => finishGospelExperience(true, true)} />
          <Action label="Save response only" onPress={() => finishGospelExperience(true)} secondary />
          <Action label="Finish without saving response" onPress={() => finishGospelExperience(false)} quiet />
        </> : <>
          <Action label="Save response & finish" onPress={() => finishGospelExperience(true)} />
          <Action label="Finish without saving response" onPress={() => finishGospelExperience(false)} quiet />
        </> : <Action label="Finish" onPress={() => finishGospelExperience(false)} />}
      </>;
    }

    if (view === 'people') {
      return <>
        <View style={styles.walkthroughLabel}>
          <Ionicons name="paper-plane-outline" size={16} color={Colors.sage} />
          <Text style={[styles.walkthroughEyebrow, font]}>GOSPEL TRACK</Text>
        </View>
        <Text style={[styles.walkthroughTitle, font]}>Pray. Share. Follow up.</Text>
        <Text style={[styles.walkthroughDescription, font]}>Keep track of the people you are praying will know Christ, then share the Gospel and follow up with care.</Text>
        <Card icon="person-add-outline" title="Add someone to pray for" body="Pray for them and prepare to share the Gospel" onPress={() => go('add-person-name')} />
        {people.map(person => {
          const prayerStartedAt = formatPrayerStartedAt(person);
          const acceptance = shareEvents.find(event =>
            event.personId === person.id && event.response === 'trusted_jesus_today',
          );
          const acceptedAt = formatGospelHistoryDate(acceptance?.sharedAt);
          return <View key={person.id} style={styles.personCard}>
            <View style={styles.personCardHeader}>
              <View style={styles.personInitial}><Text style={[styles.personInitialText, font]}>{person.displayName.charAt(0).toUpperCase()}</Text></View>
              <View style={styles.flex}>
                <View style={styles.personNameRow}>
                  <Text style={[styles.cardTitle, styles.flex, font]} numberOfLines={1}>{person.displayName}</Text>
                  {acceptance ? <View style={styles.personAnsweredBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={Colors.sage} />
                    <Text style={[styles.personAnsweredBadgeText, font]}>Answered prayer</Text>
                  </View> : null}
                </View>
                <Text style={[styles.cardBody, font]}>{person.note || 'Praying that they will know Christ and for an opportunity to share the Gospel.'}</Text>
              </View>
            </View>
            <View style={styles.personCardFooter}>
              <View style={styles.personHistory}>
                {prayerStartedAt ? <Text style={[styles.personHistoryText, font]}>Began praying · {prayerStartedAt}</Text> : null}
                {acceptedAt ? (
                <View style={styles.personAnsweredHistory}>
                  <Ionicons name="checkmark-circle" size={15} color={Colors.sage} />
                  <Text style={[styles.personAnsweredHistoryText, font]}>Accepted Jesus as Lord and Savior · {acceptedAt}</Text>
                </View>
                ) : null}
              </View>
              <View style={styles.personActions}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Pray for ${person.displayName}`} onPress={withLightHaptic(() => navigation.navigate('PrayersForPeopleWalkthrough', { initialPersonName: person.displayName, initialPrayerType: 'pray-for-someone', skipPersonName: true }))} style={styles.prayButton}>
                  <PrayerHandsIcon size={20} color={Colors.sage} strokeWidth={2.2} />
                </TouchableOpacity>
                {!acceptance ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Send the Gospel to ${person.displayName}`} onPress={withLightHaptic(() => openSend(person.id))} style={styles.prayButton}>
                  <Ionicons name="paper-plane-outline" size={19} color={Colors.sage} />
                </TouchableOpacity> : null}
              </View>
            </View>
          </View>;
        })}
        {!people.length ? <Text style={[styles.emptyText, font]}>No one added yet. Names stay on this device and are private to you.</Text> : null}
      </>;
    }

    if (view === 'shared-responses') {
      const peopleById = new Map(people.map(person => [person.id, person]));
      const localResponses: SharedGospelResponse[] = shareEvents
        .filter(event => event.method === 'together' && event.response)
        .map(event => ({
          id: `local-${event.id}`,
          response: event.response as GospelResponse,
          responder_name: event.responderName || null,
          spiritual_birthday: event.spiritualBirthday || null,
          optional_message: null,
          consented_at: event.sharedAt,
          created_at: event.sharedAt,
          gospel_share_links: {
            id: `local-${event.id}`,
            person_id: event.personId || null,
            created_at: event.sharedAt,
          },
        }));
      const allResponses = [...localResponses, ...sharedResponses]
        .sort((a, b) => new Date(b.consented_at).getTime() - new Date(a.consented_at).getTime());
      const visibleResponses = allResponses.filter(item => {
        const isPraying = peopleById.has(item.gospel_share_links.person_id || '');
        return responseFilter === 'all' || (responseFilter === 'praying' ? isPraying : !isPraying);
      });
      const responseLabels: Record<SharedGospelResponse['response'], string> = {
        trusted_jesus_today: 'Accepted Jesus as Lord and Savior.',
        has_questions: 'I have questions.',
        not_ready: 'I’m not ready yet.',
        already_follows_jesus: 'I already trust and follow Jesus.',
      };
      return <>
        <Text style={[styles.eyebrow, font]}>SHARED WITH YOU</Text>
        <Text style={[styles.title, font]}>Responses</Text>
        <Text style={[styles.body, font]}>Only answers people chose to share appear here. Their reading activity stays private.</Text>
        <View style={styles.filterRow}>
          {([['all', 'Everyone'], ['praying', "People I'm praying for"], ['others', 'Other recipients']] as const).map(([value, label]) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: responseFilter === value }}
              activeOpacity={0.75}
              onPress={withLightHaptic(() => setResponseFilter(value))}
              style={[styles.filterPill, responseFilter === value && styles.filterPillActive]}>
              <Text style={[styles.filterPillText, responseFilter === value && styles.filterPillTextActive, font]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {loadingSharedResponses ? <Text style={[styles.emptyText, font]}>Loading responses…</Text> : null}
        {!loadingSharedResponses && !visibleResponses.length ? (
          <View style={styles.responsesEmptyState} accessibilityRole="summary">
            <Ionicons testID="shared-responses-empty-icon" name="chatbubbles-outline" size={32} color={Colors.textGray} style={styles.responsesEmptyIcon} />
            <Text style={[styles.responsesEmptyTitle, font]}>No Responses Yet</Text>
          </View>
        ) : null}
        {!loadingSharedResponses && visibleResponses.map(item => {
          const person = peopleById.get(item.gospel_share_links.person_id || '');
          return <View key={item.id} style={styles.sharedResponseCard}>
            <Ionicons name="heart-outline" size={21} color={Colors.sage} />
            <View style={styles.flex}>
              <Text style={[styles.sharedResponseName, font]}>{person?.displayName || item.responder_name || 'Someone'}</Text>
              {person && item.responder_name && item.responder_name !== person.displayName ? <Text style={[styles.cardBody, font]}>Shared as {item.responder_name}</Text> : null}
              <Text style={[styles.sharedResponseText, font]}>{responseLabels[item.response]}</Text>
              {item.optional_message ? <Text style={[styles.cardBody, font]}>{item.optional_message}</Text> : null}
              {item.spiritual_birthday ? <Text style={[styles.sharedResponseBirthday, font]}>Spiritual birthday · {formatSpiritualBirthday(item.spiritual_birthday)}</Text> : null}
              {!person && item.responder_name && (item.response === 'has_questions' || item.response === 'not_ready') ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.responder_name} to people I'm praying for`}
                  disabled={linkingResponseIds.includes(item.id)}
                  onPress={withLightHaptic(() => addResponseToPrayerList(item))}
                  style={[styles.sharedResponseTrackButton, linkingResponseIds.includes(item.id) && styles.actionDisabled]}>
                  <PrayerHandsIcon size={16} color={Colors.sage} strokeWidth={2} />
                  <Text style={[styles.sharedResponseTrackText, font]}>{linkingResponseIds.includes(item.id) ? 'Adding…' : 'Add to people I’m praying for'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>;
        })}
      </>;
    }

    if (view === 'add-person-name') {
      return <>
        <View style={styles.walkthroughLabel}>
          <PrayerHandsIcon size={16} color={Colors.sage} />
          <Text style={[styles.walkthroughEyebrow, font]}>PRAY & SHARE</Text>
        </View>
        <Text style={[styles.walkthroughTitle, font]}>Who do you want to share the Gospel with?</Text>
        <Text style={[styles.walkthroughDescription, font]}>Begin by praying that they will come to know Christ.</Text>
        <TextInput
          accessibilityLabel="Name or initial"
          value={personName}
          onChangeText={setPersonName}
          placeholder="Enter their name..."
          placeholderTextColor="#7A857F"
          style={[styles.walkthroughInput, font]}
          autoFocus
          keyboardAppearance="light"
          returnKeyType="next"
          onSubmitEditing={() => personName.trim() && go('add-person-prayer')}
        />
        {personName.trim() ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Continue"
            onPress={withLightHaptic(() => go('add-person-prayer'))}
            style={styles.walkthroughNextButton}>
            <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        ) : null}
      </>;
    }

    if (view === 'add-person-prayer') {
      return <>
        <View style={styles.walkthroughLabel}>
          <PrayerHandsIcon size={16} color={Colors.sage} />
          <Text style={[styles.walkthroughEyebrow, font]}>PRAY & SHARE</Text>
        </View>
        <Text style={[styles.walkthroughTitle, font]}>As you pray for {personName.trim()}, what would help you share the Gospel with them?</Text>
        <Text style={[styles.walkthroughDescription, font]}>Choose anything that fits, or add your own note.</Text>
        <View style={styles.sharePromptPills}>
          {GOSPEL_SHARE_PROMPTS.map(prompt => {
            const selected = selectedSharePrompts.includes(prompt);
            return (
              <TouchableOpacity
                key={prompt}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                activeOpacity={0.75}
                onPress={withLightHaptic(() => setSelectedSharePrompts(current => current.includes(prompt)
                  ? current.filter(item => item !== prompt)
                  : [...current, prompt]))}
                style={[styles.filterPill, selected && styles.filterPillActive]}>
                {selected ? <Ionicons name="checkmark" size={14} color={Colors.hopeWhite} /> : null}
                <Text style={[styles.filterPillText, selected && styles.filterPillTextActive, font]}>{prompt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          accessibilityLabel={`Optional note about ${personName.trim()}`}
          value={personNote}
          onChangeText={setPersonNote}
          placeholder="Add your own note (optional)..."
          placeholderTextColor="#7A857F"
          style={[styles.walkthroughInput, styles.walkthroughMultilineInput, font]}
          multiline
          textAlignVertical="top"
          keyboardAppearance="light"
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Add ${personName.trim()} to people I'm praying for`}
          onPress={withLightHaptic(() => { void addPerson(); })}
          style={styles.walkthroughNextButton}>
          <Ionicons name="checkmark" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </>;
    }

    const lockedRecipient = lockedRecipientId
      ? people.find(person => person.id === lockedRecipientId)
      : undefined;
    const recipientOptions = lockedRecipient
      ? [{id: lockedRecipient.id as string | undefined, label: lockedRecipient.displayName}]
      : [...people.map(person => ({id: person.id as string | undefined, label: person.displayName})), {id: undefined, label: 'Someone else'}];

    return <>
      <View style={styles.walkthroughLabel}>
        <Ionicons name="paper-plane-outline" size={16} color={Colors.sage} />
        <Text style={[styles.walkthroughEyebrow, font]}>SHARE PRIVATELY</Text>
      </View>
      <Text style={[styles.walkthroughTitle, font]}>Send the good news to someone.</Text>
      <Text style={[styles.walkthroughDescription, font]}>They can go through the Gospel privately, on their own device, at their own pace.</Text>
      <Card icon="paper-plane-outline" title="Gospel link" body="No Journal account is required to read it." />
      <Text style={[styles.cardTitle, font]}>Who are you sending it to?</Text>
      <Text style={[styles.cardBody, styles.recipientHelp, font]}>{lockedRecipient
        ? `This private Gospel link will be connected to ${lockedRecipient.displayName}.`
        : "Choose someone you're praying for to keep their shared response with their name, or send to someone else."}</Text>
      {recipientOptions.map(option => (
        <TouchableOpacity key={option.id || 'other-recipient'} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: recipientId === option.id, disabled: sharingGospel || !!lockedRecipient }} disabled={sharingGospel || !!lockedRecipient} onPress={withLightHaptic(() => setRecipientId(option.id))} style={[styles.choice, recipientId === option.id && styles.choiceSelected]}>
          <View style={[styles.radio, recipientId === option.id && styles.radioSelected]} />
          <Text style={[styles.choiceText, font]}>{option.label}</Text>
        </TouchableOpacity>
      ))}
      <View style={styles.note}><Text style={[styles.noteText, font]}>Their reading activity and private response are never visible to you. They can choose whether to share their final response with you.</Text></View>
      <Action label={sharingGospel ? 'Preparing link…' : 'Share the Gospel'} onPress={shareGospel} trailingIcon="paper-plane-outline" disabled={sharingGospel} />
      <Action label="Go through it together instead" onPress={() => startPlayer('app_together')} secondary />
    </>;
  };

  const isPrayShareWalkthrough = view === 'people' || view === 'add-person-name' || view === 'add-person-prayer' || view === 'send';

  return (
    <ImageBackground
      source={gospelBackground}
      style={styles.screenBackground}
      imageStyle={styles.screenBackgroundImage}
      fadeDuration={0}
      resizeMode="cover">
      <View pointerEvents="none" style={styles.imagePreloader} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {GOSPEL_BACKGROUND_SOURCES.map((source, index) => (
          <Image key={index} source={source} style={styles.preloadedImage} fadeDuration={0} />
        ))}
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {renderHeader()}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {!isPrayShareWalkthrough ? <View style={[styles.scrollHeaderSpacer, { paddingTop: insets.top + 8 }]} /> : null}
          <Animated.View style={[
            styles.content,
            isPrayShareWalkthrough && styles.walkthroughContent,
            {
              paddingTop: isPrayShareWalkthrough ? insets.top + 8 : 52,
              paddingBottom: Math.max(insets.bottom + 32, 48),
            },
            (view === 'player' || view === 'promise' || view === 'response' || view === 'prayer' || view === 'assurance-intro' || view === 'assurance' || view === 'birthday' || view === 'next-steps') && styles.playerContent,
          ]}>
            <StaggeredPage animationKey={staggerKey} reduceMotion={reduceMotion || (view === 'player' && GOSPEL_PAGES[pageIndex].id === 'risen')}>{renderContent()}</StaggeredPage>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {undoShareEvent ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.shareUndoToast, {bottom: Math.max(insets.bottom + 18, 24)}]}>
          <View style={styles.shareUndoMessage}>
            <MaterialCommunityIcons name="sprout" size={19} color={Colors.hopeWhite} />
            <Text style={[styles.shareUndoText, font]}>{undoShareEvent.method === 'shared_openly'
              ? 'Open Gospel share recorded'
              : 'Gospel share recorded'}</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Undo Gospel share"
            disabled={savingShare}
            onPress={undoLastShare}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Text style={[styles.shareUndoAction, font]}>Undo</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ImageBackground>
  );
};

const ivorySurface = {
  backgroundColor: 'rgba(255, 253, 248, 0.92)',
  borderWidth: 0,
  shadowColor: '#13251B',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 18,
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  staggerPushToBottom: { marginTop: 'auto' },
  screenBackground: { flex: 1, backgroundColor: Colors.lightBackground },
  screenBackgroundImage: { opacity: 1 },
  imagePreloader: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  preloadedImage: { width: 1, height: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  headerButton: { ...ivorySurface, width: 42, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  headerActions: {flexDirection: 'row', alignItems: 'center', gap: 8},
  shareCounterButton: { ...ivorySurface, minWidth: 54, height: 42, borderRadius: 999, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  shareCounterLabel: {color: Colors.sage, fontSize: 13, lineHeight: 18, fontWeight: '700'},
  shareCounterText: {color: Colors.sage, fontSize: 14, lineHeight: 18, fontWeight: '800', minWidth: 9, textAlign: 'center'},
  shareUndoToast: {position: 'absolute', left: 22, right: 22, zIndex: 50, minHeight: 52, borderRadius: 18, paddingHorizontal: 17, backgroundColor: '#30483A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#13251B', shadowOffset: {width: 0, height: 7}, shadowOpacity: 0.2, shadowRadius: 15, elevation: 8},
  shareUndoMessage: {flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9},
  shareUndoText: {flexShrink: 1, color: Colors.hopeWhite, fontSize: 13, lineHeight: 18, fontWeight: '600'},
  shareUndoAction: {color: '#F2C879', fontSize: 13, lineHeight: 18, fontWeight: '800', marginLeft: 14},
  headerPlaceholder: { width: 42, height: 42 },
  headerCenterSpacer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollHeaderSpacer: { minHeight: 58, paddingBottom: 8 },
  scrollContent: { flexGrow: 1 },
  content: { flexGrow: 1, padding: 22, paddingTop: 52, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  walkthroughContent: { paddingHorizontal: 24 },
  playerContent: { flexGrow: 1 },
  playerAction: { marginTop: 'auto', paddingTop: 24 },
  hero: { backgroundColor: '#30483A', padding: 26, borderRadius: 24, marginTop: 12, marginBottom: 18 },
  heroTitle: { color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '700', marginTop: 7 },
  heroBody: { color: '#E5ECE7', fontSize: 15, lineHeight: 23, marginTop: 12 },
  eyebrow: { color: '#607967', fontSize: 12, fontWeight: '800', letterSpacing: 1.3, marginBottom: 10 },
  eyebrowCenter: { color: '#607967', fontSize: 12, fontWeight: '800', letterSpacing: 1.3, marginBottom: 10, textAlign: 'center', marginTop: 26 },
  title: { color: '#24342C', fontSize: 32, lineHeight: 39, fontWeight: '700', marginBottom: 13 },
  titleSerif: { fontFamily: Fonts.lora.bold, fontSize: 36, lineHeight: 44, fontWeight: '700' },
  birthdayCelebration: { marginTop: 18 },
  birthdayEyebrow: { marginBottom: 12 },
  birthdayDeclaration: { color: '#425248', fontFamily: Fonts.lexend.regular, fontSize: 19, lineHeight: 30, textAlign: 'left' },
  birthdayDecision: { color: '#24342C', fontFamily: Fonts.lexend.bold, fontWeight: '700' },
  birthdaySerifEmphasis: { color: '#30483A', fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic' },
  birthdayDatePrompt: { color: Colors.hopeWhite, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 10 },
  body: { color: '#66736C', fontSize: 16, lineHeight: 25, marginBottom: 24 },
  center: { textAlign: 'center' },
  card: { ...ivorySurface, padding: 16, borderRadius: 24, marginBottom: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#E5ECE5', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#24342C', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  cardBody: { color: '#6F7D75', fontSize: 13.5, lineHeight: 20 },
  gospelQuoteCard: { ...ivorySurface, flexDirection: 'row', alignItems: 'stretch', gap: 16, paddingVertical: 20, paddingHorizontal: 18, borderRadius: 24, marginBottom: 12 },
  gospelQuoteAccent: { width: 4, borderRadius: 999, backgroundColor: Colors.sage },
  gospelQuoteText: { color: '#30483A', fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700', fontSize: 21, lineHeight: 29 },
  gospelQuoteAttribution: { color: '#607967', fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 1.1, marginTop: 12 },
  divider: { height: 1, backgroundColor: '#DCE2DB', marginVertical: 8 },
  privacy: { color: '#758078', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  note: { backgroundColor: '#E5ECE5', padding: 16, borderRadius: 16, marginVertical: 14 },
  noteText: { color: '#425248', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  noteTextLeft: { textAlign: 'left' },
  introStatement: { alignItems: 'center', marginVertical: 22, gap: 7 },
  introStatementEnding: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  introStatementText: { color: '#425248', fontFamily: Platform.select({ ios: 'Georgia', android: Fonts.lora.regular }), fontSize: 19, lineHeight: 28, textAlign: 'center' },
  introStatementBold: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontWeight: '700', fontStyle: 'italic' },
  eternalPill: { backgroundColor: '#E5ECE5', borderWidth: 1, borderColor: '#C9D4CB', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 5 },
  eternalPillText: { color: '#526A59', fontFamily: Platform.select({ ios: 'Georgia-Bold', android: Fonts.lora.bold }), fontSize: 15, lineHeight: 19, fontWeight: '700', letterSpacing: 0.4 },
  action: { minHeight: 52, borderRadius: 999, backgroundColor: Colors.sage, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 16 },
  actionSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.sage, marginTop: 10 },
  actionQuiet: { ...ivorySurface, minHeight: 48, borderRadius: 999, marginTop: 10 },
  actionDisabled: { opacity: 0.45 },
  actionText: { color: Colors.hopeWhite, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  actionTextSerifItalic: { fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontWeight: '400', fontSize: 17 },
  actionTrailingArrow: { position: 'absolute', right: 22 },
  actionSecondaryText: { color: Colors.sage },
  actionQuietText: { color: '#425248', fontWeight: '700' },
  progressTrack: { height: 6, width: 120, backgroundColor: Colors.cardBorder, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.sage, borderRadius: 2 },
  scriptureCard: { paddingVertical: 10, marginBottom: 12 },
  scriptureText: { color: '#30483A', fontFamily: Fonts.lora.regular, fontStyle: 'italic', fontSize: 19, lineHeight: 30, marginBottom: 10 },
  scriptureRef: { color: '#607967', fontSize: 12, fontWeight: '800', letterSpacing: 1.3 },
  truthCard: { ...ivorySurface, flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderRadius: 24, padding: 18, marginBottom: 12 },
  truthNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5ECE5', alignItems: 'center', justifyContent: 'center' },
  truthNumberText: { color: '#526A59', fontSize: 13, fontWeight: '800' },
  truthTitle: { color: '#30483A', fontFamily: Platform.select({ ios: 'Georgia-Bold', android: Fonts.lora.bold }), fontSize: 19, lineHeight: 25, fontWeight: '700', marginBottom: 8 },
  truthText: { color: '#66736C', fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 15, lineHeight: 23 },
  truthReference: { alignSelf: 'flex-start', marginTop: 12 },
  sinStatement: { alignItems: 'center', justifyContent: 'center', marginTop: -36, paddingVertical: 34, paddingHorizontal: 12 },
  sinStatementTitle: { color: '#30483A', fontFamily: Platform.select({ ios: 'Georgia-Bold', android: Fonts.lora.bold }), fontSize: 28, lineHeight: 36, fontWeight: '700', textAlign: 'center' },
  sinStatementEveryone: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic' },
  sinBottomVerse: { color: Colors.hopeWhite, fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: -2 },
  sinBottomReference: { color: Colors.hopeWhite, fontSize: 12, fontWeight: '800', fontStyle: 'normal', letterSpacing: 1.3 },
  deathStatement: { alignItems: 'center', justifyContent: 'center', marginTop: -36, paddingVertical: 24 },
  deathVerse: { color: '#30483A', fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 29, lineHeight: 39, textAlign: 'center' },
  deathWord: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontWeight: '700' },
  deathReference: { color: '#607967', fontSize: 12, fontWeight: '800', letterSpacing: 1.3, marginTop: 16 },
  deathKindsGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 14 },
  deathKindsTitleEmphasis: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700' },
  jesusTitleEmphasis: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700' },
  faithAloneEmphasis: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700' },
  risenJesusTitle: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700' },
  risenTitleBlock: { alignItems: 'flex-end', marginBottom: 13 },
  risenTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  risenTitleText: { color: '#24342C', fontSize: 32, lineHeight: 39, fontWeight: '700' },
  risenRosePill: { minHeight: 38, borderRadius: 19, backgroundColor: Colors.sage, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  risenRoseText: { color: Colors.hopeWhite, fontSize: 24, lineHeight: 29, fontWeight: '800' },
  jesusBody: { fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic' },
  risenBody: { color: '#30483A', fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0, textAlign: 'right' },
  risenBodyEmphasis: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700' },
  onlyWayTitle: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700', fontSize: 36, lineHeight: 44 },
  onlyWayVerse: { color: '#425248', fontFamily: Platform.select({ ios: 'Georgia', android: Fonts.lora.regular }), fontSize: 18, lineHeight: 28, textAlign: 'center', marginTop: 18 },
  onlyWayReference: { color: '#30483A', fontWeight: '800', letterSpacing: 0.8 },
  deathKindColumn: { flex: 1 },
  deathKindTitlePill: { alignSelf: 'flex-start', backgroundColor: '#1F2D27', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, marginBottom: 9 },
  deathKindTitle: { color: Colors.hopeWhite, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 0.8 },
  deathKindSubtitle: { color: Colors.hopeWhite, fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  deathKindVerse: { color: Colors.hopeWhite, fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 14, lineHeight: 22 },
  deathKindReference: { color: Colors.hopeWhite, fontSize: 10, fontWeight: '800', letterSpacing: 0.9, marginTop: 8 },
  effortGrid: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 12, marginTop: -12 },
  effortLead: { color: '#425248', fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 18, lineHeight: 25, textAlign: 'center' },
  effortQuestion: { marginTop: 0 },
  effortColumnSlot: { flex: 1 },
  effortColumn: { flex: 1, alignItems: 'center' },
  effortTitle: { color: '#30483A', fontSize: 15, lineHeight: 20, fontWeight: '800', textAlign: 'center', marginBottom: 5 },
  effortBody: { color: '#66736C', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  effortBottomStatement: { color: Colors.hopeWhite, fontFamily: Platform.select({ ios: 'Georgia', android: Fonts.lora.regular }), fontSize: 20, lineHeight: 28, textAlign: 'center', marginBottom: -2 },
  effortBottomEmphasis: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700' },
  jesusBottomScripture: { marginBottom: -2 },
  jesusBottomVerse: { color: Colors.hopeWhite, fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 19, lineHeight: 28, textAlign: 'center' },
  faithBottomLead: { color: Colors.hopeWhite, fontFamily: Fonts.lexend.medium, fontSize: 20, lineHeight: 28, textAlign: 'left', marginBottom: 14 },
  jesusBottomReference: { color: Colors.hopeWhite, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center', marginTop: 8 },
  risenBottomVerse: { textAlign: 'left' },
  risenBottomReference: { textAlign: 'left' },
  pointRef: { alignSelf: 'flex-start', marginTop: 10 },
  step: { ...ivorySurface, flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderRadius: 24, padding: 15, marginBottom: 10 },
  stepNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E5ECE5', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#526A59', fontSize: 13, fontWeight: '800' },
  references: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  reference: { color: '#526A59', fontSize: 12, fontWeight: '700', backgroundColor: '#E5ECE5', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99 },
  choice: { ...ivorySurface, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 24, padding: 16, marginBottom: 10 },
  formulaChoice: { alignItems: 'flex-start', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 17 },
  formulaChoiceCorrect: { backgroundColor: '#EAF0EA', borderColor: '#D7DED8', borderWidth: 1 },
  formulaChoiceWrong: { backgroundColor: '#FFF1ED', borderColor: '#D7DED8', borderWidth: 1 },
  choiceSelected: { borderColor: '#607967', backgroundColor: '#EAF0EA' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#A6B0AA' },
  radioSelected: { borderWidth: 6, borderColor: Colors.sage },
  radioWrong: { borderColor: '#C87968' },
  choiceText: { flex: 1, color: '#24342C', fontSize: 15, lineHeight: 21 },
  choiceTextCorrect: { fontWeight: '700' },
  choiceDetail: { color: '#24342C', fontSize: 15, lineHeight: 21 },
  formulaStack: { alignItems: 'flex-start', gap: 5 },
  formulaLine: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  formulaDivider: { width: '100%', height: StyleSheet.hairlineWidth, backgroundColor: '#C9D4CB', marginVertical: 2 },
  formulaFaith: { color: '#30483A', fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700', fontSize: 18, lineHeight: 24 },
  formulaOperator: { color: '#7A857F', width: 16, fontSize: 16, lineHeight: 23, fontWeight: '800', textAlign: 'center' },
  formulaTerm: { color: '#24342C', fontSize: 15, lineHeight: 22, fontWeight: '800' },
  formulaResult: { color: '#526A59', fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700', fontSize: 19, lineHeight: 25 },
  formulaDetail: { color: '#526A59', fontStyle: 'normal', fontWeight: '700', fontSize: 15, lineHeight: 21 },
  formulaFeedbackRight: { color: '#526A59' },
  formulaFeedbackWrong: { color: '#A65A4A' },
  understandingBottomNote: { color: Colors.hopeWhite, fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 20, lineHeight: 28, textAlign: 'center', marginBottom: -2 },
  promiseTitle: { color: '#24342C', fontSize: 31, lineHeight: 39, fontWeight: '800', textAlign: 'center' },
  responseFlowEyebrow: { marginTop: 0, marginBottom: 8 },
  promiseSubtitle: { color: '#425248', fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700', fontSize: 21, lineHeight: 29, textAlign: 'center', marginTop: 6 },
  promiseBottom: { marginTop: 'auto', paddingTop: 28 },
  promiseVerse: { color: Colors.hopeWhite, fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 18, lineHeight: 27, textAlign: 'center' },
  promiseReference: { color: Colors.hopeWhite, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textAlign: 'center', marginTop: 9 },
  responseConsequence: { color: Colors.textGray, fontStyle: 'normal', fontWeight: '400', fontSize: 16, lineHeight: 23, textAlign: 'center', marginBottom: 18 },
  responseQuestion: { color: '#24342C', fontSize: 25, lineHeight: 33, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  responseDecisionEmphasis: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700' },
  responseJesus: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700' },
  responseActions: { marginTop: 'auto', paddingTop: 28 },
  responseChoicePrompt: { color: Colors.hopeWhite, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 14 },
  trustScriptureGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 2 },
  trustScriptureColumn: { flex: 1 },
  trustScriptureVerse: { color: Colors.hopeWhite, fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 13, lineHeight: 20 },
  trustScriptureReference: { color: Colors.hopeWhite, fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 0.8, marginTop: 8 },
  choiceFeedback: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  choiceFeedbackRight: { color: '#526A59' },
  choiceFeedbackWrong: { color: '#A65A4A' },
  dateCard: { ...ivorySurface, paddingVertical: 17, paddingHorizontal: 19, borderRadius: 24, marginBottom: 6 },
  dateCardLabel: { color: '#607967', fontSize: 12, fontWeight: '800', letterSpacing: 1.3, marginBottom: 4 },
  dateCardValue: { color: '#24342C', fontSize: 18, fontWeight: '700' },
  spiritualBirthdayDateRow: {flexDirection: 'row', alignItems: 'center', gap: 14},
  spiritualBirthdayPicker: {marginTop: 8, alignItems: 'center'},
  spiritualBirthdayDatePicker: {alignSelf: 'center', width: '100%', backgroundColor: 'transparent'},
  spiritualBirthdayActions: {marginTop: 'auto', paddingTop: 24},
  birthdayBottom: { marginTop: 'auto', paddingTop: 24 },
  birthdayVerse: { color: Colors.hopeWhite, fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 17, lineHeight: 26, textAlign: 'center', marginBottom: 8 },
  birthdayVerseReference: { color: Colors.hopeWhite, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 1.1, textAlign: 'center', marginBottom: 18 },
  prayerCard: { ...ivorySurface, paddingVertical: 21, paddingHorizontal: 20, borderRadius: 24 },
  prayerText: { color: '#30483A', fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', textAlign: 'left', fontSize: 16, lineHeight: 25 },
  prayerEmphasis: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700', letterSpacing: 0.25 },
  prayerAmen: { fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontWeight: '400' },
  prayerBottom: { width: '100%', marginTop: 'auto', paddingTop: 20 },
  lifeMark: { width: 176, height: 86, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 7, marginBottom: 11 },
  birdLeft: { position: 'absolute', left: 0, top: 27, opacity: 0.88, zIndex: 2, transform: [{ rotate: '-10deg' }] },
  birdRight: { position: 'absolute', right: 16, top: 8, opacity: 0.76, zIndex: 2, transform: [{ scaleX: -1 }, { rotate: '-5deg' }] },
  birdFar: { position: 'absolute', right: 0, top: 34, opacity: 0.58, zIndex: 2, transform: [{ scaleX: -1 }, { rotate: '8deg' }] },
  check: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#607967', alignItems: 'center', justifyContent: 'center' },
  assuranceBottom: { marginTop: 'auto', paddingTop: 28 },
  assuranceCard: { ...ivorySurface, borderRadius: 24, padding: 15, marginBottom: 10 },
  assuranceCardExpanded: { backgroundColor: 'rgba(255, 253, 248, 0.98)' },
  assuranceCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crossIcon: { width: 22, height: 24, alignItems: 'center', justifyContent: 'center' },
  crossIconVertical: { position: 'absolute', width: 2, height: 22, borderRadius: 2, backgroundColor: Colors.sage },
  crossIconHorizontal: { position: 'absolute', width: 15, height: 2, top: 7, borderRadius: 2, backgroundColor: Colors.sage },
  assuranceTruth: { color: '#30483A', fontSize: 13.5, lineHeight: 19, fontWeight: '400' },
  assuranceDetail: { color: '#6F7D75', fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  assuranceVerseBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCE2DB', marginTop: 13, paddingTop: 12, paddingLeft: 54, paddingRight: 4 },
  assuranceVerseBlockCollapsed: { opacity: 0.82, paddingTop: 9 },
  assuranceVerse: { color: '#425248', fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 14, lineHeight: 21 },
  assuranceReference: { color: '#607967', fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 0.8, marginTop: 7 },
  assuranceReferenceCollapsed: { marginTop: 0 },
  growthTitle: { color: '#24342C', fontSize: 28, lineHeight: 36, fontWeight: '700', textAlign: 'center' },
  growthTitleEmphasis: { fontFamily: Platform.select({ ios: 'Georgia-BoldItalic', android: Fonts.lora.bold }), fontStyle: 'italic', fontWeight: '700' },
  nextStepsTitle: { marginTop: 18 },
  growthLead: { color: Colors.textGray, fontFamily: Platform.select({ ios: 'Georgia-Italic', android: Fonts.lora.regular }), fontStyle: 'italic', fontSize: 18, lineHeight: 26, textAlign: 'center', marginBottom: 12 },
  growthBottom: { marginTop: 'auto', paddingTop: 26 },
  growthContent: { marginTop: 20 },
  growthItem: { ...ivorySurface, flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 17, borderRadius: 24, marginBottom: 12 },
  growthIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#E5ECE5', alignItems: 'center', justifyContent: 'center' },
  growthItemHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  growthItemTitle: { color: '#30483A', fontSize: 16, lineHeight: 21, fontWeight: '700', marginBottom: 4 },
  growthItemBody: { color: '#5F6E66', fontSize: 13.5, lineHeight: 20 },
  readingGuide: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DCE2DB', marginTop: 11, paddingTop: 10, gap: 9 },
  readingStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  readingStepText: { flex: 1, color: '#66736C', fontSize: 12, lineHeight: 17 },
  readingStepStrong: { color: '#30483A', fontWeight: '700' },
  sectionTop: { marginTop: 32 },
  personCard: { ...ivorySurface, borderRadius: 24, padding: 14, marginBottom: 10 },
  personCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  personNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  personCardFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 10, paddingLeft: 54 },
  personHistory: { flex: 1, minWidth: 0 },
  personActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  filterPill: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(82, 106, 91, 0.08)', borderWidth: 0.5, borderColor: 'rgba(82, 106, 91, 0.2)', borderRadius: 28, paddingHorizontal: 18, paddingVertical: 14 },
  filterPillActive: { backgroundColor: Colors.sageMuted, borderColor: Colors.sage },
  filterPillText: { color: Colors.text, fontSize: 15, lineHeight: 20 },
  filterPillTextActive: { color: Colors.hopeWhite },
  recipientHelp: { marginTop: 6, marginBottom: 14 },
  personInitial: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E5ECE5', alignItems: 'center', justifyContent: 'center' },
  personInitialText: { color: '#526A59', fontWeight: '800', fontSize: 17 },
  personHistoryText: { color: '#718078', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  personAnsweredHistory: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 4 },
  personAnsweredHistoryText: { flex: 1, color: '#526A59', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  personAnsweredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E5ECE5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  personAnsweredBadgeText: { color: '#526A59', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  sharedResponseCard: { ...ivorySurface, flexDirection: 'row', gap: 13, alignItems: 'flex-start', borderRadius: 18, padding: 16, marginTop: 12 },
  sharedResponseName: { color: '#30483A', fontSize: 16, lineHeight: 21, fontWeight: '800', marginBottom: 2 },
  sharedResponseText: { color: '#213329', fontSize: 16, lineHeight: 23, fontWeight: '600' },
  sharedResponseBirthday: { color: '#526A59', fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 6 },
  sharedResponseTrackButton: {alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 999, backgroundColor: '#E5ECE5'},
  sharedResponseTrackText: {color: Colors.sage, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  responsesEmptyState: { flex: 1, minHeight: 180, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40 },
  responsesEmptyIcon: { marginBottom: 8 },
  responsesEmptyTitle: { color: Colors.text, fontSize: 18, lineHeight: 24, fontWeight: '600', textAlign: 'center' },
  prayButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#C9D4CB', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#6F7D75', textAlign: 'center', lineHeight: 21, paddingVertical: 22 },
  walkthroughLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 32, marginBottom: 8 },
  walkthroughEyebrow: { color: Colors.sageMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  walkthroughTitle: { color: Colors.text, fontSize: 24, lineHeight: 32, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  walkthroughDescription: { color: Colors.textGray, fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 24 },
  sharePromptPills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 12 },
  walkthroughInput: { backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 16, minHeight: 56, color: '#24342C', fontSize: 18 },
  walkthroughMultilineInput: { minHeight: 150 },
  walkthroughNextButton: { alignSelf: 'flex-end', width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.sage, alignItems: 'center', justifyContent: 'center', marginTop: 'auto', shadowColor: '#29342E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
});

export default GospelScreen;
