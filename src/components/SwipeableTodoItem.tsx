import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { TouchableOpacity } from 'react-native';

import { Check } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerSelectionHaptic } from '../utils/haptics';

interface SwipeableTodoItemProps {
  item: {
    id: string;
    text: string;
    completed: boolean;
    priority?: boolean;
  };
  onToggle: (id: string, isPriority?: boolean) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
  onLongPress?: (id: string) => void;
  children: React.ReactNode;
  hideCheckbox?: boolean;
  variant?: 'todo' | 'gratitude';
  disableSwipe?: boolean;
}

interface SwipeableRef {
  close: () => void;
}

export const SwipeableTodoItem = forwardRef<SwipeableRef, SwipeableTodoItemProps>(({
  item,
  onToggle,
  onDelete,
  onEdit,
  children,
  hideCheckbox = false,
  variant = 'todo',
  disableSwipe = false,
}, ref) => {
  const swipeableRef = useRef<Swipeable>(null);

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const renderRightActions = (progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [-160, 0],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = dragX.interpolate({
      inputRange: [-160, -20, 0],
      outputRange: [1, 0.9, 0],
      extrapolate: 'clamp',
    });

    const handleDelete = () => {
      closeSwipeable();
      // Small delay to allow the swipeable to close before deleting
      setTimeout(() => onDelete(item.id), 200);
    };

    const handleEdit = () => {
      closeSwipeable();
      // Small delay to allow the swipeable to close before editing
      setTimeout(() => onEdit?.(item.id), 200);
    };

    // If onEdit is provided, show both edit and delete buttons like TimeBlocks
    if (onEdit) {
      return (
        <Animated.View
          style={[
            styles.swipeActions,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleEdit}
            style={styles.editButton}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={22} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.deleteButton}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={22} color="white" />
          </TouchableOpacity>
        </Animated.View>
      );
    }

    // Original delete-only behavior
    return (
      <Animated.View
        style={[
          styles.deleteButtonSingle,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.deleteButtonContent}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={22} color="white" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Forward the ref to the Swipeable component
  useImperativeHandle(ref, () => ({
    close: () => swipeableRef.current?.close(),
  }));

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={disableSwipe ? undefined : renderRightActions}
      rightThreshold={disableSwipe ? 0 : (onEdit ? 40 : 20)}
      enabled={!disableSwipe}
      containerStyle={styles.swipeableContainer}
      overshootRight={false}
      friction={3}
      enableTrackpadTwoFingerGesture
      onSwipeableWillOpen={() => {
        // Use a very subtle haptic similar to system selection feedback
        triggerSelectionHaptic();
      }}
    >
      <TouchableOpacity
        style={[
          styles.todoItem,
          variant === 'gratitude' && styles.gratitudeItem,
        ]}
        activeOpacity={1}
        onPress={() => {
          triggerSelectionHaptic(); // Haptic for checkmark toggle
          onToggle(item.id, false); // Explicitly pass false for regular toggle
          closeSwipeable();
        }}
        onLongPress={() => {
          if (!item.completed) {
            triggerSelectionHaptic(); // Haptic for priority toggle
            onToggle(item.id, true); // Pass true for priority toggle
          }
        }}
      >
        {!hideCheckbox && (
          <View style={styles.checkboxContainer}>
            <View
              style={[
                styles.checkbox,
                item.completed && styles.checkboxCompleted,
              ]}
            >
              {item.completed && (
                <Check size={10} color={Colors.hopeWhite} strokeWidth={2.5} />
              )}
            </View>
          </View>
        )}
        <View style={styles.textContainer}>
          {children}
          {item.priority && (
            <View style={styles.priorityIndicator}>
              <Ionicons name="star" size={12} color={Colors.alertCoral} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  swipeableContainer: {
    marginBottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
    zIndex: 1,
    opacity: 1,
  },
  gratitudeItem: {
    borderWidth: 0,
    borderColor: 'transparent',
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  checkboxContainer: {
    position: 'relative',
    marginRight: 10,
    marginTop: 2,
  },
  priorityIndicator: {
    marginLeft: 8,
  },
  todoText: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.trustGrey,
    backgroundColor: 'rgba(176, 184, 193, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: Colors.growthGreen,
    borderColor: Colors.growthGreen,
  },
  // Swipe actions container for edit + delete
  swipeActions: {
    flexDirection: 'row',
    width: 160,
    height: '100%',
    marginLeft: -10,
    overflow: 'hidden',
    borderRadius: 12,
  },
  editButton: {
    flex: 1,
    height: '100%',
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 12,
  },
  deleteButton: {
    width: 75,
    height: '100%',
    backgroundColor: '#f87171',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Single delete button (original behavior)
  deleteButtonSingle: {
    width: '100%',
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    height: 'auto',
    borderRadius: 12,
    marginLeft: 4,
  },
  deleteButtonContent: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
