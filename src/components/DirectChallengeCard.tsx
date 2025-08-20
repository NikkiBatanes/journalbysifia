import React, { useState } from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Icon from 'react-native-vector-icons/Ionicons';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BorderRadii } from '../theme/styles';

import { Colors } from '../theme';
import { Typography } from '../theme/typography';
import { SimplifiedCardInsight } from './SimplifiedCardInsight';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { triggerLightHaptic } from '../utils/haptics';

type DirectChallengeCardProps = {
  challenge: string;
  challengeCTA?: string;
  playbookTitle?: string;
  userInput?: string;
};

export default function DirectChallengeCard({ challenge, challengeCTA, playbookTitle, userInput }: DirectChallengeCardProps) {
  const { user } = useAuth();
  const expoundingAccess = useFeatureAccess({ feature: 'expounding' });
  const [showInsight, setShowInsight] = useState(false);
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <MaterialCommunityIcons
          name="lightning-bolt"
          size={24}
          color={Colors.anchorBlue}
          style={styles.icon}
        />
        <Text style={styles.heading}>Rise in Faith</Text>
        <TouchableOpacity
          style={styles.expandIcon}
          onPress={() => {
            triggerLightHaptic();
            setShowInsight(!showInsight);
          }}
        >
          <Icon
            name={showInsight ? 'chevron-up' : 'information-outline'}
            size={20}
            color={Colors.hopeWhite}
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.text}>
        {challenge}
      </Text>
      {challengeCTA && (
        <Text style={styles.cta}>{challengeCTA}</Text>
      )}

      {/* Simplified Card Insight */}
      {showInsight && (
        <SimplifiedCardInsight
          userId={user?.id || ''}
          cardType="challenge"
          cardContent={challenge + (challengeCTA ? ` ${challengeCTA}` : '')}
          playbookTitle={playbookTitle || ''}
          userOriginalInput={userInput}
          hasAccess={expoundingAccess.hasAccess}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: BorderRadii.cardXL,
    padding: 24,
    width: '100%',
    alignSelf: 'stretch',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Match TruthInLoveCard
  },
  icon: {
    marginRight: 8, // Match TruthInLoveCard's icon margin
  },
  heading: {
    ...Typography.interBold, // Match TruthInLoveCard
    fontSize: 20,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textTransform: 'none', // Match TruthInLoveCard
  },
  text: {
    ...Typography.interSemiBold,
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 26,
    textAlign: 'left',
    paddingHorizontal: 8,
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 16,
  },
  cta: {
    ...Typography.interSemiBold,
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 26,
    textAlign: 'left',
    paddingHorizontal: 8,
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 16,
  },
  expandIcon: {
    padding: 4,
    marginLeft: 8,
  },
});
