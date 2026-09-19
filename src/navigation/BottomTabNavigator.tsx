// src/navigation/BottomTabNavigator.tsx
import React, { useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { BookHeart, Feather, Heart, ListTodo, Pencil, Sun } from 'lucide-react-native';
import Svg, { Line } from 'react-native-svg';
import { BlurView } from '@react-native-community/blur';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Pressable, TouchableOpacity, Animated, Easing, NativeModules, View, Text, Dimensions, DeviceEventEmitter, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScroll } from '../context/ScrollContext';
import { getFocusedRouteNameFromRoute, ParamListBase, TabNavigationState } from '@react-navigation/native';
import { JournalScreenRef } from '../screens/JournalScreen';

import ThemedText from '../components/common/ThemedText';
import { Colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { getFontFamily } from '../theme/fonts';
import { TabBarIcons } from './TabBarIcons';
import TodayStackNavigator from './TodayStackNavigator';
import PrayerListScreen from '../screens/PrayerListScreen';
import UserProfileScreen from '../screens/UserProfileScreen';

// import JournalScreen from '../screens/JournalScreen'; // Unused - using JournalStackNavigator
import JournalStackNavigator from './JournalStackNavigator';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { experiencePreferences } from '../services/experiencePreferences';
import { triggerLightHaptic } from '../utils/haptics';
import { openPrayerFlow } from './openPrayerFlow';
import PrayerHandsIcon from '../components/common/PrayerHandsIcon';
import LiquidGlassView from '../components/common/LiquidGlassView';

const Tab = createBottomTabNavigator();

// Define the props for our custom tab bar
type CustomTabBarProps = {
  state: TabNavigationState<ParamListBase>;
  descriptors: Record<string, any>;
  navigation: any;
};


// Glass-looking pill background - opaque blue with glass-like border
const PILL_BG = Colors.sage;

// Pill now occupies the full screen width
const PILL_WIDTH = Dimensions.get('window').width - 32;
export const PILL_HEIGHT = 64;
const TAB_CIRCLE_SIZE = 48;
const COLLAPSED_WIDTH = 66;
const COLLAPSED_HEIGHT = 56;

const LABELS: Record<string, string> = {
  Today: 'Today',
  Prayer: 'Prayers',
  Journal: 'Moments',
  More: 'More',
};

// ── Add menu items ─────────────────────────────────────────────────────────
// Icons match the ones used by the Moments section cards and editors.
type AddMenuIcon =
  | { family: 'ionicons'; name: string; rotate?: string }
  | { family: 'material'; name: string; rotate?: string }
  | { family: 'lucide'; component: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; style?: any }>; rotate?: string };

type PrayerKey = 'acts' | 'open' | 'pray-for-someone' | 'prayer-request' | 'need';

type AddMenuItem = {
  icon: AddMenuIcon;
  title: string;
  target?: string;
  params?: { screen: string; params?: Record<string, any> };
  opensPrayerMenu?: boolean;
  prayerKey?: PrayerKey;
};

const ADD_MENU_ITEMS: AddMenuItem[] = [
  { icon: { family: 'material', name: 'book-outline' }, title: 'Bible Study', target: 'Journal', params: { screen: 'BibleStudy' } },
  { icon: { family: 'ionicons', name: 'reader-outline' }, title: 'Session Notes', target: 'Journal', params: { screen: 'SermonNotes', params: { openedFromPencil: true } } },
  { icon: { family: 'lucide', component: BookHeart }, title: 'Heart Journal', target: 'Journal', params: { screen: 'ReflectionEditor', params: { initialMode: 'free-form', source: 'freeform', openHeart: true } } },
  { icon: { family: 'lucide', component: ListTodo }, title: 'To-dos', target: 'TodosWalkthrough' },
  { icon: { family: 'lucide', component: Heart }, title: 'Gratitude', target: 'GratitudeWalkthrough' },
  { icon: { family: 'material', name: 'script-text-outline' }, title: 'Scripture Note', target: 'Journal', params: { screen: 'ScriptureNoteEditor' } },
  { icon: { family: 'ionicons', name: 'hand-left-outline' }, title: 'Prayer', opensPrayerMenu: true },
];

// Second-level menu shown when the Prayer chip is tapped — mirrors the
// "MAKE ROOM FOR PRAYER" actions on the Prayer screen.
const PRAYER_MENU_ITEMS: AddMenuItem[] = [
  { icon: { family: 'ionicons', name: 'layers-outline' }, title: 'CAST', prayerKey: 'acts' },
  { icon: { family: 'ionicons', name: 'chatbubble-outline' }, title: 'Open', prayerKey: 'open' },
  { icon: { family: 'ionicons', name: 'heart-outline' }, title: 'For Someone', prayerKey: 'pray-for-someone' },
  { icon: { family: 'ionicons', name: 'chatbubble-ellipses-outline' }, title: 'Prayer Request', prayerKey: 'prayer-request' },
  { icon: { family: 'ionicons', name: 'add-circle-outline' }, title: 'Prayer Need', prayerKey: 'need' },
];

const AddMenuItemIcon = ({ icon }: { icon: AddMenuIcon }) => {
  if (icon.family === 'ionicons' && icon.name === 'hand-left-outline') {
    return <PrayerHandsIcon size={15} color={Colors.hopeWhite} />;
  }
  const rotateStyle = icon.rotate ? { transform: [{ rotate: icon.rotate }] } : undefined;
  if (icon.family === 'lucide') {
    const LucideComponent = icon.component;
    return <LucideComponent size={15} color={Colors.hopeWhite} strokeWidth={2.5} style={rotateStyle} />;
  }
  if (icon.family === 'material') {
    return <MaterialCommunityIcons name={icon.name as any} size={15} color={Colors.hopeWhite} style={rotateStyle} />;
  }
  return <Ionicons name={icon.name as any} size={15} color={Colors.hopeWhite} style={rotateStyle} />;
};

// Custom tab bar — floating pill with smooth entrance/exit and per-tab bounce
const CustomTabBarComponent = ({
  state,
  descriptors: _descriptors,
  navigation,
}: CustomTabBarProps) => {
  const { showTabBar, setShowTabBar } = useScroll();
  const theme = useTheme();
  const currentFont = theme.currentFont || 'lexend';
  const fontRegular = getFontFamily(currentFont, 'regular');
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const [showLabels, setShowLabels] = React.useState(experiencePreferences.showTabLabelsEnabled);
  const [visualActiveIndex, setVisualActiveIndex] = React.useState(state.index);
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [addFlowActive, setAddFlowActive] = React.useState(false);
  const [menuMode, setMenuMode] = React.useState<'main' | 'prayer'>('main');
  const [menuModeTransitioning, setMenuModeTransitioning] = React.useState(false);
  const menuAnim = React.useRef(new Animated.Value(0)).current;
  const menuTitleAnim = React.useRef(new Animated.Value(0)).current;
  const menuItemAnims = React.useRef(ADD_MENU_ITEMS.map(() => new Animated.Value(0))).current;
  const addIconRotation = React.useRef(new Animated.Value(0)).current;
  const addIconScale = React.useRef(new Animated.Value(1)).current;
  const addButtonLayout = React.useRef({ x: 0, width: 0 });
  const activeAddRouteIdentityRef = React.useRef<string | null>(null);
  const addNavigationInFlightRef = React.useRef(false);

  // Shared selector geometry lives above the menu handlers/effects that use it.
  const selectorPosition = React.useRef(new Animated.Value(0)).current;
  const selectorScaleX = React.useRef(new Animated.Value(1)).current;
  const selectorScaleY = React.useRef(new Animated.Value(1)).current;
  const selectorMoveAnimation = React.useRef<Animated.CompositeAnimation | null>(null);
  const selectorBounceAnimation = React.useRef<Animated.CompositeAnimation | null>(null);
  const tabLayouts = React.useRef<{ x: number; width: number }[]>([]).current;

  const updateSelectorPosition = React.useCallback((targetX: number) => {
    if (targetX === undefined || targetX === null) {return;}
    // A route update can arrive while the press animation is still running.
    // Reset interrupted scale sequences so the selector can never remain wide.
    selectorMoveAnimation.current?.stop();
    selectorBounceAnimation.current?.stop();
    selectorScaleX.setValue(1);
    selectorScaleY.setValue(1);

    selectorMoveAnimation.current = Animated.spring(selectorPosition, {
      toValue: targetX,
      stiffness: 250,
      damping: 22,
      mass: 0.85,
      useNativeDriver: true,
    });
    selectorBounceAnimation.current = Animated.sequence([
      Animated.parallel([
        Animated.spring(selectorScaleX, { toValue: 1.12, stiffness: 390, damping: 20, mass: 0.65, useNativeDriver: true }),
        Animated.spring(selectorScaleY, { toValue: 1.06, stiffness: 390, damping: 20, mass: 0.65, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(selectorScaleX, { toValue: 1, stiffness: 260, damping: 14, mass: 0.7, useNativeDriver: true }),
        Animated.spring(selectorScaleY, { toValue: 1, stiffness: 260, damping: 14, mass: 0.7, useNativeDriver: true }),
      ]),
    ]);

    selectorMoveAnimation.current.start();
    selectorBounceAnimation.current.start();
  }, [selectorPosition, selectorScaleX, selectorScaleY]);

  React.useEffect(() => () => {
    selectorMoveAnimation.current?.stop();
    selectorBounceAnimation.current?.stop();
  }, []);

  // iOS composites its clock, signal, and battery above React Native views, so
  // the full-screen BlurView cannot blur those system-owned glyphs. Fade them
  // out with the write menu and always restore them when the tab bar unmounts.
  React.useEffect(() => {
    StatusBar.setHidden(showAddMenu, 'fade');
    return () => StatusBar.setHidden(false, 'fade');
  }, [showAddMenu]);

  const addIconRotate = addIconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });
  const addPlusTranslateX = addIconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 7.5],
  });
  const addPlusTranslateY = addIconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });
  const addPencilTranslateY = addIconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 7],
  });

  React.useEffect(() => {
    if (showAddMenu) {
      menuTitleAnim.stopAnimation();
      menuTitleAnim.setValue(0);
      menuItemAnims.forEach(anim => {
        anim.stopAnimation();
        anim.setValue(0);
      });
    }
    Animated.parallel([
      Animated.spring(menuAnim, {
        toValue: showAddMenu ? 1 : 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(addIconRotation, {
        toValue: showAddMenu ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(addIconScale, {
        toValue: showAddMenu ? 1.15 : 1,
        useNativeDriver: true,
        tension: 200,
        friction: 7,
      }),
      // Staggered pill reveal — same pattern as the sermon notes capture picker
      showAddMenu
        ? Animated.stagger(
            38,
            [...[...menuItemAnims].reverse(), menuTitleAnim].map(anim =>
              Animated.spring(anim, {
                toValue: 1,
                tension: 90,
                friction: 12,
                useNativeDriver: true,
              }),
            ),
          )
        : Animated.stagger(
            28,
            [...menuItemAnims, menuTitleAnim].map(anim =>
              Animated.timing(anim, {
                toValue: 0,
                duration: 130,
                useNativeDriver: true,
              }),
            ),
          ),
    ]).start();
  }, [showAddMenu, menuAnim, menuTitleAnim, menuItemAnims, addIconRotation, addIconScale]);

  // Replay the same staggered chip reveal when the menu switches into the
  // second-level prayer mode. Session Notes opens its own picker directly.
  React.useLayoutEffect(() => {
    if (!showAddMenu || menuMode === 'main') { return; }
    const anims = menuItemAnims.slice(0, PRAYER_MENU_ITEMS.length);
    menuTitleAnim.stopAnimation();
    menuTitleAnim.setValue(0);
    anims.forEach(anim => {
      anim.stopAnimation();
      anim.setValue(0);
    });
    Animated.stagger(
      38,
      [...[...anims].reverse(), menuTitleAnim].map(anim =>
        Animated.spring(anim, {
          toValue: 1,
          tension: 90,
          friction: 12,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [menuMode, showAddMenu, menuTitleAnim, menuItemAnims]);

  const transitionMenuMode = React.useCallback((nextMode: 'prayer') => {
    if (menuModeTransitioning || menuMode === nextMode) {return;}
    setMenuModeTransitioning(true);
    const currentCount = menuMode === 'main'
      ? ADD_MENU_ITEMS.length
      : PRAYER_MENU_ITEMS.length;
    const outgoing = menuItemAnims.slice(0, currentCount);
    menuTitleAnim.stopAnimation();
    outgoing.forEach(animation => animation.stopAnimation());
    Animated.stagger(
      22,
      [menuTitleAnim, ...outgoing].map(animation =>
        Animated.timing(animation, {
          toValue: 0,
          duration: 120,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ),
    ).start(() => {
      setMenuMode(nextMode);
      setMenuModeTransitioning(false);
    });
  }, [menuItemAnims, menuMode, menuModeTransitioning, menuTitleAnim]);

  const closeAddMenuForNavigation = React.useCallback(() => {
    // The destination can hide this entire tab bar during the same frame. Do
    // not leave native-driver animations attached to views being removed.
    menuAnim.stopAnimation();
    menuTitleAnim.stopAnimation();
    menuItemAnims.forEach(animation => animation.stopAnimation());
    addIconRotation.stopAnimation();
    addIconScale.stopAnimation();
    menuAnim.setValue(0);
    menuTitleAnim.setValue(0);
    menuItemAnims.forEach(animation => animation.setValue(0));
    addIconRotation.setValue(0);
    addIconScale.setValue(1);
    setShowAddMenu(false);
    setMenuMode('main');
  }, [addIconRotation, addIconScale, menuAnim, menuItemAnims, menuTitleAnim]);

  const handleAddItem = (item: AddMenuItem) => {
    if (addNavigationInFlightRef.current) {return;}
    triggerLightHaptic();
    if (item.opensPrayerMenu) {
      transitionMenuMode('prayer');
      return;
    }
    addNavigationInFlightRef.current = true;
    closeAddMenuForNavigation();
    // Only tab-owned editor routes can keep the pencil selected: their route
    // identity changes again when the editor closes. Root-stack destinations
    // hide this tab bar and same-route destinations have no close transition
    // for us to observe, so retaining addFlowActive would make it stick.
    const nestedDestination = item.target === 'Journal' && item.params?.screen !== 'JournalMoments'
      ? `Journal:${item.params?.screen}`
      : null;
    activeAddRouteIdentityRef.current = nestedDestination;
    setAddFlowActive(Boolean(nestedDestination));
    requestAnimationFrame(() => {
      try {
        if (item.params?.screen === 'BibleStudy') {
          navigation.navigate('Journal' as any, {
            screen: 'BibleStudy',
            params: { openMode: 'create', openedFromPencil: true, openRequestId: `${Date.now()}-${Math.random()}`, sessionId: null, reflectionId: null, selectedDate: null },
          } as any);
        } else if (item.params) {
          navigation.navigate(item.target as any, item.params as any);
        } else {
          navigation.navigate(item.target as any);
        }
      } finally {
        // Root-stack destinations do not change the nested tab route, so the
        // route-identity effect cannot release this press guard for them.
        addNavigationInFlightRef.current = false;
      }
    });
  };

  const handlePrayerItem = (item: AddMenuItem) => {
    triggerLightHaptic();
    setShowAddMenu(false);
    setMenuMode('main');
    if (item.prayerKey === 'need') {
      activeAddRouteIdentityRef.current = 'Prayer:';
      setAddFlowActive(true);
      navigation.navigate('Prayer' as any, { openNeedModal: true } as any);
      return;
    }
    // These walkthroughs live in the root stack, where the tab bar is hidden.
    // Clear its local selection now so it is correct when MainTabs returns.
    activeAddRouteIdentityRef.current = null;
    setAddFlowActive(false);
    const selectedDate = new Date().toISOString();
    if (item.prayerKey === 'acts' || item.prayerKey === 'open') {
      openPrayerFlow(navigation, 'PrayerJournalWalkthrough', {
        selectedDate,
        initialPrayerType: item.prayerKey,
        showDescription: true,
      });
      return;
    }
    openPrayerFlow(navigation, 'PrayersForPeopleWalkthrough', {
      selectedDate,
      initialPrayerType: item.prayerKey,
    });
  };

  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('pencilAddFlowClosed', () => {
      activeAddRouteIdentityRef.current = null;
      setAddFlowActive(false);
    });
    return () => subscription.remove();
  }, []);

  // Move the shared sliding selector under the add button when the menu is open
  React.useEffect(() => {
    if (showAddMenu || addFlowActive) {
      updateSelectorPosition(addButtonLayout.current.x);
    } else {
      updateSelectorPosition(tabLayouts[state.index]?.x ?? 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddMenu, addFlowActive, state.index]);

  const currentRouteName = state.routes[state.index].name;
  const isReflect = currentRouteName === 'Reflect';
  const activeTabRoute = state.routes[state.index] as any;
  const activeNestedRouteName = getFocusedRouteNameFromRoute(activeTabRoute);
  const isSermonNotes =
    activeNestedRouteName === 'SermonNotes' ||
    activeNestedRouteName === 'SermonNotesDetail';
  const isReflectionEditor = activeNestedRouteName === 'ReflectionEditor';
  const isScriptureNoteEditor = activeNestedRouteName === 'ScriptureNoteEditor';
  const isBibleStudy = activeNestedRouteName === 'BibleStudy';
  const isReview = activeNestedRouteName === 'Review';

  // Keep the pencil selected only while its explicitly recorded tab-owned
  // destination is active, then restore the real tab on back/navigation.
  React.useEffect(() => {
    const routeIdentity = `${currentRouteName}:${activeNestedRouteName || ''}`;
    addNavigationInFlightRef.current = false;

    if (showAddMenu) {
      // A route can change while the reversed entrance stagger still has
      // delayed native animations queued. Stop and zero them synchronously;
      // changing React state alone can let the final (Bible Study) chip run
      // after the close animation and remain visible on the next screen.
      closeAddMenuForNavigation();
      setAddFlowActive(false);
      activeAddRouteIdentityRef.current = null;
      return;
    }

    if (!addFlowActive) {return;}

    if (
      activeAddRouteIdentityRef.current &&
      activeAddRouteIdentityRef.current !== routeIdentity
    ) {
      activeAddRouteIdentityRef.current = null;
      setAddFlowActive(false);
    }
  // Deliberately react only to route identity changes, not menu opening.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRouteName, activeNestedRouteName]);

  React.useEffect(() => {
    if (!showAddMenu && !addFlowActive) {
      setVisualActiveIndex(state.index);
    }
  }, [addFlowActive, showAddMenu, state.index]);

  // ── Pill visibility: opacity + translateY ────────────────────────────────
  // 0 = hidden below screen, 1 = visible in place
  const pillAnim = React.useRef(new Animated.Value(isReflect ? 0 : 1)).current;

  // ── Collapse-to-circle: 0 = full pill, 1 = collapsed circle ──────────────
  // Starts collapsed if already on Reflect
  const collapseAnim = React.useRef(new Animated.Value(isReflect ? 1 : 0)).current;
  const collapsedScale = React.useRef(new Animated.Value(showTabBar ? 0.88 : 1)).current;
  const [collapsedControlVisible, setCollapsedControlVisible] = React.useState(!showTabBar);

  const handleTabLayout = React.useCallback((index: number) => (event: any) => {
    const { x } = event.nativeEvent.layout;
    tabLayouts[index] = { x, width: event.nativeEvent.layout.width };
    if (state.index === index) {
      selectorPosition.setValue(x);
    }
  }, [state.index, selectorPosition, tabLayouts]);

  // ── Sync show-labels preference ────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    (async () => {
      await experiencePreferences.loadOnce();
      if (isMounted) { setShowLabels(experiencePreferences.showTabLabelsEnabled); }
    })();
    const unsub = experiencePreferences.subscribe(() => {
      setShowLabels(experiencePreferences.showTabLabelsEnabled);
    });
    return () => { isMounted = false; unsub(); };
  }, []);

  // ── Route-change animations ────────────────────────────────────────────────
  const prevRouteRef = React.useRef<string>(currentRouteName);
  const isFirstRenderRef = React.useRef(true);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevRouteRef.current = currentRouteName;
      return;
    }

    const prev = prevRouteRef.current;
    prevRouteRef.current = currentRouteName;

    if (isReflect) {
      // Going TO Reflect — collapse to circle, then slide UP and fade out (mirrors entrance)
      Animated.sequence([
        Animated.spring(collapseAnim, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(pillAnim, { toValue: 0, tension: 55, friction: 14, useNativeDriver: true }),
      ]).start();

    } else if (prev === 'Reflect') {
      // Coming FROM Reflect — slide circle up from below, then expand into full pill
      collapseAnim.setValue(1);
      pillAnim.setValue(0);
      const target = tabLayouts[state.index];
      if (target) { selectorPosition.setValue(target.x); }
      Animated.sequence([
        Animated.delay(120),
        Animated.spring(pillAnim, { toValue: 1, tension: 55, friction: 12, useNativeDriver: true }),
      ]).start(() => {
        Animated.spring(collapseAnim, {
          toValue: 0,
          tension: 65,
          friction: 13,
          useNativeDriver: true,
        }).start();
      });
    } else {
      // Normal tab→tab: move selector smoothly
      updateSelectorPosition(tabLayouts[state.index]?.x ?? 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, updateSelectorPosition]);

  const previousShowTabBarRef = React.useRef(showTabBar);
  useEffect(() => {
    if (previousShowTabBarRef.current === showTabBar) {return;}
    previousShowTabBarRef.current = showTabBar;
    if (isReflect) {return;}

    if (showTabBar) {
      setCollapsedControlVisible(false);
      collapsedScale.stopAnimation();
      collapsedScale.setValue(0.88);
      // Snap selector to the active tab BEFORE the pill grows so it's already
      // in place when it becomes visible — no sliding artifact.
      const target = tabLayouts[state.index];
      if (target) { selectorPosition.setValue(target.x); }
    }
    const collapseAnimation = Animated.spring(collapseAnim, {
      toValue: showTabBar ? 0 : 1,
      tension: 75,
      friction: 12,
      useNativeDriver: true,
    });
    if (!showTabBar) {
      setCollapsedControlVisible(true);
      collapsedScale.stopAnimation();
      collapsedScale.setValue(0.35);
      requestAnimationFrame(() => {
        Animated.parallel([
          collapseAnimation,
          Animated.spring(collapsedScale, {
            toValue: 1,
            tension: 75,
            friction: 12,
            useNativeDriver: true,
          }),
        ]).start();
      });
      return;
    }
    collapseAnimation.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseAnim, collapsedScale, isReflect, showTabBar]);

  const { onTabPress } = React.useContext(TabPressContext);

  if (isSermonNotes || isReflectionEditor || isScriptureNoteEditor || isBibleStudy || isReview) {
    return null;
  }

  // pillAnim 0→1 drives: opacity 0→1 + translateY 28→0 (entrance/exit mirror)
  const pillOpacity   = pillAnim;
  const pillTranslateY = pillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  // collapseAnim 0→1: content fades early, pill shape fades+contracts, circle fades in late
  const pillContentOpacity = collapseAnim.interpolate({
    inputRange: [0, 0.35],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  // Pill shape (background/border) fades out as it collapses so no ghost remains
  const pillShapeOpacity = collapseAnim.interpolate({
    inputRange: [0, 0.7],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  // Pill shape grows left→right on expand: scaleX from circle ratio → 1, pinned at left edge
  const CIRCLE_RATIO = COLLAPSED_WIDTH / PILL_WIDTH;
  const pillShapeScaleX = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, CIRCLE_RATIO],
    extrapolate: 'clamp',
  });
  // translateX compensation to pin the left edge during scale
  const pillShapeTranslateX = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(PILL_WIDTH / 2) * (1 - CIRCLE_RATIO)],
    extrapolate: 'clamp',
  });

  // Icon for the collapsed circle — active tab in inactive color
  const INACTIVE_CIRCLE_COLOR = Colors.hopeWhite;
  const circleIcon = (() => {
    const name = state.routes[state.index].name;
    if (name === 'Today')       { return <Ionicons name="sunny" size={20} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'Prayer')      { return <PrayerHandsIcon size={20} color={INACTIVE_CIRCLE_COLOR} strokeWidth={2.2} />; }
    if (name === 'Journal')     { return <Feather size={20} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'More')        { return <Ionicons name="ellipsis-horizontal" size={20} color={INACTIVE_CIRCLE_COLOR} />; }
    return <Ionicons name="apps-outline" size={20} color={INACTIVE_CIRCLE_COLOR} />;
  })();
  const collapsedLabel = LABELS[state.routes[state.index].name] ?? state.routes[state.index].name;

  return (
    <Animated.View
      style={[
        styles.pillWrapper,
        {
          bottom: Math.max(insets.bottom, 8),
          opacity: pillOpacity,
          transform: [{ translateY: pillTranslateY }],
        },
      ]}
      pointerEvents={isReflect ? 'none' : 'box-none'}
    >
      {/* ── Add menu blur — behind the pill and menu ──────── */}
      <Animated.View
        style={[
          styles.addMenuBlur,
          { left: -16, right: -16, top: -(screenHeight - insets.bottom - PILL_HEIGHT), bottom: -insets.bottom, opacity: menuAnim },
        ]}
        pointerEvents="none">
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="light"
          blurAmount={7}
          reducedTransparencyFallbackColor={Colors.lightBackground}
        />
      </Animated.View>
      <Pressable
        style={[
          styles.addMenuDismissLayer,
          { left: -16, right: -16, top: -(screenHeight - insets.bottom - PILL_HEIGHT), bottom: -insets.bottom },
        ]}
        pointerEvents={showAddMenu ? 'auto' : 'none'}
        onPress={() => {
          closeAddMenuForNavigation();
          setAddFlowActive(false);
          activeAddRouteIdentityRef.current = null;
        }}
      />

      {/* ── Full pill: shape scales left→right, content fades separately ─── */}
      <Animated.View
        style={[
          styles.pill,
          {
            opacity: pillShapeOpacity,
            transform: [
              { translateX: pillShapeTranslateX },
              { scaleX: pillShapeScaleX },
            ],
          },
        ]}
        pointerEvents={showTabBar ? 'box-none' : 'none'}
      >
        {Platform.OS === 'ios' ? (
          <View pointerEvents="none" style={styles.pillGlassBackground}>
            <LiquidGlassView
              tintColor="rgba(82, 106, 91, 0.32)"
              cornerRadius={31}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : null}
        {/* pillInner: shared coordinate system for selector + tabs.
            Selector is absolute here; tabs fill the same space via absoluteFillObject.
            Both use x=0 as origin → onLayout x values align with selector translateX. */}
        <View style={styles.pillInner}>
          {/* Sliding selector — absolute within pillInner */}
          <Animated.View
            style={[
              styles.slidingSelector,
              { width: `${100 / (state.routes.length + 1)}%` },
              {
                opacity: pillContentOpacity,
                transform: [
                  { translateX: selectorPosition },
                  { scaleX: selectorScaleX },
                  { scaleY: selectorScaleY },
                ],
              },
            ]}
          >
            {Platform.OS === 'ios' ? (
              <View pointerEvents="none" style={styles.selectorGlassLens}>
                <LiquidGlassView
                  tintColor={Colors.sage}
                  cornerRadius={26}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            ) : null}
          </Animated.View>
          {/* Tabs overlay — same bounds as pillInner, fade independently */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { flexDirection: 'row', opacity: pillContentOpacity }]}>
          {state.routes.flatMap((route, index) => {
            const isFocused = !showAddMenu && !addFlowActive && visualActiveIndex === index;
            const iconColor = isFocused ? Colors.hopeWhite : Colors.sage;

            const onPress = () => {
              setVisualActiveIndex(index);
              closeAddMenuForNavigation();
              setAddFlowActive(false);
              activeAddRouteIdentityRef.current = null;
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              onTabPress(route.name);
              if (!event.defaultPrevented) {
                if (route.name === 'Journal') {
                  navigation.navigate('Journal', { screen: 'JournalMoments' });
                } else {
                  navigation.navigate(route.name);
                }
              }
            };

            const icon = (() => {
              if (route.name === 'Today')       { return isFocused
                ? <Ionicons name="sunny" size={20} color={iconColor} />
                : <Sun size={20} strokeWidth={2.2} color={iconColor} />; }
              if (route.name === 'Prayer')      { return <PrayerHandsIcon size={20} color={iconColor} strokeWidth={2.2} />; }
              if (route.name === 'Journal')     { return <Feather size={20} color={iconColor} />; }
              if (route.name === 'More')        { return <Ionicons name={isFocused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'} size={20} color={iconColor} />; }
              const iconName = isFocused
                ? TabBarIcons[route.name as keyof typeof TabBarIcons]?.focused
                : TabBarIcons[route.name as keyof typeof TabBarIcons]?.name;
              return <Ionicons name={iconName} size={20} color={iconColor} />;
            })();

            return [
              <Animated.View
                key={route.key}
                style={[styles.pillTab, isFocused && styles.pillTabActive]}
                onLayout={handleTabLayout(index)}
              >
                <TouchableOpacity
                  onPress={onPress}
                  activeOpacity={0.8}
                  style={styles.pillTabTouchable}
                >
                  {icon}
                  {showLabels && (
                    <Text style={[styles.pillLabel, { color: iconColor, fontFamily: fontRegular }]}>
                      {LABELS[route.name] ?? route.name}
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>,
              index === 1 && (
                <View
                  key="add"
                  style={styles.pillTab}
                  onLayout={(e) => {
                    addButtonLayout.current.x = e.nativeEvent.layout.x;
                    addButtonLayout.current.width = e.nativeEvent.layout.width;
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      triggerLightHaptic();
                      const opening = !showAddMenu;
                      if (opening) {
                        setMenuMode('main');
                      } else {
                        closeAddMenuForNavigation();
                      }
                      activeAddRouteIdentityRef.current = null;
                      setAddFlowActive(opening);
                      if (opening) { setShowAddMenu(true); }
                    }}
                    activeOpacity={0.8}
                    style={styles.pillTabTouchable}
                  >
                    <Animated.View style={{ transform: [{ scale: addIconScale }] }}>
                      <View style={styles.addIconPair}>
                        <Animated.View
                          style={[
                            styles.addIconPlus,
                            { transform: [{ translateX: addPlusTranslateX }, { translateY: addPlusTranslateY }, { rotate: addIconRotate }] },
                          ]}
                        >
                          <Svg width={13} height={13} viewBox="0 0 13 13">
                            <Line
                              x1="6.5"
                              y1="1.5"
                              x2="6.5"
                              y2="11.5"
                              stroke={showAddMenu || addFlowActive ? Colors.hopeWhite : Colors.sage}
                              strokeWidth={1.7}
                              strokeLinecap="round"
                            />
                            <Line
                              x1="1.5"
                              y1="6.5"
                              x2="11.5"
                              y2="6.5"
                              stroke={showAddMenu || addFlowActive ? Colors.hopeWhite : Colors.sage}
                              strokeWidth={1.7}
                              strokeLinecap="round"
                            />
                          </Svg>
                        </Animated.View>
                        <Animated.View
                          style={[
                            styles.addIconPencil,
                            { transform: [{ translateY: addPencilTranslateY }, { rotate: addIconRotate }] },
                          ]}
                        >
                          <Pencil
                            size={20}
                            strokeWidth={2}
                            color={showAddMenu || addFlowActive ? Colors.hopeWhite : Colors.sage}
                          />
                        </Animated.View>
                      </View>
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              ),
            ];
          })}
          </Animated.View>
        </View>
      </Animated.View>

      {/* ── Add menu — staggered chip reveal above the tab bar ─────────── */}
      <View
        style={styles.addMenu}
        pointerEvents={showAddMenu ? 'box-none' : 'none'}
      >
        <Animated.View
          style={{
            opacity: menuTitleAnim,
            transform: [
              { translateY: menuTitleAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              { scale: menuTitleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            ],
          }}
        >
          <View style={styles.addMenuTitlePill}>
            <ThemedText weight="semiBold" style={styles.addMenuTitle}>
              {menuMode === 'prayer' ? 'How would you like to pray?' : 'What would you like to write?'}
            </ThemedText>
          </View>
        </Animated.View>
        <View style={styles.addMenuGrid}>
          {(menuMode === 'prayer' ? PRAYER_MENU_ITEMS : ADD_MENU_ITEMS).map((item, index) => (
            <Animated.View
              key={item.title}
              style={{
                opacity: menuItemAnims[index],
                transform: [
                  { translateY: menuItemAnims[index].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                  { scale: menuItemAnims[index].interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                ],
              }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={item.title}
                disabled={menuModeTransitioning}
                style={styles.addMenuItem}
                onPress={() => (item.prayerKey ? handlePrayerItem(item) : handleAddItem(item))}
                activeOpacity={0.7}
              >
                <View style={styles.addMenuIconCircle}>
                  <AddMenuItemIcon icon={item.icon} />
                </View>
                <ThemedText style={styles.addMenuItemText}>{item.title}</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </View>

      {/* ── Collapsed circle (fades in from left as pill collapses) ─────── */}
      {collapsedControlVisible && !isReflect ? <Animated.View style={[styles.collapsedCircle, { transform: [{ scale: collapsedScale }] }]}>
        {Platform.OS === 'ios' ? (
          <View pointerEvents="none" style={styles.collapsedGlassClip}>
            <LiquidGlassView
              tintColor={Colors.sage}
              cornerRadius={26}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.collapsedCircleTouchable}
          activeOpacity={0.8}
          onPress={() => {
            try { triggerLightHaptic(); } catch {}
            setShowTabBar(true);
          }}
        >
          {circleIcon}
          {showLabels ? (
            <Text style={[styles.collapsedLabel, { fontFamily: fontRegular }]}>
              {collapsedLabel}
            </Text>
          ) : null}
        </TouchableOpacity>
      </Animated.View> : null}
    </Animated.View>
  );
};

// Main App Tabs
interface BottomTabNavigatorProps {
  onLogout: () => void;
}


// Create a context to share tab press handlers
const TabPressContext = React.createContext<{
  onTabPress: (tabName: string) => void;
}>({ onTabPress: () => {} });

export default function BottomTabNavigator({ onLogout: _onLogout }: BottomTabNavigatorProps) {
  const theme = useTheme();
  const { user } = useAuth();
  const currentTabRef = React.useRef<string>('Today');
  const journalScreenRef = React.useRef<JournalScreenRef>(null);

  // Subtle haptic feedback, gated by user preference
  const triggerTabHaptic = React.useCallback(() => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) { return; }
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) { return; }
      // dynamic require to avoid TurboModule issues
      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  }, [user]);

  // Handle tab press — uses ref for currentTab so handleTabPress stays stable and
  // renderTabBar never gets a new reference on every press (prevents full navigator re-render)
  const handleTabPress = React.useCallback((tabName: string) => {
    triggerLightHaptic();
    if (tabName === 'Journal' && currentTabRef.current === 'Journal' && journalScreenRef.current) {
      journalScreenRef.current.resetToCurrentDate();
    }
    currentTabRef.current = tabName;
    triggerTabHaptic();
  }, [triggerTabHaptic]);

  // Move tabBar render function outside
  const renderTabBar = React.useCallback(
    (props: any) => (
      <TabPressContext.Provider value={{ onTabPress: handleTabPress }}>
        <CustomTabBarComponent {...props} />
      </TabPressContext.Provider>
    ),
    [handleTabPress]
  );

  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      initialRouteName="Today"
      // anchorBlue scene container fills the full screen behind every tab screen,
      // so scrollable content gaps and the safe-area floor never show white.
      // tabBarStyle position:absolute stops RN from reserving space for the floating pill.
      // @ts-ignore — sceneContainerStyle works at runtime; type added in a later @react-navigation/bottom-tabs version
      sceneContainerStyle={{ backgroundColor: Colors.sage }}
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: theme.colors.anchorBlue,
        },
        headerTintColor: theme.colors.hopeWhite,
        headerTitleStyle: {
          color: theme.colors.hopeWhite,
        },
        tabBarStyle: { position: 'absolute' },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayStackNavigator}
        options={{
          tabBarLabel: 'Today',
          title: 'Today',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Journal"
        component={JournalStackNavigator}
        options={{
          tabBarLabel: 'Journal',
          title: 'Journal',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Prayer"
        component={PrayerListScreen as React.ComponentType<any>}
        options={{
          tabBarLabel: 'Prayer',
          title: 'Prayer',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="More"
        component={UserProfileScreen as React.ComponentType<any>}
        options={{
          tabBarLabel: 'More',
          title: 'More',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // Full-width absolute anchor (no side margins)
  pillWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    overflow: 'visible',
  },
  // Floating pill — full width, slightly smaller to fit icon + label
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    borderRadius: 31,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : PILL_BG,
    borderWidth: Platform.OS === 'ios' ? 0 : 1,
    borderColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.44)' : Colors.sageMuted,
    paddingHorizontal: 4,
    shadowColor: Colors.darkBackground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'ios' ? 0.2 : 0.15,
    shadowRadius: Platform.OS === 'ios' ? 18 : 12,
    elevation: 8,
  },
  pillGlassBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 31,
    overflow: 'hidden',
  },
  // Shared container — selector and tabs both reference x=0 from here
  pillInner: {
    flex: 1,
    height: TAB_CIRCLE_SIZE,
  },
  // Each tab: Animated.View takes equal share, scale bounce applies here
  pillTab: {
    flex: 1,
    height: TAB_CIRCLE_SIZE,
    borderRadius: TAB_CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // TouchableOpacity fills the tab, lays out icon + label
  pillTabTouchable: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  pillTabActive: {
    backgroundColor: 'transparent',
  },
  slidingSelector: {
    position: 'absolute',
    height: TAB_CIRCLE_SIZE,
    borderRadius: TAB_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : Colors.sageMuted,
  },
  selectorGlassLens: {
    position: 'absolute',
    top: -4,
    width: 66,
    height: 56,
    borderRadius: 26,
  },
  selectorGlassClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    overflow: 'hidden',
  },
  pillLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  addIconPair: {
    width: 28,
    height: 32,
  },
  addIconPlus: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  addIconPencil: {
    position: 'absolute',
    left: 4,
    top: 6,
  },
  // Add menu — appears above the tab bar
  addMenuBlur: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -500,
    overflow: 'hidden',
  },
  addMenuDismissLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -500,
    backgroundColor: 'transparent',
  },
  // Centered wrap grid of chips — same layout as the Today's Win picker
  // (winTypesGrid), colored like the nav pill: sage surface, ivory content.
  addMenu: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 76,
  },
  addMenuTitlePill: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.sageMuted,
    backgroundColor: PILL_BG,
    shadowColor: Colors.darkBackground,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  addMenuTitle: {
    color: Colors.hopeWhite,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  addMenuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingLeft: 9,
    paddingRight: 15,
    borderWidth: 1,
    borderColor: Colors.sageMuted,
    borderRadius: 28,
    backgroundColor: PILL_BG,
    shadowColor: Colors.darkBackground,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  addMenuIconCircle: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: Colors.sageMuted,
  },
  addMenuItemText: {
    fontSize: 15,
    color: Colors.hopeWhite,
  },
  // Collapsed circle — sits at left edge of pillWrapper
  collapsedCircle: {
    position: 'absolute',
    left: 0,
    top: (PILL_HEIGHT - COLLAPSED_HEIGHT) / 2,
    width: COLLAPSED_WIDTH,
    height: COLLAPSED_HEIGHT,
    borderRadius: 26,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : PILL_BG,
    borderWidth: Platform.OS === 'ios' ? 0 : 1,
    borderColor: Colors.sageMuted,
    shadowColor: Colors.darkBackground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'ios' ? 0.2 : 0.18,
    shadowRadius: Platform.OS === 'ios' ? 18 : 10,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapsedGlassClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    overflow: 'hidden',
  },
  collapsedCircleTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  collapsedLabel: {
    color: Colors.hopeWhite,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
