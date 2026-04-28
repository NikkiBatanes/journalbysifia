import React, { useRef, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { Pencil } from 'lucide-react-native';
import ThemedText from '../common/ThemedText';

import { ViewConfigurationManager } from '../../systems/journal/ViewConfigurationManager';
import { ViewMode } from '../../systems/journal/types';
import { AnimationUtils } from '../../utils/animations';
import LinearGradient from 'react-native-linear-gradient';
import { triggerLightHaptic } from '../../utils/haptics';

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

  // Enhanced animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animation for journal cards
    const entranceAnimation = Animated.parallel([
      AnimationUtils.fadeIn(fadeAnim, 600, 0),
      AnimationUtils.scaleIn(scaleAnim, 500, 100),
      AnimationUtils.slideUp(slideAnim, 400, 200),
    ]);

    entranceAnimation.start();

    // Optional subtle pulse for interactive cards
    if (onAdd || _onExpand) {
      const pulseAnimation = AnimationUtils.pulse(pulseAnim, 0.98, 1.02, 3000);
      pulseAnimation.start();
    }
  }, [fadeAnim, scaleAnim, slideAnim, pulseAnim, onAdd, _onExpand]);

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
      <Animated.View
        style={[
          getEmptyCardStyle(),
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim },
              { scale: pulseAnim },
            ],
          },
        ]}
      >
        {/* Pattern design gradient background */}
        <LinearGradient
          colors={[Colors.hopeWhite, 'rgba(248, 249, 250, 0.8)', Colors.hopeWhite]}
          style={styles.cardGradient}
        />

        {/* Color accent border */}
        <View style={styles.colorAccentBorder}>
          <View style={[styles.accentDot, { backgroundColor: Colors.alertCoral }]} />
          <View style={[styles.accentDot, { backgroundColor: Colors.growthGreen }]} />
          <View style={[styles.accentDot, { backgroundColor: Colors.faithGold }]} />
        </View>

        <View style={[styles.header, styles.headerEmpty]}>
          <View style={styles.headerContent}>
            {(viewMode as ViewMode) !== 'inline' && (
              typeof icon === 'string' ? (
                <Animated.View
                  style={[
                    styles.icon,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                >
                  <Ionicons
                    name={icon as any}
                    size={16}
                    color={Colors.alertCoral}
                  />
                </Animated.View>
              ) : (
                <Animated.View
                  style={[
                    styles.icon,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                >
                  {icon}
                </Animated.View>
              )
            )}
            <View style={styles.titleContainer}>
              <ThemedText weight="bold" style={[styles.title, titleStyleOverrides]}>{title}</ThemedText>
              {shouldShowSubtitle() && (
                <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
              )}
            </View>
          </View>
          {/* Enhanced floating edit button */}
          {showAddButton && onAdd && !isAdding && (viewMode as string) !== 'inline' && (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity onPress={() => { triggerLightHaptic(); onAdd && onAdd(); }} style={styles.addButtonFloating}>
                <LinearGradient
                  colors={[Colors.growthGreen, Colors.faithGold]}
                  style={styles.addButtonGradient}
                >
                  <Pencil size={14} color={Colors.hopeWhite} strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </Animated.View>
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
            <ThemedText weight="bold" style={[styles.title, titleStyleOverrides]}>{title}</ThemedText>
            {shouldShowSubtitle() && (
              <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
            )}
          </View>
        </View>
        {/* Floating edit button */}
        {showAddButton && onAdd && !isAdding && (viewMode as string) !== 'inline' && (
          <TouchableOpacity onPress={() => { triggerLightHaptic(); onAdd && onAdd(); }} style={styles.addButtonFloating}>
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
    top: 0,
    bottom: 0,
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
    color: Colors.textGray,
    textAlign: 'center',
    width: '100%', // Take full width of container
    paddingHorizontal: 4, // Match title padding
  },
  content: {
    // Content is always visible
    paddingTop: 8,
    paddingBottom: 12, // add bottom spacing so bottom-right buttons fit inside rounded corner
    paddingHorizontal: 6,   // slight spacing to avoid hugging the curved edges
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
  // Pattern design styles
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 30,
  },
  colorAccentBorder: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.8,
  },
  addButtonGradient: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
