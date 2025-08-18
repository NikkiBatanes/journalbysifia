import React, { useEffect, useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, Text, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';

import { Colors } from '../theme';
import { Typography } from '../theme/typography';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { SimplifiedCardInsight } from './SimplifiedCardInsight';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

type TruthInLoveCardProps = {
  truth: string;
  summary: string;
  username?: string;
  expanded?: boolean;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  currentUser?: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
  };
  playbookTitle?: string;
  userInput?: string;
  onToggleExpand?: () => void;
};

export default function TruthInLoveCard({
  truth,
  summary,
  username: _propUsername,
  expanded = false,
  style,
  textColor = Colors.hopeWhite,
  numberOfLines = 5,
  ellipsizeMode = 'tail' as const,
  currentUser,
  playbookTitle,
  userInput,
  onToggleExpand,
}: TruthInLoveCardProps & { numberOfLines?: number; ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip' }) {
  const { user } = useAuth();
  const expoundingAccess = useFeatureAccess({ feature: 'expounding' });
  const [showInsight, setShowInsight] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!!expanded);

  // Keep internal state in sync if parent changes the expanded prop
  useEffect(() => {
    setIsExpanded(!!expanded);
  }, [expanded]);
  // Replace [User's Name] placeholders with current user's name
  console.log('[TruthInLoveCard] Debug Info:', {
    originalTruth: truth,
    originalSummary: summary,
    currentUser,
    hasCurrentUser: !!currentUser,
  });

  const processedTruth = currentUser ? replaceAllNamePlaceholders(truth, currentUser, { replaceHardcodedNames: true }) : truth;
  const processedSummary = currentUser ? replaceAllNamePlaceholders(summary, currentUser, { replaceHardcodedNames: true }) : summary;

  console.log('[TruthInLoveCard] Processed:', {
    processedTruth,
    processedSummary,
    changed: processedTruth !== truth || processedSummary !== summary,
  });

  // Debug styles - can be removed after fixing
  const debugStyle = {
    // borderWidth: 1,
    // borderColor: 'red',
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerContainer}>
        <View style={styles.headingContainer}>
          {/* Make the left header area (heart + title) toggle expansion */}
          <TouchableOpacity
            onPress={() => (onToggleExpand ? onToggleExpand() : setIsExpanded(prev => !prev))}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? 'Collapse truth content' : 'Expand truth content'}
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="heart" size={24} color={Colors.heartRed} style={styles.heartIcon} />
            <Text style={[styles.heading, { color: textColor }]}>Truth in Love</Text>
          </TouchableOpacity>
          {/* Keep the info/insight button as a separate tap target */}
          <TouchableOpacity
            style={styles.expandIcon}
            onPress={() => setShowInsight(!showInsight)}
            accessibilityRole="button"
            accessibilityLabel={showInsight ? 'Hide insight' : 'Show insight'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showInsight ? 'chevron-up' : 'information-outline'}
              size={20}
              color={textColor}
            />
          </TouchableOpacity>
        </View>
        <Text
          style={[styles.content, styles.contentWithMargin, { color: textColor }]}
        >
          <Text style={[styles.summary, { color: textColor }]}>{processedSummary}</Text>
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.contentWrapper, debugStyle]}
        activeOpacity={0.9}
        onPress={() => (onToggleExpand ? onToggleExpand() : setIsExpanded(prev => !prev))}
        accessibilityRole="button"
        accessibilityLabel={isExpanded ? 'Collapse truth content' : 'Expand truth content'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.textContainer}>
          <Text
            style={[styles.truth, {
              color: textColor,
              // Remove flex from text style as it's now on the container
            }]}
            numberOfLines={isExpanded ? undefined : numberOfLines}
            ellipsizeMode={isExpanded ? 'clip' : ellipsizeMode}
            // Add these props to ensure proper text measurement
            textBreakStrategy="highQuality"
            allowFontScaling={true}
            adjustsFontSizeToFit={false}
          >
            {processedTruth}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Simplified Card Insight */}
      {showInsight && (
        <SimplifiedCardInsight
          userId={user?.id || ''}
          cardType="truth"
          cardContent={processedTruth}
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
  },
  expandIcon: {
    padding: 4,
    marginLeft: 8,
  },

});
