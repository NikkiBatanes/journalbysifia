/**
 * QuickActionCard.tsx
 * Reusable quick action card component for journal, prayer, etc.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: string;
  onPress: () => void;
  accentColor?: string;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  description,
  icon,
  onPress,
  accentColor = Colors.alertCoral,
}) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: accentColor }]}>
          <Ionicons name={icon as any} size={24} color={Colors.hopeWhite} />
        </View>

        <ThemedText weight="semiBold" style={styles.title}>{title}</ThemedText>
        <ThemedText weight="regular" style={styles.description}>{description}</ThemedText>

        <View style={styles.actionHint}>
          <ThemedText weight="medium" style={[styles.actionText, { color: accentColor }]}>
            Tap to start
          </ThemedText>
          <Ionicons name="arrow-forward" size={16} color={accentColor} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.modalBlue,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 140,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  description: {
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 16,
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionText: {
    fontSize: 12,
  },
});

export default QuickActionCard;
