/**
 * DailyAffirmationCard.tsx
 * Displays a random affirmation from the user's playbooks
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  NativeModules,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { faithPointsService } from '../../services/faithPointsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerErrorHaptic } from '../../utils/haptics';
import DashboardAffirmationSkeleton from '../SkeletonLoader/DashboardAffirmationSkeleton';
import ThemedText from '../common/ThemedText';


interface Affirmation {
  id: string;
  content: string;
  playbook_title?: string;
}

interface DailyAffirmationCardProps {
  onRefresh?: () => void;
  onAffirmationPress?: (affirmation: Affirmation) => void;
  onReadPress?: () => void;
}

const DailyAffirmationCard: React.FC<DailyAffirmationCardProps> = ({ onRefresh, onAffirmationPress, onReadPress }) => {
  const { user } = useAuth();
  const [affirmations, setAffirmations] = useState<Affirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasRead, setHasRead] = useState(false);
  const readCooldownRef = useRef<number>(0);
  const readAwardedRef = useRef<boolean>(false);

  // Haptics and burst animation (mirroring DevotionalDetailScreen patterns)
  type Particle = {
    id: number;
    progress: Animated.Value; // 0 -> 1
    dx: number;
    dy: number;
    size: number;
    rotate: number;
    color: string;
    delay: number;
  };

  const triggerLightHaptic = () => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) {return;}
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) { return; }

      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('impactLight', {
          enableVibrateFallback: false,
          ignoreAndroidSystemSettings: false,
        });
      }
    } catch {}
  };

  const triggerSuccessHaptic = () => {
    try {
      const { RNHapticFeedback } = NativeModules as any;
      if (!RNHapticFeedback) {return;}
      const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
      if (hapticsPref === false) { return; }

      const Haptic = require('react-native-haptic-feedback');
      const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
      if (typeof triggerFn === 'function') {
        triggerFn('notificationSuccess', {
          enableVibrateFallback: false,
          ignoreAndroidSystemSettings: false,
        });
      }
    } catch {}
  };

  const readHapticTimersRef = useRef<number[]>([]);
  const startReadBurstHaptics = () => {
    try {
      readHapticTimersRef.current.forEach(id => clearTimeout(id));
      readHapticTimersRef.current = [];
      const schedule = [0, 250, 500, 750];
      schedule.forEach(delay => {
        const id = setTimeout(() => {
          try {
            const { RNHapticFeedback } = NativeModules as any;
            if (!RNHapticFeedback) {return;}
            const hapticsPref = (user as any)?.user_metadata?.preferences?.hapticsEnabled;
            if (hapticsPref === false) { return; }

            const Haptic = require('react-native-haptic-feedback');
            const triggerFn = Haptic?.default?.trigger || Haptic?.trigger;
            if (typeof triggerFn === 'function') {
              triggerFn('impactLight', {
                enableVibrateFallback: false,
                ignoreAndroidSystemSettings: false,
              });
            }
          } catch {}
        }, delay) as unknown as number;
        readHapticTimersRef.current.push(id);
      });
    } catch {}
  };

  const [readParticles, setReadParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);
  const startReadBurst = () => {
    const NUM = 10;
    const colors = [Colors.alertCoral, '#ff7a7a', '#ff9aa2', '#ff6b6b'];
    const newParticles: Particle[] = Array.from({ length: NUM }).map((_, i) => {
      const id = particleIdRef.current++;
      return {
        id,
        progress: new Animated.Value(0),
        dx: (Math.random() * 80 - 40),
        dy: 70 + Math.random() * 70,
        size: 10 + Math.random() * 10,
        rotate: Math.random() * 60 - 30,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: i * 35,
      };
    });

    setReadParticles(prev => [...prev, ...newParticles]);
    newParticles.forEach((p) => {
      Animated.timing(p.progress, {
        toValue: 1,
        duration: 900,
        delay: p.delay,
        useNativeDriver: true,
      }).start();
    });

    setTimeout(() => {
      setReadParticles(prev => prev.filter(h => !newParticles.find(n => n.id === h.id)));
    }, 1200);
  };

  const fetchDailyAffirmation = useCallback(async () => {
    if (!user) {return;}

    try {
      setLoading(true);
      setError(null);

      // 1) Fetch user's playbooks (ids + titles)
      const { data: playbooks, error: playbooksError } = await supabase
        .from('playbooks')
        .select('id, title')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (playbooksError) {
        throw playbooksError;
      }

      if (!playbooks || playbooks.length === 0) {
        setAffirmations([]);
        return;
      }

      // 2) Fetch affirmations from separate table for these playbooks
      const playbookIds = playbooks.map(p => p.id);
      const { data: affirmationsData, error: affErr } = await supabase
        .from('playbook_affirmations')
        .select('id, playbook_id, text, order_index')
        .in('playbook_id', playbookIds)
        .order('order_index', { ascending: true });

      if (affErr) {
        throw affErr;
      }

      const titleById = new Map<string, string>(playbooks.map(p => [p.id, p.title]));
      const allAffirmations: Affirmation[] = (affirmationsData || []).map((a: any) => ({
        id: a.id,
        content: a.text,
        playbook_title: titleById.get(a.playbook_id) || undefined,
      }));



      if (allAffirmations.length === 0) {
        setAffirmations([]);
        return;
      }

      // 3) Select items (stable per local-day)
      const today = new Date();
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Show up to 3 affirmations regardless of number of playbooks
      const desiredCount = Math.min(3, allAffirmations.length);

      // Prefer items from different playbooks when possible
      const byPlaybook = new Map<string, Affirmation[]>();
      (affirmationsData || []).forEach((a: any) => {
        const p = a.playbook_id;
        if (!byPlaybook.has(p)) { byPlaybook.set(p, []); }
        byPlaybook.get(p)!.push({
          id: a.id,
          content: a.text,
          playbook_title: titleById.get(p) || undefined,
        });
      });

      // Deterministic selection per playbook
      const perPlaybookPick = (arr: Affirmation[], seed: number) => {
        if (!arr || arr.length === 0) { return null; }
        return arr[seed % arr.length];
      };

      // Load saved selection for today (to keep stable even if playbooks change)
      const storageKey = `daily_affirmation_selection_${user.id}_${dateKey}`;
      let picks: Affirmation[] = [];
      let savedIds: string[] | null = null;
      try {
        const saved = await AsyncStorage.getItem(storageKey);
        if (saved) {
          savedIds = JSON.parse(saved);
          if (Array.isArray(savedIds)) {
            picks = savedIds
              .map((id: string) => allAffirmations.find(a => a.id === id))
              .filter(Boolean) as Affirmation[];
          }
        }
      } catch {}

      // If saved picks are insufficient, fill deterministically
      // Try to pick from different playbooks first
      const playbookIdsShuffled = [...byPlaybook.keys()].sort((a, b) => (a > b ? 1 : -1));
      for (let i = 0; i < playbookIdsShuffled.length && picks.length < desiredCount; i++) {
        const id = playbookIdsShuffled[i];
        const arr = byPlaybook.get(id)!;
        const pick = perPlaybookPick(arr, dayOfYear + i);
        if (pick && !picks.find(p => p.id === pick.id)) { picks.push(pick); }
      }
      // If still short (e.g., only one playbook), fill from remaining affirmations deterministically
      let idx = 0;
      while (picks.length < desiredCount && idx < allAffirmations.length) {
        const candidate = allAffirmations[(dayOfYear + idx) % allAffirmations.length];
        if (!picks.find(p => p.id === candidate.id)) {
          picks.push(candidate);
        }
        idx++;
      }

      // Persist today's selection if none saved or we had to adjust
      try {
        const finalIds = picks.map(p => p.id);
        if (!savedIds || savedIds.length !== finalIds.length || savedIds.some((id, i) => id !== finalIds[i])) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(finalIds));
        }
      } catch {}

      setAffirmations(picks);

    } catch (err) {
      console.error('Error fetching daily affirmation:', err);
      try { triggerErrorHaptic(); } catch {}
      setError('Unable to load affirmation');
      setAffirmations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDailyAffirmation();
  }, [fetchDailyAffirmation]);

  // Initialize hasRead based on whether the user has already recorded today's read activity
  useEffect(() => {
    (async () => {
      try {
        if (!user?.id) { return; }
        const already = await faithPointsService.hasActivityToday(user.id, 'affirmation_read_aloud');
        if (already) { setHasRead(true); readAwardedRef.current = true; }
      } catch {}
    })();
  }, [user?.id]);

  // Cleanup any pending haptic timers on unmount
  useEffect(() => {
    return () => {
      try {
        readHapticTimersRef.current.forEach(id => clearTimeout(id));
        readHapticTimersRef.current = [];
      } catch {}
    };
  }, []);

  const handleRefresh = () => {
    fetchDailyAffirmation();
    // Also re-check read status on manual refresh to ensure UI stays in sync
    (async () => {
      try {
        if (!user?.id) { return; }
        const already = await faithPointsService.hasActivityToday(user.id, 'affirmation_read_aloud');
        setHasRead(!!already);
        if (already) { readAwardedRef.current = true; }
      } catch {}
    })();
    onRefresh?.();
  };

  const handleAffirmationPress = (item: Affirmation) => {
    if (!item) {return;}
    try {
      onAffirmationPress?.(item);
    } catch (e) {
      // no-op
    }
  };

  const titleCopy = affirmations.length > 1 ? "TODAY'S AFFIRMATIONS" : "TODAY'S AFFIRMATION";

  if (loading) {
    return <DashboardAffirmationSkeleton />;
  }

  // Hide the card entirely if there are no affirmations and no error
  if (!error && affirmations.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <ThemedText weight="semiBold" accessibilityRole="header" style={styles.titleText}>{titleCopy}</ThemedText>

      {error ? (
        <View style={styles.errorContainer}>
          <ThemedText accessibilityRole="alert" style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Try loading affirmations again" onPress={handleRefresh} style={styles.retryButton}>
            <ThemedText weight="semiBold" style={styles.retryText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {affirmations.length === 0 ? (
            // This branch will rarely be hit because we return null when no affirmations and no error.
            // Kept for safety in case of future changes.
            <ThemedText style={styles.errorText}>No affirmations found. Create a playbook to get started.</ThemedText>
          ) : (
            <View style={styles.listContainer}>
              {affirmations.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleAffirmationPress(item)}
                  activeOpacity={0.7}
                  style={styles.affirmationItem}
                  accessibilityRole="button"
                  accessibilityLabel={`Affirmation: ${item.content}`}
                >
                  <ThemedText style={styles.affirmationText}>{item.content}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Bottom Read button with burst animation */}
          <View pointerEvents="box-none" style={styles.readButtonWrapper}>
            {readParticles.length > 0 && (
              <View pointerEvents="none" style={styles.readBurstLayer}>
                {readParticles.map((p) => {
                  const translateY = p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -p.dy] });
                  const translateX = p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
                  const scale = p.progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.1, 0.8] });
                  const opacity = p.progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 0] });
                  return (
                    <Animated.View
                      key={p.id}
                      style={[styles.readParticle, { opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate: `${p.rotate}deg` }] }]}
                    >
                      <Ionicons name="book" size={p.size} color={p.color} />
                    </Animated.View>
                  );
                })}
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.readButton,
                hasRead && styles.readButtonActive,
              ]}
              activeOpacity={0.85}
              onPress={() => {
                const now = Date.now();
                if (now - readCooldownRef.current < 800) { return; }
                readCooldownRef.current = now;

                const nextIsRead = !hasRead;
                if (nextIsRead) {
                  // celebratory haptics + burst when marking as read
                  triggerSuccessHaptic();
                  startReadBurstHaptics();
                  startReadBurst();

                  // Award +2 FP once per day (and only once per component lifecycle)
                  if (!readAwardedRef.current && user?.id) {
                    readAwardedRef.current = true; // guard immediately to prevent race-based duplication
                    (async () => {
                      try {
                        const already = await faithPointsService.hasActivityToday(user.id, 'affirmation_read_aloud');
                        if (!already) {
                          await faithPointsService.awardPoints(user.id, 'affirmation_read_aloud');
                        }
                      } catch (e) {
                        // If check/award fails, allow retry within this session
                        readAwardedRef.current = false;
                      }
                    })();
                  }
                } else {
                  // subtle haptic when unmarking
                  triggerLightHaptic();
                }
                setHasRead(nextIsRead);
                try { onReadPress?.(); } catch {}
              }}
              accessibilityRole="button"
              accessibilityLabel={hasRead ? 'Read today\'s affirmation' : 'Read today\'s affirmation aloud'}
              accessibilityHint="Tap when you've read it aloud"
              testID="dailyAffirmationReadButton"
            >
              <Ionicons name="book-outline" size={18} color={hasRead ? Colors.alertCoral : Colors.hopeWhite} style={styles.readIcon} />
              <ThemedText weight="bold" style={[styles.readButtonText, hasRead && styles.readButtonTextActive]}>{hasRead ? 'Read' : 'Read Aloud'}</ThemedText>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
  listContainer: {
    gap: 8,
  },
  affirmationItem: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  affirmationText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.hopeWhite,
    fontStyle: 'normal',

    marginBottom: 8,
    textAlign: 'left',
  },
  readButtonWrapper: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  readBurstLayer: {
    position: 'absolute',
    bottom: 22,
    alignSelf: 'center',
    width: 140,
    height: 120,
  },
  readParticle: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
  },
  readButton: {
    // Match Pray button base style
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  readButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,

    letterSpacing: 0.3,
  },
  readButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  readButtonTextActive: {
    color: Colors.alertCoral,
  },
  readIcon: {
    marginRight: 6,
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
});

export default DailyAffirmationCard;
