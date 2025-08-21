/**
 * ActionStepsCard.tsx
 * Displays unfinished action steps from user's playbooks
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { triggerLightHaptic } from '../../utils/haptics';

interface ActionStep {
  id: string;
  title: string;
  description?: string;
  playbookTitle: string;
  playbookId: string;
  stepIndex: number;
  isCompleted: boolean;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface ActionStepsCardProps {
  onStepPress?: (step: ActionStep) => void;
  onViewAll?: () => void;
}



const ActionStepsCard: React.FC<ActionStepsCardProps> = ({ onStepPress, onViewAll }) => {
  const { user } = useAuth();
  const [actionSteps, setActionSteps] = useState<ActionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActionSteps = useCallback(async () => {
    if (!user) {return;}

    try {
      setLoading(true);
      setError(null);

      // Fetch user's playbooks
      const { data: __progressData, error: progressError } = await supabase
        .from('playbook_action_steps')
        .select(`
          *,
          playbook:playbooks(*)
        `)
        .eq('completed', false)
        .limit(10);

      if (progressError) {
        console.error('Error fetching action steps:', progressError);
        throw progressError;
      }

      if (!__progressData || __progressData.length === 0) {
        setActionSteps([]);
        return;
      }

      // Transform the data to match ActionStep interface
      const transformedSteps: ActionStep[] = __progressData.map((step: any) => ({
        id: step.id,
        title: step.title || step.step_title || 'Untitled Step',
        description: step.description || step.step_description,
        playbookTitle: step.playbook?.title || 'Unknown Playbook',
        playbookId: step.playbook_id,
        stepIndex: step.step_index || 0,
        isCompleted: step.completed || false,
        dueDate: step.due_date,
        priority: step.priority || 'medium'
      }));

      setActionSteps(transformedSteps);

    } catch (fetchError) {
      console.error('Error fetching action steps:', fetchError);
      setError('Failed to load action steps');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchActionSteps();
  }, [fetchActionSteps, user]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return Colors.alertCoral;
      case 'medium': return Colors.faithGold;
      case 'low': return Colors.successGreen;
      default: return Colors.faithGold;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return 'alert-circle';
      case 'medium': return 'time';
      case 'low': return 'checkmark-circle-outline';
      default: return 'time';
    }
  };

  const renderActionStep = ({ item }: { item: ActionStep }) => (
    <TouchableOpacity
      style={styles.stepItem}
      onPress={() => {
        triggerLightHaptic();
        onStepPress?.(item);
      }}
      activeOpacity={0.8}
    >
      <View style={styles.stepHeader}>
        <Ionicons
          name={getPriorityIcon(item.priority || 'medium')}
          size={16}
          color={getPriorityColor(item.priority || 'medium')}
        />
        <Text style={styles.stepTitle} numberOfLines={1}>
          {item.title}
        </Text>
      </View>

      <Text style={styles.playbookName} numberOfLines={1}>
        From: {item.playbookTitle}
      </Text>

      {item.description && (
        <Text style={styles.stepDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-circle" size={32} color={Colors.successGreen} />
      <Text style={styles.emptyTitle}>All Caught Up!</Text>
      <Text style={styles.emptyDescription}>
        You've completed all your action steps. Great work!
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>Unfinished Steps</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.alertCoral} />
          <Text style={styles.loadingText}>Loading steps...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="checkmark-circle" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Unfinished Steps</Text>
        {actionSteps.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onViewAll?.();
            }}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.alertCoral} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              fetchActionSteps();
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : actionSteps.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={actionSteps}
          renderItem={renderActionStep}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    flex: 1,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.alertCoral,
    fontWeight: '500',
  },
  stepItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.hopeWhite,
    flex: 1,
  },
  playbookName: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 12,
    color: Colors.lightGray,
    lineHeight: 16,
  },
  loadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  emptyContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.alertCoral,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
});

export default ActionStepsCard;
