import React, { useMemo, useRef, useState } from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';

import { Colors } from '../theme';
import TruthInLoveCard from './TruthInLoveCard';
import ActionStepsCard from './ActionStepsCard';
import AffirmationCard from './AffirmationCard';
import BibleVerseCard from './BibleVerseCard';
import DirectChallengeCard from './DirectChallengeCard';
import { Playbook } from '../interfaces/playbook';
import { ActionStep } from '../interfaces/playbook';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { faithPointsService } from '../services/faithPointsService';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { usePlaybookStoreReactQuery } from '../store/usePlaybookStoreReactQuery';

interface DocumentCardsProps {
  playbook: Playbook;
  actionSteps: ActionStep[];
  styles: any;
  onScroll?: (event: any) => void;
  scrollEventThrottle?: number;
  onLastCardVisible?: (visible: boolean) => void;
  currentUser?: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
  };
}

const DocumentCards: React.FC<DocumentCardsProps> = ({
  playbook,
  actionSteps,
  styles: propStyles,
  onScroll,
  scrollEventThrottle = 16,
  onLastCardVisible,
  currentUser,
}) => {
  const { user } = useAuth();

  // DEBUG: Log actionSteps received by DocumentCards
  console.log('[DEBUG] DocumentCards - Received actionSteps:', {
    fromProps: actionSteps,
    fromPlaybook: playbook.actionSteps,
    hasSubTasks: actionSteps?.some(step => step.subTasks && step.subTasks.length > 0) ||
                 playbook.actionSteps?.some(step => step.subTasks && step.subTasks.length > 0),
  });

  // Log first action step details if available
  const firstStep = actionSteps?.[0] || playbook.actionSteps?.[0];
  if (firstStep) {
    console.log('[DEBUG] DocumentCards - First action step:', {
      id: firstStep.id,
      title: firstStep.title,
      hasSubTasks: firstStep.subTasks && firstStep.subTasks.length > 0,
      subTasksCount: firstStep.subTasks?.length || 0,
      subTasks: firstStep.subTasks?.slice(0, 2), // Show first 2 subtasks for inspection
    });
  }

  // Challenge card Y position
  const challengeCardY = React.useRef(0);
  const challengeCardHeight = React.useRef(0);
  const scrollViewHeight = React.useRef(0);

  // Check if challenge card is visible
  const handleScroll = (event: any) => {
    if (onScroll) {onScroll(event);}
    const scrollY = event.nativeEvent.contentOffset.y;
    const visibleHeight = event.nativeEvent.layoutMeasurement.height;
    scrollViewHeight.current = visibleHeight;
    // If challenge card's top is within the visible area
    // Only show the button if the ENTIRE challenge card is visible
    if (
      challengeCardY.current >= scrollY &&
      challengeCardY.current + challengeCardHeight.current <= scrollY + visibleHeight
    ) {
      onLastCardVisible && onLastCardVisible(true);
    } else {
      onLastCardVisible && onLastCardVisible(false);
    }
  };

  return (
    <ScrollView
      style={propStyles.docContainer}
      contentContainerStyle={[propStyles.docContentContainer, styles.contentContainer]}
      onScroll={handleScroll}
      scrollEventThrottle={scrollEventThrottle}
      showsVerticalScrollIndicator={false}
    >
      <TruthInLoveCard
        key="truth"
        truth={playbook.truthInLove?.text}
        summary={playbook.truthInLove?.summary}
        expanded={true}
        style={(() => {
          console.log('[DEBUG] Colors.anchorBlue value:', Colors.anchorBlue);
          console.log('[DEBUG] propStyles.truthCard:', propStyles.truthCard);
          return [propStyles.docCard, propStyles.truthCard, { backgroundColor: Colors.anchorBlue }];
        })()}
        currentUser={currentUser}
      />
      <ActionStepsCard
        key="action"
        steps={actionSteps || playbook.actionSteps || []}
        style={[propStyles.docCard, propStyles.actionCard]}
        playbookTitle={playbook.title}
        playbookId={playbook.id}
      />
      <View key="affirmation" style={[propStyles.docCard, propStyles.affirmationsCard]}>
        <View style={propStyles.affirmationsHeader}>
          <MaterialCommunityIcons
            name="format-quote-close"
            size={24}
            color={Colors.alertCoral}
            style={[propStyles.icon, styles.quoteIcon]}
          />
          <Text style={propStyles.affirmationsTitle}>Affirmations</Text>
        </View>
        <View style={propStyles.affirmationsList}>
          {playbook.affirmations?.map((affirmation) => (
            <AffirmationCard
              key={affirmation.id}
              id={affirmation.id}
              text={affirmation.text}
              completed={affirmation.completed}
            />
          ))}
        </View>

        {/* Read Aloud button below the last affirmation (document view) */}
        {playbook.affirmations && playbook.affirmations.length > 0 && (
          <ReadAloudButtonDoc
            playbookId={playbook.id}
            playbookTitle={playbook.title}
            userId={user?.id}
          />
        )}
      </View>
      <BibleVerseCard
        key="bible"
        verse={playbook.bibleVerse}
        style={[propStyles.docCard, propStyles.bibleCard, styles.bibleVerseCard]}
      />
      <View
        key="challenge"
        style={propStyles.challengeCard}
        onLayout={event => {
          challengeCardY.current = event.nativeEvent.layout.y;
          challengeCardHeight.current = event.nativeEvent.layout.height;
        }}
      >
        <DirectChallengeCard
          challenge={
            typeof playbook.directChallenge === 'string'
              ? playbook.directChallenge
              : playbook.directChallenge?.text ?? ''
          }
          challengeCTA={playbook.challengeCTA ?? ''}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 96,
  },
  quoteIcon: {
    transform: [{ scaleX: -1 }],
  },
  bibleVerseCard: {
    // No extra margin - docCard already provides marginBottom: 16
  },
});

export default DocumentCards;

// Inline sub-component for the Document view read aloud button
const ReadAloudButtonDoc: React.FC<{
  playbookId: string;
  playbookTitle?: string;
  userId?: string;
}> = ({ playbookId, playbookTitle, userId }) => {
  const hasRead = usePlaybookStoreReactQuery(state => !!state.readAloudMap[playbookId]);
  const setReadAloud = usePlaybookStoreReactQuery(state => state.setReadAloud);
  const cooldownRef = useRef(0);
  const awardedRef = useRef(false);
  const [particles, setParticles] = useState<{ id: number; progress: Animated.Value; dx: number; dy: number; size: number; rotate: number; color: string; delay: number;}[]>([]);
  const particleIdRef = useRef(0);

  const startBurst = () => {
    const NUM = 8;
    const colors = [Colors.alertCoral, '#ff7a7a', '#ff9aa2', '#ff6b6b'];
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

  return (
    <View pointerEvents="box-none" style={readDocStyles.readButtonWrapper}>
      {particles.length > 0 && (
        <View pointerEvents="none" style={readDocStyles.readBurstLayer}>
          {particles.map((p) => {
            const translateY = p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -p.dy] });
            const translateX = p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
            const scale = p.progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.1, 0.8] });
            const opacity = p.progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 0] });
            return (
              <Animated.View key={p.id} style={[readDocStyles.readParticle, { opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate: `${p.rotate}deg` }] }]}> 
                <Ionicons name="book" size={p.size} color={p.color} />
              </Animated.View>
            );
          })}
        </View>
      )}
      <TouchableOpacity
        style={[readDocStyles.readButton, hasRead && readDocStyles.readButtonActive]}
        activeOpacity={0.85}
        onPress={() => {
          const now = Date.now();
          if (now - cooldownRef.current < 800) { return; }
          cooldownRef.current = now;

          const nextIsRead = !hasRead;
          if (nextIsRead) {
            triggerSuccessHaptic();
            startBurst();

            if (!awardedRef.current && userId && playbookId) {
              awardedRef.current = true;
              (async () => {
                try {
                  const already = await faithPointsService.hasActivityTodayForPlaybook(userId, 'affirmation_read_aloud', playbookId);
                  if (!already) {
                    await faithPointsService.awardPoints(userId, 'affirmation_read_aloud', { playbookId, playbookTitle, source: 'document_view' });
                  }
                } catch (e) {
                  awardedRef.current = false; // allow retry on failure
                }
              })();
            }
          } else {
            triggerLightHaptic();
          }
          setReadAloud(playbookId, nextIsRead);
        }}
        accessibilityRole="button"
        accessibilityLabel={hasRead ? 'Read' : 'Read aloud'}
        accessibilityHint="Tap when you have read the affirmations aloud"
        testID="documentAffirmationsReadButton"
      >
        <Ionicons name="book-outline" size={18} color={hasRead ? Colors.alertCoral : Colors.hopeWhite} style={readDocStyles.readIcon} />
        <Text style={[readDocStyles.readButtonText, hasRead && readDocStyles.readButtonTextActive]}>{hasRead ? 'Read' : 'Read Aloud'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const readDocStyles = StyleSheet.create({
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
    shadowColor: '#000',
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
    fontWeight: '700',
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
