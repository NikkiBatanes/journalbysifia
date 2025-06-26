import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, defaultFontFamily, CARD_CONTENT_PADDING, CARD_HORIZONTAL_PADDING } from '../theme';

interface DevotionalSectionCardProps {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  style?: object;
}

const DevotionalSectionCard: React.FC<DevotionalSectionCardProps> = ({
  icon,
  title,
  subtitle,
  children,
  style = {},
}) => (
  <View style={[styles.card, style]}>
    <View style={styles.headerRow}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={20} color={Colors.alertCoral} />
      </View>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
    <View style={styles.content}>
      {typeof children === 'string' ? <Text style={styles.defaultText}>{children}</Text> : children}
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    padding: CARD_CONTENT_PADDING,
    marginBottom: 18,
    marginHorizontal: CARD_HORIZONTAL_PADDING,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.3)', // Lighter alertCoral with 30% opacity
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    marginRight: 0,
  },
  title: {
    fontFamily: defaultFontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  subtitle: {
    fontFamily: defaultFontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  content: {
    marginTop: 4,
  },
  defaultText: {
    color: Colors.hopeWhite,
    fontFamily: 'System',
    fontSize: 16,
    lineHeight: 22,
  },
});

export default DevotionalSectionCard;
