import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, StyleSheet } from 'react-native';
import { BorderRadii } from '../theme/styles';

import { Colors } from '../theme';
import ThemedText from './common/ThemedText';

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
          color={Colors.anchorBlue}
          style={styles.icon}
        />
        <ThemedText weight="bold" style={styles.heading}>Rise in Faith</ThemedText>
      </View>
      <ThemedText weight="semiBold" style={styles.text}>
        {challenge}
      </ThemedText>
      {challengeCTA && (
        <ThemedText weight="semiBold" style={styles.cta}>{challengeCTA}</ThemedText>
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
    // Typography handled by ThemedText weight="bold"
    fontSize: 20,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textTransform: 'none', // Match TruthInLoveCard
  },
  text: {
    // Typography handled by ThemedText weight="semiBold"
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
    // Typography handled by ThemedText weight="semiBold"
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
