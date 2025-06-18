import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme';
import { Typography } from '../theme/typography';
import { formatBibleVerse } from '../utils/textFormatting';

import { BibleVerse } from '../interfaces/playbook';

type BibleVerseCardProps = {
  verse: BibleVerse;
  style?: any;
  textColor?: string;
  backgroundColor?: string;
};

export default function BibleVerseCard({ verse, style, textColor = Colors.hopeWhite, backgroundColor = Colors.anchorBlue }: BibleVerseCardProps) {
  return (
    <View style={[styles.container, style, { backgroundColor }]}>
      <View style={styles.headerContainer}>
        <MaterialCommunityIcons
          name="book"
          size={24}
          color={Colors.alertCoral}
          style={styles.icon}
        />
        <Text style={[styles.heading, { color: textColor }]}>Bible Verse</Text>
      </View>
      <View style={styles.contentContainer}>
        <Text style={[styles.verseText, { color: textColor }]}>{formatBibleVerse(verse.text)}</Text>
        <Text style={[styles.reference, { color: Colors.alertCoral }]}>— {verse.reference}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: Colors.anchorBlue,
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
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 20, // Space above the verse text
    paddingBottom: 5, // Space below the reference text
    width: '100%',
  },
  verseText: {
    ...Typography.interSemiBold,
    fontSize: 18,
    lineHeight: 28,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'left',
    paddingHorizontal: 8,
    width: '100%',
  },
  reference: {
    ...Typography.interBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.alertCoral,
    marginTop: 24,
    textAlign: 'right',
    paddingBottom: 5,
    opacity: 0.9,
  },
});
