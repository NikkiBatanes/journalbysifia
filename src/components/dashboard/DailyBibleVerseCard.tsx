/**
 * DailyBibleVerseCard.tsx
 * Displays a daily Bible verse from the user's playbooks
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { formatBibleVerse } from '../../utils/textFormatting';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DashboardScriptureSkeleton from '../SkeletonLoader/DashboardScriptureSkeleton';
import ThemedText from '../common/ThemedText';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { BibleCopyrightModal } from '../BibleCopyrightModal';
import { triggerLightHaptic } from '../../utils/haptics';
// import ViewShot from 'react-native-view-shot';
// import ShareableCard from '../ShareableCard';
// import { socialShareService } from '../../utils/socialShareService';

interface BibleVerse {
  id: string;
  verse: string;
  reference: string;
  source?: string;
  version?: string;
}

interface DailyBibleVerseCardProps {
  onRefresh?: () => void;
  onVersePress?: (verse: BibleVerse) => void;
  onEmpty?: () => void; // Callback when no verses available
  onLongPress?: (content: string) => void; // Callback for smart journaling
}


const DailyBibleVerseCard: React.FC<DailyBibleVerseCardProps> = ({ onRefresh, onVersePress, onEmpty, onLongPress }) => {
  const { user } = useAuth();
  const [verse, setVerse] = useState<BibleVerse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCopyright, setShowCopyright] = useState(false);
  // const [showShareModal, setShowShareModal] = useState(false);
  // const viewShotRef = useRef<ViewShot>(null);

  // Notify parent when no verses available
  React.useEffect(() => {
    if (!loading && !verse) {
      onEmpty?.();
    }
  }, [loading, verse, onEmpty]);

  const fetchDailyVerse = useCallback(async () => {
    if (!user) {return;}

    try {
      setLoading(true);
      setError(null);

      // Fetch user's playbooks (modern schema uses bible_verse field)
      const playbooksResult = await supabase
        .from('playbooks')
        .select('id, title, bible_verse, user_id')
        .eq('user_id', user.id)
        .not('bible_verse', 'is', null)
        .limit(20);


      const allVerses: BibleVerse[] = [];

      // Helper to safely parse unknown JSON values
      const safeParse = (val: any) => {
        if (typeof val === 'string') {
          try { return JSON.parse(val); } catch { return val; }
        }
        return val;
      };

      // Extract verses from playbooks.bible_verse
      if (playbooksResult.data) {
        playbooksResult.data.forEach(playbook => {
          try {
            const rawBible = safeParse((playbook as any).bible_verse);
            if (rawBible) {
              if (typeof rawBible === 'object') {
                const text = rawBible.text || rawBible.verse || rawBible.content;
                const reference = rawBible.reference || rawBible.citation || '';
                const version = rawBible.version || 'NASB';
                if (text) {
                  allVerses.push({
                    id: `playbook-${playbook.id}`,
                    verse: text,
                    reference: reference || 'Scripture',
                    version,
                    source: playbook.title,
                  });
                }
              } else if (typeof rawBible === 'string') {
                // Attempt to split string into reference and verse if possible
                const m1 = rawBible.match(/^(.*?\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*[-—–:]\s*(.+)$/);
                if (m1) {
                  allVerses.push({ id: `playbook-${playbook.id}`, verse: m1[2].trim(), reference: m1[1].trim(), version: 'NASB', source: playbook.title });
                } else {
                  // Could be just reference or just text; push as text
                  allVerses.push({ id: `playbook-${playbook.id}`, verse: rawBible, reference: 'Scripture', version: 'NASB', source: playbook.title });
                }
              }
            }
          } catch (parseError) {
            Logger.warn('Error parsing playbook bible_verse', { component: 'DailyBibleVerseCard', data: parseError });
          }
        });
      }

      // Only use verses if found in database
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const storageKey = `daily_scripture_selection_${user.id}_${dateKey}`;

      if (allVerses.length > 0) {
        // Try to load cached selection for stability throughout the day
        let cached: string | null = null;
        try {
          cached = await AsyncStorage.getItem(storageKey);
        } catch {}

        if (cached) {
          const found = allVerses.find(v => v.id === cached);
          if (found) {
            setVerse(found);
            return;
          }
        }

        // Fallback to deterministic pick and cache it
        const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        const selectedIndex = dayOfYear % allVerses.length;
        const selected = allVerses[selectedIndex];
        setVerse(selected);
        try { await AsyncStorage.setItem(storageKey, selected.id); } catch {}
      } else {
        // No verses available - clear cache and hide component
        setVerse(null);
        try { await AsyncStorage.removeItem(storageKey); } catch {}
      }

    } catch (err) {
      Logger.error('Error fetching daily verse', err as Error, { component: 'DailyBibleVerseCard' });
      setError('Unable to load verse');
      setVerse(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDailyVerse();
  }, [fetchDailyVerse]);

  const handleRefresh = () => {
    fetchDailyVerse();
    onRefresh?.();
  };

  const handleVersePress = async () => {
    if (!verse || !user) {return;}

    try {
      // Simply trigger the verse press callback; no points awarded
      onVersePress?.(verse);
    } catch (err) {
      // Even if something unexpected happens, still proceed with the callback
      Logger.warn('Verse press encountered an issue, proceeding without points', { component: 'DailyBibleVerseCard', data: err });
      onVersePress?.(verse);
    }
  };

  // Note: minimal UI — share handled elsewhere if needed

  if (loading) {
    return <DashboardScriptureSkeleton />;
  }

  // If no verse available, hide the component entirely
  if (!verse || !(verse.verse || '').trim()) {
    return null;
  }

  // const handleShare = async () => {
  //   try {
  //     triggerLightHaptic();
  //     setShowShareModal(true);
  //     setTimeout(async () => {
  //       if (viewShotRef.current && verse) {
  //         await socialShareService.shareToSocial(viewShotRef.current, {
  //           type: 'scripture',
  //           text: verse.verse,
  //           reference: `${verse.reference} (${verse.version || 'NASB'})`,
  //         });
  //         setShowShareModal(false);
  //       }
  //     }, 100);
  //   } catch (error) {
  //     Logger.error('[DailyBibleVerseCard] Share failed', error as Error, {
  //       component: 'DailyBibleVerseCard',
  //     });
  //     setShowShareModal(false);
  //   }
  // };

  const isVersePressable = typeof onVersePress === 'function';

  return (
    <View style={styles.card}>
      <ThemedText weight="semiBold" style={styles.titleText}>TODAY'S SCRIPTURE</ThemedText>
      {error ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
            <ThemedText weight="semiBold" style={styles.retryText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {isVersePressable ? (
            <TouchableOpacity
              onPress={handleVersePress}
              onLongPress={() => {
                triggerLightHaptic();
                onLongPress?.(`${formatBibleVerse(verse?.verse || '')}\n\n— ${(verse?.reference || '').toUpperCase()} ${verse?.version || 'NASB'}`);
              }}
              style={styles.verseContent}
              accessibilityRole="button"
              accessibilityLabel="Open scripture"
            >
              <View style={styles.verseRow}>
                <View style={styles.leftBar} />
                <View style={styles.verseColumn}>
                  <ThemedText weight="medium" style={styles.verseText}>
                    {verse ? formatBibleVerse(verse.verse) : ''}
                  </ThemedText>
                  <View style={styles.referenceRow}>
                    <ThemedText weight="semiBold" style={styles.referenceText}>
                      {(verse?.reference || '').toUpperCase()}
                      <ThemedText weight="semiBold" style={styles.versionText}>
                        {' '}{verse?.version || 'NASB'}
                      </ThemedText>
                    </ThemedText>
                    <TouchableOpacity
                      style={styles.infoIcon}
                      onPress={() => {
                        try { triggerLightHaptic(); } catch {}
                        setShowCopyright(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Bible translation information"
                    >
                      <Ionicons name="information-circle-outline" size={18} color={Colors.alertCoral} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onLongPress={() => {
                triggerLightHaptic();
                onLongPress?.(`${formatBibleVerse(verse?.verse || '')}\n\n— ${(verse?.reference || '').toUpperCase()} ${verse?.version || 'NASB'}`);
              }}
              activeOpacity={0.7}
              style={styles.verseContent}
            >
              <View style={styles.verseRow}>
                <View style={styles.leftBar} />
                <View style={styles.verseColumn}>
                  <ThemedText weight="medium" style={styles.verseText}>
                    {verse ? formatBibleVerse(verse.verse) : ''}
                  </ThemedText>
                  <View style={styles.referenceRow}>
                    <ThemedText weight="semiBold" style={styles.referenceText}>
                      {(verse?.reference || '').toUpperCase()}
                      <ThemedText weight="semiBold" style={styles.versionText}>
                        {' '}{verse?.version || 'NASB'}
                      </ThemedText>
                    </ThemedText>
                    <TouchableOpacity
                      style={styles.infoIcon}
                      onPress={() => {
                        try { triggerLightHaptic(); } catch {}
                        setShowCopyright(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Bible translation information"
                    >
                      <Ionicons name="information-circle-outline" size={18} color={Colors.alertCoral} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </>
      )}
      {/* Bible copyright modal */}
      <BibleCopyrightModal
        visible={!!showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={verse?.version || 'NASB'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    marginTop: 0,
    marginBottom: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    minHeight: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',

    letterSpacing: 0.8,
    marginBottom: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textGray,
    fontStyle: 'italic',
  },
  verseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  verseColumn: {
    flex: 1,
  },
  leftBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: Colors.alertCoral,
    alignSelf: 'stretch',
    marginTop: 2,
  },
  verseText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.hopeWhite,
    fontStyle: 'normal',

    marginBottom: 8,
    textAlign: 'left',
  },
  referenceText: {
    fontSize: 12,
    color: Colors.alertCoral,
    textAlign: 'left',

    marginTop: 2,
    marginBottom: 4,
  },
  versionText: {
    fontSize: 12,
    color: Colors.alertCoral,
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  infoIcon: {
    marginLeft: 6,
    padding: 4,
  },
  errorContainer: {
    flex: 1,
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
  verseContent: {
    flex: 1,
  },
  shareButton: {
    padding: 8,
  },
  shareModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DailyBibleVerseCard;
