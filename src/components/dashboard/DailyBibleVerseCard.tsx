/**
 * DailyBibleVerseCard.tsx
 * Displays a daily Bible verse from the user's playbooks/devotionals
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DashboardScriptureSkeleton from '../SkeletonLoader/DashboardScriptureSkeleton';
import ThemedText from '../common/ThemedText';


interface BibleVerse {
  id: string;
  verse: string;
  reference: string;
  source?: string;
}

interface DailyBibleVerseCardProps {
  onRefresh?: () => void;
  onVersePress?: (verse: BibleVerse) => void;
}


const DailyBibleVerseCard: React.FC<DailyBibleVerseCardProps> = ({ onRefresh, onVersePress }) => {
  const { user } = useAuth();
  const [verse, setVerse] = useState<BibleVerse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                if (text) {
                  allVerses.push({
                    id: `playbook-${playbook.id}`,
                    verse: text,
                    reference: reference || 'Scripture',
                    source: playbook.title,
                  });
                }
              } else if (typeof rawBible === 'string') {
                // Attempt to split string into reference and verse if possible
                const m1 = rawBible.match(/^(.*?\d+:\d+(?:[-–]\d+)?(?:,\s*\d+:?\d*(?:[-–]\d*)?)*)\s*[-—–:]\s*(.+)$/);
                if (m1) {
                  allVerses.push({ id: `playbook-${playbook.id}`, verse: m1[2].trim(), reference: m1[1].trim(), source: playbook.title });
                } else {
                  // Could be just reference or just text; push as text
                  allVerses.push({ id: `playbook-${playbook.id}`, verse: rawBible, reference: 'Scripture', source: playbook.title });
                }
              }
            }
          } catch (parseError) {
            console.warn('Error parsing playbook bible_verse:', parseError);
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
              if (typeof text === 'string' && text.trim().length > 0) {
                const key = `${text.trim()}|${(reference || 'Scripture').trim()}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  allVerses.push({
                    id: `devotional-${devotional.id}`,
                    verse: text.trim(),
                    reference: (reference || 'Scripture').trim(),
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
                if (typeof text === 'string' && text.trim().length > 0) {
                  const key = `${text.trim()}|${(reference || 'Scripture').trim()}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    allVerses.push({
                      id: `devotional-${devotional.id}-${index}`,
                      verse: text.trim(),
                      reference: (reference || 'Scripture').trim(),
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
              if (typeof text === 'string' && text.trim().length > 0) {
                const key = `${text.trim()}|${(reference || 'Scripture').trim()}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  allVerses.push({
                    id: `devotional-${devotional.id}-scripture`,
                    verse: text.trim(),
                    reference: (reference || 'Scripture').trim(),
                    source: devotional.title,
                  });
                }
              }
            }

            if (content && Array.isArray(content.scriptures)) {
              content.scriptures.forEach((v: any, index: number) => {
                const text = v?.text || v?.verse || v?.content || '';
                const reference = v?.reference || v?.citation || '';
                if (typeof text === 'string' && text.trim().length > 0) {
                  const key = `${text.trim()}|${(reference || 'Scripture').trim()}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    allVerses.push({
                      id: `devotional-${devotional.id}-scriptures-${index}`,
                      verse: text.trim(),
                      reference: (reference || 'Scripture').trim(),
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
                    if (typeof text === 'string' && text.trim().length > 0) {
                      const key = `${text.trim()}|${(reference || 'Scripture').trim()}`;
                      if (!seen.has(key)) {
                        seen.add(key);
                        allVerses.push({
                          id: `devotional-${devotional.id}-day-${index}`,
                          verse: text.trim(),
                          reference: (reference || 'Scripture').trim(),
                          source: devotional.title,
                        });
                      }
                    }
                  }
                });
              }
            } catch {}
          } catch (parseError) {
            console.warn('Error parsing devotional content:', parseError);
          }
        });
      }

      // Only use verses if found in database
      
      if (allVerses.length > 0) {
        const today = new Date();
        const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const storageKey = `daily_scripture_selection_${user.id}_${dateKey}`;

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
        setVerse(null);
      }

    } catch (err) {
      console.error('Error fetching daily verse:', err);
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
      console.warn('Verse press encountered an issue, proceeding without points:', err);
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
              <ThemedText weight="semiBold" style={styles.referenceText}>
                {verse?.reference}
              </ThemedText>
            </View>
          </View>
        </TouchableOpacity>
      )}
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
  titleText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textAlign: 'center',
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
    color: Colors.mediumGray,
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
});

export default DailyBibleVerseCard;
