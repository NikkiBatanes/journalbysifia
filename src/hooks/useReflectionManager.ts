import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import {
  useReflectionData,
  useCreateReflection,
  useUpdateReflection,
  useDeleteReflection,
  useInfiniteReflections,
  useReflectionsCount,
  useSearchReflections,
} from '../services/hooks/useReflectionData';
import { useReflectionForm } from './useReflectionForm';
import { analytics } from '../utils/analytics';
import { toLocalDateString } from '../utils/date';

type ViewMode = 'free' | 'guided';

interface UseReflectionManagerOptions {
  userId: string;
  selectedDate?: Date;
  enableInfiniteScroll?: boolean;
  enableSearch?: boolean;
  pageSize?: number;
}

interface ReflectionEntry {
  id: string;
  title: string;
  content: string;
  type: ViewMode;
  source?: 'devotional';
  prompt?: string;
  tags: string[];
  location?: string;
  devotionalTitle?: string;
  dayNumber?: number;
  dayTitle?: string;
  totalDays?: number;
  questionNumber?: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  selected_date: string;
}

export function useReflectionManager({
  userId,
  selectedDate = new Date(),
  enableInfiniteScroll = false,
  enableSearch = false,
  pageSize = 20,
}: UseReflectionManagerOptions) {
  const dateStr = toLocalDateString(selectedDate);

  // State management
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState('');

  // Query hooks
  const {
    data: reflectionEntries = [],
    isLoading,
    error,
    refetch,
  } = useReflectionData(userId, dateStr);

  const createMutation = useCreateReflection();
  const updateMutation = useUpdateReflection();
  const deleteMutation = useDeleteReflection();

  // Always call hooks unconditionally
  const infiniteQuery = useInfiniteReflections(userId, pageSize, {
    enabled: enableInfiniteScroll,
  });

  const searchQuery = useSearchReflections(userId, searchTerm, {
    enabled: enableSearch && searchTerm.length > 2,
  });

  const countQuery = useReflectionsCount(userId);

  // Form management
  const form = useReflectionForm({
    validateOnChange: true,
    validateOnBlur: true,
  });

  // Transform API data to local format
  const entries: ReflectionEntry[] = useMemo(() =>
    reflectionEntries.map(entry => ({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      type: entry.type,
      source: entry.source,
      prompt: undefined, // Prompt not stored in database
      tags: [], // Tags would need to be parsed from content or stored separately
      location: undefined,
      devotionalTitle: entry.devotional_title,
      dayNumber: entry.day_number,
      dayTitle: entry.day_title,
      totalDays: entry.total_days,
      questionNumber: entry.question_number,
      user_id: entry.user_id,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      selected_date: entry.selected_date,
    })), [reflectionEntries]
  );

  // Actions
  const handleAdd = useCallback(() => {
    form.resetForm({
      title: '',
      content: '',
      type: 'free',
      prompt: '',
      tags: [],
    });
    setSelectedPrompt('');
    setIsAdding(true);
    setEditingId(null);

    analytics.track('reflection_add_started', {
      date: dateStr,
      source: 'manual',
    });
  }, [form, dateStr]);

  const handleEdit = useCallback((entry: ReflectionEntry) => {
    form.resetForm({
      title: entry.title,
      content: entry.content,
      type: entry.type,
      prompt: entry.prompt || '',
      tags: entry.tags,
    });
    setEditingId(entry.id);
    setIsAdding(true);

    analytics.track('reflection_edit_started', {
      entryId: entry.id,
      type: entry.type,
    });
  }, [form]);

  const handleSave = useCallback(async (entryData: {
    title: string;
    content: string;
    tags: string[];
    date: Date;
    type: ViewMode;
    prompt?: string;
    source?: string;
  }) => {
    try {
      const apiData = {
        title: entryData.title,
        content: entryData.content,
        type: entryData.type,
        user_id: userId,
        selected_date: toLocalDateString(entryData.date),
      };

      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          updates: apiData,
        });

        analytics.track('reflection_updated', {
          entryId: editingId,
          type: entryData.type,
          contentLength: entryData.content.length,
        });
      } else {
        await createMutation.mutateAsync(apiData);

        analytics.track('reflection_created', {
          type: entryData.type,
          contentLength: entryData.content.length,
          hasTitle: !!entryData.title,
        });
      }

      // Reset form and close modal
      form.resetForm();
      setIsAdding(false);
      setEditingId(null);

    } catch (err) {
      console.error('Error saving reflection:', err);
      Alert.alert('Error', 'Failed to save reflection. Please try again.');
    }
  }, [editingId, userId, updateMutation, createMutation, form]);

  const handleDelete = useCallback(async (entryId: string) => {
    Alert.alert(
      'Delete Reflection',
      'Are you sure you want to delete this reflection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(entryId);

              analytics.track('reflection_deleted', {
                entryId,
              });
            } catch (err) {
              console.error('Error deleting reflection:', err);
              Alert.alert('Error', 'Failed to delete reflection. Please try again.');
            }
          },
        },
      ]
    );
  }, [deleteMutation]);

  const handleCancel = useCallback(() => {
    form.resetForm();
    setIsAdding(false);
    setEditingId(null);
    setSelectedPrompt('');
  }, [form]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    if (term.length > 2) {
      analytics.track('reflection_search', {
        searchTerm: term,
      });
    }
  }, []);

  // Loading states
  const isCreating = createMutation.isPending;
  const isUpdating = updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isSaving = isCreating || isUpdating;

  // Error states with unique names to avoid shadowing
  const createError = createMutation.error;
  const updateError = updateMutation.error;
  const deleteError = deleteMutation.error;
  const saveError = createError || updateError;

  return {
    // Data
    entries,
    totalCount: countQuery.data || 0,
    searchResults: searchQuery?.data || [],
    infiniteData: infiniteQuery?.data,

    // Loading states
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isSaving,
    isLoadingMore: infiniteQuery?.isFetchingNextPage || false,

    // Error states
    error,
    saveError,
    deleteError,

    // UI state
    isAdding,
    editingId,
    searchTerm,
    selectedPrompt,

    // Form
    form,

    // Actions
    handleAdd,
    handleEdit,
    handleSave,
    handleDelete,
    handleCancel,
    handleSearch,
    refetch,

    // Infinite scroll actions
    fetchNextPage: infiniteQuery?.fetchNextPage,
    hasNextPage: infiniteQuery?.hasNextPage,

    // Setters for UI state
    setIsAdding,
    setEditingId,
    setSelectedPrompt,
  };
}
