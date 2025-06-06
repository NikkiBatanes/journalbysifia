import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BorderRadii } from '../theme/styles';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Fonts } from '../theme';
import { Typography } from '../theme/typography';

type DirectChallengeCardProps = {
  challenge: string;
  challengeCTA?: string;
};

export default function DirectChallengeCard({ challenge, challengeCTA }: DirectChallengeCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <MaterialCommunityIcons
          name="lightning-bolt"
          size={24}
          color={Colors.hopeWhite}
          style={styles.icon}
        />
        <Text style={styles.heading}>Rise in Faith</Text>
      </View>
      <Text style={styles.text}>
        {challenge}
      </Text>
      {challengeCTA && (
        <Text style={styles.cta}>{challengeCTA}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.alertCoral,
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
});
