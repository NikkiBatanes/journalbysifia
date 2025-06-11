import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import TruthInLoveCard from './TruthInLoveCard';
import ActionStepsCard from './ActionStepsCard';
import AffirmationCard from './AffirmationCard';
import BibleVerseCard from './BibleVerseCard';
import DirectChallengeCard from './DirectChallengeCard';
import { Colors } from '../theme';
import { Playbook } from '../interfaces/playbook';

import { ActionStep } from '../interfaces/playbook';

interface DocumentCardsProps {
  playbook: Playbook;
  actionSteps: ActionStep[];
  styles: any;
  onScroll?: (event: any) => void;
  scrollEventThrottle?: number;
}

const DocumentCards: React.FC<DocumentCardsProps> = ({
  playbook,
  actionSteps,
  styles,
  onScroll,
  scrollEventThrottle = 16,
}) => {
  // DEBUG: Log actionSteps received by DocumentCards
  console.log('[DEBUG] DocumentCards - Received actionSteps:', {
    fromProps: actionSteps,
    fromPlaybook: playbook.actionSteps,
    hasSubTasks: actionSteps?.some(step => step.subTasks && step.subTasks.length > 0) || 
                 playbook.actionSteps?.some(step => step.subTasks && step.subTasks.length > 0)
  });
  
  // Log first action step details if available
  const firstStep = actionSteps?.[0] || playbook.actionSteps?.[0];
  if (firstStep) {
    console.log('[DEBUG] DocumentCards - First action step:', {
      id: firstStep.id,
      title: firstStep.title,
      hasSubTasks: firstStep.subTasks && firstStep.subTasks.length > 0,
      subTasksCount: firstStep.subTasks?.length || 0,
      subTasks: firstStep.subTasks?.slice(0, 2) // Show first 2 subtasks for inspection
    });
  }
  
  return (
    <ScrollView
      style={styles.docContainer}
      contentContainerStyle={styles.docContentContainer}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      showsVerticalScrollIndicator={false}
    >
    <TruthInLoveCard
      key="truth"
      truth={playbook.truthInLove?.text}
      summary={playbook.truthInLove?.summary}
      expanded={true}
      style={[styles.docCard, styles.truthCard]}
    />
    <ActionStepsCard
      key="action"
      steps={actionSteps || playbook.actionSteps || []}
      style={[styles.docCard, styles.actionCard]}
    />
    <View key="affirmation" style={[styles.docCard, styles.affirmationsCard]}>
      <View style={styles.affirmationsHeader}>
        <MaterialCommunityIcons name="format-quote-close" size={24} color="white" style={[styles.icon, { transform: [{ scaleX: -1 }] }]} />
        <Text style={styles.affirmationsTitle}>Affirmations</Text>
      </View>
      <View style={styles.affirmationsList}>
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
      style={[styles.docCard, styles.bibleCard, { marginTop: 16 }]}
    />
    <View key="challenge" style={styles.challengeCard}>
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

export default DocumentCards;
