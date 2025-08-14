/**
 * DailyAffirmationCard.tsx
 * Displays a random affirmation from the user's playbooks
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { faithPointsService } from '../../services/faithPointsService';


interface Affirmation {
  id: string;
  content: string;
  playbook_title?: string;
}

interface DailyAffirmationCardProps {
  onRefresh?: () => void;
  onAffirmationPress?: (affirmation: Affirmation) => void;
}

const DailyAffirmationCard: React.FC<DailyAffirmationCardProps> = ({ onRefresh, onAffirmationPress }) => {
  const { user } = useAuth();
  const [affirmation, setAffirmation] = useState<Affirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDailyAffirmation = useCallback(async () => {
    if (!user) {return;}

    try {
      setLoading(true);
      setError(null);

      // Query playbooks table - try different approaches to get affirmations
      let playbooks: any[] = [];
      let playbooksError: any = null;

      // First, try to get playbooks with only existing columns
      try {
        console.log('[DailyAffirmation] Fetching playbooks for user:', user.id);
        const { data, error: playbookError } = await supabase
          .from('playbooks')
          .select('id, title, affirmations')
          // Temporarily remove user_id filter for testing
          // .eq('user_id', user.id)
          .not('affirmations', 'is', null)
          .limit(10);

        if (playbookError) {
          console.error('[DailyAffirmation] Error fetching playbooks:', playbookError);
          throw playbookError;
        } else {
          playbooks = data || [];
          console.log(`[DailyAffirmation] Found ${playbooks.length} playbooks for affirmations`);
          console.log('[DailyAffirmation] Playbooks data:', playbooks);
        }
      } catch (dbError) {
        console.error('Database error fetching playbooks:', dbError);
        playbooksError = dbError;
      }

      if (playbooksError) {
        throw playbooksError;
      }

      if (!playbooks || playbooks.length === 0) {
        console.log('No playbooks found in database');
        setAffirmation(null);
        return;
      }

      // Extract affirmations from playbook content
      const allAffirmations: Affirmation[] = [];

      playbooks.forEach(playbook => {
        try {
          // Get affirmations from the affirmations field only
          let affirmations: any = null;
          if (playbook.affirmations) {
            affirmations = typeof playbook.affirmations === 'string'
              ? JSON.parse(playbook.affirmations)
              : playbook.affirmations;
          }

          // Add found affirmations to collection
          if (affirmations && Array.isArray(affirmations)) {
            affirmations.forEach((aff: any, index: number) => {
              allAffirmations.push({
                id: `${playbook.id}-${index}`,
                content: typeof aff === 'string' ? aff : aff.text || aff.content || aff.affirmation,
                playbook_title: playbook.title,
              });
            });
          }
        } catch (parseError) {
          console.warn('Error parsing playbook affirmations:', parseError);
        }
      });

      console.log(`Extracted ${allAffirmations.length} affirmations from ${playbooks.length} playbooks`);

      if (allAffirmations.length === 0) {
        setAffirmation(null);
        return;
      }

      // Select affirmation based on current date for consistency
      const today = new Date();
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      const selectedIndex = dayOfYear % allAffirmations.length;

      setAffirmation(allAffirmations[selectedIndex]);

    } catch (err) {
      console.error('Error fetching daily affirmation:', err);
      setError('Unable to load affirmation');
      setAffirmation(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDailyAffirmation();
  }, [fetchDailyAffirmation]);

  const handleRefresh = () => {
    fetchDailyAffirmation();
    onRefresh?.();
  };

  const handleAffirmationPress = async () => {
    if (!affirmation || !user) {return;}

    try {
      // Award faith points for engaging with daily affirmation
      await faithPointsService.awardPoints(user.id, 'daily_streak', {
        type: 'affirmation_read',
        affirmation_id: affirmation.id,
      });

      onAffirmationPress?.(affirmation);
    } catch (affirmationError) {
      console.error('Error awarding points for affirmation:', affirmationError);
      // Still call the callback even if points fail
      onAffirmationPress?.(affirmation);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="heart" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>Daily Affirmation</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.alertCoral} />
          <Text style={styles.loadingText}>Loading inspiration...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="heart" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Daily Affirmation</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={18} color={Colors.mediumGray} />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TouchableOpacity onPress={handleAffirmationPress} activeOpacity={0.7}>
            <Text style={styles.affirmationText}>
              "{affirmation?.content}"
            </Text>
            {affirmation?.playbook_title && (
              <Text style={styles.sourceText}>
                From: {affirmation.playbook_title}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
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
  refreshButton: {
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
  affirmationText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.hopeWhite,
    fontStyle: 'italic',
    marginBottom: 8,
    textAlign: 'center',
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
});

export default DailyAffirmationCard;
