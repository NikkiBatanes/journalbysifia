import React from 'react';
import {Platform, StyleSheet, Text} from 'react-native';

import {getGratitudeVerse} from '../../data/getGratitudeVerse';
import {Colors} from '../../theme/colors';

interface GratitudeVerseProps {
  selectedDate: Date;
}

/** Shared verse presentation for every Gratitude walkthrough. */
const GratitudeVerse: React.FC<GratitudeVerseProps> = ({selectedDate}) => {
  const verse = getGratitudeVerse(selectedDate);
  return (
    <>
      <Text style={styles.text}>{verse.text}</Text>
      <Text style={styles.reference}>— {verse.reference}</Text>
    </>
  );
};

const styles = StyleSheet.create({
  text: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 25,
    color: Colors.textGray,
    textAlign: 'center',
  },
  reference: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
});

export default GratitudeVerse;
