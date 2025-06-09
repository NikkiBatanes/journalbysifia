import React, { useContext } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Colors, Fonts } from '../theme';
import { Typography } from '../theme/typography';
import { useUser } from '../context/UserContext';

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
  username: propUsername,
  expanded = false,
  style,
  textColor = Colors.hopeWhite,
}: TruthInLoveCardProps) {
  const { name: contextUsername } = useUser();
  const username = propUsername || contextUsername || 'Friend';
  return (
    <View style={[style, { flex: 1, justifyContent: 'space-between' }]}>
      <View style={{ flexShrink: 0 }}>
        <View style={styles.headingContainer}>
          <Ionicons name="heart" size={24} color="#FF6B6B" style={styles.heartIcon} />
          <Text style={[styles.heading, { color: textColor }]}>Truth in Love</Text>
        </View>
        <Text style={[styles.content, { color: textColor, marginTop: 16 }]}>
          <Text style={[styles.username, { color: textColor }]}>{username}, </Text>
          <Text style={[styles.summary, { color: textColor }]}>{summary}</Text>
        </Text>
      </View>
      
      <View style={{ flex: 1, minHeight: 0, marginTop: 16 }}>
        <Text
          style={[styles.truth, { 
            color: textColor, 
            flex: 1,
            minHeight: 0,
          }]}
          numberOfLines={expanded ? undefined : 5}
          ellipsizeMode={expanded ? 'clip' : 'tail'}
        >
          {truth}
        </Text>
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
