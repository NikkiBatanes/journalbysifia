import React, { useState } from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Icon from 'react-native-vector-icons/Ionicons';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { Colors } from '../theme';
import { Typography } from '../theme/typography';
import { formatBibleVerse } from '../utils/textFormatting';
import { SimplifiedCardInsight } from './SimplifiedCardInsight';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

import { BibleVerse } from '../interfaces/playbook';

type BibleVerseCardProps = {
  verse: BibleVerse;
  style?: any;
  textColor?: string;
  backgroundColor?: string;
  playbookTitle?: string;
  userInput?: string;
  expanded?: boolean;
  collapsedLines?: number;
};

export default function BibleVerseCard({ verse, style, textColor = Colors.hopeWhite, backgroundColor = Colors.anchorBlue, playbookTitle, userInput, expanded = true, collapsedLines = 4 }: BibleVerseCardProps) {
  const { user } = useAuth();
  const expoundingAccess = useFeatureAccess({ feature: 'expounding' });
  const [showInsight, setShowInsight] = useState(false);
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
        <TouchableOpacity
          style={styles.expandIcon}
          onPress={() => setShowInsight(!showInsight)}
        >
          <Icon
            name={showInsight ? 'chevron-up' : 'information-outline'}
            size={20}
            color={textColor}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.contentContainer}>
        <Text
          style={[styles.verseText, { color: textColor }]}
          numberOfLines={expanded ? undefined : collapsedLines}
          ellipsizeMode={expanded ? 'clip' : 'tail'}
        >
          {formatBibleVerse(verse.text)}
        </Text>
        <View style={styles.referenceContainer}>
          <Text style={[styles.reference, { color: Colors.alertCoral }]}>{verse.reference}</Text>
        </View>
      </View>

      {/* Simplified Card Insight */}
      {showInsight && (
        <SimplifiedCardInsight
          userId={user?.id || ''}
          cardType="bible"
          cardContent={`${verse.text} - ${verse.reference}`}
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
  referenceContainer: {
    width: '100%',
    marginTop: 24,
    alignItems: 'flex-end',
  },
  reference: {
    ...Typography.interBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.alertCoral,
    paddingBottom: 5,
    opacity: 0.9,
  },
  expandIcon: {
    padding: 4,
    marginLeft: 8,
    textAlign: 'right',
    marginRight: 8, // Match the left padding of the verse text
  },
});
