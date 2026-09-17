import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Alert, Keyboard, ActivityIndicator, TouchableOpacity, ScrollView, StatusBar, Animated, Easing } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { BookHeart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { fromLocalDateString, toLocalDateString } from '../utils/date';
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
import { findLocalReflection } from '../storage/reflectionStorage';
import ThemedText from '../components/common/ThemedText';
import { HEART_JOURNAL_CLASSIFICATIONS, type HeartJournalClassification } from '../types/heartJournal';
import { Colors } from '../theme/colors';
import GuidedReflectionExperience from '../components/journal/GuidedReflectionExperience';
import { parseGuidedReflection } from '../types/guidedReflection';

interface RouteParams {
  selectedDate?: string; // ISO date string
  existingReflection?: any;
  reflectionId?: string;
  initialMode?: 'free-form' | 'guided';
  initialPrompt?: string;
  initialTitle?: string;
  lockTitle?: boolean;
  source?: string;
  playbookTitle?: string;
  dayNumber?: number;
  dayTitle?: string;
  totalDays?: number;
  questionNumber?: number;
  openHeart?: boolean;
  fromCarousel?: boolean; // Indicate if navigation is from carousel
  returnTo?: string; // Parent (tab) route to switch back to after closing
  journalClassification?: HeartJournalClassification;
}

const ReflectionEditorScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = (route.params as RouteParams) || {};
  const { user } = useAuth();
  const globalEditMode = useEditModeSafe();
  const insets = useSafeAreaInsets();

  // ReflectionEditor owns every Heart Journal surface (classification,
  // Guided, single-question, saved entry, and free-form writing), so manage
  // the system status bar here instead of in individual child experiences.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true, 'slide');
      return () => StatusBar.setHidden(false, 'slide');
    }, []),
  );

  const selectedDate = params.selectedDate ? fromLocalDateString(params.selectedDate) : new Date();
  const dateStr = toLocalDateString(selectedDate);

  const {
    data: reflectionEntries = [],
  } = useReflectionData(user?.id || '', dateStr);

  const createMutation = useCreateReflection();
  const updateMutation = useUpdateReflection();
  const deleteMutation = useDeleteReflection();

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Callers from Moments pass the canonical ID, while the journal list often
  // passes the whole entry. Resolve either form before deciding create/update.
  const [existingReflection, setExistingReflection] = useState<any>(params.existingReflection || null);
  const [editingId, setEditingId] = useState<string | null>(params.existingReflection?.id || null);
  const [isResolvingExisting, setIsResolvingExisting] = useState(Boolean(params.reflectionId && !params.existingReflection));
  const [journalClassification, setJournalClassification] = useState<HeartJournalClassification | undefined>(
    params.existingReflection?.metadata?.journalClassification || params.existingReflection?.journal_classification || params.journalClassification
  );
  const [guidedFromChooser, setGuidedFromChooser] = useState(false);
  const [singleGuidedPrompt, setSingleGuidedPrompt] = useState('');
  const [classificationTransitioning, setClassificationTransitioning] = useState(false);
  const classificationRevealAnims = useRef(
    Array.from({ length: HEART_JOURNAL_CLASSIFICATIONS.length + 2 }, () => new Animated.Value(0)),
  ).current;
  const previousGuidedFromChooserRef = useRef(guidedFromChooser);
  const guidedFromChooserRef = useRef(guidedFromChooser);
  guidedFromChooserRef.current = guidedFromChooser;

  const resetClassificationEntrance = useCallback(() => {
    setClassificationTransitioning(false);
    classificationRevealAnims.forEach(animation => {
      animation.stopAnimation();
      animation.setValue(0);
    });
  }, [classificationRevealAnims]);

  const playClassificationEntrance = useCallback(() => {
    Animated.stagger(
      38,
      classificationRevealAnims.map(animation =>
        Animated.spring(animation, {
          toValue: 1,
          tension: 90,
          friction: 12,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [classificationRevealAnims]);

  // Wait until the native modal transition finishes so the reveal is visible
  // each time Heart Journal is opened from the navigation pencil.
  useFocusEffect(
    useCallback(() => {
      if (guidedFromChooserRef.current) {return undefined;}
      resetClassificationEntrance();
      let played = false;
      const playOnce = () => {
        if (played) {return;}
        played = true;
        playClassificationEntrance();
      };
      const unsubscribe = (navigation as any).addListener?.(
        'transitionEnd',
        (event: any) => {
          if (!event?.data?.closing) {playOnce();}
        },
      );
      const fallback = setTimeout(playOnce, 450);
      return () => {
        clearTimeout(fallback);
        unsubscribe?.();
        classificationRevealAnims.forEach(animation => animation.stopAnimation());
      };
    }, [classificationRevealAnims, navigation, playClassificationEntrance, resetClassificationEntrance]),
  );

  // Closing Guided returns within the focused route, so replay without waiting
  // for a stack transition that will not occur.
  useEffect(() => {
    const returningFromGuided = previousGuidedFromChooserRef.current && !guidedFromChooser;
    previousGuidedFromChooserRef.current = guidedFromChooser;
    if (!returningFromGuided) {return;}
    resetClassificationEntrance();
    requestAnimationFrame(playClassificationEntrance);
  }, [guidedFromChooser, playClassificationEntrance, resetClassificationEntrance]);

  const classificationRevealStyle = (animation: Animated.Value) => ({
    opacity: animation,
    transform: [
      { translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
      { scale: animation.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  });

  const leaveClassificationChooser = (onComplete: () => void) => {
    if (classificationTransitioning) {return;}
    triggerLightHaptic();
    setClassificationTransitioning(true);
    Animated.stagger(
      28,
      [...classificationRevealAnims].reverse().map(animation =>
        Animated.timing(animation, {
          toValue: 0,
          duration: 130,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ),
    ).start(onComplete);
  };

  useEffect(() => {
    if (params.existingReflection?.id) {
      setExistingReflection(params.existingReflection);
      setEditingId(params.existingReflection.id);
      setIsResolvingExisting(false);
      return;
    }
    if (!params.reflectionId) {return;}
    let active = true;
    findLocalReflection(params.reflectionId).then(entry => {
      if (active && entry) {
        setExistingReflection(entry);
        setEditingId(entry.id);
      }
      if (active) {setIsResolvingExisting(false);}
    }).catch(error => {
      Logger.warn('ReflectionEditorScreen: Could not resolve reflection', { error });
      if (active) {setIsResolvingExisting(false);}
    });
    return () => { active = false; };
  }, [params.existingReflection, params.reflectionId]);

  const editorRef = useRef<ReflectionLogEditorRef>(null);

  // Close the editor and, when a returnTo route was provided, switch the
  // parent (tab) navigator back to that screen (e.g. 'Today').
  const closeEditor = useCallback(() => {
    navigation.goBack();
    if (params.returnTo) {
      (navigation.getParent() as any)?.navigate?.(params.returnTo);
    }
  }, [navigation, params.returnTo]);

  // Success modal handlers
  const successModal = useSuccessModal(
    () => {
      editorRef.current?.blurInputs();
      closeEditor();
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
    closeEditor();
  };

  const normalizeOutgoing = useCallback((text: string): string => {
    if (!text) {return '';}
    return text.replace(/<br\s*\/?\s*>/gi, '\n').replace(/\r\n/g, '\n');
  }, []);

  const handleSave = async (entryData: any) => {
    triggerLightHaptic();

    try {
      // Determine the type
      const rawType = editingId ? (existingReflection?.type || 'free') : (entryData.type || 'free');
      const normalizedType = rawType === 'free-form' ? 'free' : rawType;

      // Determine the source
      const determinedSource = normalizedType === 'guided' ? 'guided' : (entryData.source || (normalizedType === 'free' ? 'freeform' : undefined));

      // Build save data
      const saveData = {
        title: entryData.title || '',
        content: normalizeOutgoing(entryData.content || ''),
        type: normalizedType,
        // Canonical reflection storage is local-first. An account ID is only
        // attached when present; saving itself never requires authentication.
        user_id: user?.id || '',
        selected_date: dateStr,
        // A chosen Guided prompt is canonical context. An edit changes the
        // response, never replaces it with a newly generated prompt.
        ...((entryData.prompt || existingReflection?.prompt || params.initialPrompt) && {
          prompt: entryData.prompt || existingReflection?.prompt || params.initialPrompt,
        }),
        ...(entryData.journalClassification && { journal_classification: entryData.journalClassification }),
        ...(entryData.guidedJourney && { guided_journey: entryData.guidedJourney }),
        ...(entryData.tags && entryData.tags.length > 0 && { tags: entryData.tags }),
        ...(determinedSource && { source: determinedSource }),
      };

      if (editingId) {
        // Update existing entry
        await updateMutation.mutateAsync({ id: editingId, updates: saveData });

        // Track update analytics
        const existingEntry = reflectionEntries.find(e => e.id === editingId);
        user && analytics.trackReflectionEvent('reflection_updated', {
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
        user && analytics.trackReflectionEvent('reflection_created', {
          title_length: saveData.title.length,
          content_length: saveData.content.length,
          type: saveData.type,
          has_prompt: Boolean(entryData.prompt || params.initialPrompt),
          date: dateStr,
        }, user.id);
      }

      // For new reflections only, check if a streak celebration should show.
      // If so, the streak screen IS the celebration — skip the success modal.
      if (!editingId && user) {
        const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user.id, 'reflection_saved');
        if (shouldShowStreak) {
          if (globalEditMode?.isGlobalEditMode) {
            globalEditMode.setGlobalEditMode(false);
          }
          await visibleStreakService.markShownToday(user.id);
          (navigation as any).navigate('StreakPlan', {
            userId: user.id,
            source: 'reflection_saved',
            returnTo: 'journal',
            dismissRouteCount: 2,
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
      return true;
    } catch (saveError) {
      Logger.error('ReflectionEditorScreen: Save failed', saveError as Error, {
        component: 'ReflectionEditorScreen',
      });
      Alert.alert('Error', 'Failed to save reflection entry. Please try again.');
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    triggerLightHaptic();
    try {
      await deleteMutation.mutateAsync(id);
      closeEditor();
    } catch (deleteError) {
      Logger.error('Failed to delete reflection', deleteError as Error, {
        component: 'ReflectionEditorScreen',
      });
      Alert.alert('Error', 'Failed to delete reflection. Please try again.');
    }
  };

  if (isResolvingExisting) {
    return <View style={{ flex: 1, backgroundColor: '#526A5B', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /></View>;
  }

  const guidedMode = params.initialMode === 'guided' || guidedFromChooser || existingReflection?.type === 'guided';
  const structuredJourney = existingReflection
    ? (existingReflection.metadata?.guidedJourney || existingReflection.guided_journey || parseGuidedReflection(existingReflection.content))
    : null;
  const legacyGuidedPrompt = existingReflection?.prompt || existingReflection?.metadata?.prompt || params.initialPrompt || singleGuidedPrompt;
  const showGuidedExperience = guidedMode && (!existingReflection || Boolean(structuredJourney)) && !params.initialPrompt && !singleGuidedPrompt;
  const showClassificationChooser = !existingReflection && !guidedMode && !journalClassification;
  if (showClassificationChooser) {
    return <View style={{ flex: 1, backgroundColor: Colors.sage }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={() => {
          triggerLightHaptic();
          handleCancel();
        }}
        style={{
          position: 'absolute',
          top: insets.top + 10,
          right: 20,
          zIndex: 10,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.3)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="close" size={18} color={Colors.hopeWhite} />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 96, paddingBottom: 40 }}>
        <Animated.View style={classificationRevealStyle(classificationRevealAnims[0])}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 12 }}>
            <BookHeart size={17} color="rgba(255, 255, 255, 0.7)" strokeWidth={1.8} />
            <ThemedText weight="semiBold" style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 12, letterSpacing: 2.4 }}>HEART JOURNAL</ThemedText>
          </View>
          <ThemedText weight="bold" style={{ color: Colors.hopeWhite, fontSize: 30, marginBottom: 32, textAlign: 'center' }}>What's on your heart?</ThemedText>
        </Animated.View>
        <View testID="heart-journal-classification-grid" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
          {HEART_JOURNAL_CLASSIFICATIONS.map((item, index) => <Animated.View key={item.value} style={classificationRevealStyle(classificationRevealAnims[index + 1])}><TouchableOpacity accessibilityRole="button" accessibilityLabel={item.label} onPress={() => leaveClassificationChooser(() => setJournalClassification(item.value))} style={{ borderRadius: 28, paddingVertical: 14, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', backgroundColor: 'rgba(255, 255, 255, 0.15)' }}><ThemedText style={{ color: Colors.hopeWhite, fontSize: 15 }}>{item.label}</ThemedText></TouchableOpacity></Animated.View>)}
        </View>
        <Animated.View style={[{ marginTop: 40 }, classificationRevealStyle(classificationRevealAnims[classificationRevealAnims.length - 1])] }>
          <ThemedText weight="medium" style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 12, letterSpacing: 1.2, marginBottom: 10, textAlign: 'center' }}>NEED SOMEWHERE TO START?</ThemedText>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose a Guided Reflection question" onPress={() => leaveClassificationChooser(() => setGuidedFromChooser(true))} style={{ borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14 }}><ThemedText weight="semiBold" style={{ color: Colors.hopeWhite }}>Guided Reflection</ThemedText><ThemedText style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 12, marginTop: 3 }}>Choose a question to reflect on</ThemedText></TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>;
  }

  if (showGuidedExperience) {
    return (
      <>
        <GuidedReflectionExperience
          selectedDate={dateStr}
          existingContent={existingReflection?.content}
          existingPathId={structuredJourney?.pathId}
          isSaving={isLoading}
          onCancel={handleCancel}
          onCloseJourney={existingReflection ? handleCancel : guidedFromChooser ? () => setGuidedFromChooser(false) : undefined}
          onSelectQuestion={prompt => setSingleGuidedPrompt(prompt)}
          onSave={handleSave}
        />

        <NewSuccessModal
          visible={successModal.isVisible}
          config={successModal.config}
          onDone={successModal.handleDone}
          onEdit={successModal.handleEdit}
        />
      </>
    );
  }

  return (
    <>
      <View style={{ flex: 1, backgroundColor: '#526A5B' }}>
        <ReflectionLogEditor
          ref={editorRef}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={editingId ? handleDelete : undefined}
          entryId={editingId || undefined}
          initialEntry={existingReflection ? {
            title: existingReflection.title,
            content: existingReflection.content,
            tags: existingReflection.tags || [],
            type: (existingReflection.type === 'guided' ? 'guided' : 'free-form') as 'free-form' | 'guided',
            source: existingReflection.source,
            prompt: existingReflection.prompt || existingReflection.metadata?.prompt,
            journalClassification: existingReflection.metadata?.journalClassification || existingReflection.journal_classification,
          } : {
            title: params.initialTitle || '',
            content: '',
            tags: [],
            type: guidedMode ? 'guided' : 'free-form',
            source: guidedMode ? 'guided' : (params.source || 'freeform'),
            prompt: legacyGuidedPrompt || '',
            journalClassification,
          }}
          initialMode={guidedMode ? 'guided' : 'free-form'}
          initialPrompt={legacyGuidedPrompt || ''}
          initialTitle={params.initialTitle || legacyGuidedPrompt || ''}
          lockTitle={params.lockTitle || false}
          source={existingReflection?.source || (guidedMode ? 'guided' : (params.source || 'freeform'))}
          initialJournalClassification={journalClassification || existingReflection?.metadata?.journalClassification || existingReflection?.journal_classification}
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
