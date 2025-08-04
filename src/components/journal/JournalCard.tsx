import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { Pencil } from 'lucide-react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ViewConfigurationManager } from '../../systems/journal/ViewConfigurationManager';
import { ViewMode } from '../../systems/journal/types';

interface JournalCardProps {
  icon?: string | React.ReactNode;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  componentType?: string; // Add componentType prop to identify the component
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
  componentType,
}) => {
  const hasContent = React.Children.count(children) > 0;
  const showContent = hasContent || isAdding;

  // Helper function to check if we should show the subtitle
  const shouldShowSubtitle = (): boolean => {
    if (!subtitle) {return false;}
    if (componentType === 'Todos') {return true;}
    return viewMode !== 'inline';
  };

  // Get view-specific styling if viewMode is provided
  const titleStyleOverrides = viewMode ? ViewConfigurationManager.getTitleStyle(viewMode) : {};
  const cardStyleOverrides = viewMode ? ViewConfigurationManager.getCardStyle(viewMode) : {};

  // Only render header when empty (no content and not editing/adding)
  if (!showContent) {
    // In inline and moments view, don't show empty components at all
    if (viewMode === 'inline' || viewMode === 'moments') {
      return null;
    }

    const getEmptyCardStyle = () => {
      const baseStyle = [styles.card, styles.cardEmpty, variant === 'inline' && styles.cardInline, cardStyleOverrides];

      // Only apply height restrictions for carousel view when not in inline/moments view
      // and when not in loading state (to prevent card cutting during loading)
      if (variant === 'carousel') {
        // Use type assertion to handle the viewMode check
        const currentViewMode = viewMode as any;
        if (currentViewMode !== 'inline' && currentViewMode !== 'moments') {
          // Check if we're in a loading state by looking for skeleton content
          // Be more precise to avoid false positives
          const hasSkeletonContent = React.Children.toArray(children).some(child => {
            if (!React.isValidElement(child)) {return false;}

            const childType = child.type as any;
            const typeName = childType?.displayName || childType?.name || (typeof childType === 'function' ? childType.name : '');

            // Only consider it a skeleton if it explicitly contains 'Skeleton' and is likely a skeleton component
            return typeName && typeName.includes('Skeleton') && (
              typeName.endsWith('Skeleton') ||
              typeName.startsWith('Skeleton') ||
              typeName.includes('SkeletonLoader')
            );
          });

          if (hasSkeletonContent) {
            // During loading, use minHeight instead of fixed height to prevent cutting
            baseStyle.push(styles.cardLoading);
          } else if (expanded) {
            baseStyle.push(styles.cardExpanded);
          } else {
            baseStyle.push(styles.cardCollapsed);
          }
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
              {shouldShowSubtitle() && (
                <Text style={styles.subtitle}>{subtitle}</Text>
              )}
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

    // Only apply height restrictions for carousel view when not in inline/moments view
    // and when not in loading state (to prevent card cutting during loading)
    if (variant === 'carousel') {
      // Use type assertion to handle the viewMode check
      const currentViewMode = viewMode as any;
      if (currentViewMode !== 'inline' && currentViewMode !== 'moments') {
        // Check if we're in a loading state by looking for skeleton content
        // Be more precise to avoid false positives
        const hasSkeletonContent = React.Children.toArray(children).some(child => {
          if (!React.isValidElement(child)) {return false;}

          const childType = child.type as any;
          const typeName = childType?.displayName || childType?.name || (typeof childType === 'function' ? childType.name : '');

          // Only consider it a skeleton if it explicitly contains 'Skeleton' and is likely a skeleton component
          return typeName && typeName.includes('Skeleton') && (
            typeName.endsWith('Skeleton') ||
            typeName.startsWith('Skeleton') ||
            typeName.includes('SkeletonLoader')
          );
        });

        if (hasSkeletonContent) {
          // During loading, use minHeight instead of fixed height to prevent cutting
          baseStyle.push(styles.cardLoading);
        } else if (expanded) {
          baseStyle.push(styles.cardExpanded);
        } else {
          baseStyle.push(styles.cardCollapsed);
        }
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
            {shouldShowSubtitle() && (
              <Text style={styles.subtitle}>{subtitle}</Text>
            )}
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
    display: 'flex',
    flexDirection: 'column',
  },
  cardEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Match filter container background
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
    padding: 16,
    marginBottom: 2,
    minHeight: 340, // Minimum height for carousel cards, grows with content
    display: 'flex',
    flexDirection: 'column',
  },
  cardInline: {
    backgroundColor: 'transparent', // Transparent background for inline view
    borderColor: 'transparent',
  },
  cardCollapsed: {
    height: 320, // Fixed height for clean collapse (increased from 280 to prevent cutoff)
    overflow: 'hidden', // Hide overflow for clean collapse
  },
  cardExpanded: {
    minHeight: 340, // Allow expansion for carousel cards
    height: 'auto',
  },
  cardLoading: {
    minHeight: 340, // Use minHeight during loading to prevent cutting
    height: 'auto', // Allow dynamic height during loading
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
    width: '100%',
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
    width: '100%',
  },
  icon: {
    position: 'absolute',
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24, // Fixed width for consistent spacing
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
    width: '100%',
    marginLeft: 24, // Offset for the icon to center the text
    marginRight: 24, // Match the icon width for balance
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
    paddingHorizontal: 4, // Add some padding
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    width: '100%', // Take full width of container
    paddingHorizontal: 4, // Match title padding
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
    right: 12, // Move to far right like todos filter system
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  cancelButton: {
    padding: 4,
    backgroundColor: 'transparent',
  },
});
