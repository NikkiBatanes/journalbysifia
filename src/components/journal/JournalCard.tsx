import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { Pencil } from 'lucide-react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface JournalCardProps {
  icon: string | React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showAddButton?: boolean;
  onAdd?: () => void;
  isAdding?: boolean;
  onCancelAdd?: () => void;
}

export const JournalCard: React.FC<JournalCardProps> = ({
  icon,
  title,
  subtitle,
  children,
  showAddButton = false,
  onAdd,
  isAdding = false,
  onCancelAdd,
}) => {
  const hasContent = React.Children.count(children) > 0;
  const showContent = hasContent || isAdding;

  // Only render header when empty (no content and not editing/adding)
  if (!showContent) {
    return (
      <View style={[styles.card, styles.cardEmpty]}>
        <View style={[styles.header, styles.headerEmpty]}>
          <View style={styles.headerContent}>
            {typeof icon === 'string' ? (
              <Ionicons
                name={icon as any}
                size={24}
                color={Colors.alertCoral}
                style={styles.icon}
              />
            ) : (
              <View style={styles.icon}>
                {icon}
              </View>
            )}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          </View>
          {showAddButton && onAdd && !isAdding && (
            <TouchableOpacity onPress={onAdd} style={styles.addButton}>
              <Pencil size={14} color={Colors.trustGrey} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Render normal card with content
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {typeof icon === 'string' ? (
            <Ionicons
              name={icon as any}
              size={24}
              color={Colors.alertCoral}
              style={styles.icon}
            />
          ) : (
            <View style={styles.icon}>
              {icon}
            </View>
          )}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
        {showAddButton && onAdd && !isAdding && (
          <TouchableOpacity onPress={onAdd} style={styles.addButton}>
            <Pencil size={14} color={Colors.trustGrey} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
        {isAdding && onCancelAdd && (
          <TouchableOpacity onPress={onCancelAdd} style={styles.cancelButton}>
            <Ionicons name="close" size={18} color={`${Colors.alertCoral}CC`} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 16,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardEmpty: {
    padding: 16,
    marginBottom: 2,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerEmpty: {
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  icon: {
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: Colors.anchorBlue,
    marginBottom: 2,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
  },
  content: {
    // Content is always visible
    paddingTop: 8,
  },
  addButton: {
    padding: 6,
    marginLeft: 8,
  },
  cancelButton: {
    padding: 4,
    backgroundColor: 'transparent',
  },
});
