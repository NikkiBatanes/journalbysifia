import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, StyleSheet } from 'react-native';

import { Colors, CARD_HORIZONTAL_PADDING } from '../theme';
import ThemedText from './common/ThemedText';

interface DevotionalSectionCardProps {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  style?: object;
  subtitleStyle?: object;
  variant?: 'blue' | 'tintOnBlue';
}

const DevotionalSectionCard: React.FC<DevotionalSectionCardProps> = ({
  icon,
  title,
  subtitle,
  children,
  style = {},
  subtitleStyle = {},
  variant = 'blue',
}) => (
  <View style={[styles.card, variant === 'tintOnBlue' ? styles.cardTintOnBlue : null, style]}>
    <View style={styles.headerRow}>
      <View style={[styles.iconContainer, variant === 'tintOnBlue' ? styles.iconContainerOnTint : null]}>
        <Ionicons name={icon} size={20} color={Colors.alertCoral} />
      </View>
      <View style={styles.titleContainer}>
        <ThemedText weight="bold" style={styles.title}>{title}</ThemedText>
        <ThemedText weight="regular" style={[styles.subtitle, subtitleStyle]} numberOfLines={2}>{subtitle}</ThemedText>
      </View>
    </View>
    <View style={styles.content}>
      {typeof children === 'string' ? <ThemedText style={styles.defaultText}>{children}</ThemedText> : children}
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 18,
    marginHorizontal: CARD_HORIZONTAL_PADDING,
    elevation: 0,
    overflow: 'visible',
  },
  cardTintOnBlue: {
    backgroundColor: '#264674',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    paddingBottom: 4,
  },
  iconContainer: {
    // Remove circular background and sizing; leave simple spacing only
    marginRight: 12,
  },
  iconContainerOnTint: {
    // No special background on tint variant either
  },
  icon: {
    marginRight: 0,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    color: Colors.hopeWhite,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 0,
    marginBottom: 16,
  },
  content: {
    marginTop: 0,
  },
  defaultText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    lineHeight: 22,
  },
});

export default DevotionalSectionCard;
