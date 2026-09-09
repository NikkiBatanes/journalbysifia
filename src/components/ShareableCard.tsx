/**
 * ShareableCard Component
 * Beautiful story-ready graphics for sharing scripture and affirmations
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import ThemedText from './common/ThemedText';
import { Colors } from '../theme/colors';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface ShareableCardProps {
  type: 'scripture' | 'affirmation';
  text: string;
  reference?: string; // For scripture
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH;
const CARD_HEIGHT = CARD_WIDTH * 1.777; // 16:9 ratio for stories

const ShareableCard: React.FC<ShareableCardProps> = ({ type, text, reference }) => {
  return (
    <LinearGradient
      colors={['#1a3c6d', '#1A3C6D', '#1a3c6d']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Decorative pattern overlay */}
      <View style={styles.patternOverlay}>
        <MaterialCommunityIcons
          name="dots-hexagon"
          size={200}
          color="rgba(255,255,255,0.03)"
          style={styles.patternIcon}
        />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <ThemedText weight="bold" style={styles.logo}>siFia</ThemedText>
        <ThemedText weight="medium" style={styles.subtitle}>
          {type === 'scripture' ? "Today's Scripture" : "Today's Affirmation"}
        </ThemedText>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Opening Quote */}
        <MaterialCommunityIcons
          name="format-quote-open"
          size={48}
          color="rgba(255,255,255,0.3)"
          style={styles.quoteIcon}
        />

        {/* Text */}
        <ThemedText weight="semiBold" style={styles.mainText}>
          {text}
        </ThemedText>

        {/* Reference (for scripture) */}
        {reference && (
          <ThemedText weight="bold" style={styles.reference}>
            — {reference}
          </ThemedText>
        )}

        {/* Closing Quote */}
        <MaterialCommunityIcons
          name="format-quote-close"
          size={48}
          color="rgba(255,255,255,0.3)"
          style={styles.quoteIconClose}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.divider} />
        <ThemedText weight="medium" style={styles.attribution}>
          Shared from siFia
        </ThemedText>
        <ThemedText weight="regular" style={styles.tagline}>
          AI Discipleship in Your Pocket
        </ThemedText>
      </View>

      {/* Decorative corner accents */}
      <View style={styles.cornerTopLeft} />
      <View style={styles.cornerBottomRight} />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    padding: 40,
    justifyContent: 'space-between',
    position: 'relative',
  },
  patternOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patternIcon: {
    opacity: 0.5,
  },
  header: {
    alignItems: 'center',
    zIndex: 1,
  },
  logo: {
    fontSize: 36,
    color: Colors.hopeWhite,
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  quoteIcon: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  mainText: {
    fontSize: 28,
    lineHeight: 42,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginVertical: 20,
  },
  reference: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 20,
    textAlign: 'center',
  },
  quoteIconClose: {
    marginTop: 20,
    alignSelf: 'flex-end',
  },
  footer: {
    alignItems: 'center',
    zIndex: 1,
  },
  date: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 12,
  },
  attribution: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 40,
    height: 40,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});

export default ShareableCard;
