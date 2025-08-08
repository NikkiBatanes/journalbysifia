import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, Text, StyleSheet } from 'react-native';

import { NavigationProp } from '@react-navigation/native';
import TruthInLoveCard from './TruthInLoveCard';
import ActionStepsCard from './ActionStepsCard';
import { EnhancedActionStepCard } from './EnhancedActionStepCard';
import AffirmationCard from './AffirmationCard';
import BibleVerseCard from './BibleVerseCard';
import DirectChallengeCard from './DirectChallengeCard';
import { Colors } from '../theme';
import { useAuth } from '../context/IndustryStandardAuthContext';

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
}

const DocumentCardView: React.FC<DocumentCardViewProps> = ({ card, styles: propStyles, currentUser, navigation, playbookTitle, playbookId }) => {
  const { user } = useAuth();
  if (card.type === 'truth') {
    return (
      <View style={styles.truthCardContainer}>
        <TruthInLoveCard
          truth={card.truth ?? ''}
          summary={card.summary ?? ''}
          expanded={false} // Set to false for stack view
          style={styles.truthCardContent}
          numberOfLines={5}
          ellipsizeMode="tail"
          currentUser={currentUser}
        />
      </View>
    );
  }
  if (card.type === 'action') {
    // Use enhanced action step card for better expounding and export features
    const steps = card.steps ?? [];

    return (
      <View style={styles.actionCard}>
        {steps.map((step, index) => (
          <EnhancedActionStepCard
            key={step.id || `step-${index}`}
            actionStep={{
              id: step.id || `step-${index}`,
              text: step.text || '',
              completed: step.completed || false,
              orderIndex: index,
              examples: step.examples,
              subtasks: step.subtasks,
            }}
            playbookId={playbookId || ''}
            playbookTitle={playbookTitle || ''}
            userId={user?.id || ''}
            onToggleComplete={(stepId) => {
              // Handle step completion
              console.log('Step completed:', stepId);
            }}
            onToggleSubtaskComplete={(stepId: string, subtaskId: string) => {
              // Handle subtask completion
              console.log('Subtask completed:', stepId, subtaskId);
            }}
          />
        ))}

        {/* Fallback to original card if no steps or enhanced features not needed */}
        {steps.length === 0 && (
          <ActionStepsCard
            steps={card.steps ?? []}
            style={styles.actionCard}
            navigation={navigation}
            playbookTitle={playbookTitle}
            playbookId={playbookId}
          />
        )}
      </View>
    );
  }
  if (card.type === 'affirmation') {
    return (
      <View style={[propStyles.affirmationsCard, styles.affirmationsContainer]}>
        <View style={propStyles.affirmationsHeader}>
          <MaterialCommunityIcons
            name="format-quote-open"
            size={20}
            color={Colors.alertCoral}
            style={styles.affirmationIcon}
          />
          <Text style={propStyles.affirmationsTitle}>Affirmations</Text>
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
            <Text style={propStyles.noAffirmationsText}>No affirmations</Text>
          )}
        </View>
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
    transform: [{ scaleY: -1 }],
  },
});

export default DocumentCardView;
