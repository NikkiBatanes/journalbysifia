/**
 * FaithfulActionsCarousel.tsx
 * Horizontal carousel displaying incomplete faithful actions from playbooks
 */

import React, { useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';

const { width } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 16;
const VISIBLE_WIDTH = Math.max(0, width - CARD_HORIZONTAL_PADDING * 2);
const isTablet = width >= 768;
const ITEM_WIDTH = isTablet ? 384 : Math.round(VISIBLE_WIDTH * 0.8);
const ITEM_SPACING = 8;
const ITEM_SIZE = ITEM_WIDTH + ITEM_SPACING;
const SIDE_INSET = Math.max(
  0,
  isTablet ? 24 : Math.round((VISIBLE_WIDTH - ITEM_WIDTH) / 2),
);
const CAROUSEL_CONTENT_STYLE = { paddingHorizontal: SIDE_INSET };
const CURRENT_YEAR = new Date().getFullYear();

interface FaithfulAction {
  id: string;
  playbookId: string;
  playbookTitle: string;
  playbookCategory: string;
  actionIndex: number;
  actionTitle: string;
  actionDescription: string;
  completed: boolean;
  totalActions: number;
  completedActions: number;
  playbookUpdatedAt: string;
}

interface TaskStats {
  completed: number;
  total: number;
}

// Calculate completed and total tasks for a playbook's action steps
export const calculateTaskStats = (actionSteps: any[] = []): TaskStats => {
  if (!Array.isArray(actionSteps) || actionSteps.length === 0) {
    return { completed: 0, total: 0 };
  }

  let completed = 0;
  let total = 0;

  for (const step of actionSteps) {
    if (!step) { continue; }

    if (Array.isArray(step.subTasks) && step.subTasks.length > 0) {
      for (const subTask of step.subTasks) {
        if (subTask?.completed) { completed++; }
        total++;
      }
    } else {
      if (step.completed) { completed++; }
      total++;
    }
  }

  return { completed, total };
};

// Extract incomplete faithful actions from in-progress playbooks
export const extractIncompleteFaithfulActions = (playbooks: any[]): FaithfulAction[] => {
  const actions: FaithfulAction[] = [];

  for (const playbook of playbooks) {
    if (playbook.status === 'completed') { continue; }
    if (!playbook.actionSteps || !Array.isArray(playbook.actionSteps)) { continue; }

    const { completed, total } = calculateTaskStats(playbook.actionSteps);

    for (let i = 0; i < playbook.actionSteps.length; i++) {
      const step = playbook.actionSteps[i];
      if (!step) { continue; }

      const isStepIncomplete = !step.completed;

      if (Array.isArray(step.subTasks) && step.subTasks.length > 0) {
        for (let j = 0; j < step.subTasks.length; j++) {
          const subTask = step.subTasks[j];
          if (!subTask || subTask.completed) { continue; }

          actions.push({
            id: `${playbook.id}-${i}-${j}`,
            playbookId: playbook.id,
            playbookTitle: playbook.title,
            playbookCategory: playbook.category || 'Growth',
            actionIndex: i + 1,
            actionTitle: subTask.text || step.title || `Faithful Action ${i + 1}`,
            actionDescription: step.description || '',
            completed: false,
            totalActions: total,
            completedActions: completed,
            playbookUpdatedAt: playbook.updatedAt || playbook.createdAt || new Date().toISOString(),
          });
        }
      } else if (isStepIncomplete) {
        actions.push({
          id: `${playbook.id}-${i}`,
          playbookId: playbook.id,
          playbookTitle: playbook.title,
          playbookCategory: playbook.category || 'Growth',
          actionIndex: i + 1,
          actionTitle: step.title || `Faithful Action ${i + 1}`,
          actionDescription: step.description || '',
          completed: false,
          totalActions: total,
          completedActions: completed,
          playbookUpdatedAt: playbook.updatedAt || playbook.createdAt || new Date().toISOString(),
        });
      }
    }
  }

  return actions.sort((a, b) => {
    const dateA = new Date(a.playbookUpdatedAt).getTime();
    const dateB = new Date(b.playbookUpdatedAt).getTime();
    return dateB - dateA;
  });
};

interface FaithfulActionCardProps {
  item: FaithfulAction;
  index: number;
  scrollX: Animated.AnimatedInterpolation<number>;
  onPress: (item: FaithfulAction) => void;
}

const FaithfulActionCard = React.memo(({ item, index, scrollX, onPress }: FaithfulActionCardProps) => {
  const scale = useMemo(() => scrollX.interpolate({ 
    inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE], 
    outputRange: [0.96, 1, 0.96], 
    extrapolate: 'clamp' 
  }), [scrollX, index]);
  
  const opacity = useMemo(() => scrollX.interpolate({ 
    inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE], 
    outputRange: [0.9, 1, 0.9], 
    extrapolate: 'clamp' 
  }), [scrollX, index]);
  
  const translateY = useMemo(() => scrollX.interpolate({ 
    inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE], 
    outputRange: [2, 0, 2], 
    extrapolate: 'clamp' 
  }), [scrollX, index]);

  const updatedDateStr = useMemo(() => {
    if (!item.playbookUpdatedAt) { return null; }
    const d = new Date(item.playbookUpdatedAt);
    return format(d, d.getFullYear() === CURRENT_YEAR ? 'EEE, MMM d' : 'EEE, MMM d, yyyy');
  }, [item.playbookUpdatedAt]);

  return (
    <TouchableOpacity style={styles.carouselCardTouch} onPress={() => onPress(item)} activeOpacity={0.85}>
      <Animated.View style={[styles.carouselCard, { transform: [{ scale }, { translateY }], opacity }]}>
        <View style={styles.dateWithBadge}>
          {updatedDateStr ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="calendar" size={12} color="rgba(255,255,255,0.5)" />
              <ThemedText style={styles.carouselDate}> Started {updatedDateStr}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.faithfulActionBadge}>
          <ThemedText weight="regular" style={styles.faithfulActionLabel}>FAITHFUL ACTION</ThemedText>
        </View>
        <View style={styles.faithfulActionTitleRow}>
          <View style={styles.faithfulActionNumberBadge}>
            <ThemedText weight="bold" style={styles.faithfulActionNumber}>{item.actionIndex}</ThemedText>
          </View>
          <ThemedText weight="semiBold" style={styles.faithfulActionTitle}>{item.actionTitle}</ThemedText>
        </View>
        <ThemedText style={styles.faithfulActionDescription} numberOfLines={3}>{item.actionDescription}</ThemedText>

        <View style={styles.faithfulActionDivider} />

        <ThemedText style={styles.faithfulActionFrom}>FROM PLAYBOOK</ThemedText>

        <ThemedText weight="semiBold" style={styles.carouselCardTitle}>{item.playbookTitle}</ThemedText>

        <View style={styles.faithfulActionDivider} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <ThemedText style={styles.faithfulActionMeta}>{item.completedActions} of {item.totalActions} faithful actions acted on</ThemedText>
          <ThemedText style={styles.faithfulActionMeta}>{Math.round((item.completedActions / item.totalActions) * 100)}%</ThemedText>
        </View>

        <View style={{ height: 6, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${(item.completedActions / item.totalActions) * 100}%`, backgroundColor: Colors.growthGreen, borderRadius: 2 }} />
        </View>

        {updatedDateStr && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="clock" size={12} color="rgba(255,255,255,0.5)" />
            <ThemedText style={[styles.faithfulActionMeta, { marginLeft: 4 }]}>Updated {updatedDateStr}</ThemedText>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

interface FaithfulActionsCarouselProps {
  faithfulActions: FaithfulAction[];
  onPress: (item: FaithfulAction) => void;
}

const FaithfulActionsCarousel: React.FC<FaithfulActionsCarouselProps> = ({
  faithfulActions,
  onPress,
}) => {
  const scrollX = useRef(new Animated.Value(0)).current;

  const renderFACard = useCallback(({ item, index }: { item: FaithfulAction; index: number }) => (
    <FaithfulActionCard
      item={item}
      index={index}
      scrollX={scrollX}
      onPress={onPress}
    />
  ), [scrollX, onPress]);

  const getFAItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_SIZE, offset: ITEM_SIZE * index, index,
  }), []);

  if (faithfulActions.length === 0) {
    return null;
  }

  return (
    <View style={styles.categorySection}>
      <View style={styles.categorySectionHeader}>
        <ThemedText weight="semiBold" style={styles.categorySectionTitle}>CONTINUE FAITHFUL ACTIONS</ThemedText>
        <View style={styles.categorySectionCount}>
          <ThemedText style={styles.categorySectionCountText}>{faithfulActions.length}</ThemedText>
        </View>
      </View>
      <Animated.FlatList
        horizontal
        data={faithfulActions}
        keyExtractor={(a: FaithfulAction) => a.id}
        renderItem={renderFACard}
        getItemLayout={getFAItemLayout}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={CAROUSEL_CONTENT_STYLE}
        decelerationRate="fast"
        snapToInterval={ITEM_SIZE}
        snapToAlignment="center"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        directionalLockEnabled={true}
        disableIntervalMomentum={false}
        bounces={false}
        removeClippedSubviews={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  categorySection: {
    marginBottom: 24,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  categorySectionTitle: {
    fontSize: 16,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  categorySectionCount: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  categorySectionCountText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  carouselCardTouch: {
    width: ITEM_WIDTH,
  },
  carouselCard: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 16,
    padding: 16,
    height: 280,
    justifyContent: 'flex-start',
  },
  dateWithBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  carouselDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  faithfulActionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,107,107,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  faithfulActionLabel: {
    fontSize: 10,
    color: Colors.alertCoral,
    letterSpacing: 1,
  },
  faithfulActionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  faithfulActionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  faithfulActionNumber: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  faithfulActionTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    flex: 1,
  },
  faithfulActionDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    marginBottom: 12,
  },
  faithfulActionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  faithfulActionFrom: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  carouselCardTitle: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  faithfulActionMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
});

export default FaithfulActionsCarousel;
