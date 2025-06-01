import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme';

type TruthInLoveCardProps = {
  truth: string;
  summary: string;
};

export default function TruthInLoveCard({ truth, summary }: TruthInLoveCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Truth in Love</Text>
      <Text style={styles.truth}>{truth}</Text>
      <Text style={styles.summary}>{summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.anchorBlue,
    shadowColor: Colors.anchorBlue,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: Colors.anchorBlue,
    marginBottom: 8,
  },
  truth: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.trustGrey,
    marginBottom: 6,
  },
  summary: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.growthGreen,
  },
});
