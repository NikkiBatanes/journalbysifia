import React, { useRef, useCallback, useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  StyleSheet,
  Alert,
  FlatList,
  Animated,
  Pressable,
  TouchableOpacity,
  NativeModules,
  Dimensions,
  ScrollView,
  DeviceEventEmitter,
  TextInput,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../services/supabaseClient';

const { width } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 16;
const VISIBLE_WIDTH = Math.max(0, width - CARD_HORIZONTAL_PADDING * 2);
const isTablet = width >= 768;
const ITEM_WIDTH = isTablet ? 384 : Math.round(VISIBLE_WIDTH * 0.8);
const ITEM_SPACING = 8;

const ITEM_SIZE = ITEM_WIDTH + ITEM_SPACING;
const SIDE_INSET = Math.max(
  0,
  isTablet ? 24 : Math.round((VISIBLE_WIDTH - ITEM_WIDTH) / 2),
);

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useScroll } from '../context/ScrollContext';

import DevotionalModal from '../components/DevotionalModal';
import BlueSheet from '../components/layout/BlueSheet';
import { Colors, Fonts } from '../theme';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import ThemedText from '../components/common/ThemedText';
import { useTheme } from '../theme/ThemeContext';
import { getFontFamily } from '../theme/fonts';
import type { Playbook } from '../interfaces/playbook';
import { deletePlaybook, getPlaybook, getPlaybooks } from '../services/apiIntegration';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useQuery } from '@tanstack/react-query';
import { useIntelligentPrefetching } from '../services/hooks/useAdvancedPlaybookData';
import { PlaybookSkeleton } from '../components/SkeletonLoader/PlaybookSkeleton';
import { pdfExportService } from '../utils/pdfExportService';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { PDF_EXPORT_UPGRADE_PROMPT } from '../services/tierRestrictionService';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';

// Import gesture handler at the top level
import 'react-native-gesture-handler'; // This is needed for gesture handling

interface TaskStats {
  completed: number;
  total: number;
}

interface FaithfulAction {
  id: string;
  playbookId: string;
  playbookTitle: string;
  playbookCategory: string;
  actionIndex: number;
  actionTitle: string;
  actionDescription: string;
  completed: boolean;
  totalActions: number;
  completedActions: number;
  playbookUpdatedAt: string;
}

// Calculate completed and total tasks for a playbook's action steps (optimized)
export const calculateTaskStats = (actionSteps: any[] = []): TaskStats => {
  // Early return for empty or invalid input
  if (!Array.isArray(actionSteps) || actionSteps.length === 0) {
    return { completed: 0, total: 0 };
  }

  let completed = 0;
  let total = 0;

  for (const step of actionSteps) {
    if (!step) {continue;}

    if (Array.isArray(step.subTasks) && step.subTasks.length > 0) {
      // Count sub-tasks for steps that have them
      for (const subTask of step.subTasks) {
        if (subTask?.completed) {completed++;}
        total++;
      }
    } else {
      // Count regular steps that don't have sub-tasks
      if (step.completed) {completed++;}
      total++;
    }
  }

  return { completed, total };
};

// Helper function to get category from playbook (AI-generated, with fallback)
const getCategory = (playbook: Playbook): string => {
  return playbook.category || 'Growth';
};

// Estimate reading time for a block of text at ~200 wpm
const estimateReadTime = (text: string): string => {
  if (!text) { return ''; }
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
};

// Extract incomplete faithful actions from playbooks (both in-progress and completed)
const extractIncompleteFaithfulActions = (playbooks: Playbook[]): FaithfulAction[] => {
  const actions: FaithfulAction[] = [];

  for (const playbook of playbooks) {
    // Process all playbooks, regardless of completion status
    // A playbook can be marked as completed even if some action steps are still incomplete
    if (!playbook.actionSteps || !Array.isArray(playbook.actionSteps)) {continue;}

    const { completed, total } = calculateTaskStats(playbook.actionSteps);

    // Iterate through action steps to find incomplete ones
    for (let i = 0; i < playbook.actionSteps.length; i++) {
      const step = playbook.actionSteps[i];
      if (!step) {continue;}

      // Check if this step is incomplete
      const isStepIncomplete = !step.completed;

      // Handle subtasks if present
      if (Array.isArray(step.subTasks) && step.subTasks.length > 0) {
        for (let j = 0; j < step.subTasks.length; j++) {
          const subTask = step.subTasks[j];
          if (!subTask || subTask.completed) {continue;}

          actions.push({
            id: `${playbook.id}-${i}-${j}`,
            playbookId: playbook.id,
            playbookTitle: playbook.title,
            playbookCategory: getCategory(playbook),
            actionIndex: i + 1,
            actionTitle: subTask.text || step.title || `Faithful Action ${i + 1}`,
            actionDescription: step.description || '',
            completed: false,
            totalActions: total,
            completedActions: completed,
            playbookUpdatedAt: playbook.updatedAt || playbook.createdAt || new Date().toISOString(),
          });
        }
      } else if (isStepIncomplete) {
        // Top-level step that's incomplete
        actions.push({
          id: `${playbook.id}-${i}`,
          playbookId: playbook.id,
          playbookTitle: playbook.title,
          playbookCategory: getCategory(playbook),
          actionIndex: i + 1,
          actionTitle: step.title || `Faithful Action ${i + 1}`,
          actionDescription: step.description || '',
          completed: false,
          totalActions: total,
          completedActions: completed,
          playbookUpdatedAt: playbook.updatedAt || playbook.createdAt || new Date().toISOString(),
        });
      }
    }
  }

  // Sort by most recently updated playbook
  return actions.sort((a, b) => {
    const dateA = new Date(a.playbookUpdatedAt).getTime();
    const dateB = new Date(b.playbookUpdatedAt).getTime();
    return dateB - dateA;
  });
};

// Derive per-section state from walkthrough_progress and action step completion
// completed = Next was pressed on that step OR all action steps in that section are completed
// viewed = user was there but didn't press Next OR some action steps are completed OR prayed/read for Prayer/Words
// unreached = never got there
const getSectionState = (
  sectionStep: number,
  wp: number,
  completedSteps?: number,
  totalSteps?: number,
  sessionStates?: Record<string, { hasPrayed: boolean; hasRead: boolean }>,
  playbookId?: string,
): 'completed' | 'viewed' | 'unreached' => {
  if (wp < 0 && (!completedSteps || completedSteps === 0)) { return 'unreached'; }
  if (wp >= sectionStep) { return 'completed'; }
  // For Faithful Actions (step 3), if any action steps are completed, mark as viewed
  if (sectionStep === 3 && completedSteps && completedSteps > 0) { return 'viewed'; }
  // For Prayer (step 4), check if user has prayed
  if (sectionStep === 4 && sessionStates && playbookId && sessionStates[playbookId]?.hasPrayed) { return 'viewed'; }
  // For Words to Speak (step 5), check if user has read
  if (sectionStep === 5 && sessionStates && playbookId && sessionStates[playbookId]?.hasRead) { return 'viewed'; }
  // For Prayer (step 4) and Words to Speak (step 5), if walkthrough_progress >= sectionStep, mark as viewed
  if ((sectionStep === 4 || sectionStep === 5) && wp >= sectionStep) { return 'viewed'; }
  // For other sections, use walkthrough_progress
  if (wp + 1 === sectionStep) { return 'viewed'; }
  return 'unreached';
};

interface CardSection {
  label: string;
  step: number;
  metaIcon?: string;
  actionIcon?: string;
  actionIconType?: 'material' | 'ionicons';
}

// Static — defined once at module level, never recreated on render
const CARD_SECTIONS: CardSection[] = [
  { label: 'Intro',                step: 0 },
  { label: 'Truth in Love',        step: 1, metaIcon: 'time-outline' },
  { label: 'Scripture to Anchor',  step: 2 },
  { label: 'Faithful Actions',     step: 3 },
  { label: 'Prayer',               step: 4, metaIcon: 'pray-outline',        actionIcon: 'hands-pray',             actionIconType: 'material' },
  { label: 'Words to Speak',       step: 5, metaIcon: 'volume-high-outline', actionIcon: 'chatbubble-ellipses-outline', actionIconType: 'ionicons' },
];

interface FaithfulActionCardProps {
  item: FaithfulAction;
  index: number;
  scrollX: Animated.AnimatedInterpolation<number>;
  cardStyles: any;
  onPress: (item: FaithfulAction) => void;
}

const FaithfulActionCard = React.memo(({ item, index, scrollX, cardStyles: st, onPress }: FaithfulActionCardProps) => {
  const scale = useMemo(() => scrollX.interpolate({ inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE], outputRange: [0.96, 1, 0.96], extrapolate: 'clamp' }), [scrollX, index]);
  const opacity = useMemo(() => scrollX.interpolate({ inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE], outputRange: [0.9, 1, 0.9], extrapolate: 'clamp' }), [scrollX, index]);
  const translateY = useMemo(() => scrollX.interpolate({ inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE], outputRange: [2, 0, 2], extrapolate: 'clamp' }), [scrollX, index]);

  const updatedDateStr = useMemo(() => {
    if (!item.playbookUpdatedAt) {return null;}
    const d = new Date(item.playbookUpdatedAt);
    return format(d, d.getFullYear() === CURRENT_YEAR ? 'EEE, MMM d' : 'EEE, MMM d, yyyy');
  }, [item.playbookUpdatedAt]);

  return (
    <TouchableOpacity style={st.carouselCardTouch} onPress={() => onPress(item)} activeOpacity={0.85}>
      <Animated.View style={[st.carouselCard, { transform: [{ scale }, { translateY }], opacity }]}>
        <View style={st.dateWithBadge}>
          {updatedDateStr ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="calendar" size={12} color="rgba(255,255,255,0.5)" />
              <ThemedText style={st.carouselDate}> Started {updatedDateStr}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={st.faithfulActionBadge}>
          <ThemedText weight="regular" style={st.faithfulActionLabel}>FAITHFUL ACTION</ThemedText>
        </View>
        <View style={st.faithfulActionTitleRow}>
          <View style={st.faithfulActionNumberBadge}>
            <ThemedText weight="bold" style={st.faithfulActionNumber}>{item.actionIndex}</ThemedText>
          </View>
          <ThemedText weight="semiBold" style={st.faithfulActionTitle}>{item.actionTitle}</ThemedText>
        </View>
        <ThemedText style={st.faithfulActionDescription} numberOfLines={3}>{item.actionDescription}</ThemedText>

        <View style={st.faithfulActionDivider} />

        <ThemedText style={st.faithfulActionFrom}>FROM PLAYBOOK</ThemedText>

        <ThemedText weight="semiBold" style={st.carouselCardTitle}>{item.playbookTitle}</ThemedText>

        <View style={st.faithfulActionDivider} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <ThemedText style={st.faithfulActionMeta}>{item.completedActions} of {item.totalActions} faithful actions acted on</ThemedText>
          <ThemedText style={st.faithfulActionMeta}>{Math.round((item.completedActions / item.totalActions) * 100)}%</ThemedText>
        </View>

        <View style={{ height: 6, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${(item.completedActions / item.totalActions) * 100}%`, backgroundColor: Colors.growthGreen, borderRadius: 2 }} />
        </View>

        {updatedDateStr && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <MaterialCommunityIcons name="clock" size={12} color="rgba(255,255,255,0.5)" />
            <ThemedText style={[st.faithfulActionMeta, { marginLeft: 4 }]}>Updated {updatedDateStr}</ThemedText>
          </View>
        )}

      </Animated.View>
    </TouchableOpacity>
  );
});

interface CarouselCardProps {
  item: Playbook;
  index: number;
  scrollX: Animated.AnimatedInterpolation<number>;
  isMenuOpen: boolean;
  hasPrayed: boolean;
  hasRead: boolean;
  devotionalCount: number;
  cardStyles: any;
  sessionStates: Record<string, { hasPrayed: boolean; hasRead: boolean }>;
  onPress: (item: Playbook) => void; onLongPress: (item: Playbook) => void;
  onMenuToggle: (id: string | null) => void; onDelete: (id: string) => void;
  onRenamePress: (item: Playbook) => void; onTagPress: (item: Playbook) => void;
  onDevotionalPress: (item: Playbook) => void; onExportPdfPress: (item: Playbook) => void; triggerHaptic: () => void;
}
const CURRENT_YEAR = new Date().getFullYear();
const CAROUSEL_CONTENT_STYLE = { paddingHorizontal: SIDE_INSET };

const CarouselCard = React.memo(({ item, index, scrollX, isMenuOpen, hasPrayed, hasRead, devotionalCount: _devotionalCount, cardStyles: st, sessionStates, onPress, onLongPress, onMenuToggle: _onMenuToggle, onDelete: _onDelete, onRenamePress: _onRenamePress, onTagPress: _onTagPress, onDevotionalPress: _onDevotionalPress, onExportPdfPress: _onExportPdfPress, triggerHaptic: _triggerHaptic }: CarouselCardProps) => {
  // Interpolation input range depends only on index — stable dep
  const scale      = useMemo(() => scrollX.interpolate({ inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE], outputRange: [0.96, 1, 0.96], extrapolate: 'clamp' }), [scrollX, index]);
  const opacity    = useMemo(() => scrollX.interpolate({ inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE], outputRange: [0.9,  1,   0.9],  extrapolate: 'clamp' }), [scrollX, index]);
  const translateY = useMemo(() => scrollX.interpolate({ inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE], outputRange: [2,    0,   2],    extrapolate: 'clamp' }), [scrollX, index]);

  const { completed, total } = useMemo(() => calculateTaskStats(item.actionSteps), [item.actionSteps]);
  const category = useMemo(() => getCategory(item), [item]);
  const truthInLoveText = (item.truthInLove as any)?.text || '';
  const tilReadTime = useMemo(() => estimateReadTime(truthInLoveText), [truthInLoveText]);

  // Memoize formatted dates — avoids 6 Date allocations per render
  const updatedDateStr = useMemo(() => {
    if (!item.updatedAt) {return null;}
    const d = new Date(item.updatedAt);
    return format(d, d.getFullYear() === CURRENT_YEAR ? 'EEE, MMM d' : 'EEE, MMM d, yyyy');
  }, [item.updatedAt]);
  const completedDateStr = useMemo(() => {
    if (!item.completedAt) {return null;}
    const d = new Date(item.completedAt);
    return format(d, d.getFullYear() === CURRENT_YEAR ? 'EEE, MMM d' : 'EEE, MMM d, yyyy');
  }, [item.completedAt]);

  const isCardCompleted = item.status === 'completed';
  const isRefined = (item.refinementCount || 0) > 0 || Boolean(item.lastRefinedAt);
  const wp = item.walkthroughProgress ?? -1;

  return (
    <TouchableOpacity style={st.carouselCardTouch} onPress={() => onPress(item)} onLongPress={() => onLongPress(item)} activeOpacity={0.85}>
      <Animated.View style={[st.carouselCard, { transform: [{ scale }, { translateY }], opacity }]}>
        <View style={st.gradientContainer}>
          <View style={st.categoryLabel}><ThemedText weight="bold" style={st.categoryLabelText}>{category}</ThemedText></View>
          <TouchableOpacity style={st.menuButton} onPress={() => { try { _triggerHaptic(); } catch {} _onMenuToggle(isMenuOpen ? null : item.id); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>
        </View>
        <View style={st.dateWithBadge}>
          {!isCardCompleted && updatedDateStr ? (
            <ThemedText style={st.carouselDate}>{updatedDateStr}</ThemedText>
          ) : null}
          {isRefined ? (
            <View style={st.refinedBadge}>
              <ThemedText weight="semiBold" style={st.refinedBadgeText}>Refined</ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText weight="semiBold" style={st.carouselCardTitle}>{item.title}</ThemedText>
        {item.userInput && <ThemedText style={st.carouselCardDescription} numberOfLines={1}>{item.userInput}</ThemedText>}
        {isCardCompleted ? (
          <View style={st.completedSummary}>
            <View style={st.completedSummaryTop}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.growthGreen} />
              <ThemedText style={st.completedSummaryText}>{completed} of {total} faithful actions acted on</ThemedText>
            </View>
            {completedDateStr && (
              <View style={st.completedSummaryDateRow}>
                <Ionicons name="calendar-outline" size={12} color={Colors.growthGreen} />
                <ThemedText style={st.completedDateText}>Completed {completedDateStr}</ThemedText>
              </View>
            )}
          </View>
        ) : (
          <View style={st.sectionsContainer}>
            {CARD_SECTIONS.map(({ label, step, metaIcon, actionIcon, actionIconType }) => {
              const state = getSectionState(step, wp, completed, total, sessionStates, item.id);
              // Derive dynamic values per section
              const meta = step === 1 ? tilReadTime
                         : step === 3 && total > 0 ? `${completed} of ${total} acted on`
                         : undefined;
              const actionIconState = step === 4 ? hasPrayed : step === 5 ? hasRead : false;
              return (
                <View key={label} style={st.sectionItem}>
                  <View style={[st.statusPill, state === 'completed' && st.statusPillCompleted, state === 'viewed' && st.statusPillViewed, state === 'unreached' && st.statusPillUnreached]}>
                    {state === 'completed' ? <View style={[st.statusPillFill, st.statusPillFillCompleted]} /> : <ThemedText style={[st.statusPillText, state === 'viewed' && st.statusPillTextViewed, state === 'unreached' && st.statusPillTextUnreached]}>{state === 'viewed' ? '◐' : '○'}</ThemedText>}
                  </View>
                  <View style={st.sectionContent}>
                    <ThemedText style={[st.sectionLabel, state === 'unreached' && st.sectionLabelMuted]}>{label}</ThemedText>
                    {meta && <View style={st.sectionMetaContainer}>{metaIcon && <Ionicons name={metaIcon as any} size={12} color={'rgba(255,255,255,0.4)'} style={st.sectionMetaIcon} />}<ThemedText style={[st.sectionInfo, state !== 'completed' && st.sectionInfoMuted]}>{meta}</ThemedText></View>}
                    {actionIcon && !meta && (actionIconType === 'ionicons' ? <Ionicons name={actionIcon as any} size={14} color={actionIconState ? Colors.alertCoral : 'rgba(255,255,255,0.4)'} style={st.sectionActionIcon} /> : <MaterialCommunityIcons name={actionIcon as any} size={14} color={actionIconState ? Colors.alertCoral : 'rgba(255,255,255,0.4)'} style={st.sectionActionIcon} />)}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

// ── Per-category horizontal carousel row ──────────────────────────────────
interface CategoryCarouselRowProps {
  category: string;
  playbooks: Playbook[];
  cardStyles: any;
  sessionStates: Record<string, { hasPrayed: boolean; hasRead: boolean }>;
  devotionalsCount: Record<string, number>;
  menuVisible: string | null;
  onPress: (item: Playbook) => void;
  onLongPress: (item: Playbook) => void;
  onMenuToggle: (id: string | null) => void;
  onDelete: (id: string) => void;
  onRenamePress: (item: Playbook) => void;
  onTagPress: (item: Playbook) => void;
  onDevotionalPress: (item: Playbook) => void;
  onExportPdfPress: (item: Playbook) => void;
  triggerHaptic: () => void;
}

const CategoryCarouselRow = React.memo(({
  category, playbooks, cardStyles: st, sessionStates, devotionalsCount,
  menuVisible, onPress, onLongPress, onMenuToggle, onDelete,
  onRenamePress, onTagPress, onDevotionalPress, onExportPdfPress, triggerHaptic,
}: CategoryCarouselRowProps) => {
  const rowScrollX = useRef(new Animated.Value(0)).current;

  const renderCard = useCallback(({ item, index }: { item: Playbook; index: number }) => (
    <CarouselCard
      item={item}
      index={index}
      scrollX={rowScrollX}
      isMenuOpen={menuVisible === item.id}
      hasPrayed={sessionStates[item.id]?.hasPrayed ?? false}
      hasRead={sessionStates[item.id]?.hasRead ?? false}
      devotionalCount={devotionalsCount[item.id] ?? 0}
      cardStyles={st}
      sessionStates={sessionStates}
      onPress={onPress}
      onLongPress={onLongPress}
      onMenuToggle={onMenuToggle}
      onDelete={onDelete}
      onRenamePress={onRenamePress}
      onTagPress={onTagPress}
      onDevotionalPress={onDevotionalPress}
      onExportPdfPress={onExportPdfPress}
      triggerHaptic={triggerHaptic}
    />
  ), [rowScrollX, menuVisible, sessionStates, devotionalsCount, st, onPress, onLongPress, onMenuToggle, onDelete, onRenamePress, onTagPress, onDevotionalPress, onExportPdfPress, triggerHaptic]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_SIZE, offset: ITEM_SIZE * index, index,
  }), []);

  return (
    <View style={st.categorySection}>
      <View style={st.categorySectionHeader}>
        <ThemedText weight="semiBold" style={st.categorySectionTitle}>{category.toUpperCase()}</ThemedText>
        <View style={st.categorySectionCount}>
          <ThemedText style={st.categorySectionCountText}>{playbooks.length}</ThemedText>
        </View>
      </View>
      <Animated.FlatList
        horizontal
        data={playbooks}
        keyExtractor={(p: Playbook) => p.id}
        renderItem={renderCard}
        getItemLayout={getItemLayout}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={CAROUSEL_CONTENT_STYLE}
        decelerationRate="fast"
        snapToInterval={ITEM_SIZE}
        snapToAlignment="center"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: rowScrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        directionalLockEnabled={true}
        disableIntervalMomentum={false}
        bounces={false}
        removeClippedSubviews={false}
      />
    </View>
  );
});


// ── Faithful Actions horizontal carousel row ──────────────────────────────────
interface FaithfulActionsCarouselRowProps {
  faithfulActions: FaithfulAction[];
  cardStyles: any;
  onPress: (item: FaithfulAction) => void;
  triggerHaptic: () => void;
}

const FaithfulActionsCarouselRow = React.memo(({
  faithfulActions,
  cardStyles: st,
  onPress,
  triggerHaptic: _triggerHaptic,
}: FaithfulActionsCarouselRowProps) => {
  const rowScrollX = useRef(new Animated.Value(0)).current;

  const renderFACard = useCallback(({ item, index }: { item: FaithfulAction; index: number }) => (
    <FaithfulActionCard
      item={item}
      index={index}
      scrollX={rowScrollX}
      cardStyles={st}
      onPress={onPress}
    />
  ), [rowScrollX, st, onPress]);

  const getFAItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_SIZE, offset: ITEM_SIZE * index, index,
  }), []);

  return (
    <View style={st.categorySection}>
      <View style={st.categorySectionHeader}>
        <ThemedText weight="semiBold" style={st.categorySectionTitle}>CONTINUE FAITHFUL ACTIONS</ThemedText>
        <View style={st.categorySectionCount}>
          <ThemedText style={st.categorySectionCountText}>{faithfulActions.length}</ThemedText>
        </View>
      </View>
      <Animated.FlatList
        horizontal
        data={faithfulActions}
        keyExtractor={(a: FaithfulAction) => a.id}
        renderItem={renderFACard}
        getItemLayout={getFAItemLayout}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={CAROUSEL_CONTENT_STYLE}
        decelerationRate="fast"
        snapToInterval={ITEM_SIZE}
        snapToAlignment="center"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: rowScrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        directionalLockEnabled={true}
        disableIntervalMomentum={false}
        bounces={false}
        removeClippedSubviews={true}
      />
    </View>
  );
});

// ─── Picker Modal ─────────────────────────────────────────────────────────────
// Extracted as React.memo so pill taps ONLY re-render this small component,
// never the full PlaybookListScreen.
type PickerModalProps = {
  visible: boolean;
  filter: 'ongoing' | 'completed' | 'faithful';
  initContentView: 'all' | 'category' | 'date';
  initDateViewMode: 'weekly' | 'monthly' | 'yearly' | 'custom';
  initSelectedCategories: string[];
  initCustomDateFrom: Date;
  initCustomDateTo: Date;
  availableCategories: string[];
  onClose: () => void;
  onFilterChange: (f: 'ongoing' | 'completed' | 'faithful') => void;
  onApply: (
    contentView: 'all' | 'category' | 'date',
    dateViewMode: 'weekly' | 'monthly' | 'yearly' | 'custom',
    selectedCategories: string[],
    customDateFrom: Date,
    customDateTo: Date,
  ) => void;
  onHaptic: () => void;
};

// iOS inline DateTimePicker always renders at ~350pt regardless of layout.
// When it's open, we expand the card to match rather than cropping or scaling.
const IOS_PICKER_NATIVE_WIDTH = 350;

const PickerModal = React.memo(({
  visible, filter, initContentView, initDateViewMode, initSelectedCategories,
  initCustomDateFrom, initCustomDateTo, availableCategories,
  onClose, onFilterChange, onApply, onHaptic,
}: PickerModalProps) => {
  const [localView, setLocalView] = useState<'all' | 'category' | 'date'>(initContentView);
  const [localDateMode, setLocalDateMode] = useState<'weekly' | 'monthly' | 'yearly' | 'custom'>(initDateViewMode);
  const [localCategories, setLocalCategories] = useState<string[]>(initSelectedCategories);
  const [customFrom, setCustomFrom] = useState<Date>(initCustomDateFrom);
  const [customTo, setCustomTo] = useState<Date>(initCustomDateTo);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Sync local state whenever the modal opens so it starts from current values
  useEffect(() => {
    if (visible) {
      setLocalView(initContentView);
      setLocalDateMode(initDateViewMode);
      setLocalCategories(initSelectedCategories);
      setCustomFrom(initCustomDateFrom);
      setCustomTo(initCustomDateTo);
      setShowFromPicker(false);
      setShowToPicker(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Close + flush whatever local state is current
  const handleApplyAndClose = useCallback(() => {
    onApply(localView, localDateMode, localCategories, customFrom, customTo);
    onClose();
  }, [localView, localDateMode, localCategories, customFrom, customTo, onApply, onClose]);

  // Immediate apply helpers — used for auto-apply-and-close interactions
  const applyAndClose = useCallback((
    view: 'all' | 'category' | 'date',
    mode: 'weekly' | 'monthly' | 'yearly' | 'custom',
    cats: string[],
    from: Date,
    to: Date,
  ) => {
    onApply(view, mode, cats, from, to);
    onClose();
  }, [onApply, onClose]);

  const pickerStyles = React.useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.2)',
      justifyContent: 'flex-start',
      paddingTop: 112,
      alignItems: 'flex-end',
      paddingRight: 16,
    },
    card: {
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      borderRadius: 18,
      overflow: 'hidden',
      minWidth: 220,
      maxWidth: 350,
      paddingTop: 14,
      paddingBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    sectionLabel: {
      fontSize: 10,
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      color: 'rgba(255, 255, 255, 0.5)',
      paddingHorizontal: 16,
      paddingTop: 0,
    },
    pillRow: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
    },
    pill: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    pillActive: { backgroundColor: Colors.anchorBlue, borderColor: Colors.anchorBlue },
    pillActiveOngoing: { backgroundColor: Colors.anchorBlue, borderColor: Colors.anchorBlue },
    pillActiveCompleted: { backgroundColor: Colors.anchorBlue, borderColor: Colors.anchorBlue },
    pillActiveFaithful: { backgroundColor: Colors.anchorBlue, borderColor: Colors.anchorBlue },
    pillPressed: { transform: [{ scale: 0.93 }] as any, opacity: 0.75 },
    pillText: { fontSize: 13, fontFamily: Fonts.regular, color: 'rgba(255, 255, 255, 0.5)' },
    pillTextActive: { color: Colors.hopeWhite },
    pillTextOngoing: { color: Colors.hopeWhite },
    pillTextCompleted: { color: Colors.hopeWhite },
    pillTextFaithful: { color: Colors.hopeWhite },
    divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)', marginHorizontal: 16, marginVertical: 14 },
    applyBtn: {
      marginHorizontal: 16, marginTop: 12, marginBottom: 2,
      paddingVertical: 10, borderRadius: 999,
      backgroundColor: Colors.anchorBlue, alignItems: 'center' as const,
    },
    applyBtnText: { fontSize: 13, color: Colors.hopeWhite },
    customDateRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const,
      marginHorizontal: 16, marginTop: 10, marginBottom: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', overflow: 'hidden' as const,
    },
    customDateField: { flex: 1, alignItems: 'center' as const, paddingVertical: 10, gap: 2 },
    customDateSep: { width: 1, height: 32, backgroundColor: 'rgba(255, 255, 255, 0.15)' },
    customDateLabel: {
      fontSize: 10, fontFamily: Fonts.regular,
      color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' as const, letterSpacing: 0.8,
    },
    customDateValue: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.hopeWhite },

  }), []); // static — only computed once

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleApplyAndClose}>
      {/* Backdrop — tap to apply current local state and close */}
      <Pressable style={pickerStyles.overlay} onPress={handleApplyAndClose}>
        <Pressable
          style={[
            pickerStyles.card,
            // Expand card to fit the picker natively — no cropping, no scaling
            (showFromPicker || showToPicker) && {
              width: Math.min(IOS_PICKER_NATIVE_WIDTH, width - 32),
            },
          ]}
        >

          {/* ── VIEW ──────────────────────────────────── */}
          <ThemedText weight="semiBold" style={pickerStyles.sectionLabel}>View</ThemedText>
          <View style={pickerStyles.pillRow}>
            {(['all', 'category', 'date'] as const).map(v => {
              const active = localView === v;
              return (
                <Pressable key={v}
                  style={({ pressed }) => [pickerStyles.pill, active && pickerStyles.pillActive, pressed && pickerStyles.pillPressed]}
                  onPress={() => {
                    onHaptic();
                    if (v === 'all') {
                      // All: immediate apply + close
                      applyAndClose('all', localDateMode, [], customFrom, customTo);
                    } else {
                      // Category / Date: switch sub-section, modal stays open
                      setLocalView(v);
                    }
                  }}
                >
                  <ThemedText weight={active ? 'semiBold' : 'regular'}
                    style={[pickerStyles.pillText, active && pickerStyles.pillTextActive]}>
                    {v === 'all' ? 'All' : v === 'category' ? 'Category' : 'Date'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* ── CATEGORY sub-section ─────────────────── */}
          {localView === 'category' && availableCategories.length > 0 && (
            <>
              <ThemedText weight="semiBold" style={[pickerStyles.sectionLabel, { marginTop: 14 }]}>Categories</ThemedText>
              <View style={pickerStyles.pillRow}>
                {availableCategories.map(cat => {
                  const sel = localCategories.includes(cat);
                  return (
                    <Pressable key={cat}
                      style={({ pressed }) => [pickerStyles.pill, sel && pickerStyles.pillActive, pressed && pickerStyles.pillPressed]}
                      onPress={() => {
                        onHaptic();
                        // Toggle and immediately apply — no button needed
                        const next = sel
                          ? localCategories.filter(c => c !== cat)
                          : [...localCategories, cat];
                        setLocalCategories(next);
                        applyAndClose('category', localDateMode, next, customFrom, customTo);
                      }}
                    >
                      <ThemedText weight={sel ? 'semiBold' : 'regular'}
                        style={[pickerStyles.pillText, sel && pickerStyles.pillTextActive]}>
                        {cat}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              {/* No Apply button — tap a category to select, backdrop to close */}
            </>
          )}

          {/* ── DATE VIEW sub-section ────────────────── */}
          {localView === 'date' && (
            <>
              <ThemedText weight="semiBold" style={[pickerStyles.sectionLabel, { marginTop: 14 }]}>Date View</ThemedText>
              <View style={pickerStyles.pillRow}>
                {(['weekly', 'monthly', 'yearly', 'custom'] as const).map(m => {
                  const active = localDateMode === m;
                  const label = m === 'weekly' ? 'Weekly' : m === 'monthly' ? 'Monthly' : m === 'yearly' ? 'Yearly' : 'Custom';
                  return (
                    <Pressable key={m}
                      style={({ pressed }) => [pickerStyles.pill, active && pickerStyles.pillActive, pressed && pickerStyles.pillPressed]}
                      onPress={() => {
                        onHaptic();
                        setLocalDateMode(m);
                        if (m !== 'custom') {
                          // Weekly / Monthly / Yearly: immediate apply + close
                          applyAndClose('date', m, localCategories, customFrom, customTo);
                        }
                        // Custom: stay open to pick date range
                      }}
                    >
                      <ThemedText weight={active ? 'semiBold' : 'regular'}
                        style={[pickerStyles.pillText, active && pickerStyles.pillTextActive]}>
                        {label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom only: date range pickers + Apply button */}
              {localDateMode === 'custom' && (
                <>
                  <View style={pickerStyles.customDateRow}>
                    <Pressable style={({ pressed }) => [pickerStyles.customDateField, pressed && { opacity: 0.7 }]}
                      onPress={() => { setShowFromPicker(p => !p); setShowToPicker(false); }}>
                      <ThemedText weight="regular" style={pickerStyles.customDateLabel}>From</ThemedText>
                      <ThemedText weight="semiBold" style={pickerStyles.customDateValue}>{format(customFrom, 'MMM d, yyyy')}</ThemedText>
                    </Pressable>
                    <View style={pickerStyles.customDateSep} />
                    <Pressable style={({ pressed }) => [pickerStyles.customDateField, pressed && { opacity: 0.7 }]}
                      onPress={() => { setShowToPicker(p => !p); setShowFromPicker(false); }}>
                      <ThemedText weight="regular" style={pickerStyles.customDateLabel}>To</ThemedText>
                      <ThemedText weight="semiBold" style={pickerStyles.customDateValue}>{format(customTo, 'MMM d, yyyy')}</ThemedText>
                    </Pressable>
                  </View>
                  {showFromPicker && (
                    <DateTimePicker value={customFrom} mode="date" display="inline" maximumDate={customTo}
                      onChange={(_e, d) => { if (d) { setCustomFrom(d); } }}
                      style={{
                        // Explicit dimensions tell RN layout how much space to allocate —
                        // without these the card never gets the signal to expand.
                        // Height 390 covers both the month-calendar view and the
                        // month+year scroll wheel that appears when the header is tapped.
                        width: Math.min(IOS_PICKER_NATIVE_WIDTH, width - 32),
                        height: 390,
                      }}
                      accentColor={Colors.hopeWhite} themeVariant="dark" />
                  )}
                  {showToPicker && (
                    <DateTimePicker value={customTo} mode="date" display="inline" minimumDate={customFrom} maximumDate={new Date()}
                      onChange={(_e, d) => { if (d) { setCustomTo(d); } }}
                      style={{
                        width: Math.min(IOS_PICKER_NATIVE_WIDTH, width - 32),
                        height: 390,
                      }}
                      accentColor={Colors.hopeWhite} themeVariant="dark" />
                  )}
                  {/* Apply only needed for Custom since date selection requires confirmation */}
                  <Pressable style={({ pressed }) => [pickerStyles.applyBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => { onHaptic(); applyAndClose('date', 'custom', localCategories, customFrom, customTo); }}>
                    <ThemedText weight="semiBold" style={pickerStyles.applyBtnText}>Apply</ThemedText>
                  </Pressable>
                </>
              )}
            </>
          )}

          {/* ── DIVIDER ──────────────────────────────── */}
          <View style={pickerStyles.divider} />

          {/* ── STATUS ───────────────────────────────── */}
          <ThemedText weight="semiBold" style={pickerStyles.sectionLabel}>Status</ThemedText>
          <View style={pickerStyles.pillRow}>
            {(['ongoing', 'completed', 'faithful'] as const).map(s => {
              const active = filter === s;
              const ongoing = s === 'ongoing';
              const faithful = s === 'faithful';
              return (
                <Pressable key={s}
                  style={({ pressed }) => [
                    pickerStyles.pill,
                    active && (ongoing ? pickerStyles.pillActiveOngoing : faithful ? pickerStyles.pillActiveFaithful : pickerStyles.pillActiveCompleted),
                    pressed && pickerStyles.pillPressed,
                  ]}
                  onPress={() => { onHaptic(); onFilterChange(s); onClose(); }}
                >
                  <ThemedText weight={active ? 'semiBold' : 'regular'} style={[
                    pickerStyles.pillText,
                    active && (ongoing ? pickerStyles.pillTextOngoing : faithful ? pickerStyles.pillTextFaithful : pickerStyles.pillTextCompleted),
                  ]}>
                    {ongoing ? 'In Progress' : faithful ? 'Faithful Actions' : 'Completed'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
});

const PlaybookListScreen = ({ navigation }: any) => {
  const { user, session, isAuthenticated } = useAuth();
  const userId = user?.id || session?.user?.id;
  const theme = useTheme();
  const { currentFont } = theme;
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, 'regular');
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const pdfExportAccess = useFeatureAccess({ feature: 'export_pdf' });
  const { setShowTabBar } = useScroll();
  const tabBarCollapsedRef = useRef(false);

  // State for creating a devotional from a playbook via long-press
  const [devotionalModalVisible, setDevotionalModalVisible] = useState(false);
  const [selectedPlaybookForDevotional, setSelectedPlaybookForDevotional] = useState<Playbook | null>(null);

  // State for rename playbook
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [selectedPlaybookForRename, setSelectedPlaybookForRename] = useState<Playbook | null>(null);
  const [newTitle, setNewTitle] = useState('');

  // State for tag playbook
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [selectedPlaybookForTag, setSelectedPlaybookForTag] = useState<Playbook | null>(null);
  const [selectedTag, setSelectedTag] = useState('');
  const [customTag, setCustomTag] = useState('');

  // Predefined tags
  const predefinedTags = [
    'Relationships',
    'Marriage',
    'Family',
    'Conflict',
    'Peace',
    'Career',
    'Work',
    'Finance',
    'Growth',
    'Health',
    'Spiritual',
    'Custom',
  ];

  // Subtle haptic feedback, gated by user preference
  // Collapse bottom nav on scroll down, expand only when scrolling back to the very top
  const lastScrollYRef = useRef(0);
  const handleScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const isScrollingUp = y < lastScrollYRef.current;
    lastScrollYRef.current = y;
    if (y > 60 && !tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = true;
      setShowTabBar(false);
    } else if (isScrollingUp && y <= 0 && tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);
    }
  }, [setShowTabBar]);

  // Always expand tab bar when returning to this screen
  useFocusEffect(
    useCallback(() => {
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);
    }, [setShowTabBar])
  );

  const hapticModuleRef = useRef<any>(null);
  const triggerLightHaptic = useCallback(() => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) { return; }
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) { return; }
      if (!hapticModuleRef.current) {
        hapticModuleRef.current = require('react-native-haptic-feedback');
      }
      const triggerFn = hapticModuleRef.current?.default?.trigger || hapticModuleRef.current?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('impactLight', { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
      }
    } catch {}
  }, [user]);

  // Logging for user state

  // Fetch playbooks from database using React Query with proper caching
  const { data: playbooks = [], isLoading, refetch, isFetching } = useQuery<Playbook[]>({
    queryKey: ['playbooks', userId, 'lightweight'],
    queryFn: () => {
      // Use lightweight mode for list view (80% data reduction)
      return getPlaybooks(userId || '', { lightweight: true });
    },
    enabled: !!userId && isAuthenticated, // Only run when we have a valid userId and are authenticated
    staleTime: 0, // No stale time - always refetch for real-time updates
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Enable automatic refetch on focus to update walkthrough_progress
    retry: (failureCount) => {

      return failureCount < 3;
    },
  });

  // Listen for playbook action step updates from PlaybookWalkthrough and ActionStepsCard
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('playbookProgressUpdate', () => {
      // Force immediate refetch to get updated data
      // Small delay to ensure database update completes
      setTimeout(() => {
        refetch();
      }, 100);
    });
    const refinementSubscription = DeviceEventEmitter.addListener('playbook_refined', () => {
      setTimeout(() => {
        refetch();
      }, 100);
    });

    return () => {
      subscription.remove();
      refinementSubscription.remove();
    };
  }, [refetch]);

  // Advanced prefetching for lightning-fast navigation
  const { prefetchVisiblePlaybooks } = useIntelligentPrefetching(userId || '');

  // Stable ref for playbook IDs to avoid recreating callback on every query update
  const playbookIdsRef = useRef<string[]>([]);
  useEffect(() => {
    playbookIdsRef.current = playbooks.map(p => p.id);
  }, [playbooks]);

  // Throttle session state loads — only reload if >5s have passed (avoids N AsyncStorage reads on every tab press)
  const lastSessionLoadRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastSessionLoadRef.current < 5000) { return; }
      const ids = playbookIdsRef.current;
      if (ids.length === 0) { return; }
      lastSessionLoadRef.current = now;
      const loadAll = async () => {
        const entries: Record<string, { hasPrayed: boolean; hasRead: boolean }> = {};
        await Promise.all(
          ids.map(async (id) => {
            try {
              const raw = await AsyncStorage.getItem(`playbook_session_${id}`);
              if (raw) {
                const sess = JSON.parse(raw);
                entries[id] = {
                  hasPrayed: sess.hasPrayed ?? false,
                  hasRead: sess.hasRead ?? false,
                };
              }
            } catch (_) {}
          })
        );
        setSessionStates(entries);
      };
      loadAll();
    }, [])
  );

  // Listen for prayer/reads updates from PlaybookWalkthrough
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('playbookPrayerReadUpdated', (data) => {
      setSessionStates(prev => ({
        ...prev,
        [data.playbookId]: {
          hasPrayed: data.hasPrayed ?? prev[data.playbookId]?.hasPrayed ?? false,
          hasRead: data.hasRead ?? prev[data.playbookId]?.hasRead ?? false,
        },
      }));
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle rename playbook
  const handleRenamePlaybook = useCallback(async () => {
    if (!selectedPlaybookForRename || !newTitle.trim()) {return;}

    try {
      triggerLightHaptic();
      const { error } = await supabase
        .from('playbooks')
        .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', selectedPlaybookForRename.id);

      if (error) {throw error;}

      // Refetch to update data
      refetch();

      setRenameModalVisible(false);
      setNewTitle('');
      setSelectedPlaybookForRename(null);
    } catch (err) {
      Logger.error('Error renaming playbook', err as Error, { component: 'PlaybookListScreen' });
      Alert.alert('Error', 'Failed to rename playbook. Please try again.');
    }
  }, [selectedPlaybookForRename, newTitle, triggerLightHaptic, refetch]);

  // Handle tag playbook
  const handleTagPlaybook = useCallback(async () => {
    if (!selectedPlaybookForTag) {return;}

    const finalTag = selectedTag === 'Custom' ? customTag.trim() : selectedTag;
    if (!finalTag) {return;}

    try {
      triggerLightHaptic();
      const { error } = await supabase
        .from('playbooks')
        .update({ tag: finalTag, updated_at: new Date().toISOString() })
        .eq('id', selectedPlaybookForTag.id);

      if (error) {throw error;}

      // Refetch to update data
      refetch();

      setTagModalVisible(false);
      setSelectedTag('');
      setCustomTag('');
      setSelectedPlaybookForTag(null);
    } catch (err) {
      Logger.error('Error tagging playbook', err as Error, { component: 'PlaybookListScreen' });
      Alert.alert('Error', 'Failed to tag playbook. Please try again.');
    }
  }, [selectedPlaybookForTag, selectedTag, customTag, triggerLightHaptic, refetch]);

  // Status filter
  const [filter, setFilter] = useState<'ongoing' | 'completed' | 'faithful'>('ongoing');
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // All picker/view state batched into one object — a single setState = a single re-render
  const [pickerState, setPickerState] = useState<{
    contentView: 'all' | 'category' | 'date';
    dateViewMode: 'weekly' | 'monthly' | 'yearly' | 'custom';
    selectedCategories: string[];
    customDateFrom: Date;
    customDateTo: Date;
  }>({
    contentView: 'all',
    dateViewMode: 'monthly',
    selectedCategories: [],
    customDateFrom: (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; })(),
    customDateTo: new Date(),
  });
  const { contentView, dateViewMode, selectedCategories, customDateFrom, customDateTo } = pickerState;
  // Time filter for "Continue your playbooks" section (legacy, kept for continuePlaybooks memo)
  const [continueTimeFilter] = useState<'latest'>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  // Native-driver anim used only for the search icon button scale (not height)
  const searchIconAnim = useRef(new Animated.Value(1)).current;
  const searchInputRef = useRef<TextInput>(null);
  const [devotionalsCount, setDevotionalsCount] = useState<Record<string, number>>({});
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [selectedPlaybookForMenu, setSelectedPlaybookForMenu] = useState<Playbook | null>(null);
  const menuVisibleRef = useRef<string | null>(null);
  useEffect(() => { menuVisibleRef.current = menuVisible; }, [menuVisible]);
  const [sessionStates, setSessionStates] = useState<Record<string, { hasPrayed: boolean; hasRead: boolean }>>({});

  // Auto-close dropdown menu when navigating away
  useFocusEffect(
    useCallback(() => {
      return () => {
        setMenuVisible(null);
      };
    }, [])
  );

  // Deferred versions — content rendering uses these so expensive work is deferred
  // while pill visuals / modal state update instantly from the originals
  const deferredFilter = useDeferredValue(filter);
  const deferredSelectedCategories = useDeferredValue(selectedCategories);
  const deferredContentView = useDeferredValue(contentView);
  const deferredDateViewMode = useDeferredValue(dateViewMode);

  // Memoized style objects — prevents ScrollView layout recalculation on every render
  const scrollContentStyle = useMemo(() => ({ paddingBottom: tabBarHeight + 32 }), [tabBarHeight]);

  const toggleSearch = useCallback(() => {
    const opening = !showSearch;

    // LayoutAnimation runs on the native thread — no JS-thread jank for height changes
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });

    setShowSearch(opening);
    if (!opening) {
      setSearchQuery('');
    } else {
      // Focus after layout settles
      setTimeout(() => { searchInputRef.current?.focus(); }, 50);
    }

    // Subtle native-driver press pop on the icon button
    Animated.sequence([
      Animated.timing(searchIconAnim, { toValue: 0.88, duration: 80, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.spring(searchIconAnim, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 6 }),
    ]).start();
  }, [showSearch, searchIconAnim]);

  // PickerModal callbacks — close modal immediately, defer heavy state update until after fade animation
  const handlePickerApply = useCallback((
    cv: 'all' | 'category' | 'date',
    dm: 'weekly' | 'monthly' | 'yearly' | 'custom',
    cats: string[],
    from: Date,
    to: Date,
  ) => {
    // Close modal right away so fade animation isn't competing with re-render work
    setShowStatusPicker(false);
    // Wait for Modal's fade-out to finish (~250ms) before the heavy state update.
    // InteractionManager alone is unreliable here — Modal's animation isn't always
    // registered as an interaction, so it can fire immediately.
    setTimeout(() => {
      setPickerState({ contentView: cv, dateViewMode: dm, selectedCategories: cats, customDateFrom: from, customDateTo: to });
    }, 260);
  }, []);

  const handlePickerClose = useCallback(() => setShowStatusPicker(false), []);
  const handlePickerFilterChange = useCallback((f: 'ongoing' | 'completed' | 'faithful') => {
    setTimeout(() => setFilter(f), 260);
  }, []);

  // Component renders with current state

  // Removed loadPlaybooksCallback - React Query handles data fetching automatically

  // DISABLED: Entrance animations cause ghosting/fading during data updates
  // Since we've optimized data loading to be instant, animations are unnecessary
  // const hasInitializedAnimations = useRef(false);
  // useEffect(() => {
  //   if (playbooks.length > 0 && !hasInitializedAnimations.current) {
  //     hasInitializedAnimations.current = true;
  //     initAnimations(playbooks.length);
  //   }
  // }, [playbooks.length]);

  // Refetch data whenever screen gains focus (e.g. returning from PlaybookWalkthrough after marking actions done)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setFilter('ongoing'); // React bails out (no re-render) when value is already 'ongoing'
      refetch(); // Always refetch fresh data on screen focus
    });
    return () => { unsubscribe(); };
  }, [navigation, refetch]);

  // Additional effect to handle userId changes and ensure data loading
  useEffect(() => {

    // If we have a userId and are authenticated but no playbooks and we're not currently loading, force a refetch
    if (userId && isAuthenticated && playbooks.length === 0 && !isLoading && !isFetching) {

      const timer = setTimeout(() => {
        refetch();
      }, 100);

      return () => clearTimeout(timer);
    }

    // If we lost authentication, clear any cached data
    if (!isAuthenticated && playbooks.length > 0) {

    }
  }, [userId, isAuthenticated, playbooks.length, isLoading, isFetching, refetch]);

  // React Query will automatically refetch when userId changes due to queryKey dependency

  // OPTIMIZED: Cache progress calculations to avoid recalculating on every filter change
  const playbooksWithProgress = useMemo(() => {
    if (!Array.isArray(playbooks) || playbooks.length === 0) {
      return [];
    }

    return playbooks.map(playbook => {
      if (!playbook?.actionSteps) {
        return { playbook, progress: 0, isCompleted: false };
      }

      const { completed, total } = calculateTaskStats(playbook.actionSteps);
      const progress = total > 0 ? (completed / total) * 100 : 0;
      // Completion is driven by the status field (Save & Finish pressed), not action step math
      const isCompleted = playbook.status === 'completed';

      return { playbook, progress, isCompleted };
    });
  }, [playbooks]);

  // Extract incomplete faithful actions from in-progress playbooks
  const incompleteFaithfulActions = useMemo(() => {
    if (!Array.isArray(playbooks) || playbooks.length === 0) {
      return [];
    }
    return extractIncompleteFaithfulActions(playbooks);
  }, [playbooks]);

  // Fetch devotionals count for each playbook — stable dep: playbooks.length, not the full array ref
  const playbooksLengthRef = useRef(0);
  const devotionalsCountLoadedRef = useRef(false);
  useEffect(() => {
    if (!userId || playbooks.length === 0) {return;}
    if (playbooks.length === playbooksLengthRef.current && devotionalsCountLoadedRef.current) {return;}
    playbooksLengthRef.current = playbooks.length;

    const fetchDevotionalsCount = async () => {
      try {
        const { data: devotionals, error } = await supabase
          .from('devotionals')
          .select('playbook_id')
          .eq('user_id', userId);

        if (error) {throw error;}

        const counts: Record<string, number> = {};
        devotionals?.forEach((devotional: any) => {
          if (devotional.playbook_id) {
            counts[devotional.playbook_id] = (counts[devotional.playbook_id] || 0) + 1;
          }
        });

        setDevotionalsCount(counts);
        devotionalsCountLoadedRef.current = true;
      } catch (err) {
        Logger.error('Error fetching devotionals count', err as Error, { component: 'PlaybookListScreen' });
      }
    };

    fetchDevotionalsCount();
  }, [userId, playbooks.length]);

  // Filter and sort playbooks by status and search
  const filteredPlaybooks = useMemo(() => {
    if (playbooksWithProgress.length === 0) { return []; }
    const hasSearch = searchQuery.trim().length > 0;

    const filtered = playbooksWithProgress.filter(({ isCompleted, playbook }) => {
      // Status filter — bypassed when user is actively searching (search crosses both statuses)
      if (!hasSearch) {
        if (deferredFilter === 'ongoing' && isCompleted) { return false; }
        if (deferredFilter === 'completed' && !isCompleted) { return false; }
      }

      // Search filter
      if (hasSearch) {
        const q = searchQuery.toLowerCase();
        const title = (playbook.title || '').toLowerCase();
        const cat = ((playbook as any).category || '').toLowerCase();
        const tag = (playbook.tag || '').toLowerCase();
        const input = (playbook.userInput || '').toLowerCase();
        if (!title.includes(q) && !cat.includes(q) && !tag.includes(q) && !input.includes(q)) {
          return false;
        }
      }

      return true;
    });

    return filtered
      .sort((a, b) => {
        const dateA = new Date(a.playbook.updatedAt || a.playbook.createdAt || 0).getTime();
        const dateB = new Date(b.playbook.updatedAt || b.playbook.createdAt || 0).getTime();
        return dateB - dateA;
      })
      .map(({ playbook }) => playbook);
  }, [playbooksWithProgress, deferredFilter, searchQuery]);

  // Intelligent prefetching: prefetch visible playbooks for instant navigation
  // Gate with a ref so background re-fetches of the same list don't fire 20+ duplicate DB calls
  const lastPrefetchedIdsRef = useRef<string>('');
  useEffect(() => {
    if (filteredPlaybooks.length > 0 && userId) {
      const idKey = filteredPlaybooks.slice(0, 5).map(p => p.id).join(',');
      if (idKey === lastPrefetchedIdsRef.current) {return;}
      lastPrefetchedIdsRef.current = idKey;
      const raf = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: (time?: number) => void) => setTimeout(() => cb(), 16);
      raf(() => {
        const visiblePlaybookIds = filteredPlaybooks.slice(0, 5).map(p => p.id);
        prefetchVisiblePlaybooks(visiblePlaybookIds).catch(error => {
          Logger.warn('[PlaybookListScreen] Prefetching failed', { component: 'PlaybookListScreen', data: error });
        });
      });
    }
  }, [filteredPlaybooks, userId, prefetchVisiblePlaybooks]);

  // (Remove any other filteredPlaybooks declarations below this point)

  // In-progress playbooks for "Continue" section — time-filtered, newest activity first
  const continuePlaybooks = useMemo(() => {
    if (deferredFilter === 'completed') {return [];}
    let list = playbooksWithProgress
      .filter(({ isCompleted }) => !isCompleted)
      .sort((a, b) => {
        const dateA = new Date(a.playbook.updatedAt || a.playbook.createdAt || 0).getTime();
        const dateB = new Date(b.playbook.updatedAt || b.playbook.createdAt || 0).getTime();
        return dateB - dateA;
      });
    if (continueTimeFilter !== 'latest') {
      const now = new Date();
      const cutoff = new Date(now);
      if (continueTimeFilter === 'week') { cutoff.setDate(now.getDate() - 7); }
      else if (continueTimeFilter === 'month') { cutoff.setMonth(now.getMonth() - 1); }
      else { cutoff.setFullYear(now.getFullYear() - 1); }
      list = list.filter(({ playbook }) =>
        new Date(playbook.updatedAt || playbook.createdAt || 0) >= cutoff,
      );
    }
    return list.map(({ playbook }) => playbook);
  }, [playbooksWithProgress, continueTimeFilter, deferredFilter]);

  // All playbooks grouped by category — both statuses, newest first per group
  // All unique categories the user actually has playbooks for
  const availableCategories = useMemo(() => {
    const seen = new Set<string>();
    playbooksWithProgress.forEach(({ playbook }) => {
      seen.add(getCategory(playbook));
    });
    return Array.from(seen).sort();
  }, [playbooksWithProgress]);

  const categorySections = useMemo(() => {
    const map = new Map<string, Playbook[]>();
    playbooksWithProgress.forEach(({ playbook, isCompleted }) => {
      if (deferredFilter === 'ongoing' && isCompleted) {return;}
      if (deferredFilter === 'completed' && !isCompleted) {return;}
      const cat = getCategory(playbook);
      // If specific categories are selected, skip others
      if (deferredSelectedCategories.length > 0 && !deferredSelectedCategories.includes(cat)) {return;}
      if (!map.has(cat)) { map.set(cat, []); }
      map.get(cat)!.push(playbook);
    });
    const sections: { category: string; playbooks: Playbook[] }[] = [];
    map.forEach((pbs, category) => {
      const sorted = [...pbs].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      sections.push({ category, playbooks: sorted });
    });
    // Sort sections by most recently active playbook in each group
    sections.sort((a, b) => {
      const dateA = new Date(a.playbooks[0]?.updatedAt || a.playbooks[0]?.createdAt || 0).getTime();
      const dateB = new Date(b.playbooks[0]?.updatedAt || b.playbooks[0]?.createdAt || 0).getTime();
      return dateB - dateA;
    });
    return sections;
  }, [playbooksWithProgress, deferredFilter, deferredSelectedCategories]);

  // All completed playbooks sorted by latest activity
  const completedPlaybooks = useMemo(() => {
    if (deferredFilter === 'ongoing') {return [];}
    return playbooksWithProgress
      .filter(({ isCompleted }) => isCompleted)
      .sort((a, b) => new Date(b.playbook.updatedAt || b.playbook.createdAt || 0).getTime() - new Date(a.playbook.updatedAt || a.playbook.createdAt || 0).getTime())
      .map(({ playbook }) => playbook);
  }, [playbooksWithProgress, deferredFilter]);

  // All playbooks sorted newest first (for date views) — respects status filter
  const allPlaybooksSorted = useMemo(() =>
    [...playbooksWithProgress]
      .filter(({ isCompleted }) => {
        if (deferredFilter === 'ongoing' && isCompleted) { return false; }
        if (deferredFilter === 'completed' && !isCompleted) { return false; }
        return true;
      })
      .sort((a, b) => new Date(b.playbook.updatedAt || b.playbook.createdAt || 0).getTime() - new Date(a.playbook.updatedAt || a.playbook.createdAt || 0).getTime())
      .map(({ playbook }) => playbook),
    [playbooksWithProgress, deferredFilter],
  );

  const currentYear = new Date().getFullYear();

  // Weekly sections: group by year-week key, sorted newest first
  const weeklySections = useMemo(() => {
    const map = new Map<string, { label: string; weekStart: Date; playbooks: Playbook[] }>();
    allPlaybooksSorted.forEach(pb => {
      const d = new Date(pb.updatedAt || pb.createdAt || 0);
      const dow = d.getDay(); // 0=Sun
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - dow);
      weekStart.setHours(0, 0, 0, 0);
      const key = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
      if (!map.has(key)) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const isCurrentYear = weekStart.getFullYear() === currentYear;
        const label = `${format(weekStart, 'MMM d')} – ${format(weekEnd, isCurrentYear ? 'MMM d' : 'MMM d, yyyy')}`;
        map.set(key, { label, weekStart, playbooks: [] });
      }
      map.get(key)!.playbooks.push(pb);
    });
    return Array.from(map.values()).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  }, [allPlaybooksSorted, currentYear]);

  // Monthly sections: group by year-month, sorted newest first; showYear flags year-change rows
  const monthlySections = useMemo(() => {
    const map = new Map<string, { label: string; year: number; month: number; playbooks: Playbook[] }>();
    allPlaybooksSorted.forEach(pb => {
      const d = new Date(pb.updatedAt || pb.createdAt || 0);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${m}`;
      if (!map.has(key)) {
        map.set(key, { label: format(d, 'MMMM'), year: y, month: m, playbooks: [] });
      }
      map.get(key)!.playbooks.push(pb);
    });
    const sorted = Array.from(map.values()).sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
    // Compute showYear once per item so renderItem in FlatList doesn't need local state
    let lastSeenYear: number | null = null;
    return sorted.map(item => {
      const showYear = item.year !== currentYear && item.year !== lastSeenYear;
      if (item.year !== currentYear) { lastSeenYear = item.year; }
      return { ...item, showYear };
    });
  }, [allPlaybooksSorted, currentYear]);

  // Yearly sections: group by year, sorted newest first
  const yearlySections = useMemo(() => {
    const map = new Map<number, { year: number; playbooks: Playbook[] }>();
    allPlaybooksSorted.forEach(pb => {
      const y = new Date(pb.updatedAt || pb.createdAt || 0).getFullYear();
      if (!map.has(y)) { map.set(y, { year: y, playbooks: [] }); }
      map.get(y)!.playbooks.push(pb);
    });
    return Array.from(map.values()).sort((a, b) => b.year - a.year);
  }, [allPlaybooksSorted]);

  // Custom date range filtered playbooks
  const customDatePlaybooks = useMemo(() => {
    const fromStart = new Date(customDateFrom); fromStart.setHours(0, 0, 0, 0);
    const toEnd = new Date(customDateTo); toEnd.setHours(23, 59, 59, 999);
    return allPlaybooksSorted.filter(pb => {
      const d = new Date(pb.updatedAt || pb.createdAt || 0).getTime();
      return d >= fromStart.getTime() && d <= toEnd.getTime();
    });
  }, [allPlaybooksSorted, customDateFrom, customDateTo]);

  // Unified data array for the date-view FlatList — computed from the active mode.
  // Defining this as a memo means FlatList data reference only changes when the sections change,
  // not on every unrelated render.
  type DateSectionItem = {
    key: string;
    category: string;
    playbooks: Playbook[];
    showYear: boolean;
    year?: number;
    isEmpty?: boolean;
  };
  const dateSectionItems = useMemo((): DateSectionItem[] => {
    switch (deferredDateViewMode) {
      case 'weekly':
        if (weeklySections.length === 0 || weeklySections.every(s => s.playbooks.length === 0)) {
          return [{ key: 'weekly-empty', category: '', playbooks: [], showYear: false, isEmpty: true }];
        }
        return weeklySections.map(s => ({
          key: s.weekStart.toISOString(),
          category: s.label,
          playbooks: s.playbooks,
          showYear: false,
        }));
      case 'monthly':
        if (monthlySections.length === 0 || monthlySections.every(s => s.playbooks.length === 0)) {
          return [{ key: 'monthly-empty', category: '', playbooks: [], showYear: false, isEmpty: true }];
        }
        return monthlySections.map(s => ({
          key: `${s.year}-${s.month}`,
          category: s.label,
          playbooks: s.playbooks,
          showYear: s.showYear,
          year: s.year,
        }));
      case 'yearly':
        if (yearlySections.length === 0 || yearlySections.every(s => s.playbooks.length === 0)) {
          return [{ key: 'yearly-empty', category: '', playbooks: [], showYear: false, isEmpty: true }];
        }
        return yearlySections.map(s => ({
          key: String(s.year),
          category: String(s.year),
          playbooks: s.playbooks,
          showYear: false,
        }));
      case 'custom':
        if (customDatePlaybooks.length === 0) {
          return [{ key: 'custom-empty', category: '', playbooks: [], showYear: false, isEmpty: true }];
        }
        return [{
          key: 'custom',
          category: `${format(customDateFrom, 'MMM d')} – ${format(customDateTo, 'MMM d, yyyy')}`,
          playbooks: customDatePlaybooks,
          showYear: false,
        }];
      default:
        return [];
    }
  }, [deferredDateViewMode, weeklySections, monthlySections, yearlySections, customDatePlaybooks, customDateFrom, customDateTo]);

  const isEmptyState = playbooks.length === 0 && !isLoading && !!userId;

  useScreenStatusBar(isEmptyState ? 'light' : 'auto', isEmptyState ? Colors.anchorBlue : undefined);

  const handleDelete = useCallback(async (id: string) => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try { triggerLightHaptic(); } catch {}
    Alert.alert(
      'Delete Playbook',
      'Are you sure you want to delete this playbook?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try { triggerLightHaptic(); } catch {}
            try {
              // Delete from database
              await deletePlaybook(id, user?.id || '');
              // Refresh the list after successful deletion
              await refetch();
            } catch (err) {
              Logger.error('Error deleting playbook', err as Error, { component: 'PlaybookListScreen' });
              // If there was an error, reload the playbooks to restore the correct state
              await refetch();
              Alert.alert('Error', 'Failed to delete playbook. Please try again.');
            }
          },
        },
      ]
    );
  }, [userId, triggerLightHaptic, user?.id, refetch]);

  // Move handleCardPress outside of renderItem
  const handleCardPress = useCallback((playbook: Playbook) => {
    // Don't navigate if menu is open for this card
    if (menuVisibleRef.current === playbook.id) {
      setMenuVisible(null);
      return;
    }
    triggerLightHaptic();
    navigation.navigate('PlaybookWalkthrough', { playbook });
  }, [navigation, triggerLightHaptic]);

  const handleCardLongPress = useCallback((playbook: Playbook) => {
    try { triggerLightHaptic(); } catch {}
    setSelectedPlaybookForDevotional(playbook);
    setDevotionalModalVisible(true);
  }, [triggerLightHaptic]);

  const handleRenamePress = useCallback((item: Playbook) => {
    setMenuVisible(null); setSelectedPlaybookForRename(item); setRenameModalVisible(true);
  }, []);
  const handleTagPress = useCallback((item: Playbook) => {
    setMenuVisible(null); setSelectedPlaybookForTag(item); setTagModalVisible(true);
  }, []);
  const handleDevotionalPress = useCallback((pb: Playbook) => {
    setMenuVisible(null); handleCardLongPress(pb);
  }, [handleCardLongPress]);

  const handleExportPdfPress = useCallback(async (item: Playbook) => {
    // Check feature access
    if (!pdfExportAccess.hasAccess) {
      const upgradePrompt = pdfExportAccess.accessResult?.upgradePrompt;
      const upgradeMessage = typeof upgradePrompt?.message === 'string'
        ? upgradePrompt.message
        : typeof upgradePrompt === 'object' && upgradePrompt?.message
          ? (upgradePrompt as any).message
          : PDF_EXPORT_UPGRADE_PROMPT;

      Alert.alert(
        'Upgrade Required',
        upgradeMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Upgrade',
            onPress: () => {
              (navigation as any).navigate('OnboardingSalesOffer' as any, {
                upgradeMode: true,
                currentTier: pdfExportAccess.accessResult?.requiredTier,
                skipNotificationPreference: true,
                featureType: 'export_pdf',
                source: 'playbook_list',
              });
            },
          },
        ]
      );
      return;
    }

    try {
      triggerLightHaptic();
      setMenuVisible(null);

      // Fetch the full playbook before exporting
      if (!userId) {
        Alert.alert('Error', 'Unable to export this playbook right now.');
        return;
      }

      const fullPlaybook = await getPlaybook(userId, item.id);
      if (!fullPlaybook) {
        Alert.alert('Error', 'Could not load the full playbook for export.');
        return;
      }

      // Get user metadata for name replacement
      const metaUser: any = (user as any)?.user_metadata || {};
      const metaFirstName = metaUser.first_name || (user as any)?.displayName?.split(' ')[0] || '';
      const metaDisplayName = (user as any)?.displayName ||
                            metaUser.full_name ||
                            [metaUser.first_name, metaUser.last_name].filter(Boolean).join(' ').trim() ||
                            '';

      // Get bible version from user preferences or default to NASB
      const bibleVersion = (user as any)?.user_metadata?.preferences?.content?.bibleVersion || 'NASB';

      // Use pdfExportService to generate and share PDF
      pdfExportService.exportPlaybookPDF({
        title: fullPlaybook.title,
        truthInLove: replaceAllNamePlaceholders(
          typeof fullPlaybook.truthInLove === 'string' ? fullPlaybook.truthInLove : fullPlaybook.truthInLove?.text || '',
          { firstName: metaFirstName, displayName: metaDisplayName },
          { replaceHardcodedNames: true }
        ),
        truthInLoveSummary: replaceAllNamePlaceholders(
          typeof fullPlaybook.truthInLove === 'string' ? '' : fullPlaybook.truthInLove?.summary || '',
          { firstName: metaFirstName, displayName: metaDisplayName },
          { replaceHardcodedNames: true }
        ),
        bibleVerse: {
          ...fullPlaybook.bibleVerse,
          version: bibleVersion,
        },
        bibleVerseReflection: fullPlaybook.bibleVerseReflection || '',
        actionSteps: fullPlaybook.actionSteps?.map(step => {
          // Derive examples similar to ActionStepsCard
          let examples: string[] = [];

          const rawExamples: any = (step as any).examples;

          if (rawExamples && typeof rawExamples === 'string') {
            if (/Example:\s*/i.test(rawExamples)) {
              const exampleMatches = rawExamples
                .split(/Example:\s*/i)
                .filter((text: string) => text.trim().length > 0);
              examples = exampleMatches.map((ex: string) => ex.replace(/^Example:\s*/i, '').trim());
            } else if (rawExamples.includes(';')) {
              examples = rawExamples
                .split(';')
                .map((ex: string) => ex.replace(/^Example:\s*/i, '').trim())
                .filter(Boolean);
            } else if (rawExamples.trim()) {
              examples = [rawExamples.replace(/^Example:\s*/i, '').trim()];
            }
          } else if (Array.isArray(rawExamples)) {
            examples = rawExamples.map((ex: string) => ex.replace(/^"+|"+$/g, '').replace(/^Example:\s*/i, '').trim());
          } else if (step.subTasks && step.subTasks.length > 0) {
            // Extract examples from subtasks that have is_example flag OR start with "example:"
            examples = step.subTasks
              .filter((st: any) =>
                (typeof st.text === 'string' && st.text.toLowerCase().startsWith('example:')) ||
                st.is_example === true ||
                st.isExample === true
              )
              .map((st: any) => st.text.replace(/^Example:\s*/i, '').trim());
          }

          return {
            title: step.title,
            description: step.description || '',
            subtasks: step.subTasks?.map((st: any) => st.text || st.title || st) || [],
            examples,
          };
        }),
        affirmations: fullPlaybook.affirmations?.map((a: any) =>
          replaceAllNamePlaceholders(
            typeof a === 'string' ? a : a?.text || '',
            { firstName: metaFirstName, displayName: metaDisplayName },
            { replaceHardcodedNames: true }
          )
        ) || [],
        prayer: fullPlaybook.prayer || '',
        wordsToSpeak: fullPlaybook.wordToSpeak || '',
        directChallenge: replaceAllNamePlaceholders(
          typeof fullPlaybook.directChallenge === 'string' ? fullPlaybook.directChallenge : fullPlaybook.directChallenge?.text || '',
          { firstName: metaFirstName, displayName: metaDisplayName },
          { replaceHardcodedNames: true }
        ),
        createdAt: fullPlaybook.createdAt,
      });
    } catch (error) {
      console.error('PDF Export Error:', error);
      Alert.alert('Error', 'Failed to export PDF');
    }
  }, [pdfExportAccess, navigation, triggerLightHaptic, user, userId]);

  // Stable renderItem for the date-view FlatList.
  // Defined with useCallback so its reference only changes when actual data/handlers change —
  // not on every parent render. Without this, FlatList re-renders ALL visible items on each
  // unrelated state change (e.g. menuVisible toggle, searchQuery keystroke).
  const renderDateSectionItem = useCallback(({ item }: { item: DateSectionItem }) => {
    if (item.isEmpty) {
      return null; // Handle empty state in ListHeaderComponent instead
    }
    return (
      <View>
        {item.showYear && item.year != null && (
          <View style={styles.dateSectionYearHeader}>
            <ThemedText weight="semiBold" style={styles.dateSectionYearText}>{item.year}</ThemedText>
          </View>
        )}
        <CategoryCarouselRow
          category={item.category}
          playbooks={item.playbooks}
          cardStyles={styles}
          sessionStates={sessionStates}
          devotionalsCount={devotionalsCount}
          menuVisible={menuVisible}
          onPress={handleCardPress}
          onLongPress={handleCardLongPress}
          onMenuToggle={(id) => {
            if (id) {
              const playbook = playbooks.find(p => p.id === id);
              setSelectedPlaybookForMenu(playbook || null);
            } else {
              setSelectedPlaybookForMenu(null);
            }
            setMenuVisible(id);
          }}
          onDelete={handleDelete}
          onRenamePress={handleRenamePress}
          onTagPress={handleTagPress}
          onDevotionalPress={handleDevotionalPress}
          onExportPdfPress={handleExportPdfPress}
          triggerHaptic={triggerLightHaptic}
        />
      </View>
    );
  }, [styles, sessionStates, devotionalsCount, menuVisible, handleCardPress, handleCardLongPress, handleDelete, handleRenamePress, handleTagPress, handleDevotionalPress, handleExportPdfPress, triggerLightHaptic, playbooks]);

  // Show loading state when we don't have a userId yet (auth loading) or not authenticated
  if (!userId || !isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left','right']}>
        <View style={styles.container}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, styles.pageInner]}
          >
            <PlaybookSkeleton />
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // Show empty state when we have no playbooks and we're not in initial loading state
  // Allow isFetching to be true (for pull-to-refresh) as long as we're not in initial loading
  if (playbooks.length === 0 && !isLoading && userId) {

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.anchorBlue }]} edges={['left','right']}>
        <View style={[styles.container, styles.containerEmpty, { backgroundColor: Colors.anchorBlue }]}>
          <View style={[styles.headerBar, { paddingTop: insets.top, backgroundColor: Colors.anchorBlue }]}>
            <View style={styles.pageInner}>
              {/* Hide header when empty; keep layout with spacer (match Devotionals) */}
              <View style={styles.headerSpacer} />
            </View>
          </View>

          {/* Empty state hero on anchor blue background via BlueSheet */}
          <BlueSheet style={styles.contentSheet}>
            <View style={[styles.emptyStateContainer, styles.pageInner]}>
              <View style={styles.emptyHeroContainer}>
                <View style={styles.heroCard}>
              <MaterialCommunityIcons
                name="clipboard-text-play"
                size={32}
                color="rgba(255,255,255,0.8)"
                style={styles.heroIcon}
              />
              <ThemedText weight="semiBold" style={styles.heroOverline}>NO PLAYBOOKS</ThemedText>
              <ThemedText weight="semiBold" style={styles.heroTitle}>Start a New Playbook</ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                Share what happened and what feels tangled. The more honest context you give, the more grounded your playbook can be.
              </ThemedText>

              <TouchableOpacity
                onPress={() => { triggerLightHaptic(); navigation.navigate('UserInput'); }}
                activeOpacity={0.85}
                style={styles.heroOutlineButton}
              >
                <MaterialIcons name="auto-fix-high" size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                <ThemedText weight="medium" style={styles.heroOutlineButtonText}>Start a Playbook</ThemedText>
              </TouchableOpacity>

                {/* Hint before bullets */}
                <ThemedText weight="semiBold" style={styles.stepsHint}>Helpful details to include:</ThemedText>

                {/* Guided steps */}
                <View style={styles.stepsContainer}>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><ThemedText weight="semiBold" style={styles.stepBadgeText}>1</ThemedText></View>
                  <ThemedText style={styles.stepText}>What happened</ThemedText>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><ThemedText weight="semiBold" style={styles.stepBadgeText}>2</ThemedText></View>
                  <ThemedText style={styles.stepText}>What feels painful or heavy</ThemedText>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><ThemedText weight="semiBold" style={styles.stepBadgeText}>3</ThemedText></View>
                  <ThemedText style={styles.stepText}>The situation or struggle</ThemedText>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}><ThemedText weight="semiBold" style={styles.stepBadgeText}>4</ThemedText></View>
                  <ThemedText style={styles.stepText}>A decision you need to make</ThemedText>
                </View>
                </View>
                {/* Subtle deliverable hint below bullets */}
                <ThemedText weight="medium" style={styles.stepsFootnote}>We'll turn this into a personalized playbook.</ThemedText>
                </View>
              </View>
            </View>
          </BlueSheet>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left','right']}>
      <View style={styles.container}>
        {/* ── WHITE HEADER ─────────────────────────────────────── */}
        <View style={[styles.headerBar, { paddingTop: insets.top }]}>
          <View style={styles.pageInner}>

            {/* Row 1: Title left, actions right */}
            <View style={styles.headerTopRow}>
              <ThemedText weight="bold" style={styles.headerTitle}>Playbooks</ThemedText>
              <View style={styles.headerActions}>
                {/* Status pill — shows current filter, not clickable */}
                <View
                  style={[
                    styles.statusDropdownBtn,
                    filter === 'ongoing' && styles.statusDropdownBtnOngoing,
                    filter === 'completed' && styles.statusDropdownBtnCompleted,
                    filter === 'faithful' && styles.statusDropdownBtnFaithful,
                  ]}
                >
                  <ThemedText weight="semiBold" style={[
                    styles.statusDropdownBtnText,
                    filter === 'ongoing' && styles.statusDropdownBtnTextOngoing,
                    filter === 'completed' && styles.statusDropdownBtnTextCompleted,
                    filter === 'faithful' && styles.statusDropdownBtnTextFaithful,
                  ]}>
                    {filter === 'ongoing' ? 'In Progress' : filter === 'completed' ? 'Completed' : 'Faithful Actions'}
                  </ThemedText>
                </View>

                {/* Tune icon — opens status picker */}
                <TouchableOpacity
                  style={styles.dateFilterCircleButton}
                  onPress={() => { triggerLightHaptic(); setShowStatusPicker(true); }}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="tune" size={16} color={Colors.anchorBlue} />
                </TouchableOpacity>

                {/* Search circle */}
                <TouchableOpacity
                  style={styles.searchCircleButton}
                  onPress={() => { triggerLightHaptic(); toggleSearch(); }}
                  activeOpacity={0.75}
                >
                  <Ionicons name={showSearch ? 'close' : 'search'} size={17} color={Colors.anchorBlue} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Row 2: Search bar — height animated by LayoutAnimation (native thread) */}
            {showSearch && (
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={16} color={'rgba(3,32,61,0.4)'} style={styles.searchIcon} />
                <View style={styles.searchInputWrapper}>
                  <TextInput
                    ref={searchInputRef}
                    style={[styles.searchInput, { padding: 0, margin: 0 }]}
                    placeholder="Search all playbooks..."
                    placeholderTextColor={'rgba(3,32,61,0.35)'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    textAlignVertical="top"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    keyboardAppearance="dark"
                  />
                </View>
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={'rgba(3,32,61,0.3)'} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            {!showSearch && <View style={styles.searchBarCollapsedSpacer} />}

          </View>
        </View>

        {/* Status picker modal — extracted as React.memo to avoid re-rendering this screen on every pill tap */}
        <PickerModal
          visible={showStatusPicker}
          filter={filter}
          initContentView={contentView}
          initDateViewMode={dateViewMode}
          initSelectedCategories={selectedCategories}
          initCustomDateFrom={customDateFrom}
          initCustomDateTo={customDateTo}
          availableCategories={availableCategories}
          onClose={handlePickerClose}
          onFilterChange={handlePickerFilterChange}
          onApply={handlePickerApply}
          onHaptic={triggerLightHaptic}
        />

        {/* ── BLUE SHEET ─────────────────────────────────────── */}
        <BlueSheet style={styles.contentSheet}>
          {isLoading ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.listContent, styles.pageInner]}
            >
              <PlaybookSkeleton />
            </ScrollView>
          ) : searchQuery.trim().length > 0 ? (
            /* ── SEARCH RESULTS ──────────────────────────── */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={scrollContentStyle}>
              <View style={styles.carouselTitleContainer}>
                <ThemedText weight="semiBold" style={styles.carouselTitle}>
                  {filteredPlaybooks.length} RESULT{filteredPlaybooks.length !== 1 ? 'S' : ''}
                </ThemedText>
              </View>
              {filteredPlaybooks.length === 0 ? (
                <View style={styles.continueEmptyContainer}>
                  <ThemedText style={styles.continueEmptyText}>No playbooks match your search.</ThemedText>
                </View>
              ) : (
                <CategoryCarouselRow
                  category=""
                  playbooks={filteredPlaybooks}
                  cardStyles={styles}
                  sessionStates={sessionStates}
                  devotionalsCount={devotionalsCount}
                  menuVisible={menuVisible}
                  onPress={handleCardPress}
                  onLongPress={handleCardLongPress}
                  onMenuToggle={(id) => {
            if (id) {
              const playbook = playbooks.find(p => p.id === id);
              setSelectedPlaybookForMenu(playbook || null);
            } else {
              setSelectedPlaybookForMenu(null);
            }
            setMenuVisible(id);
          }}
                  onDelete={handleDelete}
                  onRenamePress={handleRenamePress}
                  onTagPress={handleTagPress}
                  onDevotionalPress={handleDevotionalPress}
                  onExportPdfPress={handleExportPdfPress}
                  triggerHaptic={triggerLightHaptic}
                />
              )}
            </ScrollView>
          ) : deferredContentView === 'all' ? (
            /* ── ALL VIEW: Respects header filter ─────────────── */
            <ScrollView showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={100} contentContainerStyle={scrollContentStyle}>
              {deferredFilter === 'faithful' ? (
                incompleteFaithfulActions.length === 0 ? (
                  <View style={styles.emptyStateContainer}>
                    <View style={styles.heroCard}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={32}
                        color={Colors.growthGreen}
                        style={styles.heroIcon}
                      />
                      <ThemedText weight="semiBold" style={styles.heroOverline}>ALL CAUGHT UP</ThemedText>
                      <ThemedText weight="semiBold" style={styles.heroTitle}>All Faithful Actions Completed</ThemedText>
                      <ThemedText style={styles.heroSubtitle}>
                        You've completed all the faithful actions in this space. Return when another faithful step is ready.
                      </ThemedText>

                      <TouchableOpacity
                        onPress={() => {
                          triggerLightHaptic();
                          setFilter(continuePlaybooks.length > 0 ? 'ongoing' : 'completed');
                        }}
                        activeOpacity={0.85}
                        style={styles.heroOutlineButton}
                      >
                        <MaterialCommunityIcons name="clipboard-text-play" size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                        <ThemedText weight="medium" style={styles.heroOutlineButtonText}>View Playbooks</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <FaithfulActionsCarouselRow
                    faithfulActions={incompleteFaithfulActions}
                    cardStyles={styles}
                    onPress={(action) => {
                      triggerLightHaptic();
                      navigation.navigate('PlaybookWalkthrough', {
                        playbook: { id: action.playbookId },
                        initialStep: 3,
                        initialActionIndex: action.actionIndex - 1,
                      });
                    }}
                    triggerHaptic={triggerLightHaptic}
                  />
                )
              ) : deferredFilter === 'ongoing' ? (
                <>
                  {continuePlaybooks.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                      <View style={styles.heroCard}>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={32}
                          color={Colors.growthGreen}
                          style={styles.heroIcon}
                        />
                        <ThemedText weight="semiBold" style={styles.heroOverline}>ALL CAUGHT UP</ThemedText>
                        <ThemedText weight="semiBold" style={styles.heroTitle}>All Playbooks Completed</ThemedText>
                        <ThemedText style={styles.heroSubtitle}>
                          You've finished the playbooks in this space. Begin a new one when another moment needs clarity.
                        </ThemedText>

                        <TouchableOpacity
                          onPress={() => { triggerLightHaptic(); navigation.navigate('UserInput'); }}
                          activeOpacity={0.85}
                          style={styles.heroOutlineButton}
                        >
                          <MaterialIcons name="auto-fix-high" size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                          <ThemedText weight="medium" style={styles.heroOutlineButtonText}>Start a New Playbook</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <CategoryCarouselRow
                      category={`CONTINUE YOUR PLAYBOOK${continuePlaybooks.length !== 1 ? 'S' : ''}`}
                      playbooks={continuePlaybooks}
                      cardStyles={styles}
                      sessionStates={sessionStates}
                      devotionalsCount={devotionalsCount}
                      menuVisible={menuVisible}
                      onPress={handleCardPress}
                      onLongPress={handleCardLongPress}
                      onMenuToggle={(id) => {
            if (id) {
              const playbook = playbooks.find(p => p.id === id);
              setSelectedPlaybookForMenu(playbook || null);
            } else {
              setSelectedPlaybookForMenu(null);
            }
            setMenuVisible(id);
          }}
                      onDelete={handleDelete}
                      onRenamePress={handleRenamePress}
                      onTagPress={handleTagPress}
                      onDevotionalPress={handleDevotionalPress}
                      onExportPdfPress={handleExportPdfPress}
                      triggerHaptic={triggerLightHaptic}
                    />
                  )}
                  {incompleteFaithfulActions.length > 0 && (
                    <FaithfulActionsCarouselRow
                      faithfulActions={incompleteFaithfulActions}
                      cardStyles={styles}
                      onPress={(action) => {
                        triggerLightHaptic();
                        navigation.navigate('PlaybookWalkthrough', {
                          playbook: { id: action.playbookId },
                          initialStep: 3,
                          initialActionIndex: action.actionIndex - 1,
                        });
                      }}
                      triggerHaptic={triggerLightHaptic}
                    />
                  )}
                </>
              ) : (
                <>
                  {completedPlaybooks.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                      <View style={styles.heroCard}>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={32}
                          color={Colors.growthGreen}
                          style={styles.heroIcon}
                        />
                        <ThemedText weight="semiBold" style={styles.heroOverline}>NO COMPLETED PLAYBOOKS</ThemedText>
                        <ThemedText weight="semiBold" style={styles.heroTitle}>No Completed Playbooks Yet</ThemedText>
                        <ThemedText style={styles.heroSubtitle}>
                          You haven't finished a playbook yet. Return to your in-progress playbooks when you're ready to keep going.
                        </ThemedText>

                        <TouchableOpacity
                          onPress={() => {
                            triggerLightHaptic();
                            setFilter('ongoing');
                          }}
                          activeOpacity={0.85}
                          style={styles.heroOutlineButton}
                        >
                          <MaterialCommunityIcons name="clipboard-text-play" size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                          <ThemedText weight="medium" style={styles.heroOutlineButtonText}>View In Progress</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <CategoryCarouselRow
                      category={`REVISIT YOUR COMPLETED PLAYBOOK${completedPlaybooks.length !== 1 ? 'S' : ''}`}
                      playbooks={completedPlaybooks}
                      cardStyles={styles}
                      sessionStates={sessionStates}
                      devotionalsCount={devotionalsCount}
                      menuVisible={menuVisible}
                      onPress={handleCardPress}
                      onLongPress={handleCardLongPress}
                      onMenuToggle={(id) => {
            if (id) {
              const playbook = playbooks.find(p => p.id === id);
              setSelectedPlaybookForMenu(playbook || null);
            } else {
              setSelectedPlaybookForMenu(null);
            }
            setMenuVisible(id);
          }}
                      onDelete={handleDelete}
                      onRenamePress={handleRenamePress}
                      onTagPress={handleTagPress}
                      onDevotionalPress={handleDevotionalPress}
                      onExportPdfPress={handleExportPdfPress}
                      triggerHaptic={triggerLightHaptic}
                    />
                  )}
                </>
              )}
            </ScrollView>
          ) : deferredContentView === 'category' ? (
            /* ── CATEGORY VIEW: per-category carousels ──────── */
            <ScrollView showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={100} contentContainerStyle={scrollContentStyle}>
              {deferredFilter === 'faithful' ? (
                incompleteFaithfulActions.length === 0 ? (
                  <View style={styles.emptyStateContainer}>
                    <View style={styles.heroCard}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={32}
                        color={Colors.growthGreen}
                        style={styles.heroIcon}
                      />
                      <ThemedText weight="semiBold" style={styles.heroOverline}>ALL CAUGHT UP</ThemedText>
                      <ThemedText weight="semiBold" style={styles.heroTitle}>All Faithful Actions Completed</ThemedText>
                      <ThemedText style={styles.heroSubtitle}>
                        You've completed all the faithful actions in this space. Return when another faithful step is ready.
                      </ThemedText>

                      <TouchableOpacity
                        onPress={() => {
                          triggerLightHaptic();
                          setFilter(continuePlaybooks.length > 0 ? 'ongoing' : 'completed');
                        }}
                        activeOpacity={0.85}
                        style={styles.heroOutlineButton}
                      >
                        <MaterialCommunityIcons name="clipboard-text-play" size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                        <ThemedText weight="medium" style={styles.heroOutlineButtonText}>View Playbooks</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <FaithfulActionsCarouselRow
                    faithfulActions={incompleteFaithfulActions}
                    cardStyles={styles}
                    onPress={(action) => {
                      triggerLightHaptic();
                      navigation.navigate('PlaybookWalkthrough', {
                        playbook: { id: action.playbookId },
                        initialStep: 3,
                        initialActionIndex: action.actionIndex - 1,
                      });
                    }}
                    triggerHaptic={triggerLightHaptic}
                  />
                )
              ) : categorySections.length === 0 ? (
                <>
                  <View style={styles.emptyStateContainer}>
                    <View style={styles.heroCard}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={32}
                        color={Colors.growthGreen}
                        style={styles.heroIcon}
                      />
                      <ThemedText weight="semiBold" style={styles.heroOverline}>ALL CAUGHT UP</ThemedText>
                      <ThemedText weight="semiBold" style={styles.heroTitle}>No Playbooks in This Category</ThemedText>
                      <ThemedText style={styles.heroSubtitle}>
                        {deferredFilter === 'ongoing'
                          ? "You don't have any in-progress playbooks in this category yet."
                          : "You don't have any completed playbooks in this category yet."}
                      </ThemedText>

                      {deferredFilter === 'ongoing' ? (
                        <TouchableOpacity
                          onPress={() => { triggerLightHaptic(); navigation.navigate('UserInput'); }}
                          activeOpacity={0.85}
                          style={styles.heroOutlineButton}
                        >
                          <MaterialIcons name="auto-fix-high" size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                          <ThemedText weight="medium" style={styles.heroOutlineButtonText}>Start a New Playbook</ThemedText>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            triggerLightHaptic();
                            setFilter('ongoing');
                          }}
                          activeOpacity={0.85}
                          style={styles.heroOutlineButton}
                        >
                          <MaterialCommunityIcons name="clipboard-text-play" size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                          <ThemedText weight="medium" style={styles.heroOutlineButtonText}>View In Progress</ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {deferredFilter !== 'completed' && incompleteFaithfulActions.length > 0 && (
                    <FaithfulActionsCarouselRow
                      faithfulActions={incompleteFaithfulActions}
                      cardStyles={styles}
                      onPress={(action) => {
                        triggerLightHaptic();
                        navigation.navigate('PlaybookWalkthrough', {
                          playbook: { id: action.playbookId },
                          initialStep: 3,
                          initialActionIndex: action.actionIndex - 1,
                        });
                      }}
                      triggerHaptic={triggerLightHaptic}
                    />
                  )}
                </>
              ) : (
                <>
                  {deferredFilter === 'ongoing' && (
                    <View style={styles.carouselTitleContainer}>
                      <ThemedText weight="semiBold" style={styles.carouselTitle}>
                        CONTINUE YOUR PLAYBOOKS
                      </ThemedText>
                    </View>
                  )}
                  {categorySections.map(({ category, playbooks: catPlaybooks }) => (
                    <CategoryCarouselRow
                      key={category}
                      category={category}
                      playbooks={catPlaybooks}
                      cardStyles={styles}
                      sessionStates={sessionStates}
                      devotionalsCount={devotionalsCount}
                      menuVisible={menuVisible}
                      onPress={handleCardPress}
                      onLongPress={handleCardLongPress}
                      onMenuToggle={(id) => {
            if (id) {
              const playbook = playbooks.find(p => p.id === id);
              setSelectedPlaybookForMenu(playbook || null);
            } else {
              setSelectedPlaybookForMenu(null);
            }
            setMenuVisible(id);
          }}
                      onDelete={handleDelete}
                      onRenamePress={handleRenamePress}
                      onTagPress={handleTagPress}
                      onDevotionalPress={handleDevotionalPress}
                      onExportPdfPress={handleExportPdfPress}
                      triggerHaptic={triggerLightHaptic}
                    />
                  ))}
                  {deferredFilter !== 'completed' && incompleteFaithfulActions.length > 0 && (
                    <FaithfulActionsCarouselRow
                      faithfulActions={incompleteFaithfulActions}
                      cardStyles={styles}
                      onPress={(action) => {
                        triggerLightHaptic();
                        navigation.navigate('PlaybookWalkthrough', {
                          playbook: { id: action.playbookId },
                          initialStep: 3,
                          initialActionIndex: action.actionIndex - 1,
                        });
                      }}
                      triggerHaptic={triggerLightHaptic}
                    />
                  )}
                </>
              )}
            </ScrollView>
          ) : (
            /* ── DATE VIEW: Weekly / Monthly / Yearly / Custom — virtualized ─── */
            <FlatList
              data={dateSectionItems}
              keyExtractor={item => item.key}
              renderItem={renderDateSectionItem}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={100}
              contentContainerStyle={scrollContentStyle}
              initialNumToRender={2}
              maxToRenderPerBatch={1}
              updateCellsBatchingPeriod={100}
              windowSize={3}
              removeClippedSubviews={true}
              ListHeaderComponent={
                dateSectionItems.some(item => item.isEmpty) ? (
                  <View style={styles.emptyStateContainer}>
                    <View style={styles.heroCard}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={32}
                        color={Colors.growthGreen}
                        style={styles.heroIcon}
                      />
                      <ThemedText weight="semiBold" style={styles.heroOverline}>ALL CAUGHT UP</ThemedText>
                      <ThemedText weight="semiBold" style={styles.heroTitle}>No Playbooks in This Date Range</ThemedText>
                      <ThemedText style={styles.heroSubtitle}>
                        You don't have any playbooks in the selected date range.
                      </ThemedText>

                      {deferredFilter === 'ongoing' ? (
                        <TouchableOpacity
                          onPress={() => { triggerLightHaptic(); navigation.navigate('UserInput'); }}
                          activeOpacity={0.85}
                          style={styles.heroOutlineButton}
                        >
                          <MaterialIcons name="auto-fix-high" size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                          <ThemedText weight="medium" style={styles.heroOutlineButtonText}>Start a New Playbook</ThemedText>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            triggerLightHaptic();
                            setFilter('ongoing');
                          }}
                          activeOpacity={0.85}
                          style={styles.heroOutlineButton}
                        >
                          <MaterialCommunityIcons name="clipboard-text-play" size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                          <ThemedText weight="medium" style={styles.heroOutlineButtonText}>View In Progress</ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : deferredFilter === 'faithful' ? (
                  incompleteFaithfulActions.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                      <View style={styles.heroCard}>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={32}
                          color={Colors.growthGreen}
                          style={styles.heroIcon}
                        />
                        <ThemedText weight="semiBold" style={styles.heroOverline}>ALL CAUGHT UP</ThemedText>
                        <ThemedText weight="semiBold" style={styles.heroTitle}>All Faithful Actions Completed</ThemedText>
                        <ThemedText style={styles.heroSubtitle}>
                          You've completed all the faithful actions in this space. Return when another faithful step is ready.
                        </ThemedText>

                        <TouchableOpacity
                          onPress={() => {
                            triggerLightHaptic();
                            setFilter(continuePlaybooks.length > 0 ? 'ongoing' : 'completed');
                          }}
                          activeOpacity={0.85}
                          style={styles.heroOutlineButton}
                        >
                          <MaterialCommunityIcons name="clipboard-text-play" size={16} color={Colors.hopeWhite} style={styles.heroButtonIcon} />
                          <ThemedText weight="medium" style={styles.heroOutlineButtonText}>View Playbooks</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <FaithfulActionsCarouselRow
                      faithfulActions={incompleteFaithfulActions}
                      cardStyles={styles}
                      onPress={(action) => {
                        triggerLightHaptic();
                        navigation.navigate('PlaybookWalkthrough', {
                          playbook: { id: action.playbookId },
                          initialStep: 3,
                          initialActionIndex: action.actionIndex - 1,
                        });
                      }}
                      triggerHaptic={triggerLightHaptic}
                    />
                  )
                ) : deferredFilter === 'ongoing' ? (
                  <View style={styles.carouselTitleContainer}>
                    <ThemedText weight="semiBold" style={styles.carouselTitle}>
                      CONTINUE YOUR PLAYBOOKS
                    </ThemedText>
                  </View>
                ) : null
              }
              ListFooterComponent={
                deferredFilter !== 'completed' && incompleteFaithfulActions.length > 0 ? (
                  <FaithfulActionsCarouselRow
                    faithfulActions={incompleteFaithfulActions}
                    cardStyles={styles}
                    onPress={(action) => {
                      triggerLightHaptic();
                      navigation.navigate('PlaybookWalkthrough', {
                        playbook: { id: action.playbookId },
                        initialStep: 3,
                        initialActionIndex: action.actionIndex - 1,
                      });
                    }}
                    triggerHaptic={triggerLightHaptic}
                  />
                ) : null
              }
            />
          )}
        </BlueSheet>
      </View>
      {/* Devotional creation modal triggered by long-press on a playbook card */}
      <DevotionalModal
        visible={devotionalModalVisible}
        onClose={() => {
          setDevotionalModalVisible(false);
          setSelectedPlaybookForDevotional(null); // Reset selected playbook
        }}
        playbookId={selectedPlaybookForDevotional?.id}
        userInput={selectedPlaybookForDevotional?.userInput}
        onDevotionalCreated={(devotionalId: string) => {
          setDevotionalModalVisible(false);
          setSelectedPlaybookForDevotional(null); // Reset selected playbook
          try { navigation.navigate('DevotionalDetail' as never, { devotionalId } as never); } catch {}
        }}
      />
      {/* Dropdown menu modal - rendered outside carousel structure to prevent clipping */}
      <Modal
        visible={menuVisible !== null}
        transparent
        animationType="none"
        onRequestClose={() => setMenuVisible(null)}
      >
        <TouchableOpacity
          style={styles.menuModalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(null)}
        >
          {selectedPlaybookForMenu && (
            <View style={styles.modalDropdownMenu}>
              <TouchableOpacity
                style={styles.modalDropdownItem}
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  setMenuVisible(null);
                  handleDevotionalPress(selectedPlaybookForMenu);
                }}
              >
                <View style={styles.dropdownItemContent}>
                  <ThemedText weight="medium" style={styles.dropdownItemText}>Turn into a devotional</ThemedText>
                  {devotionalsCount[selectedPlaybookForMenu.id] > 0 && (
                    <View style={styles.dropdownBadge}>
                      <MaterialCommunityIcons name="book" size={10} color={Colors.hopeWhite} />
                      {devotionalsCount[selectedPlaybookForMenu.id] >= 2 && (
                        <ThemedText style={styles.dropdownBadgeText}>{devotionalsCount[selectedPlaybookForMenu.id]}</ThemedText>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDropdownItem}
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  setMenuVisible(null);
                  handleRenamePress(selectedPlaybookForMenu);
                }}
              >
                <ThemedText weight="medium" style={styles.dropdownItemText}>Rename</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDropdownItem}
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  setMenuVisible(null);
                  handleExportPdfPress(selectedPlaybookForMenu);
                }}
              >
                <ThemedText weight="medium" style={styles.dropdownItemText}>Export as PDF</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDropdownItem, styles.dropdownItemLast]}
                onPress={() => {
                  try { triggerLightHaptic(); } catch {}
                  setMenuVisible(null);
                  handleDelete(selectedPlaybookForMenu.id);
                }}
              >
                <View style={styles.dropdownItemContent}>
                  <Ionicons name="trash-outline" size={16} color={Colors.alertCoral} />
                  <ThemedText weight="medium" style={[styles.dropdownItemText, styles.dropdownItemTextDelete]}>Delete</ThemedText>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.renameModalOverlay}
          activeOpacity={1}
          onPress={() => setRenameModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.renameModalCard}
            activeOpacity={1}
          >
            <View style={styles.renameModalHeader}>
              <ThemedText weight="semiBold" style={styles.renameModalTitle}>Rename</ThemedText>
              <TouchableOpacity
                onPress={() => {
                  triggerLightHaptic();
                  setRenameModalVisible(false);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.renameModalCloseButton}
              >
                <Ionicons name="close" size={17} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.renameModalInput, { fontFamily }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter new title"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              autoFocus
              keyboardAppearance="dark"
            />
            <TouchableOpacity
              style={styles.renameModalSaveButton}
              onPress={() => {
                triggerLightHaptic();
                handleRenamePlaybook();
              }}
              activeOpacity={0.7}
            >
              <ThemedText weight="semiBold" style={styles.renameModalSaveButtonText}>Save</ThemedText>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Tag selection modal */}
      <Modal
        visible={tagModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTagModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTagModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <ThemedText weight="bold" style={styles.modalTitle}>Select Tag</ThemedText>
            <ScrollView style={styles.tagList} showsVerticalScrollIndicator={false}>
              {predefinedTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagItem,
                    selectedTag === tag && styles.tagItemSelected,
                  ]}
                  onPress={() => {
                    if (tag === 'Custom') {
                      setSelectedTag('Custom');
                    } else {
                      setSelectedTag(tag);
                      setCustomTag('');
                    }
                  }}
                >
                  <ThemedText style={[
                    styles.tagItemText,
                    selectedTag === tag && styles.tagItemTextSelected,
                  ]}>
                    {tag}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selectedTag === 'Custom' && (
              <TextInput
                style={styles.modalInput}
                value={customTag}
                onChangeText={setCustomTag}
                placeholder="Enter custom tag"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
              />
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setTagModalVisible(false)}
              >
                <ThemedText style={styles.modalButtonTextCancel}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleTagPlaybook}
              >
                <ThemedText style={styles.modalButtonTextConfirm}>Save</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default withErrorBoundary(PlaybookListScreen, 'PlaybookListScreen');

const createStyles = (_theme: any) => StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardTouchable: {
    width: '100%',
  },
  carouselCardTouch: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
    overflow: 'visible',
    position: 'relative',
  },
  carouselCard: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 26,
    padding: 16,
    overflow: 'visible',
    position: 'relative',
  },
  carouselTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  carouselTypeText: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: Colors.alertCoral,
  },
  carouselBadgeContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  carouselProgressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  carouselProgressBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  carouselCardTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  carouselDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 0,
  },
  dateWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  refinedBadge: {
    marginLeft: 8,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(230, 90, 70, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(230, 90, 70, 0.32)',
  },
  refinedBadgeText: {
    fontSize: 10,
    color: Colors.hopeWhite,
  },
  devotionalsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginLeft: 8,
    minHeight: 20,
  },
  devotionalsBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginLeft: 3,
  },
  carouselCardDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 6,
  },
  // Faithful Action Card Styles
  faithfulActionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 12,
  },
  faithfulActionLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  faithfulActionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  faithfulActionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
  },
  faithfulActionNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
    lineHeight: 18,
  },
  faithfulActionTitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    marginTop: 0,
    marginBottom: 0,
    flex: 1,
    flexWrap: 'wrap',
  },
  faithfulActionDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    marginTop: 0,
  },
  faithfulActionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 6,
  },
  faithfulActionFrom: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  faithfulActionMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  faithfulActionContinueButton: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  carouselProgressSection: {
    marginBottom: 12,
  },
  carouselProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  carouselProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  carouselProgressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  carouselStepInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carouselStepText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  carouselScrollContainer: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  carouselTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIDE_INSET,
    paddingTop: 20,
    paddingBottom: 8,
  },
  continueTimeDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 4,
  },
  continueTimeDropdownText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
  },
  continueTimeDropdownIcon: {
    marginLeft: 2,
  },
  continueTimeDropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  continueTimeDropdownContent: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 16,
    width: '100%',
    overflow: 'hidden',
  },
  continueTimeDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(3, 32, 61, 0.08)',
  },
  continueTimeDropdownOptionActive: {
    backgroundColor: 'rgba(3, 32, 61, 0.04)',
  },
  continueTimeDropdownOptionText: {
    fontSize: 15,
    color: Colors.anchorBlue,
  },
  continueTimeDropdownOptionTextActive: {
    fontFamily: Fonts.semiBold,
    color: Colors.anchorBlue,
  },
  carouselTitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  // ── View pill filters row ─────────────────────────────────
  viewPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIDE_INSET,
    paddingVertical: 12,
    gap: 8,
  },
  viewPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  viewPillWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  viewPillText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  viewPillTextActive: {
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
  },
  // ── Date section year header ───────────────────────────────
  dateSectionYearHeader: {
    paddingHorizontal: SIDE_INSET,
    paddingTop: 24,
    paddingBottom: 4,
  },
  dateSectionYearText: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 0.5,
  },
  // ── Continue your playbooks time filter chips ───────────────
  continueTimeFilterScroll: {
    marginTop: -4,
  },
  continueTimeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  continueTimeChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  continueTimeChipText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
  },
  continueTimeChipTextActive: {
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
  },
  continueEmptyContainer: {
    paddingHorizontal: SIDE_INSET,
    paddingVertical: 32,
    alignItems: 'center',
  },
  continueEmptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  // ── Category section rows ─────────────────────────────────────
  categorySection: {
    marginTop: 24,
    overflow: 'visible',
  },
  categorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIDE_INSET,
    paddingBottom: 12,
  },
  categorySectionTitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  categorySectionCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categorySectionCountText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
  },
  gradientContainer: {
    height: 44,
    borderRadius: 14,
    marginBottom: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'linear-gradient(135deg, rgba(231, 238, 247, 0.2) 0%, rgba(219, 230, 244, 0.2) 45%, rgba(244, 239, 230, 0.2) 100%)',
  },
  gradientRelationships: {
    backgroundColor: 'linear-gradient(135deg, rgba(230, 237, 247, 0.2) 0%, rgba(213, 227, 245, 0.2) 50%, rgba(245, 235, 232, 0.2) 100%)',
  },
  gradientFinance: {
    backgroundColor: 'linear-gradient(135deg, rgba(238, 244, 235, 0.2) 0%, rgba(223, 233, 220, 0.2) 50%, rgba(227, 237, 246, 0.2) 100%)',
  },
  gradientFaith: {
    backgroundColor: 'linear-gradient(135deg, rgba(241, 238, 229, 0.2) 0%, rgba(232, 224, 210, 0.2) 45%, rgba(219, 230, 244, 0.2) 100%)',
  },
  gradientPeace: {
    backgroundColor: 'linear-gradient(135deg, rgba(230, 237, 247, 0.2) 0%, rgba(213, 227, 245, 0.2) 50%, rgba(245, 235, 232, 0.2) 100%)',
  },
  gradientHope: {
    backgroundColor: 'linear-gradient(135deg, rgba(238, 244, 235, 0.2) 0%, rgba(223, 233, 220, 0.2) 50%, rgba(227, 237, 246, 0.2) 100%)',
  },
  gradientWisdom: {
    backgroundColor: 'linear-gradient(135deg, rgba(241, 238, 229, 0.2) 0%, rgba(232, 224, 210, 0.2) 45%, rgba(219, 230, 244, 0.2) 100%)',
  },
  gradientForgiveness: {
    backgroundColor: 'linear-gradient(135deg, rgba(230, 237, 247, 0.2) 0%, rgba(213, 227, 245, 0.2) 50%, rgba(245, 235, 232, 0.2) 100%)',
  },
  gradientGratitude: {
    backgroundColor: 'linear-gradient(135deg, rgba(238, 244, 235, 0.2) 0%, rgba(223, 233, 220, 0.2) 50%, rgba(227, 237, 246, 0.2) 100%)',
  },
  gradientPurpose: {
    backgroundColor: 'linear-gradient(135deg, rgba(241, 238, 229, 0.2) 0%, rgba(232, 224, 210, 0.2) 45%, rgba(219, 230, 244, 0.2) 100%)',
  },
  gradientGrowth: {
    backgroundColor: 'linear-gradient(135deg, rgba(231, 238, 247, 0.2) 0%, rgba(219, 230, 244, 0.2) 45%, rgba(244, 239, 230, 0.2) 100%)',
  },
  gradientBubble: {
    position: 'absolute',
    right: -18,
    top: -18,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  gradientBubbleSmall: {
    position: 'absolute',
    right: 30,
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  categoryLabel: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
  categoryLabelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.04,
    textTransform: 'uppercase',
    color: Colors.anchorBlue,
  },
  menuButton: {
    position: 'absolute',
    top: 8,
    right: 10,
    padding: 4,
    zIndex: 20,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 35,
    right: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 18,
    minWidth: 180,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    paddingVertical: 8,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownItemText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
  },
  dropdownItemTextDelete: {
    color: Colors.alertCoral,
  },
  dropdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 12,
  },
  dropdownBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalDropdownMenu: {
    position: 'absolute',
    top: 210,
    right:40,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 18,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    paddingVertical: 8,
  },
  modalDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalContent: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: Colors.hopeWhite,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalButtonConfirm: {
    backgroundColor: Colors.anchorBlue,
  },
  modalButtonTextCancel: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  renameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameModalCard: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    margin: 16,
    width: '85%',
    maxWidth: 400,
  },
  renameModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  renameModalTitle: {
    fontSize: 18,
    color: Colors.hopeWhite,
  },
  renameModalCloseButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 999,
  },
  renameModalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    color: Colors.hopeWhite,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  renameModalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
  },
  renameModalSaveButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  tagList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  tagItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  tagItemSelected: {
    backgroundColor: Colors.anchorBlue,
  },
  tagItemText: {
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  tagItemTextSelected: {
    fontWeight: '600',
  },
  sectionsContainer: {
    marginTop: 10,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sectionCheck: {
    marginRight: 8,
  },
  // Pill badge status icons with green and faith gold colors
  statusPill: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusPillCompleted: {
    backgroundColor: 'rgba(95, 138, 104, 0.15)',
    borderColor: Colors.growthGreen,
  },
  statusPillViewed: {
    backgroundColor: 'rgba(197, 140, 43, 0.1)',
    borderColor: Colors.faithGold,
  },
  statusPillUnreached: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  statusPillTextCompleted: {
    color: Colors.growthGreen,
  },
  statusPillTextViewed: {
    color: Colors.faithGold,
  },
  statusPillTextUnreached: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  statusPillFill: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusPillFillCompleted: {
    backgroundColor: Colors.growthGreen,
  },
  sectionContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    color: Colors.hopeWhite,
  },
  sectionLabelMuted: {
    color: 'rgba(255, 255, 255, 0.35)',
  },
  sectionMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionMetaIcon: {
    marginRight: 0,
  },
  sectionInfo: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  sectionInfoMuted: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  sectionActionIcon: {
    marginRight: 0,
  },
  sectionViewedIcon: {
    fontSize: 15,
    color: Colors.faithGold,
    lineHeight: 18,
    marginRight: 0,
  },
  completedDate: {
    color: Colors.growthGreen,
  },
  completedDateText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  completedSummary: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginTop: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  completedSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  completedSummaryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedSummaryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  pageInner: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16, // Add responsive padding
  },
  containerEmpty: {
    // Remove default container padding so heroCard width matches Devotionals (90% of screen)
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 0,
    paddingBottom: 0,
    backgroundColor: Colors.hopeWhite,
  },
  // ── Header layout ────────────────────────────────────────────
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    letterSpacing: 0.5,
    flex: 1,
  },
  // Search row: bar + filter button side by side
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 2,
  },
  // Animated search bar (inside searchBarWrapper)
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(3, 32, 61, 0.055)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(3, 32, 61, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 0,
    marginTop: 6,
    marginBottom: 8,
    height: 42,
  },
  searchInputWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  searchIcon: {
    marginRight: 7,
  },
  searchBarCollapsedSpacer: {
    height: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.anchorBlue,
    paddingVertical: 0,
    fontFamily: Fonts.regular,
    letterSpacing: 0.1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  clearButton: {
    marginLeft: 6,
    padding: 2,
  },
  searchCircleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(3, 32, 61, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFilterCircleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(3, 32, 61, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFilterCircleButtonActive: {
    backgroundColor: 'rgba(3, 32, 61, 0.12)',
  },
  searchBarWrapper: {
    overflow: 'hidden',
  },
  // Additional layout styling applied on top of BlueSheet if needed
  contentSheet: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
    overflow: 'visible',
  },
  floatingButton: {
    position: 'absolute',
    // bottom set dynamically in render using bottomClearance
    // right set dynamically to respect safe area
    zIndex: 10001,
    elevation: 10001,
  },
  expandableButton: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 28,
    height: 56,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignSelf: 'flex-end',
  },
  expandableButtonTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    minWidth: 56,
  },
  fabIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingButtonIcon: {
    width: 40,
    height: 40,
    alignSelf: 'center',
    tintColor: Colors.alertCoral,
  },
  expandText: {
    color: Colors.anchorBlue,
    fontSize: 14,
    marginLeft: 8,
    overflow: 'hidden',
    fontFamily: Fonts.semiBold,
  },
  headerSpacer: {
    height: 44,
    marginTop: 10,
    marginBottom: 10,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingTop: 32,
    paddingBottom: 16,
    paddingHorizontal: 0,
    minHeight: 300,
  },
  // Empty state styles (mirroring Devotionals)
  emptyHeroContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    width: '90%',
    maxWidth: 720,
    backgroundColor: Colors.subtleOverlay,
    borderRadius: 34,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginHorizontal: 'auto', // Center the card
  },
  heroIcon: {
    marginBottom: 12,
    opacity: 0.8,
  },
  heroOverline: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: Fonts.semiBold,
  },
  heroTitle: {
    fontSize: 18,
    textAlign: 'center',
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
    lineHeight: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  heroOutlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    minWidth: 120,
    marginBottom: 12,
  },
  heroOutlineButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.medium,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  heroButtonIcon: {
    marginRight: 8,
  },
  // Link-style text button below hero CTA
  heroTextButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  heroLinkText: {
    color: Colors.hopeWhite,
    opacity: 0.9,
  },
  stepsHint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  stepsFootnote: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  stepsContainer: {
    width: '100%',
    marginTop: 16,
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 2,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stepBadgeText: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontFamily: Fonts.semiBold,
  },
  stepText: {
    color: Colors.hopeWhite,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 0, // Remove padding since pageInner handles it
    paddingBottom: 70,
  },
  // SectionList container and extra padding
  sectionList: {
    flex: 1,
  },
  listContentPadding: {
    paddingTop: 20,
    paddingBottom: 8,
  },
  filterTabs: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
    gap: 2,
    marginTop: 12,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 2,
  },
  filterTabActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterTabActiveCompleted: {
    backgroundColor: Colors.growthGreen,
  },
  filterTabActiveOngoing: {
    backgroundColor: Colors.alertCoral,
  },
  filterTabText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.hopeWhite,
    letterSpacing: 0.2,
  },
  filterTabTextActive: {
    color: Colors.hopeWhite,
  },

  // ── Header action buttons ─────────────────────────────────────
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Status dropdown pill beside search icon
  statusDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(3, 32, 61, 0.05)',
  },
  statusDropdownBtnOngoing: {
    backgroundColor: 'rgba(230, 90, 70, 0.07)',
  },
  statusDropdownBtnCompleted: {
    backgroundColor: 'rgba(95, 138, 104, 0.07)',
  },
  statusDropdownBtnFaithful: {
    backgroundColor: 'rgba(59, 130, 246, 0.07)',
  },
  statusDropdownBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: 'rgba(3, 32, 61, 0.5)',
  },
  statusDropdownBtnTextOngoing: {
    color: Colors.alertCoral,
  },
  statusDropdownBtnTextCompleted: {
    color: Colors.growthGreen,
  },
  statusDropdownBtnTextFaithful: {
    color: Colors.anchorBlue,
  },
  // Status picker modal
  statusPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-start',
    paddingTop: 112,
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  statusPickerContent: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 18,
    overflow: 'hidden',
    minWidth: 220,
    maxWidth: 320,
    paddingTop: 14,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  statusPickerSectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  statusPickerSectionHeaderTop: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(3, 32, 61, 0.07)',
    marginTop: 4,
  },
  statusPickerSectionHeaderText: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(255, 255, 255, 0.5)',
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  pickerPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  pickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  pickerPillCompact: {
    paddingVertical: 3,
  },
  pickerPillActive: {
    backgroundColor: Colors.anchorBlue,
    borderColor: Colors.anchorBlue,
  },
  pickerPillPressed: {
    transform: [{ scale: 0.93 }],
    opacity: 0.75,
  },
  pickerPillActiveOngoing: {
    backgroundColor: Colors.anchorBlue,
    borderColor: Colors.anchorBlue,
  },
  pickerPillActiveCompleted: {
    backgroundColor: Colors.anchorBlue,
    borderColor: Colors.anchorBlue,
  },
  pickerPillText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  pickerPillTextActive: {
    color: Colors.hopeWhite,
  },
  pickerPillTextOngoing: {
    color: Colors.hopeWhite,
  },
  pickerPillTextCompleted: {
    color: Colors.hopeWhite,
  },
  pickerStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  pickerStatusDotOngoing: {
    backgroundColor: Colors.alertCoral,
  },
  pickerStatusDotCompleted: {
    backgroundColor: Colors.growthGreen,
  },
  pickerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 16,
    marginVertical: 14,
  },
  pickerCategoryScroll: {
    marginTop: 4,
    marginBottom: 2,
  },
  pickerCategoryScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  pickerApplyButton: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 0,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.anchorBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerApplyButtonText: {
    fontSize: 13,
    color: Colors.hopeWhite,
  },
  customDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  customDateField: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  customDateSep: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  customDateLabel: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  customDateValue: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
  },
  inlineDatePicker: {
    marginHorizontal: 8,
    marginBottom: 4,
  },
  statusPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 6,
    marginBottom: 2,
    borderRadius: 10,
  },
  statusPickerOptionActive: {
    backgroundColor: 'rgba(3, 32, 61, 0.05)',
  },
  statusPickerOptionText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: 'rgba(3, 32, 61, 0.5)',
    flex: 1,
  },
  statusPickerOptionTextActive: {
    fontFamily: Fonts.semiBold,
    color: Colors.anchorBlue,
  },
  statusPickerOptionTextOngoing: {
    fontFamily: Fonts.semiBold,
    color: Colors.alertCoral,
  },
  statusPickerOptionTextCompleted: {
    fontFamily: Fonts.semiBold,
    color: Colors.growthGreen,
  },
  statusPickerDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusPickerDotOngoing: {
    backgroundColor: Colors.alertCoral,
  },
  statusPickerDotCompleted: {
    backgroundColor: Colors.growthGreen,
  },
  // Shared status dot
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statusDotInactive: {
    backgroundColor: 'rgba(3, 32, 61, 0.25)',
  },
  statusDotOngoing: {
    backgroundColor: Colors.alertCoral,
  },
  statusDotCompleted: {
    backgroundColor: Colors.growthGreen,
  },

  // ── Tag chip row (inside BlueSheet — dark background) ───────
  tagChipScrollView: {
    flexGrow: 0,
    paddingTop: 14,
    paddingBottom: 4,
  },
  tagChipScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 16,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tagChipDate: {
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  tagChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  tagChipText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  tagChipTextActive: {
    color: Colors.hopeWhite,
  },

  // ── Legacy on-white filter tab styles (kept for empty state) ─
  filterTabsOnWhite: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
    gap: 6,
  },
  filterTabOnWhite: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(3, 32, 61, 0.06)',
  },
  filterTabActiveOnWhite: {
    backgroundColor: Colors.anchorBlue,
  },
  filterTabTextOnWhite: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.anchorBlue,
    letterSpacing: 0.2,
  },
  filterTabTextActiveOnWhite: {
    color: Colors.hopeWhite,
  },
  sectionHeader: {
    backgroundColor: '#2c4b77',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  sectionHeaderText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    marginBottom: 12,
  },
  cardContent: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    paddingVertical: 2,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    lineHeight: 24,
    paddingVertical: 1,
    flexShrink: 1,
  },
  date: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.8,
    lineHeight: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
});
