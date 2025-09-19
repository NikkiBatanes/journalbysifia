import React, { useEffect, useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, Text, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';

import { Colors } from '../theme';
import { Typography } from '../theme/typography';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { triggerLightHaptic } from '../utils/haptics';
import ThemedText from './common/ThemedText';

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
  const [isExpanded, setIsExpanded] = useState(!!expanded);

  // Keep internal state in sync if parent changes the expanded prop
  useEffect(() => {
    setIsExpanded(!!expanded);
  }, [expanded]);
  // Use fresh user data from auth context, fallback to currentUser prop
  const freshUserData = user ? {
    displayName: (user as any).displayName || (user.user_metadata?.full_name) || '',
    firstName: (user as any).firstName || (user.user_metadata?.first_name) || '',
    lastName: (user as any).lastName || (user.user_metadata?.last_name) || '',
  } : currentUser;

  console.log('[TruthInLoveCard] Debug Info:', {
    originalTruth: truth,
    originalSummary: summary,
    currentUser,
    freshUserData,
    usingFreshData: !!user,
    userMetadata: user?.user_metadata,
    timestamp: new Date().toISOString(),
  });

  // Force re-computation when user data changes
  const processedTruth = React.useMemo(() => {
    const result = freshUserData ? replaceAllNamePlaceholders(truth, freshUserData, { replaceHardcodedNames: true }) : truth;
    console.log('[TruthInLoveCard] Processing truth:', { original: truth, processed: result, userData: freshUserData });
    return result;
  }, [truth, freshUserData?.firstName, freshUserData?.displayName]);

  const processedSummary = React.useMemo(() => {
    const result = freshUserData ? replaceAllNamePlaceholders(summary, freshUserData, { replaceHardcodedNames: true }) : summary;
    console.log('[TruthInLoveCard] Processing summary:', { original: summary, processed: result, userData: freshUserData });
    return result;
  }, [summary, freshUserData?.firstName, freshUserData?.displayName]);

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
            <Ionicons name="heart" size={24} color={Colors.alertCoral} style={styles.heartIcon} />
            <ThemedText weight="bold" style={[styles.heading, { color: textColor }]}>Truth in Love</ThemedText>
          </TouchableOpacity>
          {/* Keep the info/insight button as a separate tap target */}
        </View>
        <ThemedText
          weight="regular"
          style={[styles.content, styles.contentWithMargin, { color: textColor }]}
        >
          <ThemedText weight="bold" style={[styles.summary, { color: textColor }]}>{processedSummary}</ThemedText>
        </ThemedText>
      </View>

      <View style={[styles.contentWrapper, debugStyle]}>
        <View style={styles.textContainer}>
          <ThemedText
            weight="regular"
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
          </ThemedText>
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
    // Typography handled by ThemedText weight="bold"
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
    // Typography handled by ThemedText weight="regular"
    fontSize: 28,
    lineHeight: 38,
    color: Colors.hopeWhite,
    marginBottom: 4, // Reduced from 12 to 4
  },
  summary: {
    // Typography handled by ThemedText weight="bold"
  },
  truth: {
    // Typography handled by ThemedText weight="regular"
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginTop: 4, // Further reduced from 8 to 4
  },
  truncatedTruth: {
    // Typography handled by ThemedText weight="regular"
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
  },
  expandIcon: {
    padding: 4,
    marginLeft: 8,
  },

});
