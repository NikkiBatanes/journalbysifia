/**
 * DailyBibleVerseCard.tsx
 * Displays a daily Bible verse from the user's playbooks/devotionals
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DashboardScriptureSkeleton from '../SkeletonLoader/DashboardScriptureSkeleton';
import ThemedText from '../common/ThemedText';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { BibleCopyrightModal } from '../BibleCopyrightModal';
import { triggerLightHaptic } from '../../utils/haptics';
import ViewShot from 'react-native-view-shot';
import ShareableCard from '../ShareableCard';
import { socialShareService } from '../../utils/socialShareService';

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
}


const DailyBibleVerseCard: React.FC<DailyBibleVerseCardProps> = ({ onRefresh, onVersePress, onEmpty }) => {
  const { user } = useAuth();
  const [verse, setVerse] = useState<BibleVerse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCopyright, setShowCopyright] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

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

      // Fetch user's playbooks (modern schema uses bible_verse field) and devotionals as secondary source

      const [playbooksResult, devotionalsResult] = await Promise.all([
        supabase
          .from('playbooks')
          .select('id, title, bible_verse, user_id')
          .eq('user_id', user.id)
          .not('bible_verse', 'is', null)
          .limit(20),
        supabase
          .from('devotionals')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(50),
      ]);


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

      // Extract verses from devotionals
      if (devotionalsResult.data) {
        const seen = new Set<string>();
        devotionalsResult.data.forEach((devotional: any) => {
          try {
            const content = devotional?.content
              ? (typeof devotional.content === 'string' ? JSON.parse(devotional.content) : devotional.content)
              : null;

            // Primary: single verse object/string
            if (content && content.verse) {
              const text = (typeof content.verse === 'object')
                ? (content.verse.text || content.verse.verse || content.verse.content || '')
                : String(content.verse);
              const reference = (typeof content.verse === 'object')
                ? (content.verse.reference || content.verse.citation || '')
                : '';
              const version = (typeof content.verse === 'object') ? (content.verse.version || 'NASB') : 'NASB';
              if (typeof text === 'string' && text.trim().length > 0) {
                const key = `${text.trim()}|${(reference || 'Scripture').trim()}|${version}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  allVerses.push({
                    id: `devotional-${devotional.id}`,
                    verse: text.trim(),
                    reference: (reference || 'Scripture').trim(),
                    version,
                    source: devotional.title,
                  });
                }
              }
            }

            // Secondary: array of verses
            if (content && Array.isArray(content.verses)) {
              content.verses.forEach((v: any, index: number) => {
                const text = v?.text || v?.verse || v?.content || '';
                const reference = v?.reference || v?.citation || '';
                const version = v?.version || 'NASB';
                if (typeof text === 'string' && text.trim().length > 0) {
                  const key = `${text.trim()}|${(reference || 'Scripture').trim()}|${version}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    allVerses.push({
                      id: `devotional-${devotional.id}-${index}`,
                      verse: text.trim(),
                      reference: (reference || 'Scripture').trim(),
                      version,
                      source: devotional.title,
                    });
                  }
                }
              });
            }

            // Alternate key: scripture (object/string)
            if (content && content.scripture) {
              const text = (typeof content.scripture === 'object')
                ? (content.scripture.text || content.scripture.verse || content.scripture.content || '')
                : String(content.scripture);
              const reference = (typeof content.scripture === 'object')
                ? (content.scripture.reference || content.scripture.citation || '')
                : '';
              const version = (typeof content.scripture === 'object') ? (content.scripture.version || 'NASB') : 'NASB';
              if (typeof text === 'string' && text.trim().length > 0) {
                const key = `${text.trim()}|${(reference || 'Scripture').trim()}|${version}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  allVerses.push({
                    id: `devotional-${devotional.id}-scripture`,
                    verse: text.trim(),
                    reference: (reference || 'Scripture').trim(),
                    version,
                    source: devotional.title,
                  });
                }
              }
            }

            if (content && Array.isArray(content.scriptures)) {
              content.scriptures.forEach((v: any, index: number) => {
                const text = v?.text || v?.verse || v?.content || '';
                const reference = v?.reference || v?.citation || '';
                const version = v?.version || 'NASB';
                if (typeof text === 'string' && text.trim().length > 0) {
                  const key = `${text.trim()}|${(reference || 'Scripture').trim()}|${version}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    allVerses.push({
                      id: `devotional-${devotional.id}-scriptures-${index}`,
                      verse: text.trim(),
                      reference: (reference || 'Scripture').trim(),
                      version,
                      source: devotional.title,
                    });
                  }
                }
              });
            }

            // Tertiary: extract from per-day structures (supports top-level days column or content.days)
            try {
              let days: any = (devotional as any).days ?? content?.days;
              if (typeof days === 'string') {
                try { days = JSON.parse(days); } catch {}
              }
              if (Array.isArray(days)) {
                days.forEach((day: any, index: number) => {
                  const s = day?.scripture || day?.verse || null;
                  if (s) {
                    const text = (typeof s === 'object')
                      ? (s.text || s.verse || s.content || '')
                      : String(s);
                    const reference = (typeof s === 'object')
                      ? (s.reference || s.citation || '')
                      : '';
                    const version = (typeof s === 'object') ? (s.version || 'NASB') : 'NASB';
                    if (typeof text === 'string' && text.trim().length > 0) {
                      const key = `${text.trim()}|${(reference || 'Scripture').trim()}|${version}`;
                      if (!seen.has(key)) {
                        seen.add(key);
                        allVerses.push({
                          id: `devotional-${devotional.id}-day-${index}`,
                          verse: text.trim(),
                          reference: (reference || 'Scripture').trim(),
                          version,
                          source: devotional.title,
                        });
                      }
                    }
                  }
                });
              }
            } catch {}
          } catch (parseError) {
            Logger.warn('Error parsing devotional content', { component: 'DailyBibleVerseCard', data: parseError });
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

  const handleShare = async () => {
    try {
      triggerLightHaptic();
      setShowShareModal(true);
      setTimeout(async () => {
        if (viewShotRef.current && verse) {
          await socialShareService.shareToSocial(viewShotRef.current, {
            type: 'scripture',
            text: verse.verse,
            reference: `${verse.reference} (${verse.version || 'NASB'})`,
          });
          setShowShareModal(false);
        }
      }, 100);
    } catch (error) {
      Logger.error('[DailyBibleVerseCard] Share failed', error as Error, {
        component: 'DailyBibleVerseCard',
      });
      setShowShareModal(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <ThemedText weight="semiBold" style={styles.titleText}>TODAY'S SCRIPTURE</ThemedText>
        <TouchableOpacity
          onPress={handleShare}
          style={styles.shareButton}
          accessibilityRole="button"
          accessibilityLabel="Share scripture"
        >
          <Ionicons name="share-outline" size={20} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>
      {error ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
            <ThemedText weight="semiBold" style={styles.retryText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleVersePress}
          style={styles.verseContent}
          accessibilityRole="button"
          accessibilityLabel="Open scripture"
        >
          <View style={styles.verseRow}>
            <View style={styles.leftBar} />
            <View style={styles.verseColumn}>
              <ThemedText weight="medium" style={styles.verseText}>
                {verse?.verse}
              </ThemedText>
              <View style={styles.referenceRow}>
                <ThemedText weight="semiBold" style={styles.referenceText}>
                  {verse?.reference}
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
      {/* Bible copyright modal */}
      <BibleCopyrightModal
        visible={!!showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={verse?.version || 'NASB'}
      />
      
      {/* Share modal with shareable card */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.shareModalContainer}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
            <ShareableCard
              type="scripture"
              text={verse?.verse || ''}
              reference={`${verse?.reference} (${verse?.version || 'NASB'})`}
            />
          </ViewShot>
        </View>
      </Modal>
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
