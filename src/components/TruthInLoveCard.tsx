import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Colors, Fonts } from '../theme';
import { Typography } from '../theme/typography';

type TruthInLoveCardProps = {
  truth: string;
  summary: string;
  username?: string;
  expanded?: boolean;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
};

export default function TruthInLoveCard({
  truth,
  summary,
  username = 'Nikki',
  expanded = false,
  style,
  textColor = Colors.hopeWhite,
}: TruthInLoveCardProps) {
  return (
    <View style={style}>
      <View style={styles.headingContainer}>
        <Ionicons name="heart" size={24} color="#FF6B6B" style={styles.heartIcon} />
        <Text style={[styles.heading, { color: textColor }]}>Truth in Love</Text>
      </View>

      <View style={styles.contentContainer}>
        <Text style={[styles.content, { color: textColor }]}>
          <Text style={[styles.username, { color: textColor }]}>{username}, </Text>
          <Text style={[styles.summary, { color: textColor }]}>{summary}</Text>
        </Text>
        {expanded ? (
          <Text style={[styles.truth, { color: textColor }]}>{truth}</Text>
        ) : (
          <Text
            style={[styles.truncatedTruth, { color: textColor }]}
            numberOfLines={5}
            ellipsizeMode="tail"
          >
            {truth}
          </Text>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  headingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Reduced from 20 to 8
  },
  heartIcon: {
    marginRight: 8,
  },
  heading: {
    ...Typography.interBold,
    fontSize: 20,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textTransform: 'none',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingBottom: 20, // Reduced padding to 20
    maxHeight: '80%', // Limit height to prevent overflow
  },
  content: {
    ...Typography.interRegular,
    fontSize: 28,
    lineHeight: 38,
    color: Colors.hopeWhite,
    marginBottom: 4, // Reduced from 12 to 4
  },
  username: {
    ...Typography.interBlack,
  },
  summary: {
    ...Typography.interBlack,
  },
  truth: {
    ...Typography.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginTop: 4, // Further reduced from 8 to 4
  },
  truncatedTruth: {
    ...Typography.interRegular,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginTop: 2,
    flexShrink: 1, // Allow text to shrink if needed
  },

});
