/**
 * DailyBibleVerseCard.tsx
 * Displays a daily Bible verse from the user's playbooks/devotionals
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { faithPointsService } from '../../services/faithPointsService';


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

      // Fetch user's playbooks and devotionals with verses
      console.log('[DailyScripture] Fetching content for user:', user.id);
      const [playbooksResult, devotionalsResult] = await Promise.all([
        supabase
          .from('playbooks')
          .select('id, title, content')
          // Temporarily remove user_id filter for testing
          // .eq('user_id', user.id)
          .not('content', 'is', null)
          .limit(5),
        supabase
          .from('devotionals')
          .select('id, title, content')
          // Temporarily remove user_id filter for testing
          // .eq('user_id', user.id)
          .not('content', 'is', null)
          .limit(5),
      ]);

      console.log('[DailyScripture] Playbooks result:', playbooksResult.data?.length || 0);
      console.log('[DailyScripture] Devotionals result:', devotionalsResult.data?.length || 0);

      const allVerses: BibleVerse[] = [];

      // Extract verses from playbooks
      if (playbooksResult.data) {
        playbooksResult.data.forEach(playbook => {
          try {
            const content = typeof playbook.content === 'string'
              ? JSON.parse(playbook.content)
              : playbook.content;

            // Look for Bible verses in various content structures
            if (content.verses && Array.isArray(content.verses)) {
              content.verses.forEach((v: any, index: number) => {
                allVerses.push({
                  id: `playbook-${playbook.id}-${index}`,
                  verse: v.text || v.verse || v.content,
                  reference: v.reference || v.citation || 'Scripture',
                  source: playbook.title,
                });
              });
            }

            // Look for scripture in action steps
            if (content.actionSteps && Array.isArray(content.actionSteps)) {
              content.actionSteps.forEach((step: any, index: number) => {
                if (step.scripture) {
                  allVerses.push({
                    id: `playbook-step-${playbook.id}-${index}`,
                    verse: step.scripture.verse || step.scripture,
                    reference: step.scripture.reference || 'Scripture',
                    source: playbook.title,
                  });
                }
              });
            }
          } catch (parseError) {
            console.warn('Error parsing playbook content:', parseError);
          }
        });
      }

      // Extract verses from devotionals
      if (devotionalsResult.data) {
        devotionalsResult.data.forEach(devotional => {
          try {
            const content = typeof devotional.content === 'string'
              ? JSON.parse(devotional.content)
              : devotional.content;

            if (content.verse) {
              allVerses.push({
                id: `devotional-${devotional.id}`,
                verse: content.verse.text || content.verse,
                reference: content.verse.reference || 'Scripture',
                source: devotional.title,
              });
            }

            if (content.verses && Array.isArray(content.verses)) {
              content.verses.forEach((v: any, index: number) => {
                allVerses.push({
                  id: `devotional-${devotional.id}-${index}`,
                  verse: v.text || v.verse || v.content,
                  reference: v.reference || v.citation || 'Scripture',
                  source: devotional.title,
                });
              });
            }
          } catch (parseError) {
            console.warn('Error parsing devotional content:', parseError);
          }
        });
      }

      // Only use verses if found in database
      if (allVerses.length > 0) {
        // Select verse based on current date for consistency
        const today = new Date();
        const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        const selectedIndex = dayOfYear % allVerses.length;

        setVerse(allVerses[selectedIndex]);
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
      // Award faith points for engaging with daily scripture
      await faithPointsService.awardPoints(user.id, 'daily_streak', {
        type: 'scripture_read',
        verse_id: verse.id,
      });

      onVersePress?.(verse);
    } catch (pointsError) {
      console.error('Error awarding points for scripture:', pointsError);
      // Still call the callback even if points fail
      onVersePress?.(verse);
    }
  };

  const handleShare = async () => {
    if (!verse) {return;}

    try {
      await Share.share({
        message: `"${verse.verse}"\n\n- ${verse.reference}`,
        title: 'Daily Bible Verse',
      });
    } catch (generateError) {
      console.error('Error generating verse:', generateError);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="book" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>Daily Scripture</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.alertCoral} />
          <Text style={styles.loadingText}>Loading verse...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="book" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Daily Scripture</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
            <Ionicons name="share-outline" size={18} color={Colors.mediumGray} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} style={styles.actionButton}>
            <Ionicons name="refresh" size={18} color={Colors.mediumGray} />
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleVersePress}
          activeOpacity={0.8}
          style={styles.verseContent}
        >
          <Text style={styles.verseText}>
            "{verse?.verse}"
          </Text>
          <Text style={styles.referenceText}>
            - {verse?.reference}
          </Text>
          {verse?.source && (
            <Text style={styles.sourceText}>
              From: {verse.source}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.modalBlue,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    padding: 4,
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
  verseText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.hopeWhite,
    fontStyle: 'italic',
    marginBottom: 8,
    textAlign: 'center',
  },
  referenceText: {
    fontSize: 14,
    color: Colors.devotionalPurple,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 4,
  },
  sourceText: {
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'right',
    fontWeight: '500',
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
    fontWeight: '600',
  },
  verseContent: {
    flex: 1,
  },
});

export default DailyBibleVerseCard;
