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
  headerRight?: React.ReactNode;
}

export const JournalCard: React.FC<JournalCardProps> = ({
  icon,
  title,
  subtitle,
  children,
  showAddButton = false,
  onAdd,
  isAdding = false,
  headerRight,
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
              <View style={styles.icon}>
                <Ionicons
                  name={icon as any}
                  size={16}
                  color={Colors.alertCoral}
                />
              </View>
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
            <View style={styles.icon}>
              <Ionicons
                name={icon as any}
                size={20}
                color={Colors.alertCoral}
              />
            </View>
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
        <View style={styles.headerActions}>
          {headerRight}
          {showAddButton && onAdd && !isAdding && (
            <TouchableOpacity onPress={onAdd} style={styles.addButton}>
              <Pencil size={14} color={Colors.trustGrey} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
        {/* Cancel button removed as per design */}
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
    borderColor: 'rgba(255, 255, 255, 0.2)',

    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cardEmpty: {
    backgroundColor: Colors.hopeWhite,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  headerEmpty: {
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.1)', // 10% opacity of alertCoral
    borderRadius: 10,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // For Ionicons that are passed as strings
  iconWrapper: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
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
