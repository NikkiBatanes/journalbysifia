import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Check } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';

interface SwipeableTodoItemProps {
  item: {
    id: string;
    text: string;
    completed: boolean;
    priority?: boolean;
  };
  onToggle: (id: string, isPriority?: boolean) => void;
  onDelete: (id: string) => void;
  onLongPress?: (id: string) => void;
  children: React.ReactNode;
}

interface SwipeableRef {
  close: () => void;
}

export const SwipeableTodoItem = forwardRef<SwipeableRef, SwipeableTodoItemProps>(({
  item,
  onToggle,
  onDelete,
  children,
}, ref) => {
  const swipeableRef = useRef<Swipeable>(null);

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const renderRightActions = (progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = dragX.interpolate({
      inputRange: [-100, -20, 0],
      outputRange: [1, 0.9, 0],
      extrapolate: 'clamp',
    });

    const handleDelete = () => {
      closeSwipeable();
      // Small delay to allow the swipeable to close before deleting
      setTimeout(() => onDelete(item.id), 200);
    };

    return (
      <Animated.View
        style={[
          styles.deleteButton,
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
      renderRightActions={renderRightActions}
      rightThreshold={20}
      containerStyle={styles.swipeableContainer}
      overshootRight={false}
      friction={3}
      enableTrackpadTwoFingerGesture
      onSwipeableWillOpen={() => {
        const { Vibration } = require('react-native');
        Vibration.vibrate(10);
      }}
    >
      <TouchableOpacity 
        style={styles.todoItem}
        activeOpacity={1}
        onPress={() => {
          onToggle(item.id);
          closeSwipeable();
        }}
        onLongPress={() => {
          if (!item.completed) {
            onToggle(item.id, true);
          }
        }}
      >
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
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f87171',
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ebeef2',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 40,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    position: 'relative',
    zIndex: 1,
    opacity: 1,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkboxContainer: {
    position: 'relative',
    marginRight: 10,
  },
  priorityIndicator: {
    marginLeft: 8,
  },
  todoText: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.darkGray,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: Colors.trustGrey,
    backgroundColor: 'rgba(176, 184, 193, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: Colors.growthGreen,
    borderColor: Colors.growthGreen,
  },
  deleteButton: {
    width: 80, // Slightly wider for better touch target
    backgroundColor: '#f87171',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 10, // Push content to the right to center in visible area
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    marginLeft: -10, // Pull the button to the left to maintain alignment
  },
  deleteButtonContent: {
    width: 60, // Fixed width to center the icon
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
