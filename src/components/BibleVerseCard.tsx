import React, { useState } from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Icon from 'react-native-vector-icons/Ionicons';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';

import { Colors } from '../theme';
import { Typography } from '../theme/typography';
import { formatBibleVerse } from '../utils/textFormatting';
import { triggerLightHaptic } from '../utils/haptics';
import { BibleCopyrightModal } from './BibleCopyrightModal';
import ThemedText from './common/ThemedText';
import ThemedTextInput from './common/ThemedTextInput';

import { BibleVerse } from '../interfaces/playbook';

type BibleVerseCardProps = {
  verse: BibleVerse;
  style?: any;
  textColor?: string;
  backgroundColor?: string;
  expanded?: boolean;
  collapsedLines?: number;
  showCloseButton?: boolean;
  preferredBibleTranslation?: string; // User's preferred Bible translation
};

export default function BibleVerseCard({
  verse,
  style,
  textColor = Colors.hopeWhite,
  backgroundColor = '#274673',
  expanded = true,
  collapsedLines = 4,
  showCloseButton = true,
  preferredBibleTranslation,
}: BibleVerseCardProps) {
  const [showCopyright, setShowCopyright] = useState(false);
  // Extract version from reference if stored version is missing
  const getVersionFromReference = (ref: string) => {
    const match = ref.match(/\(([^)]+)\)$/);
    return match ? match[1] : null;
  };

  // Use the actual verse version first, then try to extract from reference, then user's preferred translation, then default to NASB
  const extractedVersion = getVersionFromReference(verse.reference || '');
  const bibleVersion = verse.version || extractedVersion || preferredBibleTranslation || 'NASB';
  const rawReference = (verse.reference || '').trim();
  // Always show version if available, either from stored version or extracted from reference
  let cleanReference = rawReference.replace(/\s*\(\s*[A-Z]{2,5}\s*\)\s*$/i, '').toUpperCase();

  // Add version if we have it
  if (bibleVersion) {
    cleanReference += ` ${bibleVersion}`;
  }
  return (
    <View style={[styles.container, style, { backgroundColor }]}>
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="book"
            size={24}
            color={Colors.alertCoral}
            style={styles.icon}
          />
          <ThemedText weight="semiBold" style={[styles.heading, { color: textColor }]}>Scripture Anchor</ThemedText>
        </View>
        {expanded && showCloseButton && (
          <View style={styles.closeButtonContainer}>
            <Icon
              name="close"
              size={18}
              color={textColor}
              style={styles.closeButton}
            />
          </View>
        )}
      </View>
      <View style={styles.contentContainer}>
        {expanded && Platform.OS === 'ios' ? (
          <ThemedTextInput
            weight="semiBold"
            value={formatBibleVerse(verse.text)}
            editable={false}
            multiline={true}
            scrollEnabled={false}
            numberOfLines={expanded ? undefined : collapsedLines}
            style={[styles.scriptureText]}
          />
        ) : (
          <ThemedText
            weight="semiBold"
            style={[styles.scriptureText]}
            numberOfLines={expanded ? undefined : collapsedLines}
            ellipsizeMode={expanded ? 'clip' : 'tail'}
          >
            {formatBibleVerse(verse.text)}
          </ThemedText>
        )}
        <View style={styles.scriptureReferenceContainer}>
          <ThemedText weight="bold" style={styles.scriptureReference}>
            {cleanReference}
          </ThemedText>
          <TouchableOpacity
            style={styles.infoIcon}
            onPress={() => {
              try { triggerLightHaptic(); } catch {}
              setShowCopyright(true);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Bible translation information"
          >
            <Icon
              name="information-circle-outline"
              size={18}
              color={Colors.alertCoral}
            />
          </TouchableOpacity>
        </View>
      </View>


      {/* Bible copyright modal - default to NASB */}
      <BibleCopyrightModal
        visible={showCopyright}
        onClose={() => setShowCopyright(false)}
        bibleVersion={bibleVersion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#274673',
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
    width: '100%',
    paddingTop: 0,
    paddingBottom: 16,
  },
  // Match DevotionalDetailScreen scripture styles
  scriptureText: {
    fontSize: 18,
    lineHeight: 26,
    color: Colors.hopeWhite,
    textAlign: 'left',
    marginBottom: 12,
    fontStyle: 'italic',
    width: '100%',
  },
  scriptureReferenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
  },
  scriptureReference: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.alertCoral,
    marginTop: 8,
    opacity: 0.9,
  },
  bibleVersion: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.alertCoral,
    opacity: 0.9,
  },
  infoIcon: {
    marginLeft: 8,
  },
  expandIcon: {
    padding: 4,
    marginLeft: 8,
    textAlign: 'right',
    marginRight: 8, // Match the left padding of the verse text
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
