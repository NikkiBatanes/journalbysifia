/**
 * CombinedContentCarousel.tsx
 * Unified carousel displaying both playbooks and devotionals in a single horizontal scroll
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  DeviceEventEmitter,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { supabase } from '../../services/supabaseClient';
import { logger } from '../../utils/logger';
import { format } from 'date-fns';
import { triggerLightHaptic } from '../../utils/haptics';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import DashboardCombinedContentSkeleton from '../SkeletonLoader/DashboardCombinedContentSkeleton';
import DevotionalModal from '../DevotionalModal';
import { normalizeDevotionalCategory } from '../../utils/devotionalCategories';
import { extractCleanTitle } from '../../utils/titleUtils';
import { useDevotionalOperations } from '../../services/hooks/useDevotionalDataSimplified';
import { deletePlaybook } from '../../services/apiIntegration';
import { pdfExportService } from '../../utils/pdfExportService';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { PDF_EXPORT_UPGRADE_PROMPT } from '../../services/tierRestrictionService';
import { replaceAllNamePlaceholders } from '../../utils/nameReplacement';

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

type ContentType = 'playbook' | 'devotional';

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

// Derive per-section state from walkthrough_progress and action step completion
// completed = Next was pressed on that step OR all action steps in that section are completed
// viewed = user was there but didn't press Next OR some action steps are completed
// unreached = never got there
const getSectionState = (
  sectionStep: number,
  wp: number,
  completedSteps?: number,
): 'completed' | 'viewed' | 'unreached' => {
  if (wp < 0 && (!completedSteps || completedSteps === 0)) { return 'unreached'; }
  if (wp >= sectionStep) { return 'completed'; }
  // For Faithful Actions (step 3), if any action steps are completed, mark as viewed
  if (sectionStep === 3 && completedSteps && completedSteps > 0) { return 'viewed'; }
  // For other sections, use walkthrough_progress
  if (wp + 1 === sectionStep) { return 'viewed'; }
  return 'unreached';
};

interface BaseContent {
  id: string;
  type: ContentType;
  title: string;
  description?: string;
  content?: any;
  lastAccessed?: string;
  category?: string;
}

interface PlaybookContent {
  type: 'playbook';
  id: string;
  title: string;
  description?: string;
  content: any;
  userInput?: string;
  progress: number;
  totalSteps: number;
  completedSteps: number;
  lastAccessed?: string;
  category: string;
  walkthroughProgress: number;
  updatedAt: string;
  completedAt?: string;
  status?: string;
  truthInLove?: any;
  tag?: string;
}

interface DevotionalContent extends BaseContent {
  type: 'devotional';
  isCompleted: boolean;
  completedAt?: string;
  createdAt?: string;
  estimatedDuration?: number;
  verse?: {
    text: string;
    reference: string;
  } | null;
  tags?: string[];
  current_day?: number;
  total_days?: number;
  days?: any[];
  nextDayNumber?: number;
  nextDayTitle?: string;
  category?: string;
  rating?: number;
}

type CombinedContent = PlaybookContent | DevotionalContent;

interface NormalizeDayTitleOptions {
  dayNumber?: number;
  category?: string;
}

const normalizeDayTitle = (title?: string | null, options: NormalizeDayTitleOptions = {}): string | undefined => {
  const { dayNumber, category } = options;
  if (!title) { return undefined; }

  const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

  let cleaned = collapseWhitespace(title);
  if (!cleaned) { return undefined; }

  const removeLeadingPattern = (pattern: RegExp) => {
    cleaned = cleaned.replace(pattern, '');
    cleaned = collapseWhitespace(cleaned);
  };

  cleaned = cleaned.replace(/^[-*•]+/, '');
  cleaned = collapseWhitespace(cleaned);

  const prefixPatterns = [
    /^[^A-Za-z0-9]*day\s*\d+\s*[-:–—.]*\s*/i,
    /^[^A-Za-z0-9]*focus\s*[-:–—.]*\s*/i,
  ];
  prefixPatterns.forEach(removeLeadingPattern);

  removeLeadingPattern(/^[^A-Za-z0-9]*category\s*[-:–—.]*\s*/i);

  if (cleaned.includes('|')) {
    const segments = cleaned
      .split('|')
      .map(segment => collapseWhitespace(segment))
      .filter(Boolean);

    const preferredSegment = segments.find(segment => {
      const lower = segment.toLowerCase();
      if (dayNumber && lower === `day ${dayNumber}`.toLowerCase()) { return false; }
      if (category && lower === category.trim().toLowerCase()) { return false; }
      return true;
    });
    cleaned = preferredSegment || segments[segments.length - 1] || cleaned;
  }

  if (!cleaned) { return undefined; }

  if (dayNumber && cleaned.toLowerCase() === `day ${dayNumber}`.toLowerCase()) {
    return undefined;
  }

  if (category && cleaned.toLowerCase() === category.trim().toLowerCase()) {
    return undefined;
  }

  const categoryIndex = cleaned.toLowerCase().indexOf('category:');
  if (categoryIndex >= 0) {
    const afterCategory = collapseWhitespace(cleaned.substring(categoryIndex + 'category:'.length));
    cleaned = afterCategory || cleaned.substring(0, categoryIndex).trim();
  }

  return cleaned;
};

interface CombinedContentCarouselProps {
  onPlaybookPress?: (playbook: PlaybookContent) => void;
  onDevotionalPress?: (devotional: DevotionalContent) => void;
  onEmpty?: () => void;
}

const CombinedContentCarousel: React.FC<CombinedContentCarouselProps> = ({
  onPlaybookPress,
  onDevotionalPress,
  onEmpty,
}) => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const scrollX = useRef(new Animated.Value(0)).current;
  const [content, setContent] = useState<CombinedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const refetchTimeoutRef = useRef<any>(null);
  const [devotionalModalVisible, setDevotionalModalVisible] = useState(false);
  const [selectedPlaybookForDevotional, setSelectedPlaybookForDevotional] = useState<PlaybookContent | null>(null);
  const [sessionStates, setSessionStates] = useState<Record<string, { hasPrayed: boolean; hasRead: boolean }>>({});
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [selectedPlaybookForRename, setSelectedPlaybookForRename] = useState<PlaybookContent | null>(null);
  const [selectedPlaybookForTag, setSelectedPlaybookForTag] = useState<PlaybookContent | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [devotionalsCount, setDevotionalsCount] = useState<Record<string, number>>({});

  // Devotional operations for delete functionality
  const { deleteDevotional } = useDevotionalOperations(user?.id || '');

  // Feature access checks for PDF export
  const pdfExportAccess = useFeatureAccess({ feature: 'export_pdf' });
  const devotionalPdfExportAccess = useFeatureAccess({ feature: 'export_pdf' });

  // Helper functions for devotional card
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const currentYear = new Date().getFullYear();
    const year = date.getFullYear();
    const formatString = year === currentYear ? 'EEE, MMM d' : 'EEE, MMM d, yyyy';
    return format(date, formatString);
  };

  const handleDeleteDevotional = async (devotionalId: string) => {
    try {
      await deleteDevotional(devotionalId);
      setMenuVisible(null);
    } catch (deleteError) {
      console.error('Error deleting devotional', deleteError);
    }
  };

  const handleDeletePlaybook = async (playbookId: string) => {
    try {
      await deletePlaybook(playbookId, user?.id || '');
      setMenuVisible(null);
    } catch (deleteError) {
      console.error('Error deleting playbook', deleteError);
    }
  };

  const showDeleteConfirm = (devotionalId: string) => {
    setMenuVisible(null);
    Alert.alert(
      'Delete Devotional',
      'Are you sure you want to delete this devotional?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteDevotional(devotionalId),
        },
      ]
    );
  };

  const showPlaybookDeleteConfirm = (playbookId: string) => {
    setMenuVisible(null);
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
          onPress: () => handleDeletePlaybook(playbookId),
        },
      ]
    );
  };

  const handleRenamePress = (playbook: PlaybookContent) => {
    setMenuVisible(null);
    setSelectedPlaybookForRename(playbook);
    setNewTitle(playbook.title);
    setRenameModalVisible(true);
  };

  const handleTagPress = (playbook: PlaybookContent) => {
    setMenuVisible(null);
    setSelectedPlaybookForTag(playbook);
    setSelectedTag(playbook.tag || '');
    setTagModalVisible(true);
  };

  const handleRenamePlaybook = async () => {
    if (!selectedPlaybookForRename || !newTitle.trim()) { return; }

    try {
      triggerLightHaptic();
      const { supabase } = await import('../../services/supabaseClient');
      const { error } = await supabase
        .from('playbooks')
        .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', selectedPlaybookForRename.id);

      if (error) { throw error; }

      setRenameModalVisible(false);
      setNewTitle('');
      setSelectedPlaybookForRename(null);
      fetchContent();
    } catch (err) {
      console.error('Error renaming playbook', err);
      Alert.alert('Error', 'Failed to rename playbook. Please try again.');
    }
  };

  const handleTagPlaybook = async () => {
    if (!selectedPlaybookForTag) { return; }

    const finalTag = selectedTag === 'Custom' ? customTag.trim() : selectedTag;
    if (!finalTag) { return; }

    try {
      triggerLightHaptic();
      const { supabase } = await import('../../services/supabaseClient');
      const { error } = await supabase
        .from('playbooks')
        .update({ tag: finalTag, updated_at: new Date().toISOString() })
        .eq('id', selectedPlaybookForTag.id);

      if (error) { throw error; }

      setTagModalVisible(false);
      setSelectedTag('');
      setCustomTag('');
      setSelectedPlaybookForTag(null);
      fetchContent();
    } catch (err) {
      console.error('Error tagging playbook', err);
      Alert.alert('Error', 'Failed to tag playbook. Please try again.');
    }
  };

  const handleExportPdfPress = async (playbook: PlaybookContent) => {
    console.log('[PDF Export] handleExportPdfPress called for playbook:', playbook.id);
    setMenuVisible(null);

    // Check feature access
    console.log('[PDF Export] Checking feature access:', pdfExportAccess.hasAccess);
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
                source: 'dashboard_carousel',
              });
            },
          },
        ]
      );
      return;
    }

    try {
      triggerLightHaptic();
      console.log('[PDF Export] Haptic triggered, fetching playbook data...');

      // Fetch the full playbook before exporting
      if (!user?.id) {
        console.log('[PDF Export] No user ID found');
        Alert.alert('Error', 'Unable to export this playbook right now.');
        return;
      }

      const { getPlaybook } = await import('../../services/apiIntegration');
      console.log('[PDF Export] Calling getPlaybook...');
      const fullPlaybook = await getPlaybook(user.id, playbook.id);
      console.log('[PDF Export] Full playbook received:', fullPlaybook ? 'yes' : 'no');
      if (!fullPlaybook) {
        Alert.alert('Error', 'Could not load the full playbook for export.');
        return;
      }

      // Get user metadata for name replacement
      const metaUser: any = user?.user_metadata || {};
      const metaFirstName = metaUser.first_name || '';
      const metaDisplayName = metaUser.full_name ||
                            [metaUser.first_name, metaUser.last_name].filter(Boolean).join(' ').trim() ||
                            '';

      // Get bible version from user preferences or default to NASB
      const bibleVersion = user?.user_metadata?.preferences?.content?.bibleVersion || 'NASB';

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
        actionSteps: fullPlaybook.actionSteps?.map((step: any) => {
          // Derive examples similar to ActionStepsCard
          let examples: string[] = [];

          const rawExamples: any = step.examples;

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
        ),
        prayer: fullPlaybook.prayer || '',
        wordsToSpeak: typeof fullPlaybook.wordsToSpeak === 'string'
          ? replaceAllNamePlaceholders(fullPlaybook.wordsToSpeak, { firstName: metaFirstName, displayName: metaDisplayName }, { replaceHardcodedNames: true })
          : '',
        directChallenge: typeof fullPlaybook.directChallenge === 'string'
          ? replaceAllNamePlaceholders(fullPlaybook.directChallenge, { firstName: metaFirstName, displayName: metaDisplayName }, { replaceHardcodedNames: true })
          : '',
        createdAt: fullPlaybook.createdAt,
      });
    } catch (error) {
      console.error('Error exporting playbook PDF:', error);
      Alert.alert('Error', 'Failed to export playbook as PDF. Please try again.');
    }
  };

  const handleExportDevotionalPdf = async (devotional: DevotionalContent) => {
    console.log('[PDF Export] handleExportDevotionalPdf called for devotional:', devotional.id);
    setMenuVisible(null);

    // Check feature access
    console.log('[PDF Export] Checking devotional feature access:', devotionalPdfExportAccess.hasAccess);
    if (!devotionalPdfExportAccess.hasAccess) {
      const upgradePrompt = devotionalPdfExportAccess.accessResult?.upgradePrompt;
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
                currentTier: devotionalPdfExportAccess.accessResult?.requiredTier,
                skipNotificationPreference: true,
                featureType: 'export_pdf',
                source: 'dashboard_carousel',
              });
            },
          },
        ]
      );
      return;
    }

    try {
      triggerLightHaptic();
      console.log('[PDF Export] Exporting devotional PDF...');

      // Get bible version from user preferences or default to NASB
      const bibleVersion = user?.user_metadata?.preferences?.content?.bibleVersion || 'NASB';

      const totalDays = devotional.total_days || 1;

      // Helper function to export a single day
      const exportDevotionalDay = async (day: any, dayNumber: number) => {
        const dayTitle = day.title || devotional.title;
        const dayLabel = totalDays > 1 ? `Day ${dayNumber} of ${totalDays}` : 'Day 1';
        const duration = `${totalDays} Day${totalDays > 1 ? 's' : ''}`;

        pdfExportService.exportDevotionalPDF({
          title: devotional.title,
          duration,
          dayTitle,
          dayLabel,
          bibleVerse: day.scripture ? {
            text: day.scripture.text,
            reference: day.scripture.reference,
            version: bibleVersion,
          } : undefined,
          reflection: day.reflection,
          questionsToPonder: day.reflectionQuestions?.map((q: any) => q.text) || [],
          prayer: day.prayer,
        });
      };

      // Helper function to export all days
      const exportAllDaysDevotional = async () => {
        const duration = `${totalDays} Day${totalDays > 1 ? 's' : ''}`;
        const daysData = devotional.days?.map((day: any) => ({
          dayNumber: day.dayNumber,
          title: day.title,
          scripture: day.scripture ? {
            text: day.scripture.text,
            reference: day.scripture.reference,
            version: bibleVersion,
          } : undefined,
          reflection: day.reflection,
          reflectionQuestions: day.reflectionQuestions?.map((q: any) => ({ text: q.text })) || [],
          prayer: day.prayer,
        })) || [];

        pdfExportService.exportDevotionalPDF({
          title: devotional.title,
          duration,
          days: daysData,
        });
      };

      // If single-day devotional, export directly
      if (totalDays === 1 && devotional.days && devotional.days.length > 0) {
        await exportDevotionalDay(devotional.days[0], 1);
        return;
      }

      // Multi-day devotional: show day selection dialog
      const dayOptions = devotional.days?.map((day: any) => `Day ${day.dayNumber}: ${day.title}`) || [];
      const options = ['All Days', ...dayOptions, 'Cancel'];

      const handleDaySelection = async (buttonIndex: number) => {
        // Don't trigger haptic for Cancel button (last index)
        if (buttonIndex !== options.length - 1) {
          triggerLightHaptic();
        }
        if (buttonIndex === 0) {
          // "All Days" selected - export all days in a single PDF
          await exportAllDaysDevotional();
        } else if (buttonIndex > 0 && devotional.days && buttonIndex < devotional.days.length + 1) {
          // Specific day selected (adjust index by -1 to skip "All Days")
          const selectedDay = devotional.days[buttonIndex - 1];
          const dayNumber = selectedDay.dayNumber;
          await exportDevotionalDay(selectedDay, dayNumber);
        }
      };

      if (Platform.OS === 'ios') {
        const { ActionSheetIOS } = require('react-native');
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: options.length - 1,
          },
          handleDaySelection
        );
      } else {
        // Android: use Alert with buttons
        const buttons = [{ text: 'All Days', onPress: async () => await handleDaySelection(0) }];
        devotional.days?.forEach((day: any, index: number) => {
          buttons.push({
            text: `Day ${day.dayNumber}: ${day.title}`,
            onPress: async () => await handleDaySelection(index + 1),
          });
        });
        buttons.push({ text: 'Cancel', onPress: async () => {} });

        Alert.alert('Select Day to Export', '', buttons);
      }
    } catch (error) {
      console.error('Error exporting devotional PDF:', error);
      Alert.alert('Error', 'Failed to export devotional as PDF. Please try again.');
    }
  };

  React.useEffect(() => {
    if (!loading && content.length === 0) {
      onEmpty?.();
    }
  }, [loading, content.length, onEmpty]);

  // Load session states from AsyncStorage for playbooks
  useEffect(() => {
    const loadSessionStates = async () => {
      const playbookIds = content.filter(c => c.type === 'playbook').map(c => c.id);
      if (playbookIds.length === 0) {return;}

      const entries: Record<string, { hasPrayed: boolean; hasRead: boolean }> = {};
      await Promise.all(
        playbookIds.map(async (id) => {
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

    loadSessionStates();
  }, [content]);

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

  const fetchContent = useCallback(async () => {
    if (!user) { return; }

    try {
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      setError(null);

      // Use getPlaybooks API for consistency with PlaybookListScreen
      const { getPlaybooks } = await import('../../services/apiIntegration');
      const playbooksData = await getPlaybooks(user.id, { lightweight: true });

      const devotionalsQuery = await supabase
        .from('devotionals')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (devotionalsQuery.error) {
        logger.error('Error fetching devotionals', devotionalsQuery.error as Error, {
          component: 'CombinedContentCarousel',
        });
      }
      const devotionalsData = devotionalsQuery.data || [];

      const playbooksWithProgress = playbooksData.map((playbook) => {
        // getPlaybooks API already returns processed data with walkthroughProgress and actionSteps
        // Calculate completed/total stats from actionSteps
        let completed = 0;
        let total = 0;
        if (playbook.actionSteps && Array.isArray(playbook.actionSteps)) {
          for (const step of playbook.actionSteps) {
            if (!step) { continue; }
            if (Array.isArray(step.subTasks) && step.subTasks.length > 0) {
              for (const subTask of step.subTasks) {
                if (subTask?.completed) { completed++; }
                total++;
              }
            } else {
              if (step.completed) { completed++; }
              total++;
            }
          }
        }

        const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          type: 'playbook' as const,
          id: playbook.id,
          title: playbook.title,
          description: playbook.description,
          content: playbook.content,
          userInput: playbook.userInput,
          progress: progressPercentage,
          totalSteps: total,
          completedSteps: completed,
          lastAccessed: playbook.updatedAt,
          category: playbook.category || 'Personal Growth',
          walkthroughProgress: playbook.walkthroughProgress ?? -1,
          updatedAt: playbook.updatedAt,
          completedAt: playbook.completedAt,
          status: playbook.status,
          truthInLove: playbook.truthInLove, // Include for read time calculation
        };
      });

      const deriveCategory = (row: any): string => {
        const savedArray = Array.isArray(row.categories) ? row.categories : [];
        const saved = (row.category as string) || (savedArray[0] as string) || '';
        return normalizeDevotionalCategory(saved, `${row.title || ''} ${row.description || ''}`);
      };

      const devotionalsWithStatus = await Promise.all(
        devotionalsData.map(async (devotional) => {
          try {
            const { data: progressData } = await supabase
              .from('user_progress')
              .select('*')
              .eq('user_id', user.id)
              .eq('content_type', 'devotional')
              .eq('content_id', devotional.id)
              .single();

            let verse = null;
            let estimatedDuration = 5;
            let isCompleted = false;
            let completedAt: string | undefined;
            let lastAccessed: string | undefined;
            let nextDayNumber: number | undefined;
            let nextDayTitle: string | undefined;

            const derivedCategory = deriveCategory(devotional);

            try {
              const devotionalContent = devotional.content
                ? (typeof devotional.content === 'string'
                    ? JSON.parse(devotional.content)
                    : devotional.content)
                : null;

              if (devotionalContent && devotionalContent.verse) {
                verse = {
                  text: devotionalContent.verse.text || devotionalContent.verse,
                  reference: devotionalContent.verse.reference || 'Scripture',
                };
              }

              let days = devotionalContent?.days ?? (devotional as any).days;
              if (typeof days === 'string') {
                try { days = JSON.parse(days); } catch {}
              }
              const totalDays: number | undefined = (devotional as any).total_days ?? devotionalContent?.total_days ?? (Array.isArray(days) ? days.length : undefined);
              const currentDay: number = Math.max(1, Math.min(
                Number((devotional as any).current_day ?? devotionalContent?.current_day ?? 1) || 1,
                totalDays || 9999,
              ));

              const allDaysCompleted = Array.isArray(days) && days.length > 0 && days.every((d: any) => !!d?.completed);
              const progressedPastEnd = !!totalDays && currentDay > totalDays;
              if (allDaysCompleted || progressedPastEnd) {
                isCompleted = true;
                if (!completedAt) {
                  completedAt = lastAccessed || new Date().toISOString();
                }
              }

              let usedPerDayText = false;
              if (Array.isArray(days) && days.length >= currentDay) {
                const dayEntry = days[currentDay - 1];
                const dayText = dayEntry?.reflection || dayEntry?.content || dayEntry?.text || '';
                nextDayNumber = currentDay;
                const rawDayTitle = typeof dayEntry?.title === 'string' ? dayEntry.title : undefined;
                const cleanedTitle = normalizeDayTitle(rawDayTitle, { dayNumber: currentDay, category: derivedCategory });
                nextDayTitle = cleanedTitle || `Day ${currentDay}`;
                if (typeof dayText === 'string' && dayText.length > 0) {
                  const textLength = dayText.length;
                  estimatedDuration = Math.max(3, Math.ceil(textLength / 200));
                  usedPerDayText = true;
                }
              }

              if (!usedPerDayText && devotionalContent && (devotionalContent.reflection || devotionalContent.content)) {
                const textLength = (devotionalContent.reflection || devotionalContent.content).length;
                estimatedDuration = Math.max(3, Math.ceil(textLength / 200));
              }
            } catch {}

            if (progressData && progressData.progress_data) {
              try {
                const progress = typeof progressData.progress_data === 'string'
                  ? JSON.parse(progressData.progress_data)
                  : progressData.progress_data;

                isCompleted = progress.completed || false;
                const progressUpdatedAt = (progressData as any).updated_at as string | undefined;
                completedAt = progress.completedAt || progressUpdatedAt || undefined;
                lastAccessed = progressUpdatedAt || undefined;
              } catch {}
            }

            if (!lastAccessed) {
              try { lastAccessed = (devotional as any).updated_at as string | undefined; } catch {}
            }

            if (isCompleted) {
              nextDayNumber = undefined;
              nextDayTitle = undefined;
            }

            return {
              type: 'devotional' as const,
              id: devotional.id,
              title: devotional.title,
              description: devotional.description,
              content: devotional.content,
              isCompleted,
              completedAt,
              lastAccessed,
              estimatedDuration,
              category: derivedCategory,
              verse,
              current_day: (devotional as any).current_day,
              total_days: (devotional as any).total_days,
              days: (devotional as any).days,
              nextDayNumber,
              nextDayTitle,
            };
          } catch (err) {
            logger.warn('Error processing devotional', { component: 'CombinedContentCarousel', data: err });
            return {
              type: 'devotional' as const,
              id: devotional.id,
              title: devotional.title,
              description: devotional.description,
              content: devotional.content,
              isCompleted: false,
              estimatedDuration: 5,
              category: 'Faith & Obedience',
              verse: null,
            };
          }
        })
      );

      // Filter out completed items and limit to 3 of each type
      const activePlaybooks = playbooksWithProgress
        .filter(p => p.progress < 100 && p.status !== 'completed')
        .slice(0, 3);

      const activeDevotionals = devotionalsWithStatus
        .filter(d => !d.isCompleted)
        .slice(0, 3);

      const combined: CombinedContent[] = [
        ...activePlaybooks,
        ...activeDevotionals,
      ].sort((a, b) => {
        const aDate = new Date(a.lastAccessed || 0).getTime();
        const bDate = new Date(b.lastAccessed || 0).getTime();
        return bDate - aDate;
      });

      setContent(combined);
    } catch (err) {
      logger.error('Error fetching content', err as Error, {
        component: 'CombinedContentCarousel',
      });
      setError('Unable to load content');
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  useFocusEffect(
    useCallback(() => {
      fetchContent();
      return () => {
        // Dismiss dropdown menu when navigating away
        setMenuVisible(null);
      };
    }, [fetchContent])
  );

  // Listen for playbook action step updates from PlaybookWalkthrough
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('playbookActionStepUpdated', () => {
      fetchContent();
    });

    return () => {
      subscription.remove();
    };
  }, [fetchContent, content]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }
    refetchTimeoutRef.current = setTimeout(() => {
      fetchContent();
    }, 150);
  }, [fetchContent]);

  useEffect(() => {
    const handleProgressUpdate = () => {
      scheduleRefetch();
    };

    const subscription = DeviceEventEmitter.addListener('playbookProgressUpdate', handleProgressUpdate);

    return () => {
      subscription.remove();
    };
  }, [scheduleRefetch]);

  useEffect(() => {
    if (!user?.id) { return; }

    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe();
      } catch {}
      channelRef.current = null;
    }

    const channel = supabase.channel(`dashboard-combined-content-${user.id}-${Date.now()}`);

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'playbook_action_steps' },
      () => {
        fetchContent();
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'playbook_sub_tasks' },
      () => {
        fetchContent();
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_progress' },
      () => {
        scheduleRefetch();
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'playbooks' },
      () => {
        scheduleRefetch();
      }
    );

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'devotionals' },
      () => {
        scheduleRefetch();
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        try { channelRef.current.unsubscribe(); } catch {}
        channelRef.current = null;
      }
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = null;
      }
    };
  }, [user?.id, scheduleRefetch, fetchContent]);

  const renderPlaybookCard = (playbook: PlaybookContent, index: number) => {
    const inputRange = [
      (index - 1) * ITEM_SIZE,
      index * ITEM_SIZE,
      (index + 1) * ITEM_SIZE,
    ];
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.96, 1, 0.96],
      extrapolate: 'clamp',
    });
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });
    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [2, 0, 2],
      extrapolate: 'clamp',
    });

    const isCardCompleted = playbook.status === 'completed';
    const wp = playbook.walkthroughProgress ?? -1;

    // Use the pre-calculated completedSteps and totalSteps from the playbook object
    const completed = playbook.completedSteps ?? 0;
    const total = playbook.totalSteps ?? 0;

    const category = playbook.category || 'Growth';

    // Calculate read time for Truth in Love section
    const estimateReadTime = (text: string): string => {
      if (!text) { return ''; }
      const words = text.trim().split(/\s+/).length;
      const minutes = Math.max(1, Math.round(words / 200));
      return `${minutes} min read`;
    };

    // Use truthInLove from playbook object to match PlaybookListScreen
    const tilText = (playbook.truthInLove as any)?.text || '';
    const tilReadTime = estimateReadTime(tilText);

    // Format dates
    const CURRENT_YEAR = new Date().getFullYear();
    let updatedDateStr = null;
    if (playbook.updatedAt) {
      const d = new Date(playbook.updatedAt);
      updatedDateStr = format(d, d.getFullYear() === CURRENT_YEAR ? 'EEE, MMM d' : 'EEE, MMM d, yyyy');
    }
    let completedDateStr = null;
    if (playbook.completedAt) {
      const d = new Date(playbook.completedAt);
      completedDateStr = format(d, d.getFullYear() === CURRENT_YEAR ? 'EEE, MMM d' : 'EEE, MMM d, yyyy');
    }

    return (
      <TouchableOpacity
        key={playbook.id}
        style={styles.cardTouch}
        onPress={() => {
          triggerLightHaptic();
          onPlaybookPress?.(playbook);
        }}
        activeOpacity={0.85}
      >
        <Animated.View
          style={[
            styles.carouselCard,
            styles.itemContainer,
            { transform: [{ scale }, { translateY }], opacity },
          ]}
        >
          <View style={styles.gradientContainer}>
            <View style={styles.gradientTagRow}>
              <View style={styles.typeIconCircle}>
                <MaterialCommunityIcons name="clipboard-text-play" size={14} color={Colors.alertCoral} />
              </View>
              <View style={styles.categoryLabel}>
                <ThemedText weight="bold" style={styles.categoryLabelText}>{category}</ThemedText>
              </View>
            </View>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => {
                console.log('[Menu Button] Pressed for playbook:', playbook.id);
                try { triggerLightHaptic(); } catch {}
                setMenuVisible(menuVisible === playbook.id ? null : playbook.id);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255, 255, 255, 0.7)" />
            </TouchableOpacity>
            {menuVisible === playbook.id && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    setSelectedPlaybookForDevotional(playbook);
                    setDevotionalModalVisible(true);
                    setMenuVisible(null);
                  }}
                >
                  <View style={styles.dropdownItemContent}>
                    <ThemedText weight="medium" style={styles.dropdownItemText}>Turn into devotional</ThemedText>
                    {devotionalsCount[playbook.id] > 0 && (
                      <View style={styles.dropdownBadge}>
                        <MaterialCommunityIcons name="book" size={10} color={Colors.hopeWhite} />
                        {devotionalsCount[playbook.id] >= 2 && (
                          <ThemedText style={styles.dropdownBadgeText}>{devotionalsCount[playbook.id]}</ThemedText>
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    handleRenamePress(playbook);
                  }}
                >
                  <ThemedText weight="medium" style={styles.dropdownItemText}>Rename</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    handleTagPress(playbook);
                  }}
                >
                  <View style={styles.dropdownItemContent}>
                    <ThemedText weight="medium" style={styles.dropdownItemText}>Tag</ThemedText>
                    {playbook.tag && (
                      <View style={styles.dropdownBadge}>
                        <ThemedText style={styles.dropdownBadgeText}>{playbook.tag}</ThemedText>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    handleExportPdfPress(playbook);
                  }}
                >
                  <ThemedText weight="medium" style={styles.dropdownItemText}>Export as PDF</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropdownItem, styles.dropdownItemLast]}
                  onPress={() => {
                    try { triggerLightHaptic(); } catch {}
                    showPlaybookDeleteConfirm(playbook.id);
                  }}
                >
                  <View style={styles.dropdownItemContent}>
                    <Ionicons name="trash-outline" size={16} color={Colors.alertCoral} />
                    <ThemedText weight="medium" style={[styles.dropdownItemText, styles.dropdownItemTextDelete]}>Delete</ThemedText>
                  </View>
                </TouchableOpacity>
              </View>
            )}
            {menuVisible === playbook.id && (
              <TouchableOpacity
                style={styles.menuBackdrop}
                onPress={() => setMenuVisible(null)}
                activeOpacity={1}
              />
            )}
          </View>

          <View style={styles.dateWithBadge}>
            {!isCardCompleted && updatedDateStr ? (
              <ThemedText style={styles.carouselDate}>{updatedDateStr}</ThemedText>
            ) : null}
          </View>

          <ThemedText weight="semiBold" style={styles.carouselCardTitle}>
            {playbook.title}
          </ThemedText>

          {playbook.userInput && (
            <ThemedText style={styles.carouselCardDescription} numberOfLines={1}>
              {playbook.userInput}
            </ThemedText>
          )}

          {isCardCompleted ? (
            <View style={styles.completedSummary}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.growthGreen} />
              <ThemedText style={styles.completedSummaryText}>{completed} of {total} faithful actions acted on</ThemedText>
              {completedDateStr && (
                <>
                  <View style={styles.completedSummaryDivider} />
                  <ThemedText style={styles.completedDateText}>{completedDateStr}</ThemedText>
                </>
              )}
            </View>
          ) : (
            <View style={styles.sectionsContainer}>
              {CARD_SECTIONS.map(({ label, step, metaIcon, actionIcon, actionIconType }) => {
                const state = getSectionState(step, wp, completed);
                // Derive dynamic values per section to match PlaybookListScreen
                const meta = step === 1 ? tilReadTime
                           : step === 3 ? `${completed} of ${total} acted on`
                           : undefined;
                // Use hasPrayed/hasRead flags for Prayer/Words to Speak icons
                const actionIconState = step === 4 ? sessionStates[playbook.id]?.hasPrayed ?? false
                                          : step === 5 ? sessionStates[playbook.id]?.hasRead ?? false
                                          : state === 'completed' || state === 'viewed';
                return (
                  <View key={label} style={styles.sectionItem}>
                    <View style={[styles.statusPill, state === 'completed' && styles.statusPillCompleted, state === 'viewed' && styles.statusPillViewed, state === 'unreached' && styles.statusPillUnreached]}>
                      {state === 'completed' ? <View style={[styles.statusPillFill, styles.statusPillFillCompleted]} /> : <ThemedText style={[styles.statusPillText, state === 'viewed' && styles.statusPillTextViewed, state === 'unreached' && styles.statusPillTextUnreached]}>{state === 'viewed' ? '◐' : '○'}</ThemedText>}
                    </View>
                    <View style={styles.sectionContent}>
                      <ThemedText style={[styles.sectionLabel, state === 'unreached' && styles.sectionLabelMuted]}>{label}</ThemedText>
                      {meta && <View style={styles.sectionMetaContainer}>{metaIcon && <Ionicons name={metaIcon as any} size={12} color={'rgba(255,255,255,0.4)'} style={styles.sectionMetaIcon} />}<ThemedText style={[styles.sectionInfo, state !== 'completed' && styles.sectionInfoMuted]}>{meta}</ThemedText></View>}
                      {actionIcon && !meta && (actionIconType === 'ionicons' ? <Ionicons name={actionIcon as any} size={14} color={actionIconState ? Colors.alertCoral : 'rgba(255,255,255,0.4)'} style={styles.sectionActionIcon} /> : <MaterialCommunityIcons name={actionIcon as any} size={14} color={actionIconState ? Colors.alertCoral : 'rgba(255,255,255,0.4)'} style={styles.sectionActionIcon} />)}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderDevotionalCard = (devotional: DevotionalContent, index: number) => {
    const inputRange = [
      (index - 1) * ITEM_SIZE,
      index * ITEM_SIZE,
      (index + 1) * ITEM_SIZE,
    ];
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.96, 1, 0.96],
      extrapolate: 'clamp',
    });
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });
    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [2, 0, 2],
      extrapolate: 'clamp',
    });

    // Calculate progress
    const completedDays = devotional.days?.filter((day: any) => day.completed).length || 0;
    const totalDays = devotional.total_days || devotional.days?.length || 1;
    const progress = (completedDays / totalDays) * 100;
    const isComplete = progress >= 100;
    const formattedDate = formatDate(devotional.createdAt || new Date().toISOString());
    const cleanTitle = extractCleanTitle(devotional.title, 'Devotional');

    // Find next incomplete day
    let nextDayInfo = null;
    if (!isComplete && devotional.days) {
      const nextIdx = devotional.days.findIndex((day: any) => !day.completed);
      if (nextIdx !== -1) {
        const nextDay = devotional.days[nextIdx];
        const scriptureWords = nextDay.scripture?.text ? nextDay.scripture.text.trim().split(/\s+/).length : 0;
        const reflectionWords = nextDay.reflection ? nextDay.reflection.trim().split(/\s+/).length : 0;
        const questionsWords = nextDay.reflectionQuestions?.reduce((sum: number, q: any) => sum + (q.text ? q.text.trim().split(/\s+/).length : 0), 0) || 0;
        const prayerWords = nextDay.prayer ? nextDay.prayer.trim().split(/\s+/).length : 0;
        const totalWords = scriptureWords + reflectionWords + questionsWords + prayerWords;
        const readTime = totalWords > 0 ? Math.max(1, Math.round(totalWords / 100)) : 0;
        const isOneDay = totalDays === 1;
        nextDayInfo = {
          dayNumber: nextDay.dayNumber || nextIdx + 1,
          title: nextDay.title,
          readTime,
          isOneDay,
        };
      }
    }

    return (
      <TouchableOpacity
        key={devotional.id}
        style={styles.cardTouch}
        onPress={() => {
          triggerLightHaptic();
          onDevotionalPress?.(devotional);
        }}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            styles.card,
            styles.itemContainer,
            { transform: [{ scale }, { translateY }], opacity },
          ]}
        >
          <View style={styles.cardContent}>
            {/* Gradient Container with Category and Menu */}
            <View style={styles.gradientContainer}>
              <View style={styles.gradientTagRow}>
                <View style={styles.typeIconCircle}>
                  <MaterialCommunityIcons name="book" size={14} color={Colors.alertCoral} />
                </View>
                <View style={styles.categoryLabel}>
                  <ThemedText weight="bold" style={styles.categoryLabelText}>{devotional.category || 'Devotional'}</ThemedText>
                </View>
              </View>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => {
                  console.log('[Menu Button] Pressed for devotional:', devotional.id);
                  try { triggerLightHaptic(); } catch {}
                  setMenuVisible(menuVisible === devotional.id ? null : devotional.id);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255, 255, 255, 0.7)" />
              </TouchableOpacity>
              {menuVisible === devotional.id && (
                <View style={styles.dropdownMenu}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      try { triggerLightHaptic(); } catch {}
                      handleExportDevotionalPdf(devotional);
                    }}
                  >
                    <View style={styles.dropdownItemContent}>
                      <ThemedText weight="medium" style={styles.dropdownItemText}>Export as PDF</ThemedText>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dropdownItem, styles.dropdownItemLast]}
                    onPress={() => {
                      try { triggerLightHaptic(); } catch {}
                      showDeleteConfirm(devotional.id);
                    }}
                  >
                    <View style={styles.dropdownItemContent}>
                      <Ionicons name="trash-outline" size={16} color={Colors.alertCoral} />
                      <ThemedText weight="medium" style={[styles.dropdownItemText, styles.dropdownItemTextDelete]}>Delete</ThemedText>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
              {menuVisible === devotional.id && (
                <TouchableOpacity
                  style={styles.menuBackdrop}
                  onPress={() => setMenuVisible(null)}
                  activeOpacity={1}
                />
              )}
            </View>

            {/* Date */}
            <View style={styles.dateWithBadge}>
              <ThemedText weight="medium" style={styles.date}>{formattedDate}</ThemedText>
            </View>

            {/* Title */}
            <ThemedText weight="semiBold" style={styles.devotionalTitle} numberOfLines={2}>{cleanTitle}</ThemedText>

            {/* Description */}
            {devotional.description && (
              <ThemedText style={styles.description} numberOfLines={2}>
                {devotional.description.replace(/^CATEGORY:[^\n]*\n?/i, '')}
              </ThemedText>
            )}

            <View style={styles.progressBarContainer}>
              <View style={styles.progressHeader}>
                <View style={styles.progressLabel}>
                  <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={16} color={Colors.secondaryText} style={styles.progressIcon} />
                  <ThemedText weight="semiBold" style={styles.progressLabelText}>Progress</ThemedText>
                </View>
                <ThemedText weight="medium" style={styles.dayCounter}>
                  {completedDays} of {totalDays} days completed
                </ThemedText>
              </View>
              <View style={styles.progressBarRow}>
                <View style={styles.progressWrapper}>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${progress}%` }]} />
                  </View>
                </View>
              </View>
              <View style={styles.nextDayContainer}>
                {nextDayInfo && (
                  <View style={styles.nextDayContentContainer}>
                    <ThemedText weight="bold" style={styles.nextDayLabel}>Next</ThemedText>
                    <ThemedText weight="medium" style={styles.nextDayTitle}>
                      Day {nextDayInfo.dayNumber}{!nextDayInfo.isOneDay && `: ${nextDayInfo.title}`}
                    </ThemedText>
                    <View style={styles.nextDayReadTimeContainer}>
                      <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.4)" style={styles.nextDayReadTimeIcon} />
                      <ThemedText style={styles.nextDayReadTime}>{nextDayInfo.readTime} min read</ThemedText>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Rating (Completed only) */}
            {isComplete && devotional.rating && typeof devotional.rating === 'number' && devotional.rating > 0 && (
              <View style={styles.ratingContainer}>
                <View style={styles.ratingRow}>
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const isFilled = idx < Math.round(devotional.rating || 0);
                    return (
                      <MaterialCommunityIcons
                        key={idx}
                        name={isFilled ? 'star' : 'star-outline'}
                        size={18}
                        color={isFilled ? Colors.faithGold : Colors.secondaryText}
                        style={styles.ratingStar}
                      />
                    );
                  })}
                  <ThemedText weight="medium" style={styles.ratingValueText}>
                    {Math.round(devotional.rating || 0)}/5
                  </ThemedText>
                </View>
              </View>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderCard = (item: CombinedContent, index: number) => {
    if (item.type === 'playbook') {
      return renderPlaybookCard(item, index);
    } else {
      return renderDevotionalCard(item, index);
    }
  };

  // Rename Modal
  const renderRenameModal = () => (
    <Modal visible={renameModalVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ThemedText weight="bold" style={styles.modalTitle}>Rename Playbook</ThemedText>
          <TextInput
            style={styles.modalInput}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Enter new name"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={() => {
                setRenameModalVisible(false);
                setNewTitle('');
                setSelectedPlaybookForRename(null);
              }}
            >
              <ThemedText style={styles.modalButtonTextCancel}>Cancel</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={handleRenamePlaybook}
            >
              <ThemedText style={styles.modalButtonTextConfirm}>Save</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Tag Modal
  const renderTagModal = () => (
    <Modal visible={tagModalVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ThemedText weight="bold" style={styles.modalTitle}>Tag Playbook</ThemedText>
          <View style={styles.tagList}>
            {['Work', 'Personal', 'Growth', 'Faith', 'Custom'].map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagItem,
                  selectedTag === tag && styles.tagItemSelected,
                ]}
                onPress={() => setSelectedTag(tag)}
              >
                <ThemedText style={styles.tagItemText}>{tag}</ThemedText>
              </TouchableOpacity>
            ))}
            {selectedTag === 'Custom' && (
              <TextInput
                style={styles.modalInput}
                value={customTag}
                onChangeText={setCustomTag}
                placeholder="Enter custom tag"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
              />
            )}
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={() => {
                setTagModalVisible(false);
                setSelectedTag('');
                setCustomTag('');
                setSelectedPlaybookForTag(null);
              }}
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
      </View>
    </Modal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyCard}>
        <View style={styles.heroCard}>
          <MaterialCommunityIcons
            name="clipboard-text-play"
            size={32}
            color="rgba(255,255,255,0.85)"
            style={styles.heroIcon}
          />
          <ThemedText weight="semiBold" style={styles.heroOverline}>No Content Yet</ThemedText>
          <ThemedText weight="bold" style={styles.heroTitle}>Create Your First Playbook</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Share what you're going through in detail.{'\n'}
            The more context, the better we can help.
          </ThemedText>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => {
            triggerLightHaptic();
            try { navigation.navigate('UserInput'); } catch {}
          }}
        >
          <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
          <ThemedText weight="semiBold" style={styles.createButtonText}>Create a Playbook</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return <DashboardCombinedContentSkeleton />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerCenter}>
        <ThemedText weight="semiBold" style={styles.title}>CONTINUE YOUR JOURNEY</ThemedText>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              fetchContent();
            }}
            style={styles.retryButton}
          >
            <ThemedText weight="semiBold" style={styles.retryText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      ) : content.length === 0 ? (
        renderEmptyState()
      ) : (
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContainer, { paddingHorizontal: SIDE_INSET }]}
          decelerationRate="fast"
          snapToInterval={ITEM_SIZE}
          snapToAlignment="center"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          bounces={true}
          removeClippedSubviews={false}
          style={styles.scrollExpanded}
        >
          {content.map((item, i) => renderCard(item, i))}
        </Animated.ScrollView>
      )}

      <DevotionalModal
        visible={devotionalModalVisible}
        onClose={() => {
          setDevotionalModalVisible(false);
          setSelectedPlaybookForDevotional(null);
        }}
        playbookId={selectedPlaybookForDevotional?.id}
        userInput={selectedPlaybookForDevotional?.userInput}
        onDevotionalCreated={(devotionalId: string) => {
          setDevotionalModalVisible(false);
          setSelectedPlaybookForDevotional(null);
          try { navigation.navigate('DevotionalDetail' as never, { devotionalId } as never); } catch {}
        }}
      />
      {renderRenameModal()}
      {renderTagModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    overflow: 'visible',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 30,
  },
  headerCenter: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 12,
    color: Colors.hopeWhite,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  viewAllButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 11,
    color: Colors.alertCoral,
  },
  scrollContainer: {
    paddingVertical: 0,
    paddingRight: 0,
    overflow: 'visible',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    flexGrow: 1,
  },
  scrollExpanded: {
    overflow: 'visible',
    marginHorizontal: -16,
  },
  emptyStateContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyCard: {
    width: '100%',
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: 'relative',
  },
  heroCard: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  heroIcon: {
    marginBottom: 8,
    opacity: 0.9,
  },
  heroOverline: {
    fontSize: 12,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 18,
    textAlign: 'center',
    color: Colors.hopeWhite,
    lineHeight: 24,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  card: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: 'relative',
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
  },
  cardTouch: {},
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  typeText: {
    fontSize: 10,
    color: Colors.textGray,
    letterSpacing: 0.8,
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  progressBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  progressBadgeText: {
    fontSize: 10,
    color: Colors.hopeWhite,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    color: Colors.hopeWhite,
  },
  cardTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 8,
    paddingRight: 64,
    lineHeight: 22,
  },
  cardDescription: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
    marginBottom: 8,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 3,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textGray,
  },
  stepInfo: {
    gap: 2,
  },
  stepText: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },
  verseContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.faithGold,
  },
  verseText: {
    fontSize: 13,
    color: Colors.hopeWhite,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 4,
  },
  verseReference: {
    fontSize: 11,
    color: Colors.faithGold,
  },
  completedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedText: {
    fontSize: 12,
    color: Colors.growthGreen,
  },
  nextDayInfo: {
    marginTop: 4,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  nextDayText: {
    fontSize: 12,
    color: Colors.hopeWhite,
  },
  durationText: {
    fontSize: 11,
    color: Colors.textGray,
  },
  createButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
    flexDirection: 'row',
  },
  createButtonText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  errorContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.alertCoral,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  // New styles to match PlaybookListScreen card design
  carouselCard: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 26,
    padding: 16,
  },
  gradientContainer: {
    height: 44,
    borderRadius: 14,
    marginBottom: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'linear-gradient(135deg, rgba(231, 238, 247, 0.2) 0%, rgba(219, 230, 244, 0.2) 45%, rgba(244, 239, 230, 0.2) 100%)',
    overflow: 'visible',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  categoryLabel: {
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
    padding: 4,
    zIndex: 20,
  },
  dateWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  carouselDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 0,
  },
  carouselCardTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  // Devotional card styles from DevotionalsScreen
  cardContent: {
    flex: 1,
  },
  gradientTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 58, 138, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 40,
    right: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 18,
    minWidth: 180,
    zIndex: 100,
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
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  dropdownItemTextDelete: {
    color: Colors.alertCoral,
  },
  dropdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dropdownBadgeText: {
    fontSize: 10,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 0,
  },
  devotionalTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 6,
  },
  progressBarContainer: {
    width: '100%',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressLabelText: {
    fontSize: 13,
    color: Colors.holyGlow,
    marginLeft: 4,
    fontWeight: '500',
  },
  progressIcon: {
    marginRight: 4,
  },
  dayCounter: {
    fontSize: 12,
    color: Colors.secondaryText,
    fontWeight: '500',
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  progressWrapper: {
    flex: 1,
  },
  barBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 3,
  },
  nextDayContainer: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  nextDayContentContainer: {
    gap: 2,
  },
  nextDayLabel: {
    fontSize: 13,
    color: Colors.holyGlow,
    fontWeight: 'bold',
  },
  nextDayTitle: {
    fontSize: 13,
    color: Colors.holyGlow,
    fontWeight: '500',
  },
  nextDayReadTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nextDayReadTimeIcon: {
    marginRight: 2,
  },
  nextDayReadTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  ratingContainer: {
    marginTop: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStar: {
    marginRight: 2,
  },
  ratingValueText: {
    marginLeft: 8,
    fontSize: 12,
    color: Colors.faithGold,
    fontWeight: '500',
  },
  carouselCardDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 6,
  },
  completedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  completedSummaryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  completedSummaryDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 8,
  },
  completedDateText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
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
});

export default CombinedContentCarousel;
