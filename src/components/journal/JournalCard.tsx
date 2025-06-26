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
  isExpanded: boolean;
  onToggle: () => void;
  showAddButton?: boolean;
  onAdd?: () => void;
}

export const JournalCard: React.FC<JournalCardProps> = ({
  icon,
  title,
  subtitle,
  children,
  isExpanded,
  onToggle,
  showAddButton = false,
  onAdd,
}) => {
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={onToggle}>
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
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={Colors.mediumGray}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          {children}
          {showAddButton && onAdd && (
            <TouchableOpacity style={styles.addButton} onPress={onAdd}>
              <Ionicons name="add-circle" size={24} color={Colors.alertCoral} />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    marginLeft: 8,
    color: Colors.alertCoral,
    fontFamily: Fonts.medium,
  },
});
