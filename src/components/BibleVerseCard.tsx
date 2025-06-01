import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme';

type BibleVerse = {
  text: string;
  reference: string;
};

type BibleVerseCardProps = {
  verse: BibleVerse;
};

export default function BibleVerseCard({ verse }: BibleVerseCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Bible Verse</Text>
      <Text style={styles.verseText}>"{verse.text}"</Text>
      <Text style={styles.reference}>{verse.reference}</Text>
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
  verseText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    fontStyle: 'italic',
    color: Colors.trustGrey,
    marginBottom: 6,
  },
  reference: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.faithGold,
    textAlign: 'right',
  },
});
