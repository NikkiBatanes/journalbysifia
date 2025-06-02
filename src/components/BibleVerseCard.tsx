import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Fonts } from '../theme';

type BibleVerse = {
  text: string;
  reference: string;
};

type BibleVerseCardProps = {
  verse: BibleVerse;
  style?: any;
};

export default function BibleVerseCard({ verse, style }: BibleVerseCardProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerContainer}>
        <MaterialCommunityIcons 
          name="book" 
          size={24} 
          color={Colors.hopeWhite} 
          style={styles.icon}
        />
        <Text style={styles.heading}>Bible Verse</Text>
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.verseText}>"{verse.text}"</Text>
        <Text style={styles.reference}>— {verse.reference}</Text>
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
    marginBottom: 16,
  },
  icon: {
    marginRight: 12,
  },
  heading: {
    fontFamily: 'Inter-Black',
    fontSize: 20,
    color: Colors.hopeWhite,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 20, // Equivalent to 2 lines of text (24px line height * 2)
    width: '100%',
  },
  verseText: {
    fontFamily: Fonts.lora.italic,
    fontSize: 18,
    lineHeight: 28,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'left',
    paddingHorizontal: 8,
    fontWeight: '400',
    width: '100%',
  },
  reference: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 40, // Increased from 16 to 40 to move the reference text down
    fontWeight: '600',
    opacity: 0.9,
    paddingHorizontal: 8,
    alignSelf: 'flex-end',
  },
});
