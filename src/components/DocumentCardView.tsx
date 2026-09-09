import React, { useEffect, useMemo, useRef, useState } from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';

import { NavigationProp } from '@react-navigation/native';
import TruthInLoveCard from './TruthInLoveCard';
import ActionStepsCard from './ActionStepsCard';
import AffirmationCard from './AffirmationCard';
import BibleVerseCard from './BibleVerseCard';
import DirectChallengeCard from './DirectChallengeCard';
import { Colors } from '../theme';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { faithPointsService } from '../services/faithPointsService';
import { usePlaybookStoreReactQuery } from '../store/usePlaybookStoreReactQuery';
import ThemedText from './common/ThemedText';

interface Affirmation {
  id: string;
  text: string;
  completed: boolean;
}

interface Card {
  type: string;
  truth?: string;
  summary?: string;
  steps?: any[];
  affirmations?: Affirmation[];
  verse?: { text: string; reference: string };
  challenge?: string | { text: string; summary: string };
  challengeCTA?: string;
}

interface DocumentCardViewProps {
  card: Card;
  styles: any;
  currentUser?: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
  };
  navigation?: NavigationProp<any>;
  playbookTitle?: string;
  playbookId?: string;
  userInput?: string;
  expanded?: boolean;
}

const DocumentCardView: React.FC<DocumentCardViewProps> = ({ card, styles: propStyles, currentUser, navigation, playbookTitle, playbookId, userInput, expanded = false }) => {
  const { user } = useAuth();

  // Get user's preferred Bible translation
  const userMeta: any = (user as any)?.user_metadata || {};
  const preferredBibleTranslation = userMeta?.preferences?.content?.bibleVersion;

  // Shared Read Aloud state across views
  const hasRead = usePlaybookStoreReactQuery(state => playbookId ? !!state.readAloudMap[playbookId] : false);
  const setReadAloud = usePlaybookStoreReactQuery(state => state.setReadAloud);
  const readCooldownRef = useRef<number>(0);
  const readAwardedRef = useRef<boolean>(false);
  const hasInitializedReadFromFaithPointsRef = useRef<boolean>(false);
  const [particles, setParticles] = useState<{ id: number; progress: Animated.Value; dx: number; dy: number; size: number; rotate: number; color: string; delay: number;}[]>([]);
  const particleIdRef = useRef(0);

  const showReadButton = useMemo(() => card.type === 'affirmation' && (card.affirmations?.length || 0) > 0, [card]);

  // Fallback: if points were already awarded for this playbook today, mark as read in store (run once on initial load)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (hasInitializedReadFromFaithPointsRef.current) { return; }
        hasInitializedReadFromFaithPointsRef.current = true;

        if (user?.id && playbookId && !hasRead) {
          const already = await faithPointsService.hasActivityTodayForPlaybook(user.id, 'affirmation_read_aloud', playbookId);
          if (mounted && already) {
            setReadAloud(playbookId, true);
          }
        }
      } catch (e) {}
    })();
    return () => { mounted = false; };
  }, [user?.id, playbookId, hasRead, setReadAloud]);

  const startBurst = () => {
    const NUM = 8;
    const colors = [Colors.alertCoral, '#D97872', '#D97872', '#D97872'];
    const newParticles = Array.from({ length: NUM }).map((_, i) => {
      const id = particleIdRef.current++;
      return {
        id,
        progress: new Animated.Value(0),
        dx: (Math.random() * 80 - 40),
        dy: 60 + Math.random() * 60,
        size: 10 + Math.random() * 8,
        rotate: Math.random() * 60 - 30,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: i * 35,
      };
    });
    setParticles(prev => [...prev, ...newParticles]);
    newParticles.forEach(p => {
      Animated.timing(p.progress, { toValue: 1, duration: 900, delay: p.delay, useNativeDriver: true }).start();
    });
    setTimeout(() => {
      setParticles(prev => prev.filter(h => !newParticles.find(n => n.id === h.id)));
    }, 1200);
  };
  if (card.type === 'truth') {
    return (
      <View style={styles.truthCardContainer}>
        <TruthInLoveCard
          truth={card.truth ?? ''}
          summary={card.summary ?? ''}
          expanded={expanded}
          style={styles.truthCardContent}
          numberOfLines={expanded ? undefined : 5}
          ellipsizeMode={expanded ? undefined : 'tail'}
          currentUser={currentUser}
          playbookTitle={playbookTitle}
          userInput={userInput}
        />
      </View>
    );
  }
  if (card.type === 'action') {
    const steps = card.steps ?? [];

    return (
      <ActionStepsCard
        steps={steps}
        style={styles.actionCard}
        navigation={navigation}
        playbookTitle={playbookTitle}
        playbookId={playbookId}
      />
    );
  }
  if (card.type === 'affirmation') {

    return (
      <View style={[propStyles.affirmationsCard, styles.affirmationsContainer]}>
        <View style={propStyles.affirmationsHeader}>
          <MaterialCommunityIcons
            name="format-quote-close"
            size={24}
            color={Colors.alertCoral}
            style={[propStyles.icon, styles.affirmationIcon]}
          />
          <ThemedText weight="semiBold" style={propStyles.affirmationsTitle}>Declarations</ThemedText>
        </View>
        <View style={propStyles.affirmationsList}>
          {Array.isArray(card.affirmations) && card.affirmations.length > 0 ? (
            card.affirmations
              .filter((affirmation): affirmation is Required<Affirmation> =>
                affirmation?.id !== undefined &&
                affirmation?.text !== undefined &&
                affirmation?.completed !== undefined
              )
              .map((affirmation) => (
                <AffirmationCard
                  key={affirmation.id}
                  id={affirmation.id}
                  text={affirmation.text}
                  completed={affirmation.completed}
                />
              ))
          ) : (
            <ThemedText weight="regular" style={propStyles.noAffirmationsText}>No declarations</ThemedText>
          )}
        </View>

        {/* Read Aloud button below the last affirmation */}
        {showReadButton && (
          <View pointerEvents="box-none" style={readStyles.readButtonWrapper}>
            {particles.length > 0 && (
              <View pointerEvents="none" style={readStyles.readBurstLayer}>
                {particles.map((p) => {
                  const translateY = p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -p.dy] });
                  const translateX = p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
                  const scale = p.progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.1, 0.8] });
                  const opacity = p.progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 0] });
                  return (
                    <Animated.View key={p.id} style={[readStyles.readParticle, { opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate: `${p.rotate}deg` }] }]}>
                      <Ionicons name="book" size={p.size} color={p.color} />
                    </Animated.View>
                  );
                })}
              </View>
            )}
            <TouchableOpacity
              style={[readStyles.readButton, hasRead && readStyles.readButtonActive]}
              activeOpacity={0.85}
              onPress={() => {
                const now = Date.now();
                if (now - readCooldownRef.current < 800) { return; }
                readCooldownRef.current = now;

                const nextIsRead = !hasRead;
                if (nextIsRead) {
                  triggerSuccessHaptic();
                  startBurst();

                  if (!readAwardedRef.current && user?.id && playbookId) {
                    readAwardedRef.current = true; // session guard
                    (async () => {
                      try {
                        const already = await faithPointsService.hasActivityTodayForPlaybook(user.id, 'affirmation_read_aloud', playbookId);
                        if (!already) {
                          await faithPointsService.awardPoints(user.id, 'affirmation_read_aloud', { playbookId, playbookTitle, source: 'playbook_detail' });
                        }
                      } catch (e) {
                        // allow retry if failed
                        readAwardedRef.current = false;
                      }
                    })();
                  }
                } else {
                  triggerLightHaptic();
                }
                if (playbookId) { setReadAloud(playbookId, nextIsRead); }
              }}
              accessibilityRole="button"
              accessibilityLabel={hasRead ? 'Read' : 'Read aloud'}
              accessibilityHint="Tap when you have read the affirmations aloud"
              testID="playbookAffirmationsReadButton"
            >
              <Ionicons name="book-outline" size={18} color={hasRead ? Colors.alertCoral : Colors.hopeWhite} style={readStyles.readIcon} />
              <ThemedText weight="bold" style={[readStyles.readButtonText, hasRead && readStyles.readButtonTextActive]}>{hasRead ? 'I\'ve read this aloud' : 'I\'ve read this aloud'}</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }
  if (card.type === 'bible') {
    return (
      <BibleVerseCard
        verse={{
          text: card.verse?.text ?? 'No verse text available',
          reference: card.verse?.reference ?? 'Unknown',
        }}
        expanded={expanded}
        preferredBibleTranslation={preferredBibleTranslation}
      />
    );
  }
  if (card.type === 'challenge') {
    return (
      <View style={styles.challengeCardContainer}>
        <DirectChallengeCard
          challenge={typeof card.challenge === 'string' ? card.challenge : card.challenge?.text ?? ''}
          challengeCTA={card.challengeCTA ?? ''}
        />
      </View>
    );
  }
  return <View style={styles.defaultContainer} />;
};

const styles = StyleSheet.create({
  truthCardContainer: {
    flex: 1,
    padding: 32,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  truthCardContent: {
    flex: 1,
  },
  actionCard: {
    flex: 1,
    padding: 24,
  },
  affirmationsContainer: {
    flex: 1,
    width: '100%',
  },
  challengeCardContainer: {
    flex: 1,
    backgroundColor: Colors.alertCoral,
    borderRadius: 24,
  },
  defaultContainer: {
    flex: 1,
    padding: 24,
  },
  affirmationIcon: {
    marginRight: 8,
    transform: [{ scaleX: -1 }],
  },
});

export default DocumentCardView;

// Styles specifically for the Read Aloud button and burst animation within the Affirmations card
const readStyles = StyleSheet.create({
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  readButtonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    // Typography handled by ThemedText weight="bold"
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
});
