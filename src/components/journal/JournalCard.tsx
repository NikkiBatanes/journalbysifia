import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { Pencil } from 'lucide-react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ViewConfigurationManager } from '../../systems/journal/ViewConfigurationManager';
import { ViewMode } from '../../systems/journal/types';

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
  variant?: 'carousel' | 'inline';
  viewMode?: ViewMode;
  expanded?: boolean;
  onExpand?: () => void;
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
  variant = 'carousel',
  viewMode,
  expanded = false,
  onExpand: _onExpand,
}) => {
  const hasContent = React.Children.count(children) > 0;
  const showContent = hasContent || isAdding;

  // Get view-specific styling if viewMode is provided
  const titleStyleOverrides = viewMode ? ViewConfigurationManager.getTitleStyle(viewMode) : {};
  const cardStyleOverrides = viewMode ? ViewConfigurationManager.getCardStyle(viewMode) : {};

  // Only render header when empty (no content and not editing/adding)
  if (!showContent) {
    // In inline view, don't show empty components at all
    if (viewMode === 'inline') {
      return null;
    }

    const getEmptyCardStyle = () => {
      const baseStyle = [styles.card, styles.cardEmpty, variant === 'inline' && styles.cardInline, cardStyleOverrides];

      // Only apply height restrictions for carousel view
      if (variant === 'carousel') {
        if (expanded) {
          baseStyle.push(styles.cardExpanded);
        } else {
          baseStyle.push(styles.cardCollapsed);
        }
      }

      return baseStyle;
    };

    return (
      <View style={getEmptyCardStyle()}>
        <View style={[styles.header, styles.headerEmpty]}>
          <View style={styles.headerContent}>
            {(viewMode as ViewMode) !== 'inline' && (
              typeof icon === 'string' ? (
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
              )
            )}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, titleStyleOverrides]}>{title}</Text>
              {subtitle && (viewMode as string) !== 'inline' && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
          </View>
          {/* Floating edit button for empty card */}
          {showAddButton && onAdd && !isAdding && (viewMode as string) !== 'inline' && (
            <TouchableOpacity onPress={onAdd} style={styles.addButtonFloating}>
              <Pencil size={14} color={Colors.trustGrey} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Render normal card with content
  const getCardStyle = () => {
    const baseStyle = [styles.card, variant === 'inline' && styles.cardInline, cardStyleOverrides];

    // Only apply height restrictions for carousel view
    if (variant === 'carousel') {
      if (expanded) {
        baseStyle.push(styles.cardExpanded);
      } else {
        baseStyle.push(styles.cardCollapsed);
      }
    }

    return baseStyle;
  };

  return (
    <View style={getCardStyle()}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {viewMode !== 'inline' && (
            typeof icon === 'string' ? (
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
            )
          )}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, titleStyleOverrides]}>{title}</Text>
            {subtitle && (viewMode as string) !== 'inline' && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        </View>
        {/* Floating edit button */}
        {showAddButton && onAdd && !isAdding && (viewMode as string) !== 'inline' && (
          <TouchableOpacity onPress={onAdd} style={styles.addButtonFloating}>
            <Pencil size={14} color={Colors.trustGrey} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
        {headerRight && (
          <View style={styles.headerActionsFloating}>
            {headerRight}
          </View>
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Match filter container background
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
    padding: 16,
    marginBottom: 2,
    minHeight: 340, // Minimum height for carousel cards, grows with content
  },
  cardEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Match filter container background
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
    padding: 16,
    marginBottom: 2,
    minHeight: 340, // Minimum height for carousel cards, grows with content
  },
  cardInline: {
    backgroundColor: 'transparent', // Transparent background for inline view
    borderColor: 'transparent',
  },
  cardCollapsed: {
    height: 280, // Fixed height for collapsed carousel cards
    overflow: 'hidden',
  },
  cardExpanded: {
    minHeight: 340, // Allow expansion for carousel cards
    height: 'auto',
  },
  headerEmpty: {
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
    position: 'relative',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    position: 'relative',
  },
  icon: {
    position: 'absolute',
    left: 0,
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
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.hopeWhite + 'e6', // hopeWhite with ~90% opacity
    marginBottom: 2,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    width: '100%',
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    width: '100%',
  },
  content: {
    // Content is always visible
    paddingTop: 8,
  },
  addButton: {
    padding: 6,
    marginLeft: 8,
  },
  addButtonFloating: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 6,
    zIndex: 10,
  },
  headerActionsFloating: {
    position: 'absolute',
    top: 12,
    right: 50,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  cancelButton: {
    padding: 4,
    backgroundColor: 'transparent',
  },
});
