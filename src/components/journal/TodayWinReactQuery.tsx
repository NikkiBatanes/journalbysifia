import React, { useState, useRef, useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { JournalCard } from './JournalCard';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import ThemedText from '../common/ThemedText';
import { Trophy as LuTrophy, Pencil as LuPencil } from 'lucide-react-native';

import { useAuth } from '../../context/IndustryStandardAuthContext';
import { toLocalDateString } from '../../utils/date';
import {
  useTodayWinData,
} from '../../services/hooks/useJournalData';
import { useFocusEffect } from '@react-navigation/native';

// Win type names mapping
const WIN_TYPE_NAMES: Record<string, string> = {
  'followed-through': 'I followed through',
  'chose-peace': 'I chose peace',
  'told-truth': 'I told the truth',
  'showed-up': 'I showed up',
  'god-provided': 'God provided',
  'kept-going': 'I kept going',
};
import { ErrorBoundary } from '../ErrorBoundary';
import { TodayWinSkeleton } from '../SkeletonLoader/TodayWinSkeleton';
import { analytics } from '../../utils/analytics';
import { triggerLightHaptic } from '../../utils/haptics';
import { useNavigation } from '@react-navigation/native';

interface TodayWinProps {
  selectedDate: Date;
  viewMode?: 'carousel' | 'inline' | 'moments';
  expanded?: boolean;
  onExpand?: () => void;
}

const TodayWinComponent: React.FC<TodayWinProps> = ({ selectedDate, viewMode, expanded, onExpand }) => {
  const navigation = useNavigation();

  const { user } = useAuth();
  const [displayWin, setDisplayWin] = useState<{ id: string; text: string; winType?: string } | null>(null);

  const dateStr = toLocalDateString(selectedDate);

  // ----- Date category and copy helpers -----
  const toLocalYMD = (d: Date) => {
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
  };
  const isSameLocalDay = (a: Date, b: Date) => {
    const A = toLocalYMD(a);
    const B = toLocalYMD(b);
    return A.y === B.y && A.m === B.m && A.d === B.d;
  };
  const addDaysLocal = (d: Date, delta: number) => {
    const nd = new Date(d);
    nd.setDate(d.getDate() + delta);
    return nd;
  };
  const getDateCategory = (d: Date): 'today' | 'yesterday' | 'earlier' => {
    const today = new Date();
    if (isSameLocalDay(d, today)) {return 'today';}
    if (isSameLocalDay(d, addDaysLocal(today, -1))) {return 'yesterday';}
    return 'earlier';
  };

  const getCopy = (category: 'today' | 'yesterday' | 'earlier', count: number) => {
    if (category === 'today') {
      return {
        header: "TODAY'S WIN",
        subtitle: "What's your biggest win today?",
        emptySubtext: 'Share a moment where faith led to triumph today',
      } as const;
    }
    if (category === 'yesterday') {
      return {
        header: "YESTERDAY'S WIN",
        subtitle:
          count === 0
            ? 'No wins yet from yesterday, share a moment where faith led to triumph'
            : 'Your win from yesterday',
        emptySubtext: 'No wins yet from yesterday, share a moment where faith led to triumph',
      } as const;
    }
    // earlier
    return {
      header: 'EARLIER WINS',
      subtitle:
        count === 0
          ? 'No wins yet on this day, share a moment where faith led to triumph'
          : 'Your win on this day',
      emptySubtext: 'No wins yet on this day, share a moment where faith led to triumph',
    } as const;
  };

  const userId = user?.id || '';

  // Get today's win entry with performance tracking
  const loadStartTime = useRef<number>(Date.now());
  const { data: entries = [], isLoading, error, refetch } = useTodayWinData(userId, dateStr);

  // Refetch data when screen comes back into focus (after saving in walkthrough)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Track loading performance
  React.useEffect(() => {
    if (!isLoading && entries.length >= 0) {
      const loadTime = Date.now() - loadStartTime.current;
      const hasWin = entries.length > 0 && entries[0]?.content;

      analytics.trackWinEvent('win_loaded', {
        has_win: Boolean(hasWin),
        load_time_ms: loadTime,
        date: dateStr,
      }, user?.id);
    }
  }, [isLoading, entries, entries.length, dateStr, user?.id]);

  // Handle loading and error states
  React.useEffect(() => {
    if (error) {
      analytics.trackWinEvent('win_error', {
        error_type: error.message || 'unknown',
        operation: 'load',
        date: dateStr,
      }, user?.id);

      Alert.alert('Error', 'Failed to load today\'s win.');
    }
  }, [error, dateStr, user?.id]);

  // Get the first entry (TodayWin typically has one entry) - moved before early returns
  const entry = entries.length > 0 ? entries[0] : null;

  // Memoize the win object to prevent infinite re-renders - moved before early returns
  const win = React.useMemo(() => {
    if (!entry) {return null;}

    try {
      const content = typeof entry.content === 'string' ? JSON.parse(entry.content) : entry.content;
      console.log('[TodayWin] Raw content:', content);
      // Handle new structure with winType and quietWin (check for winType or winTypeName presence)
      if (content.winType || content.winTypeName) {
        const result = {
          id: entry.id,
          text: content.quietWin || '',
          winType: content.winTypeName || content.winType,
        };
        console.log('[TodayWin] Parsed win (new structure):', result);
        return result;
      }
      // Handle old structure with just win
      const result = {
        id: entry.id,
        text: content.win || '',
      };
      console.log('[TodayWin] Old structure win:', result);

      return result;
    } catch (error) {
      console.error('[TodayWin] Error parsing content:', error);
      const result = {
        id: entry.id,
        text: '',
      };

      return result;
    }
  }, [entry]);

  // Update displayWin when win data changes
  React.useEffect(() => {
    setDisplayWin(win);
  }, [win]);

  // Handle loading state
  if (isLoading) {
    return <TodayWinSkeleton />;
  }

  // Handle error state
  if (error) {
    return (
      <JournalCard
        title="TODAY'S WIN"
        subtitle="What's your biggest win today?"
        icon={<LuTrophy size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
        showAddButton={false}
      >
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>
            Failed to load today's win. Please try again.
          </ThemedText>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { refetch(); }}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.retryText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      </JournalCard>
    );
  }

  const startAdding = () => {
    triggerLightHaptic();
    (navigation as any).navigate('TodaysWinWalkthrough', {
      selectedDate: toLocalDateString(selectedDate),
    });
  };

  const handleEdit = () => {
    triggerLightHaptic();
    (navigation as any).navigate('TodaysWinWalkthrough', {
      selectedDate: toLocalDateString(selectedDate),
    });
  };

  // Hide empty component in inline and moments view
  if ((viewMode === 'inline' || viewMode === 'moments') && !isLoading && !error && (!win || !win.text.trim())) {
    return null;
  }

  return (
    <JournalCard
      title={(() => {
        if (!displayWin) {return undefined;}
        const category = getDateCategory(selectedDate);
        const copy = getCopy(category, entries.length);
        return copy.header;
      })()}
      subtitle={(() => {
        if (!displayWin) {return undefined;}
        const category = getDateCategory(selectedDate);
        const copy = getCopy(category, entries.length);
        return copy.subtitle;
      })()}
      icon={displayWin ? <Ionicons name="trophy" size={24} color={Colors.alertCoral} /> : undefined}
      showAddButton={!!displayWin}
      onAdd={handleEdit}
      viewMode={viewMode}
      expanded={expanded}
      onExpand={onExpand}
    >
      {displayWin ? (
        <View style={styles.completionCard}>
          <View style={styles.completionHeader}>
            <View style={styles.completionHeaderContent}>
              <ThemedText weight="semiBold" style={styles.completionCategory}>
                {displayWin.winType || 'Today\'s Win'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.completionDivider} />

          {displayWin.text.trim() && (
            <View style={styles.completionSection}>
              <ThemedText weight="medium" style={styles.completionSectionLabel}>QUIET WIN</ThemedText>
              <ThemedText style={styles.completionSectionText}>{displayWin.text}</ThemedText>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyStateContainer}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="trophy"
              size={32}
              color={Colors.textGray}
            />
            <ThemedText style={styles.sectionLabel} accessibilityRole="text">
              {(() => {
                const category = getDateCategory(selectedDate);
                const copy = getCopy(category, entries.length);
                return copy.header;
              })()}
            </ThemedText>
          </View>
          <View style={styles.titleContainer}>
            <ThemedText
              style={styles.emptyStateTitle}
              accessibilityRole="header"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Celebrate God's Victories
            </ThemedText>
          </View>
          <ThemedText style={styles.emptyStateSubtext} accessibilityRole="text">
            {(() => {
              const category = getDateCategory(selectedDate);
              const copy = getCopy(category, entries.length);
              return copy.emptySubtext;
            })()}
          </ThemedText>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={startAdding}
            accessibilityRole="button"
            accessibilityLabel={(() => {
              const category = getDateCategory(selectedDate);
              return category === 'today' ? "Begin today's win" : 'Revisit wins';
            })()}
          >
            <LuPencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
            <ThemedText style={styles.emptyStateButtonText}>
              {(() => {
                const category = getDateCategory(selectedDate);
                return category === 'today' ? 'Begin' : 'Revisit';
              })()}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </JournalCard>
  );
};

// Export with error boundary wrapper
export const TodayWinReactQuery: React.FC<TodayWinProps> = (props) => {
  return (
    <ErrorBoundary name="TodayWinReactQuery">
      <TodayWinComponent {...props} />
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  swipeableContainer: {
    marginBottom: 4,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f87171',
  },
  winContainer: {
    backgroundColor: '#274673',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexDirection: 'column',
    width: '100%',
    alignSelf: 'stretch',
  },
  winContainerInline: {
    backgroundColor: Colors.anchorBlue,
  },
  deleteButton: {
    width: 80,
    backgroundColor: '#f87171',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 10,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    marginLeft: -10,
  },
  deleteButtonContent: {
    width: 60,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winContent: {
    flex: 1,
  },
  winDisplayWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  winText: {
    color: Colors.hopeWhite,
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'left',
    letterSpacing: 1,
    fontWeight: '600',
    flexWrap: 'wrap',
    width: '100%',
  },
  winTextCentered: {
    textAlign: 'center',
  },
  winTypePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  winTypePillText: {
    fontSize: 12,
    color: Colors.alertCoral,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  completionCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    width: '100%',
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  completionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  completionHeaderContent: {
    flex: 1,
    alignItems: 'center',
  },
  completionCategory: {
    fontSize: 20,
    color: Colors.hopeWhite,
    marginBottom: 4,
    textAlign: 'center',
  },
  completionSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  completionCheckmark: {
    marginLeft: 12,
  },
  completionSection: {
    marginBottom: 20,
  },
  completionSectionLabel: {
    fontSize: 12,
    color: Colors.alertCoral,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontWeight: '500',
  },
  completionSectionText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
  completionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 16,
  },
  editButton: {
    padding: 4,
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 4,
  },

  // Error state styles
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 8,
  },
  errorText: {
    color: Colors.alertCoral,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'center',
  },
  retryText: {
    color: Colors.hopeWhite,
    fontSize: 12,
  },
  // Empty state styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 12,
    width: '100%',
  },
  emptyStateTitle: {
    fontWeight: '600',
    fontSize: 18,
    color: Colors.hopeWhite,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  beginButton: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  beginButtonText: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  // New empty state styles
  iconContainer: {
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 12,
  },
  emptyStateIcon: {
    marginBottom: 8,
    opacity: 0.8,
  },
  sectionLabel: {
    fontWeight: '600',
    fontSize: 12,
    color: Colors.textGray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 6,
    opacity: 0.9,
  },
  titleContainer: {
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  emptyStateButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonIcon: {
    marginRight: 8,
  },
  emptyStateButtonText: {
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
  },
});
