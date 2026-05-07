import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';

import { Colors } from '../theme';
import { replaceAllNamePlaceholders } from '../utils/nameReplacement';
import { useAuth } from '../context/IndustryStandardAuthContext';
import ThemedText from './common/ThemedText';
import ThemedTextInput from './common/ThemedTextInput';

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
  showCloseButton?: boolean;
  headingStyle?: StyleProp<ViewStyle>;
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
  playbookTitle: _playbookTitle,
  userInput: _userInput,
  showCloseButton = true,
  headingStyle,
}: TruthInLoveCardProps & { numberOfLines?: number; ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip' }) {
  const { user } = useAuth();
  // Use only parent-controlled expansion
  const isExpanded = expanded;
  // Use fresh user data from auth context, fallback to currentUser prop
  const freshUserData = React.useMemo(() => user ? {
    displayName: (user as any).displayName || (user.user_metadata?.full_name) || '',
    firstName: (user as any).firstName || (user.user_metadata?.first_name) || '',
    lastName: (user as any).lastName || (user.user_metadata?.last_name) || '',
  } : currentUser, [user, currentUser]);

  // Force re-computation when user data changes
  // Replace only placeholders, not hardcoded names (to avoid replacing "you"/"your" with name)
  const processedTruth = React.useMemo(() => {
    const result = freshUserData ? replaceAllNamePlaceholders(truth, freshUserData, { replaceHardcodedNames: false }) : truth;
    return result;
  }, [truth, freshUserData]);

  const { summaryText, cueText } = React.useMemo(() => {
    const substituted = freshUserData ? replaceAllNamePlaceholders(summary, freshUserData, { replaceHardcodedNames: false }) : summary;
    if (!substituted) {
      return { summaryText: '', cueText: '' };
    }
    const trimmed = substituted.trim();
    const cueMatch = trimmed.match(/\s*\(([^)]+)\)\s*$/);
    if (cueMatch && cueMatch.index !== undefined) {
      return {
        summaryText: trimmed.slice(0, cueMatch.index).trim(),
        cueText: cueMatch[1].trim(),
      };
    }

    return { summaryText: trimmed, cueText: '' };
  }, [summary, freshUserData]);

  const truthParagraphs = React.useMemo(() => {
    if (!processedTruth) {
      return [] as string[];
    }

    return processedTruth
      .split(/\n\s*\n+/)
      .map(paragraph => paragraph.trim())
      .filter(paragraph => paragraph.length > 0);
  }, [processedTruth]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerContainer}>
        <View style={[styles.headingContainer, headingStyle]}>
          {/* Header area - expansion handled by parent card tap */}
          <View style={styles.rowCenterFlex1}>
            <Ionicons name="heart" size={24} color={Colors.alertCoral} style={styles.heartIcon} />
            <ThemedText weight="bold" style={[styles.heading, { color: textColor }]}>Truth in Love</ThemedText>
          </View>
          {/* Subtle close button when expanded */}
          {isExpanded && showCloseButton && (
            <View style={styles.closeButtonContainer}>
              <Ionicons
                name="close"
                size={18}
                color={textColor}
                style={styles.closeButton}
              />
            </View>
          )}
        </View>
        {isExpanded && Platform.OS === 'ios' ? (
          <>
            <ThemedTextInput
              weight="bold"
              value={summaryText}
              editable={false}
              multiline={true}
              scrollEnabled={false}
              style={[styles.content, styles.contentWithMargin, styles.summary, { color: textColor }]}
            />
            {cueText ? (
              <ThemedText
                weight="regular"
                style={[styles.regulationCue, { color: textColor }]}
              >
                {cueText}
              </ThemedText>
            ) : null}
          </>
        ) : (
          <>
            <ThemedText
              weight="bold"
              style={[styles.content, styles.contentWithMargin, styles.summary, { color: textColor }]}
            >
              {summaryText}
            </ThemedText>
            {cueText ? (
              <ThemedText
                weight="regular"
                style={[styles.regulationCue, { color: textColor }]}
              >
                {cueText}
              </ThemedText>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.contentWrapper}>
        <View style={styles.textContainer}>
          {isExpanded
            ? (Platform.OS === 'ios' ? (
                <ThemedTextInput
                  weight="regular"
                  value={processedTruth}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={[styles.truth, { color: textColor }]}
                />
              ) : (
                truthParagraphs.map((paragraph, index) => (
                  <ThemedText
                    weight="regular"
                    style={[styles.truth, styles.truthParagraph, { color: textColor }]}
                    key={`truth-paragraph-${index}`}
                    textBreakStrategy="highQuality"
                    allowFontScaling={true}
                    adjustsFontSizeToFit={false}
                  >
                    {paragraph}
                  </ThemedText>
                ))
              ))
            : (
                <ThemedText
                  weight="regular"
                  style={[styles.truth, { color: textColor }]}
                  numberOfLines={numberOfLines}
                  ellipsizeMode={ellipsizeMode}
                  textBreakStrategy="highQuality"
                  allowFontScaling={true}
                  adjustsFontSizeToFit={false}
                >
                  {truthParagraphs.length > 0 ? truthParagraphs[0] : processedTruth}
                </ThemedText>
              )}
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Remove flex: 1 to allow natural height expansion like other cards
    // flex: 1,
    // justifyContent: 'space-between',
  },
  headerContainer: {
    flexShrink: 0,
  },
  contentWithMargin: {
    marginTop: 16,
  },
  contentWrapper: {
    marginTop: 8,
  },
  textContainer: {
    // Remove flex and overflow constraints
    // flex: 1,
    // minHeight: 0,
    // overflow: 'hidden',
  },
  headingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -50,
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
  regulationCue: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.7,
    marginTop: 12,
    alignSelf: 'center',
    textAlign: 'center',
  },
  truth: {
    // Typography handled by ThemedText weight="regular"
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginTop: 4, // Further reduced from 8 to 4
  },
  truthParagraph: {
    marginBottom: 12,
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
  rowCenterFlex1: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButtonContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    opacity: 0.7,
  },

});
