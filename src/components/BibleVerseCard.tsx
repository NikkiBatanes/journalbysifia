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
};

export default function BibleVerseCard({ verse }: BibleVerseCardProps) {
  return (
    <View style={styles.docCard}>
      <View style={[styles.verseCard, styles.cardContent]}>
        <View style={styles.headerContainer}>
          <MaterialCommunityIcons 
            name="book" 
            size={24} 
            color={Colors.hopeWhite} 
            style={styles.icon}
          />
          <Text style={styles.heading}>Bible Verse</Text>
        </View>
        <View style={styles.verseContainer}>
          <Text style={styles.verseText}>"{verse.text}"</Text>
          <Text style={styles.reference}>— {verse.reference}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  docCard: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
    borderRadius: 28,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    backgroundColor: Colors.anchorBlue,
    minHeight: 200,
    flex: 1,
  },
  verseCard: {
    width: '100%',
    padding: 24,
    flex: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  verseContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    flex: 1,
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
  verseText: {
    fontFamily: Fonts.lora.italic,
    fontSize: 18,
    lineHeight: 28,
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  reference: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    fontWeight: '600',
    opacity: 0.9,
  },
});
