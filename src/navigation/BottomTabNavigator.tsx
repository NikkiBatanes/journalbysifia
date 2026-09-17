// src/navigation/BottomTabNavigator.tsx
import React, { useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Feather, Heart, ListTodo, NotebookPen } from 'lucide-react-native';
import { BlurView } from '@react-native-community/blur';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Pressable, TouchableOpacity, Animated, Easing, NativeModules, View, Text, Dimensions } from 'react-native';
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
export const PILL_HEIGHT = 56;
const TAB_CIRCLE_SIZE = 40;
const CIRCLE_SIZE = 48;

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
  opensSessionMenu?: boolean;
  prayerKey?: PrayerKey;
};

const ADD_MENU_ITEMS: AddMenuItem[] = [
  { icon: { family: 'material', name: 'book-outline' }, title: 'Bible Study', target: 'Journal', params: { screen: 'BibleStudy' } },
  { icon: { family: 'ionicons', name: 'reader-outline' }, title: 'Session Notes', opensSessionMenu: true },
  { icon: { family: 'lucide', component: NotebookPen }, title: 'Heart Journal', target: 'Journal', params: { screen: 'ReflectionEditor', params: { initialMode: 'free-form', source: 'freeform', openHeart: true } } },
  { icon: { family: 'lucide', component: ListTodo }, title: 'To-dos', target: 'TodosWalkthrough' },
  { icon: { family: 'lucide', component: Heart }, title: 'Gratitude', target: 'Journal', params: { screen: 'JournalMoments' } },
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

// Second-level menu shown when the Session Notes chip is tapped — every option
// opens the same structured note editor with a different document type.
const SESSION_MENU_ITEMS: AddMenuItem[] = [
  { icon: { family: 'ionicons', name: 'reader-outline' }, title: 'Sermon', target: 'Journal', params: { screen: 'SermonNotes', params: { sessionNoteType: 'sermon' } } },
  { icon: { family: 'ionicons', name: 'megaphone-outline' }, title: 'Conference', target: 'Journal', params: { screen: 'SermonNotes', params: { sessionNoteType: 'conference' } } },
  { icon: { family: 'ionicons', name: 'mic-outline' }, title: 'Speaking', target: 'Journal', params: { screen: 'SermonNotes', params: { sessionNoteType: 'speaking' } } },
  { icon: { family: 'ionicons', name: 'people-outline' }, title: 'Meeting', target: 'Journal', params: { screen: 'SermonNotes', params: { sessionNoteType: 'meeting' } } },
  { icon: { family: 'ionicons', name: 'construct-outline' }, title: 'Workshop', target: 'Journal', params: { screen: 'SermonNotes', params: { sessionNoteType: 'workshop' } } },
  { icon: { family: 'ionicons', name: 'document-text-outline' }, title: 'Other', target: 'Journal', params: { screen: 'SermonNotes', params: { sessionNoteType: 'other' } } },
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
  const [showAddMenu, setShowAddMenu] = React.useState(false);
  const [addFlowActive, setAddFlowActive] = React.useState(false);
  const [menuMode, setMenuMode] = React.useState<'main' | 'prayer' | 'session'>('main');
  const [menuModeTransitioning, setMenuModeTransitioning] = React.useState(false);
  const menuAnim = React.useRef(new Animated.Value(0)).current;
  const menuTitleAnim = React.useRef(new Animated.Value(0)).current;
  const menuItemAnims = React.useRef(ADD_MENU_ITEMS.map(() => new Animated.Value(0))).current;
  const addIconRotation = React.useRef(new Animated.Value(0)).current;
  const addIconScale = React.useRef(new Animated.Value(1)).current;
  const addButtonLayout = React.useRef({ x: 0, width: 0 });
  const pendingAddNavigationRef = React.useRef(false);
  const activeAddRouteIdentityRef = React.useRef<string | null>(null);

  // Shared selector geometry lives above the menu handlers/effects that use it.
  const selectorPosition = React.useRef(new Animated.Value(0)).current;
  const selectorScaleX = React.useRef(new Animated.Value(1)).current;
  const selectorScaleY = React.useRef(new Animated.Value(1)).current;
  const tabLayouts = React.useRef<{ x: number; width: number }[]>([]).current;

  const updateSelectorPosition = React.useCallback((targetX: number) => {
    if (targetX === undefined || targetX === null) {return;}
    Animated.parallel([
      Animated.spring(selectorPosition, {
        toValue: targetX,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.parallel([
          Animated.spring(selectorScaleX, { toValue: 1.15, tension: 200, friction: 8, useNativeDriver: true }),
          Animated.spring(selectorScaleY, { toValue: 1.05, tension: 200, friction: 8, useNativeDriver: true }),
        ]),
        Animated.delay(100),
        Animated.parallel([
          Animated.spring(selectorScaleX, { toValue: 1, tension: 180, friction: 10, useNativeDriver: true }),
          Animated.spring(selectorScaleY, { toValue: 1, tension: 200, friction: 12, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, [selectorPosition, selectorScaleX, selectorScaleY]);

  const addIconRotate = addIconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
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
      // Same rotate-to-open as the playbook walkthrough journal trigger
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

  // Replay the same staggered chip reveal when the menu switches into a
  // second-level mode (prayer or session notes)
  React.useLayoutEffect(() => {
    if (!showAddMenu || menuMode === 'main') { return; }
    const anims = menuItemAnims.slice(0, menuMode === 'prayer' ? PRAYER_MENU_ITEMS.length : SESSION_MENU_ITEMS.length);
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

  const transitionMenuMode = React.useCallback((nextMode: 'prayer' | 'session') => {
    if (menuModeTransitioning || menuMode === nextMode) {return;}
    setMenuModeTransitioning(true);
    const currentCount = menuMode === 'main'
      ? ADD_MENU_ITEMS.length
      : menuMode === 'prayer'
        ? PRAYER_MENU_ITEMS.length
        : SESSION_MENU_ITEMS.length;
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

  const handleAddItem = (item: AddMenuItem) => {
    triggerLightHaptic();
    if (item.opensPrayerMenu) {
      transitionMenuMode('prayer');
      return;
    }
    if (item.opensSessionMenu) {
      transitionMenuMode('session');
      return;
    }
    setShowAddMenu(false);
    setAddFlowActive(true);
    setMenuMode('main');
    pendingAddNavigationRef.current = true;
    if (item.params?.screen === 'BibleStudy') {
      navigation.navigate('Journal' as any, {
        screen: 'BibleStudy',
        params: { openMode: 'create', openRequestId: `${Date.now()}-${Math.random()}`, sessionId: null, reflectionId: null, selectedDate: null },
      } as any);
      return;
    }
    if (item.params) {
      navigation.navigate(item.target as any, item.params as any);
    } else {
      navigation.navigate(item.target as any);
    }
  };

  const handlePrayerItem = (item: AddMenuItem) => {
    triggerLightHaptic();
    setShowAddMenu(false);
    setAddFlowActive(true);
    setMenuMode('main');
    pendingAddNavigationRef.current = true;
    if (item.prayerKey === 'need') {
      navigation.navigate('Prayer' as any, { openNeedModal: true } as any);
      return;
    }
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
  const isBibleStudy = activeNestedRouteName === 'BibleStudy';
  const isReview = activeNestedRouteName === 'Review';

  // Record the route opened from the pencil. Keep the pencil selected while
  // that destination is active, then restore the real tab when the user backs
  // out or another navigation action changes the route.
  React.useEffect(() => {
    const routeIdentity = `${currentRouteName}:${activeNestedRouteName || ''}`;

    if (showAddMenu) {
      setShowAddMenu(false);
      setAddFlowActive(false);
      setMenuMode('main');
      pendingAddNavigationRef.current = false;
      activeAddRouteIdentityRef.current = null;
      return;
    }

    if (!addFlowActive) {return;}

    if (pendingAddNavigationRef.current) {
      pendingAddNavigationRef.current = false;
      activeAddRouteIdentityRef.current = routeIdentity;
      return;
    }

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

  // ── Pill visibility: opacity + translateY ────────────────────────────────
  // 0 = hidden below screen, 1 = visible in place
  const pillAnim = React.useRef(new Animated.Value(isReflect ? 0 : 1)).current;

  // ── Collapse-to-circle: 0 = full pill, 1 = collapsed circle ──────────────
  // Starts collapsed if already on Reflect
  const collapseAnim = React.useRef(new Animated.Value(isReflect ? 1 : 0)).current;

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
      // Snap selector to the active tab BEFORE the pill grows so it's already
      // in place when it becomes visible — no sliding artifact.
      const target = tabLayouts[state.index];
      if (target) { selectorPosition.setValue(target.x); }
    }
    Animated.spring(collapseAnim, {
      toValue: showTabBar ? 0 : 1,
      tension: 75,
      friction: 12,
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseAnim, isReflect, showTabBar]);

  const { onTabPress } = React.useContext(TabPressContext);

  if (isSermonNotes || isReflectionEditor || isBibleStudy || isReview) {
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
  const circleOpacity = collapseAnim.interpolate({
    inputRange: [0.5, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // Pill shape grows left→right on expand: scaleX from circle ratio → 1, pinned at left edge
  const CIRCLE_RATIO = CIRCLE_SIZE / PILL_WIDTH;
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
    if (name === 'Today')       { return <Ionicons name="sunny-outline" size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'Prayer')      { return <PrayerHandsIcon size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'Journal')     { return <Feather size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    if (name === 'More')        { return <Ionicons name="ellipsis-horizontal" size={22} color={INACTIVE_CIRCLE_COLOR} />; }
    return <Ionicons name="apps-outline" size={22} color={INACTIVE_CIRCLE_COLOR} />;
  })();

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
          setShowAddMenu(false);
          setAddFlowActive(false);
          setMenuMode('main');
          pendingAddNavigationRef.current = false;
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
                transform: [
                  { translateX: selectorPosition },
                  { scaleX: selectorScaleX },
                  { scaleY: selectorScaleY },
                ],
              },
            ]}
          />
          {/* Tabs overlay — same bounds as pillInner, fade independently */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { flexDirection: 'row', opacity: pillContentOpacity }]}>
          {state.routes.flatMap((route, index) => {
            const isFocused = state.index === index;
            const iconColor = Colors.hopeWhite;

            const onPress = () => {
              setShowAddMenu(false);
              setAddFlowActive(false);
              setMenuMode('main');
              pendingAddNavigationRef.current = false;
              activeAddRouteIdentityRef.current = null;
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              updateSelectorPosition(tabLayouts[index]?.x ?? 0);
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
              if (route.name === 'Today')       { return <Ionicons name={isFocused ? 'sunny' : 'sunny-outline'} size={20} color={iconColor} />; }
              if (route.name === 'Prayer')      { return <PrayerHandsIcon size={20} color={iconColor} />; }
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
                      if (opening) { setMenuMode('main'); }
                      pendingAddNavigationRef.current = false;
                      activeAddRouteIdentityRef.current = null;
                      setAddFlowActive(opening);
                      setShowAddMenu(opening);
                    }}
                    activeOpacity={0.8}
                    style={styles.pillTabTouchable}
                  >
                    <Animated.View style={{ transform: [{ rotate: addIconRotate }, { scale: addIconScale }] }}>
                      <MaterialCommunityIcons name="pencil-plus-outline" size={24} color={Colors.hopeWhite} />
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
              {menuMode === 'prayer' ? 'How would you like to pray?' : menuMode === 'session' ? 'What are you taking notes for?' : 'What would you like to write?'}
            </ThemedText>
          </View>
        </Animated.View>
        <View style={styles.addMenuGrid}>
          {(menuMode === 'prayer' ? PRAYER_MENU_ITEMS : menuMode === 'session' ? SESSION_MENU_ITEMS : ADD_MENU_ITEMS).map((item, index) => (
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
      <Animated.View
        style={[styles.collapsedCircle, { opacity: circleOpacity }]}
        pointerEvents={showTabBar ? 'none' : 'box-none'}
      >
        <TouchableOpacity
          style={styles.collapsedCircleTouchable}
          activeOpacity={0.8}
          onPress={() => {
            try { triggerLightHaptic(); } catch {}
            setShowTabBar(true);
          }}
        >
          {circleIcon}
        </TouchableOpacity>
      </Animated.View>
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
  const currentTabRef = React.useRef<string>('UserInput');
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
    borderRadius: PILL_HEIGHT / 2,
    backgroundColor: PILL_BG,
    borderWidth: 1,
    borderColor: Colors.sageMuted,
    paddingHorizontal: 4,
    shadowColor: Colors.darkBackground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
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
    backgroundColor: Colors.sageMuted,
  },
  pillLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.1,
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
    top: (PILL_HEIGHT - CIRCLE_SIZE) / 2,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: PILL_BG,
    borderWidth: 1,
    borderColor: Colors.sageMuted,
    shadowColor: Colors.darkBackground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapsedCircleTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
