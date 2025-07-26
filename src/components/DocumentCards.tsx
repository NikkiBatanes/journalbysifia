import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme';
import TruthInLoveCard from './TruthInLoveCard';
import ActionStepsCard from './ActionStepsCard';
import AffirmationCard from './AffirmationCard';
import BibleVerseCard from './BibleVerseCard';
import DirectChallengeCard from './DirectChallengeCard';
import { Playbook } from '../interfaces/playbook';
import { ActionStep } from '../interfaces/playbook';

interface DocumentCardsProps {
  playbook: Playbook;
  actionSteps: ActionStep[];
  styles: any;
  onScroll?: (event: any) => void;
  scrollEventThrottle?: number;
  onLastCardVisible?: (visible: boolean) => void;
}

const DocumentCards: React.FC<DocumentCardsProps> = ({
  playbook,
  actionSteps,
  styles: propStyles,
  onScroll,
  scrollEventThrottle = 16,
  onLastCardVisible,
}) => {
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
      />
      <ActionStepsCard
        key="action"
        steps={actionSteps || playbook.actionSteps || []}
        style={[propStyles.docCard, propStyles.actionCard]}
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
