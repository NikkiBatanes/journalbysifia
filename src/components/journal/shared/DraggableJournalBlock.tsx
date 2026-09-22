import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {StyleSheet, View, type LayoutRectangle} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {Colors} from '../../../theme/colors';
import {triggerLightHaptic} from '../../../utils/haptics';

export const DraggableJournalBlock = ({
  blockId,
  children,
  onSelect,
  onLayout,
  onDragStart,
  onDragMove,
  onDragEnd,
  shiftY = 0,
  selected = false,
  tone = 'default',
}: {
  blockId: string;
  children: React.ReactNode;
  onSelect: () => void;
  onLayout: (layout: LayoutRectangle) => void;
  onDragStart: (blockId: string) => void;
  onDragMove: (blockId: string, deltaY: number) => void;
  onDragEnd: (blockId: string, deltaY: number) => void;
  shiftY?: number;
  selected?: boolean;
  tone?: 'default' | 'onDark';
}) => {
  const translateY = useSharedValue(0);
  const neighborShiftY = useSharedValue(0);
  const scale = useSharedValue(1);
  const lastReportedY = useSharedValue(0);
  const gestureActivated = useSharedValue(false);
  const [dragging, setDragging] = useState(false);
  const onSelectRef = useRef(onSelect);
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  onSelectRef.current = onSelect;
  onDragStartRef.current = onDragStart;
  onDragMoveRef.current = onDragMove;
  onDragEndRef.current = onDragEnd;

  useLayoutEffect(() => {
    neighborShiftY.value = shiftY === 0
      ? 0
      : withSpring(shiftY, {
          damping: 20,
          stiffness: 260,
          mass: 0.65,
        });
  }, [neighborShiftY, shiftY]);

  const beginDrag = useCallback(() => {
    onSelectRef.current();
    onDragStartRef.current(blockId);
    setDragging(true);
    triggerLightHaptic();
  }, [blockId]);

  const reportDragMove = useCallback(
    (deltaY: number) => onDragMoveRef.current(blockId, deltaY),
    [blockId],
  );

  const finishDrag = useCallback(
    (deltaY: number) => {
      setDragging(false);
      onDragEndRef.current(blockId, deltaY);
    },
    [blockId],
  );

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(1)
        .onBegin(() => {
          gestureActivated.value = true;
          lastReportedY.value = 0;
          scale.value = withSpring(1.015, {damping: 18, stiffness: 240});
          runOnJS(beginDrag)();
        })
        .onUpdate(event => {
          translateY.value = event.translationY;
          if (Math.abs(event.translationY - lastReportedY.value) >= 8) {
            lastReportedY.value = event.translationY;
            runOnJS(reportDragMove)(event.translationY);
          }
        })
        .onEnd(event => {
          const deltaY = event.translationY;
          gestureActivated.value = false;
          // The parent commits the previewed order immediately. Clearing the
          // finger offset in the same frame keeps the block in the open slot.
          translateY.value = 0;
          scale.value = withSpring(1, {damping: 20, stiffness: 260});
          runOnJS(reportDragMove)(deltaY);
          runOnJS(finishDrag)(deltaY);
        })
        .onFinalize((_event, success) => {
          if (!success) {
            translateY.value = withSpring(0, {damping: 20, stiffness: 260});
            scale.value = withSpring(1, {damping: 20, stiffness: 260});
            if (gestureActivated.value) {
              gestureActivated.value = false;
              runOnJS(finishDrag)(0);
            }
          }
        }),
    [
      beginDrag,
      finishDrag,
      gestureActivated,
      lastReportedY,
      reportDragMove,
      scale,
      translateY,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {translateY: translateY.value + neighborShiftY.value},
      {scale: scale.value},
    ],
  }));

  return (
    <Animated.View
      collapsable={false}
      onLayout={event => onLayout(event.nativeEvent.layout)}
      onTouchStart={onSelect}
      style={[styles.wrapper, dragging && styles.dragging, animatedStyle]}>
      {children}
      {selected && (
        <GestureDetector gesture={dragGesture}>
          <View
            collapsable={false}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Drag to reorder this block"
            style={styles.handleTouchTarget}>
            <Ionicons
              name="reorder-three-outline"
              size={16}
              color={tone === 'onDark' ? Colors.hopeWhite : Colors.sage}
              style={styles.handleIcon}
            />
          </View>
        </GestureDetector>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {position: 'relative'},
  dragging: {
    zIndex: 50,
    elevation: 12,
    opacity: 0.96,
    shadowColor: '#15221B',
    shadowOffset: {width: 0, height: 7},
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  handleTouchTarget: {
    position: 'absolute',
    left: -26,
    top: 2,
    zIndex: 60,
    width: 34,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleIcon: {opacity: 0.58},
});

export default DraggableJournalBlock;
