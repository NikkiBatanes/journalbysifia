import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme';

type AffirmationCardProps = {
  affirmation: string;
};

export default function AffirmationCard({ affirmation }: AffirmationCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Daily Affirmation</Text>
      <Text style={styles.text}>{affirmation}</Text>
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
    borderColor: Colors.faithGold,
    shadowColor: Colors.faithGold,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: Colors.faithGold,
    marginBottom: 8,
  },
  text: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.anchorBlue,
  },
});
