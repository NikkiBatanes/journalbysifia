/**
 * FaithfulActionsCarousel.tsx
 * Horizontal carousel displaying incomplete faithful actions from playbooks
 */

import React, { useRef, useMemo } from 'react';
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
    extrapolate: 'clamp',
  }), [scrollX, index]);

  const opacity = useMemo(() => scrollX.interpolate({
    inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE],
    outputRange: [0.9, 1, 0.9],
    extrapolate: 'clamp',
  }), [scrollX, index]);

  const translateY = useMemo(() => scrollX.interpolate({
    inputRange: [(index - 1) * ITEM_SIZE, index * ITEM_SIZE, (index + 1) * ITEM_SIZE],
    outputRange: [2, 0, 2],
    extrapolate: 'clamp',
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

  if (faithfulActions.length === 0) {
    return null;
  }

  return (
    <View style={styles.categorySection}>
      <View style={styles.categorySectionHeader}>
        <ThemedText weight="semiBold" style={styles.categorySectionTitle}>CONTINUE FAITHFUL ACTIONS</ThemedText>
      </View>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContainer, CAROUSEL_CONTENT_STYLE]}
        decelerationRate="fast"
        snapToInterval={ITEM_SIZE}
        snapToAlignment="center"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        bounces={true}
        removeClippedSubviews={false}
        style={styles.scrollExpanded}
      >
        {faithfulActions.map((item, index) => (
          <View key={item.id} style={styles.itemContainer}>
            <FaithfulActionCard
              item={item}
              index={index}
              scrollX={scrollX}
              onPress={onPress}
            />
          </View>
        ))}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  categorySection: {
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 30,
    overflow: 'visible',
  },
  scrollContainer: {
    paddingVertical: 0,
    paddingRight: 0,
    overflow: 'visible',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    flexGrow: 1,
  },
  scrollExpanded: {
    overflow: 'visible',
    marginHorizontal: -16,
  },
  categorySectionHeader: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  categorySectionTitle: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginRight: ITEM_SPACING,
  },
  carouselCardTouch: {
    width: ITEM_WIDTH,
    overflow: 'visible',
    position: 'relative',
  },
  carouselCard: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 26,
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
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 0,
  },
  faithfulActionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 12,
  },
  faithfulActionLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  faithfulActionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
  },
  faithfulActionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,107,107,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  faithfulActionNumber: {
    fontSize: 14,
    color: Colors.alertCoral,
    lineHeight: 18,
  },
  faithfulActionTitle: {
    fontSize: 15,
    color: Colors.hopeWhite,
    marginTop: 0,
    marginBottom: 0,
    flex: 1,
    flexWrap: 'wrap',
  },
  faithfulActionDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
    marginTop: 0,
  },
  faithfulActionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 6,
  },
  faithfulActionFrom: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  carouselCardTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  faithfulActionMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
});

export default FaithfulActionsCarousel;
