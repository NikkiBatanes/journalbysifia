import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
}

const DocumentCardView: React.FC<DocumentCardViewProps> = ({ card, styles: propStyles }) => {
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
        />
      </View>
    );
  }
  if (card.type === 'action') {
    return <ActionStepsCard steps={card.steps ?? []} style={styles.actionCard} />;
  }
  if (card.type === 'affirmation') {
    return (
      <View style={[propStyles.affirmationsCard, styles.affirmationsContainer]}>
        <View style={propStyles.affirmationsHeader}>
          <MaterialCommunityIcons 
            name="format-quote-open" 
            size={20} 
            color={Colors.hopeWhite} 
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
    transform: [{ rotate: '180deg' }],
  },
});

export default DocumentCardView;
