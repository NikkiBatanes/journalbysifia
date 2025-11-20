import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';
import { BorderRadii } from '../theme/styles';

import { Colors } from '../theme';
import ThemedText from './common/ThemedText';
import ThemedTextInput from './common/ThemedTextInput';

type DirectChallengeCardProps = {
  challenge: string;
  challengeCTA?: string;
  style?: StyleProp<ViewStyle>;
  expanded?: boolean;
  showCloseButton?: boolean;
};

export default function DirectChallengeCard({ challenge, challengeCTA, style, expanded = true, showCloseButton = true }: DirectChallengeCardProps) {
  // Parse SPIRITUAL and TACTICAL sections if they exist
  const spiritualMatch = challenge.match(/SPIRITUAL:\s*(.+?)(?=\n\s*TACTICAL)/is);
  const tacticalMatch = challenge.match(/TACTICAL[^:]*:\s*(.+?)$/is);

  const hasStructuredFormat = spiritualMatch && tacticalMatch;
  const spiritualText = spiritualMatch?.[1]?.trim();
  // Remove any remaining "TACTICAL (48-72 hour deadline):" prefix from the tactical text
  // This handles cases where the AI includes the label in the content
  const tacticalText = tacticalMatch?.[1]?.trim().replace(/^TACTICAL[^:]*:\s*/gi, '');

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="flash"
            size={24}
            color={Colors.alertCoral}
            style={styles.icon}
          />
          <ThemedText weight="bold" style={styles.heading}>Rise in Faith</ThemedText>
        </View>
        {expanded && showCloseButton && (
          <View style={styles.closeButtonContainer}>
            <Ionicons 
              name="close" 
              size={18} 
              color={Colors.hopeWhite} 
              style={styles.closeButton}
            />
          </View>
        )}
      </View>

      {hasStructuredFormat ? (
        <>
          {/* 1. */}
          <View style={styles.itemRow}>
            <View style={styles.numberBadge}>
              <ThemedText weight="bold" style={styles.numberText}>1</ThemedText>
            </View>
            <View style={styles.itemTextContainer}>
              {expanded && Platform.OS === 'ios' ? (
                <ThemedTextInput
                  weight="medium"
                  value={spiritualText}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={styles.sectionText}
                />
              ) : (
                <ThemedText weight="medium" style={styles.sectionText}>
                  {spiritualText}
                </ThemedText>
              )}
            </View>
          </View>

          {/* 2. */}
          <View style={styles.itemRow}>
            <View style={styles.numberBadge}>
              <ThemedText weight="bold" style={styles.numberText}>2</ThemedText>
            </View>
            <View style={styles.itemTextContainer}>
              {expanded && Platform.OS === 'ios' ? (
                <ThemedTextInput
                  weight="medium"
                  value={tacticalText}
                  editable={false}
                  multiline={true}
                  scrollEnabled={false}
                  style={styles.sectionText}
                />
              ) : (
                <ThemedText weight="medium" style={styles.sectionText}>
                  {tacticalText}
                </ThemedText>
              )}
            </View>
          </View>
        </>
      ) : (
        expanded && Platform.OS === 'ios' ? (
          <ThemedTextInput
            weight="semiBold"
            value={challenge}
            editable={false}
            multiline={true}
            scrollEnabled={false}
            style={styles.text}
          />
        ) : (
          <ThemedText weight="semiBold" style={styles.text}>
            {challenge}
          </ThemedText>
        )
      )}

      {challengeCTA && (
        <ThemedText weight="semiBold" style={styles.cta}>{challengeCTA}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: BorderRadii.cardXL,
    paddingTop: 0,
    paddingHorizontal: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8, // Match TruthInLoveCard's icon margin
  },
  heading: {
    // Typography handled by ThemedText weight="bold"
    fontSize: 20,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textTransform: 'none', // Match TruthInLoveCard
  },
  text: {
    // Typography handled by ThemedText weight="semiBold"
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 26,
    textAlign: 'left',
    paddingHorizontal: 8,
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 16,
  },
  cta: {
    // Typography handled by ThemedText weight="semiBold"
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 26,
    textAlign: 'left',
    paddingHorizontal: 8,
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 16,
  },
  expandIcon: {
    padding: 4,
    marginLeft: 8,
  },
  section: {
    marginTop: 20,
    paddingLeft: 8,
  },
  sectionLabel: {
    fontSize: 16,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    opacity: 0.9,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 22,
    textAlign: 'left',
  },
  // Numbered layout (matches gratitude list feel)
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 18,
    paddingRight: 8,
  },
  numberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    marginRight: 12,
  },
  numberText: {
    color: Colors.alertCoral,
    fontSize: 14,
  },
  itemTextContainer: {
    flex: 1,
    minWidth: 0,
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
