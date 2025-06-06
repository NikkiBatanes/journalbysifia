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
}

const DocumentCards: React.FC<DocumentCardsProps> = ({ playbook, actionSteps, styles }) => (
  <ScrollView
    style={styles.docContainer}
    contentContainerStyle={styles.docContentContainer}
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
      steps={actionSteps}
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
      <DirectChallengeCard challenge={playbook.directChallenge} challengeCTA={playbook.challengeCTA} />
    </View>
  </ScrollView>
);

export default DocumentCards;
