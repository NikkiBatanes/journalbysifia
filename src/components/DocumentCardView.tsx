import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, Text, StyleSheet } from 'react-native';

import { NavigationProp } from '@react-navigation/native';
import TruthInLoveCard from './TruthInLoveCard';
import ActionStepsCard from './ActionStepsCard';
import AffirmationCard from './AffirmationCard';
import BibleVerseCard from './BibleVerseCard';
import DirectChallengeCard from './DirectChallengeCard';
import { Colors } from '../theme';

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
    console.log('[DEBUG] DocumentCardView: Action card rendering:', {
      stepsCount: steps.length,
      steps: steps.map(s => ({ id: s.id, title: s.title, hasSubTasks: s.subTasks?.length || 0 })),
    });

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
    console.log('[DEBUG] DocumentCardView: Affirmation card rendering:', {
      affirmationsCount: card.affirmations?.length || 0,
      affirmations: card.affirmations?.map(a => ({ id: a.id, text: a.text?.substring(0, 50) + '...', completed: a.completed })),
    });
    return (
      <View style={[propStyles.affirmationsCard, styles.affirmationsContainer]}>
        <View style={propStyles.affirmationsHeader}>
          <MaterialCommunityIcons
            name="format-quote-close"
            size={24}
            color={Colors.alertCoral}
            style={[propStyles.icon, styles.affirmationIcon]}
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
                  playbookTitle={playbookTitle}
                  userInput={userInput}
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
        expanded={expanded}
        playbookTitle={playbookTitle}
        userInput={userInput}
      />
    );
  }
  if (card.type === 'challenge') {
    return (
      <View style={styles.challengeCardContainer}>
        <DirectChallengeCard
          challenge={typeof card.challenge === 'string' ? card.challenge : card.challenge?.text ?? ''}
          challengeCTA={card.challengeCTA ?? ''}
          playbookTitle={playbookTitle}
          userInput={userInput}
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
