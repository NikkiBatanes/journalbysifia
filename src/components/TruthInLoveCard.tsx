import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import { Colors } from '../theme';
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
  numberOfLines = 5,
  ellipsizeMode = 'tail' as const,
}: TruthInLoveCardProps & { numberOfLines?: number; ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip' }) {
  const { name: contextUsername } = useUser();
  const username = propUsername || contextUsername || 'Friend';
  // Debug styles - can be removed after fixing
  const debugStyle = {
    // borderWidth: 1,
    // borderColor: 'red',
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerContainer}>
        <View style={styles.headingContainer}>
          <Ionicons name="heart" size={24} color="#FF6B6B" style={styles.heartIcon} />
          <Text style={[styles.heading, { color: textColor }]}>Truth in Love</Text>
        </View>
        <Text style={[styles.content, styles.contentWithMargin, { color: textColor }]}>
          <Text style={[styles.username, { color: textColor }]}>{username}, </Text>
          <Text style={[styles.summary, { color: textColor }]}>{summary}</Text>
        </Text>
      </View>

      <View style={[styles.contentWrapper, debugStyle]}>
        <View style={styles.textContainer}>
          <Text
            style={[styles.truth, {
              color: textColor,
              // Remove flex from text style as it's now on the container
            }]}
            numberOfLines={expanded ? undefined : numberOfLines}
            ellipsizeMode={expanded ? 'clip' : ellipsizeMode}
            // Add these props to ensure proper text measurement
            textBreakStrategy="highQuality"
            allowFontScaling={true}
            adjustsFontSizeToFit={false}
          >
            {truth}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerContainer: {
    flexShrink: 0,
  },
  contentWithMargin: {
    marginTop: 16,
  },
  contentWrapper: {
    flex: 1,
    minHeight: 0,
    marginTop: 16,
    flexShrink: 1,
  },
  textContainer: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
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
