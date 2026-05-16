import React, { useState, useCallback, useRef } from 'react';
import { View, Alert, Keyboard } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { toLocalDateString } from '../utils/date';
import ReflectionLogEditor, { ReflectionLogEditorRef } from '../components/journal/ReflectionLogEditor';
import { styles as reflectionLogStyles } from '../components/journal/reflectionStyles';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useReflectionData, useCreateReflection, useUpdateReflection, useDeleteReflection } from '../services/hooks/useReflectionData';
import { analytics } from '../utils/analytics';
import { Logger } from '../utils/ProductionLogger';
import NewSuccessModal from '../components/NewSuccessModal';
import { useSuccessModal } from '../hooks/useSuccessModal';
import { triggerLightHaptic } from '../utils/haptics';
import { useEditModeSafe } from '../systems/journal/context/EditModeContext';
import { visibleStreakService } from '../services/visibleStreakService';

interface RouteParams {
  selectedDate?: string; // ISO date string
  existingReflection?: any;
  initialMode?: 'free-form' | 'guided';
  initialPrompt?: string;
  initialTitle?: string;
  lockTitle?: boolean;
  source?: string;
  devotionalTitle?: string;
  playbookTitle?: string;
  dayNumber?: number;
  dayTitle?: string;
  totalDays?: number;
  questionNumber?: number;
  openHeart?: boolean;
  fromCarousel?: boolean; // Indicate if navigation is from carousel
}

const ReflectionEditorScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = (route.params as RouteParams) || {};
  const { user } = useAuth();
  const globalEditMode = useEditModeSafe();

  const selectedDate = params.selectedDate ? new Date(params.selectedDate) : new Date();
  const dateStr = toLocalDateString(selectedDate);

  const {
    data: reflectionEntries = [],
  } = useReflectionData(user?.id || '', dateStr);

  const createMutation = useCreateReflection();
  const updateMutation = useUpdateReflection();
  const deleteMutation = useDeleteReflection();

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const [editingId] = useState<string | null>(params.existingReflection?.id || null);

  const editorRef = useRef<ReflectionLogEditorRef>(null);

  // Success modal handlers
  const successModal = useSuccessModal(
    () => {
      editorRef.current?.blurInputs();
      navigation.goBack();
    },
    () => {
      // Edit callback - keep screen open and focus input
      handleEditFocus();
    }
  );

  const handleEditFocus = () => {
    // Focus input after success modal closes
    setTimeout(() => {
      // The ReflectionLogEditor will handle focus
    }, 300);
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    navigation.goBack();
  };

  const normalizeOutgoing = useCallback((text: string): string => {
    if (!text) {return '';}
    return text.replace(/<br\s*\/?\s*>/gi, '\n').replace(/\r\n/g, '\n');
  }, []);

  const handleSave = async (entryData: any) => {
    triggerLightHaptic();
    if (!user) {
      Logger.error('User not authenticated', undefined, { component: 'ReflectionEditorScreen' });
      return;
    }

    try {
      // Determine the type
      const rawType = editingId ? (params.existingReflection?.type || 'free') : (entryData.type || 'free');
      const normalizedType = rawType === 'free-form' ? 'free' : rawType;

      // Determine the source
      const determinedSource = normalizedType === 'guided' ? 'guided' : (entryData.source || (normalizedType === 'free' ? 'freeform' : undefined));

      // Build save data
      const saveData = {
        title: entryData.title || '',
        content: normalizeOutgoing(entryData.content || ''),
        type: normalizedType,
        user_id: user.id,
        selected_date: dateStr,
        ...(entryData.prompt && { prompt: entryData.prompt }),
        ...(entryData.tags && entryData.tags.length > 0 && { tags: entryData.tags }),
        ...(determinedSource && { source: determinedSource }),
      };

      if (editingId) {
        // Update existing entry
        await updateMutation.mutateAsync({ id: editingId, updates: saveData });

        // Track update analytics
        const existingEntry = reflectionEntries.find(e => e.id === editingId);
        analytics.trackReflectionEvent('reflection_updated', {
          reflection_id: editingId,
          title_length: saveData.title.length,
          content_length: saveData.content.length,
          previous_title_length: existingEntry?.title?.length || 0,
          previous_content_length: existingEntry?.content?.length || 0,
          type: saveData.type as 'free' | 'guided',
          date: dateStr,
        }, user.id);
      } else {
        // Create new entry
        await createMutation.mutateAsync(saveData);

        // Track creation analytics
        analytics.trackReflectionEvent('reflection_created', {
          title_length: saveData.title.length,
          content_length: saveData.content.length,
          type: saveData.type,
          has_prompt: Boolean(entryData.prompt || params.initialPrompt),
          date: dateStr,
        }, user.id);
      }

      // For new reflections only, check if a streak celebration should show.
      // If so, the streak screen IS the celebration — skip the success modal.
      if (!editingId) {
        const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user.id, 'reflection_saved');
        if (shouldShowStreak) {
          if (globalEditMode?.isGlobalEditMode) {
            globalEditMode.setGlobalEditMode(false);
          }
          await visibleStreakService.markShownToday(user.id);
          (navigation as any).navigate('StreakPlan', {
            userId: user.id,
            source: 'reflection_saved',
          });
          return;
        }
      }

      // Show success modal
      setTimeout(() => {
        successModal.showSuccess({
          title: editingId ? 'Reflection Updated' : 'Reflection Saved',
          message: editingId ? 'Your reflection has been updated in your journal.' : 'Your reflection has been saved to your journal.',
          showEditButton: true,
        });
      }, 100);

      // Close global edit mode if active
      if (globalEditMode?.isGlobalEditMode) {
        globalEditMode.setGlobalEditMode(false);
      }
    } catch (saveError) {
      Logger.error('ReflectionEditorScreen: Save failed', saveError as Error, {
        component: 'ReflectionEditorScreen',
      });
      Alert.alert('Error', 'Failed to save reflection entry. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    triggerLightHaptic();
    try {
      await deleteMutation.mutateAsync(id);
      navigation.goBack();
    } catch (deleteError) {
      Logger.error('Failed to delete reflection', deleteError as Error, {
        component: 'ReflectionEditorScreen',
      });
      Alert.alert('Error', 'Failed to delete reflection. Please try again.');
    }
  };

  return (
    <>
      <View style={{ flex: 1, backgroundColor: '#1a3c5e' }}>
        <ReflectionLogEditor
          ref={editorRef}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={editingId ? handleDelete : undefined}
          entryId={editingId || undefined}
          initialEntry={params.existingReflection ? {
            title: params.existingReflection.title,
            content: params.existingReflection.content,
            tags: params.existingReflection.tags || [],
            type: params.existingReflection.type === 'free' || params.existingReflection.type === 'playbook' ? 'free-form' : (params.existingReflection.type === 'devotional' ? 'guided' : 'free-form') as 'free-form' | 'guided',
            source: params.existingReflection.source,
            prompt: params.existingReflection.prompt,
          } : {
            title: params.initialTitle || '',
            content: '',
            tags: [],
            type: params.initialMode || 'free-form',
            source: params.source || 'freeform',
            prompt: params.initialPrompt || '',
          }}
          initialMode={params.initialMode || 'free-form'}
          initialPrompt={params.initialPrompt || ''}
          initialTitle={params.initialTitle || ''}
          lockTitle={params.lockTitle || false}
          source={params.source || 'freeform'}
          devotionalTitle={params.devotionalTitle}
          playbookTitle={params.playbookTitle}
          dayNumber={params.dayNumber}
          dayTitle={params.dayTitle}
          totalDays={params.totalDays}
          questionNumber={params.questionNumber}
          styles={reflectionLogStyles}
          dateString={(function() {
            const year = selectedDate.getFullYear();
            const currentYear = new Date().getFullYear();
            const base: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
            const withYear: Intl.DateTimeFormatOptions = { ...base, year: 'numeric' };
            return selectedDate.toLocaleDateString('en-US', year === currentYear ? base : withYear);
          })()}
          isLoading={isLoading}
          hideGuidedPromptButton={!params.openHeart}
          autoOpenGuidedPrompt={false} // Don't auto-open guided prompt when coming from carousel
          fromCarousel={params.fromCarousel}
        />
      </View>

      {/* Success Modal */}
      <NewSuccessModal
        visible={successModal.isVisible}
        config={successModal.config}
        onDone={successModal.handleDone}
        onEdit={successModal.handleEdit}
      />
    </>
  );
};

export default ReflectionEditorScreen;
