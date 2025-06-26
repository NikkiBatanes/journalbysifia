import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface JournalCardProps {
  icon: string;
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
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons
            name={icon as any}
            size={24}
            color={Colors.alertCoral}
            style={styles.icon}
          />
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
        {showAddButton && onAdd && !isAdding && (
          <TouchableOpacity onPress={onAdd} style={styles.addButton}>
            <Ionicons name="add-circle" size={24} color={Colors.alertCoral} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
        {isAdding && onCancelAdd && (
          <TouchableOpacity onPress={onCancelAdd} style={styles.cancelButton}>
            <Ionicons name="close-circle" size={24} color={Colors.mediumGray} />
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    color: Colors.darkGray,
    marginBottom: 2,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    marginLeft: 8,
  },
  addButtonText: {
    marginLeft: 4,
    color: Colors.alertCoral,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  cancelButton: {
    padding: 4,
  },
});
