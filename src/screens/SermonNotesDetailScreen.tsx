import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Easing,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil, FileText, Sparkles, Leaf } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { getLocalReflection, updateLocalReflection } from '../storage/reflectionStorage';
import { safeJsonParse } from '../utils/safeJsonParse';
import { triggerLightHaptic } from '../utils/haptics';
import { getScripturePassage } from '../services/scriptureReaderService';
import { useNetworkStore } from '../services/network/networkManager';
import { formatBibleVerse } from '../utils/textFormatting';
import { formatSessionNoteHeaderDate } from '../utils/date';
import { useAuth } from '../context/IndustryStandardAuthContext';
import ScriptureReaderModal from '../components/ScriptureReaderModal';
import { SermonNotesStyles } from './SermonNotesScreen';
import { getSessionNoteConfig, getSessionNoteContext, resolveSessionNoteType, sessionNoteTypeLabel } from '../types/sessionNotes';
import SavedReflectionBlocks from '../components/journal/SavedReflectionBlocks';
import {
  hasMeaningfulJournalBlock,
  prepareJournalBlocksForSave,
  type JournalBlock,
} from '../components/journal/shared/journalBlocks';

type NoteBlock = JournalBlock;

const TAB_ICONS = {
  notes: FileText,
  reflection: Sparkles,
  prayer: Leaf,
} as const;

const SermonNotesDetailScreen: React.FC = () => {
  const isOnline = useNetworkStore(state => state.isOnline);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const { reflectionId, selectedDate } = route.params ?? {};
  const bibleVersion = useMemo(
    () =>
      (user as any)?.user_metadata?.preferences?.content?.bibleVersion ||
      'NASB',
    [user],
  );

  const [entry, setEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'notes' | 'reflection' | 'prayer'>('notes');
  const [mainScriptureTexts, setMainScriptureTexts] = useState<string[]>([]);
  const [scriptureReaderOpen, setScriptureReaderOpen] = useState(false);
  const [scriptureReaderIndex, setScriptureReaderIndex] = useState(0);
  const [contentY, setContentY] = useState(0);
  const [tabsFloating, setTabsFloating] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const scrollViewRef = useRef<any>(null);
  const snapStarted = useRef(false);
  const snapAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const snapOffset = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const tabTransition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const data = reflectionId
          ? await getLocalReflection(reflectionId, 'sermon', selectedDate)
          : null;
        if (mounted) {setEntry(data);}
      } catch (error) {
        console.warn('Error loading sermon detail:', error);
      } finally {
        if (mounted) {setLoading(false);}
      }
    })();
    return () => { mounted = false; };
  }, [reflectionId, selectedDate]);

  useEffect(() => {
    const listenerId = snapOffset.addListener(({value}) => {
      scrollViewRef.current?.scrollTo({y: value, animated: false});
    });
    return () => {
      snapAnimation.current?.stop();
      snapOffset.removeListener(listenerId);
    };
  }, [snapOffset]);

  useEffect(() => {
    tabTransition.stopAnimation();
    Animated.timing(tabTransition, {
      toValue: tabsFloating ? 1 : 0,
      duration: 240,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tabTransition, tabsFloating]);

  const metadata = useMemo(() => entry?.metadata || {}, [entry]);
  const content = useMemo(() => {
    if (!entry?.content) {return { blocks: [] };}
    const parsed =
      typeof entry.content === 'string'
        ? safeJsonParse<{ blocks?: NoteBlock[] }>(entry.content, { fallback: { blocks: [] } })
        : entry.content;
    return parsed || { blocks: [] };
  }, [entry]);
  const blocks = useMemo(() => content?.blocks || [], [content]);
  const preparedBlocks = useMemo(
    () => prepareJournalBlocksForSave(blocks as JournalBlock[]) as NoteBlock[],
    [blocks],
  );

  const dateStr = useMemo(() => {
    const raw = entry?.selected_date || selectedDate;
    if (!raw) {return '';}
    return formatSessionNoteHeaderDate(String(raw));
  }, [entry, selectedDate]);

  const sessionType = useMemo(() => resolveSessionNoteType(entry), [entry]);
  const sessionConfig = useMemo(() => getSessionNoteConfig(sessionType), [sessionType]);
  const sessionContext = useMemo(() => getSessionNoteContext(metadata, sessionType), [metadata, sessionType]);
  const title = useMemo(() => entry?.title?.trim() || sessionNoteTypeLabel(sessionType), [entry, sessionType]);
  const speaker = sessionContext.person.trim();
  const series = sessionContext.event.trim();
  const church = sessionContext.location.trim();
  const mainScripture: string = sessionContext.topic.trim();
  const mainScriptureRefs = useMemo(() => {
    return sessionType === 'sermon' ? mainScripture
      .split(/[;\n]+/)
      .map((r: string) => r.trim())
      .filter(Boolean) : [];
  }, [mainScripture, sessionType]);

  useEffect(() => {
    if (mainScriptureRefs.length === 0) {
      setMainScriptureTexts([]);
      return;
    }
    let active = true;
    setMainScriptureTexts([]);
    Promise.all(
      mainScriptureRefs.map(reference =>
        getScripturePassage(reference, bibleVersion)
          .then(result => (result.text ? formatBibleVerse(result.text) : ''))
          .catch(() => ''),
      ),
    ).then(texts => {
      if (active) {setMainScriptureTexts(texts);}
    });
    return () => { active = false; };
  }, [bibleVersion, isOnline, mainScriptureRefs]);

  const hasAdditionalDetails = useMemo(() => series || church || (sessionType !== 'sermon' && mainScripture), [series, church, mainScripture, sessionType]);

  const reflectionKinds = useMemo(() => ['question', 'reflection_question', 'remember', 'revisit', 'response'], []);
  const notesBlocks = useMemo(() => {
    return preparedBlocks.filter(
      (b: NoteBlock) =>
        !b.parentColumnId &&
        (b.kind === 'column' || hasMeaningfulJournalBlock(b)) &&
        !reflectionKinds.includes(b.kind) &&
        b.kind !== 'prayer',
    );
  }, [preparedBlocks, reflectionKinds]);
  const reflectionBlocks = useMemo(() => {
    return preparedBlocks.filter((b: NoteBlock) => !b.parentColumnId && hasMeaningfulJournalBlock(b) && reflectionKinds.includes(b.kind));
  }, [preparedBlocks, reflectionKinds]);
  const prayerBlocks = useMemo(() => {
    return preparedBlocks.filter((b: NoteBlock) => !b.parentColumnId && hasMeaningfulJournalBlock(b) && b.kind === 'prayer');
  }, [preparedBlocks]);
  const reflectionQuestions = useMemo(() => {
    return [
      { key: 'notice', question: 'What stayed with you?' },
      { key: 'carry', question: 'What is God showing you about Himself?' },
    ]
      .map(({ key, question }) => ({ key, question, answer: metadata[key]?.trim() || '' }))
      .filter(item => item.answer);
  }, [metadata]);
  const prayerQuestions = useMemo(() => {
    return [
      { key: 'prayer', question: 'What needs to change in you?' },
      { key: 'prayer_answer', question: 'What will you carry with you?' },
    ]
      .map(({ key, question }) => ({ key, question, answer: metadata[key]?.trim() || '' }))
      .filter(item => item.answer);
  }, [metadata]);

  const hasNotes = notesBlocks.length > 0;
  const hasReflection = reflectionQuestions.length > 0 || reflectionBlocks.length > 0;
  const hasPrayer = prayerQuestions.length > 0 || prayerBlocks.length > 0;

  const handleToggleSavedAction = async (blockId: string) => {
    if (!entry) {return;}
    const previousEntry = entry;
    const nextBlocks = blocks.map((block: NoteBlock) =>
      block.id === blockId && block.kind === 'action'
        ? {...block, completed: !block.completed}
        : block,
    );
    const optimisticEntry = {
      ...entry,
      content: JSON.stringify({...content, blocks: nextBlocks}),
    };
    triggerLightHaptic();
    setEntry(optimisticEntry);
    try {
      const updatedEntry = await updateLocalReflection(optimisticEntry);
      setEntry(updatedEntry);
      DeviceEventEmitter.emit('sermon_saved', {
        reflectionId: updatedEntry.id,
        type: 'action_toggled',
        selectedDate: updatedEntry.selected_date,
      });
    } catch {
      setEntry(previousEntry);
      Alert.alert('Could not update action', 'Please try again.');
    }
  };

  const persistReorderedSavedBlocks = async (
    reorderedTabBlocks: NoteBlock[],
  ) => {
    if (!entry) {return;}
    const previousEntry = entry;
    const reorderedIds = new Set(reorderedTabBlocks.map(block => block.id));
    let reorderedIndex = 0;
    const topLevelBlocks = preparedBlocks.filter(block => !block.parentColumnId);
    const reorderedTopLevel = topLevelBlocks.map(block =>
      reorderedIds.has(block.id)
        ? reorderedTabBlocks[reorderedIndex++]
        : block,
    );
    const parentIds = new Set(reorderedTopLevel.map(block => block.id));
    const nextBlocks = reorderedTopLevel.flatMap(parent => [
      parent,
      ...preparedBlocks.filter(child => child.parentColumnId === parent.id),
    ]);
    nextBlocks.push(
      ...preparedBlocks.filter(
        child => child.parentColumnId && !parentIds.has(child.parentColumnId),
      ),
    );
    const optimisticEntry = {
      ...entry,
      content: JSON.stringify({...content, blocks: nextBlocks}),
    };
    triggerLightHaptic();
    setEntry(optimisticEntry);
    try {
      const updatedEntry = await updateLocalReflection(optimisticEntry);
      setEntry(updatedEntry);
      DeviceEventEmitter.emit('sermon_saved', {
        reflectionId: updatedEntry.id,
        type: 'blocks_reordered',
        selectedDate: updatedEntry.selected_date,
      });
    } catch {
      setEntry(previousEntry);
      Alert.alert('Could not move note', 'Please try again.');
    }
  };

  const renderMovableBlocks = (tabBlocks: NoteBlock[]) => {
    const tabBlockIds = new Set(tabBlocks.map(block => block.id));
    const blocksWithChildren = preparedBlocks.filter(
      block =>
        tabBlockIds.has(block.id) ||
        Boolean(block.parentColumnId && tabBlockIds.has(block.parentColumnId)),
    );

    return (
      <SavedReflectionBlocks
        blocks={blocksWithChildren}
        embedded
        onToggleAction={handleToggleSavedAction}
        onReorderBlocks={reorderedBlocks =>
          persistReorderedSavedBlocks(
            reorderedBlocks.filter(block => !block.parentColumnId),
          )
        }
      />
    );
  };
  const handleEdit = () => {
    triggerLightHaptic();
    const params: any = { reflectionId, selectedDate };
    if (activeTab === 'notes') {
      params.initialStage = 2;
    } else if (activeTab === 'reflection') {
      params.initialStage = 4;
      params.initialReflectionStep = 0;
    } else if (activeTab === 'prayer') {
      params.initialStage = 4;
      params.initialReflectionStep = 3;
    }
    navigation.push('SermonNotes', params);
  };

  const handleClose = () => {
    triggerLightHaptic();
    navigation.goBack();
  };

  const renderTabs = () => (
    <View style={styles.pills}>
      {(['notes', 'reflection', 'prayer'] as const).map(tab => {
        const active = activeTab === tab;
        const TabIcon = TAB_ICONS[tab];
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.pill, active && styles.pillActive]}
            activeOpacity={0.7}>
            <TabIcon
              size={17}
              color={active ? Colors.hopeWhite : Colors.text}
            />
            <ThemedText
              weight="medium"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.pillText, active && styles.pillTextActive]}>
              {tab[0].toUpperCase() + tab.slice(1)}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={Colors.sage} />
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <ThemedText style={styles.empty}>Sermon note not found.</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          SermonNotesStyles.content,
          {paddingHorizontal: 0, paddingTop: insets.top + 80, paddingBottom: 0},
        ]}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {
            useNativeDriver: true,
            listener: ({nativeEvent}: any) => {
              const offsetY = nativeEvent.contentOffset.y;
              if (!tabsFloating && !snapStarted.current && contentY > 0 && offsetY >= 24) {
                const targetY = Math.max(0, contentY - insets.top - 80);
                snapStarted.current = true;
                setScrollEnabled(false);
                setTabsFloating(true);
                snapOffset.setValue(offsetY);
                snapAnimation.current = Animated.timing(snapOffset, {
                  toValue: targetY,
                  duration: 260,
                  easing: Easing.inOut(Easing.cubic),
                  useNativeDriver: false,
                });
                snapAnimation.current.start(({finished}) => {
                  if (!finished) {return;}
                  scrollViewRef.current?.scrollTo({y: targetY, animated: false});
                  snapAnimation.current = null;
                  snapStarted.current = false;
                  setScrollEnabled(true);
                });
              } else if (tabsFloating && !snapStarted.current && offsetY <= 4) {
                setTabsFloating(false);
              }
            },
          },
        )}
        bounces={false}
        scrollEnabled={scrollEnabled}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            SermonNotesStyles.sermonDetails,
            {paddingHorizontal: 22},
            {
              opacity: scrollY.interpolate({
                inputRange: [0, 90],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateY: scrollY.interpolate({
                    inputRange: [0, 90],
                    outputRange: [0, -18],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  scale: scrollY.interpolate({
                    inputRange: [0, 90],
                    outputRange: [1, 0.98],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}>
          <ThemedText weight="bold" style={SermonNotesStyles.sermonEyebrow}>
            {sessionNoteTypeLabel(sessionType).toUpperCase()}
          </ThemedText>
          {!!title && (
            <ThemedText weight="bold" style={SermonNotesStyles.sermonTitle}>
              {title}
            </ThemedText>
          )}
          {!!speaker && (
            <ThemedText weight="bold" style={SermonNotesStyles.sermonPastor}>
              {speaker}
            </ThemedText>
          )}
          {!!dateStr && (
            <ThemedText style={SermonNotesStyles.sermonDate}>{dateStr}</ThemedText>
          )}

          {hasAdditionalDetails && (
            <>
              <View style={SermonNotesStyles.divider} />
              <View style={SermonNotesStyles.detailGrid}>
                {!!series && (
                  <View style={SermonNotesStyles.detailItem}>
                    <ThemedText weight="bold" style={SermonNotesStyles.detailLabel}>
                      {sessionConfig.details[0].label.toUpperCase()}
                    </ThemedText>
                    <ThemedText weight="bold" style={SermonNotesStyles.detailValue}>
                      {series}
                    </ThemedText>
                  </View>
                )}
                {!!church && (
                  <View style={SermonNotesStyles.detailItem}>
                    <ThemedText weight="bold" style={SermonNotesStyles.detailLabel}>
                      {sessionConfig.details[2].label.toUpperCase()}
                    </ThemedText>
                    <ThemedText weight="bold" style={SermonNotesStyles.detailValue}>
                      {church}
                    </ThemedText>
                  </View>
                )}
                {sessionType !== 'sermon' && !!mainScripture && (
                  <View style={SermonNotesStyles.detailItem}>
                    <ThemedText weight="bold" style={SermonNotesStyles.detailLabel}>{sessionConfig.details[1].label.toUpperCase()}</ThemedText>
                    <ThemedText weight="bold" style={SermonNotesStyles.detailValue}>{mainScripture}</ThemedText>
                  </View>
                )}
              </View>
            </>
          )}

          {!!mainScriptureRefs.length && (
            <>
              <ThemedText
                weight="bold"
                style={[SermonNotesStyles.detailLabel, {marginTop: 8}]}>
                {mainScriptureRefs.length > 1 ? 'MAIN SCRIPTURES' : 'MAIN SCRIPTURE'}
              </ThemedText>
              {mainScriptureRefs.map((ref, index) => (
                <View key={ref + index} style={SermonNotesStyles.sermonQuote}>
                  <View style={SermonNotesStyles.sermonQuoteLine} />
                  <View style={SermonNotesStyles.sermonQuoteContent}>
                    <ThemedText style={SermonNotesStyles.sermonQuoteText}>
                      {mainScriptureTexts[index] || ref}
                    </ThemedText>
                    <View style={SermonNotesStyles.sermonQuoteReferenceRow}>
                      <ThemedText weight="bold" style={SermonNotesStyles.sermonQuoteReference}>
                        {ref.toUpperCase()} {bibleVersion}
                      </ThemedText>
                      <View style={SermonNotesStyles.scriptureActions}>
                        <TouchableOpacity onPress={() => {setScriptureReaderIndex(index); setScriptureReaderOpen(true);}} activeOpacity={0.7}>
                          <MaterialCommunityIcons name="script-text" size={16} color={Colors.sage} />
                        </TouchableOpacity>
                        <Ionicons name="paper-plane-outline" size={16} color={Colors.sage} style={{marginLeft: 10}} />
                        <Ionicons name="information-circle-outline" size={16} color={Colors.sage} style={{marginLeft: 10}} />
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {(hasAdditionalDetails || !!mainScriptureRefs.length) && (
            <View style={SermonNotesStyles.divider} />
          )}
        </Animated.View>

        <Animated.View
          pointerEvents={tabsFloating ? 'none' : 'auto'}
          style={{
            opacity: tabTransition.interpolate({inputRange: [0, 1], outputRange: [1, 0]}),
            transform: [
              {translateY: tabTransition.interpolate({inputRange: [0, 1], outputRange: [0, -8]})},
              {scale: tabTransition.interpolate({inputRange: [0, 1], outputRange: [1, 0.94]})},
            ],
          }}>
          {renderTabs()}
        </Animated.View>

        <View onLayout={({nativeEvent}) => setContentY(nativeEvent.layout.y)}>
        {activeTab === 'notes' && (
          <View style={[SermonNotesStyles.editor, {paddingHorizontal: 22, paddingTop: 20}]}>
            {hasNotes ? (
              <>
                <ThemedText weight="bold" style={SermonNotesStyles.sermonEyebrow}>
                  MY NOTES
                </ThemedText>
                {renderMovableBlocks(notesBlocks)}
              </>
            ) : (
              <ThemedText style={styles.emptyTab}>No notes saved.</ThemedText>
            )}
          </View>
        )}

        {activeTab === 'reflection' && (
          <View style={[SermonNotesStyles.editor, {paddingHorizontal: 22, paddingTop: 8}]}>
            {hasReflection ? (
              <>
                <ThemedText weight="bold" style={SermonNotesStyles.sermonEyebrow}>
                  YOUR REFLECTION
                </ThemedText>
                {reflectionQuestions.map((item, index) => (
                  <View key={item.key} style={styles.reflectionItem}>
                    <ThemedText weight="bold" style={styles.question}>
                      {item.question.toUpperCase()}
                    </ThemedText>
                    <ThemedText style={styles.answer}>{item.answer}</ThemedText>
                    {index < reflectionQuestions.length - 1 && <View style={SermonNotesStyles.divider} />}
                  </View>
                ))}
                {renderMovableBlocks(reflectionBlocks)}
              </>
            ) : (
              <ThemedText style={styles.emptyTab}>No reflection saved.</ThemedText>
            )}
          </View>
        )}

        {activeTab === 'prayer' && (
          <View style={[SermonNotesStyles.editor, {paddingHorizontal: 22, paddingTop: 20}]}>
            {hasPrayer ? (
              <>
                <ThemedText weight="bold" style={SermonNotesStyles.sermonEyebrow}>
                  PRAYER
                </ThemedText>
                {prayerQuestions.map((item, index) => (
                  <View key={item.key} style={styles.reflectionItem}>
                    <ThemedText weight="bold" style={styles.question}>
                      {item.question.toUpperCase()}
                    </ThemedText>
                    <ThemedText style={styles.answer}>{item.answer}</ThemedText>
                    {index < prayerQuestions.length - 1 && <View style={SermonNotesStyles.divider} />}
                  </View>
                ))}
                {renderMovableBlocks(prayerBlocks)}
              </>
            ) : (
              <ThemedText style={styles.emptyTab}>No prayer saved.</ThemedText>
            )}
          </View>
        )}
        </View>
      </Animated.ScrollView>

      <View style={[styles.topBar, {top: insets.top + 16}]}>
        <View style={styles.topBarSpacer} />
        <Animated.View
          pointerEvents={tabsFloating ? 'auto' : 'none'}
          style={[
            styles.compactTabs,
            {
              opacity: tabTransition,
              transform: [
                {translateY: tabTransition.interpolate({inputRange: [0, 1], outputRange: [10, 0]})},
                {scale: tabTransition.interpolate({inputRange: [0, 1], outputRange: [0.88, 1]})},
              ],
            },
          ]}>
          {(['notes', 'reflection', 'prayer'] as const).map(tab => {
            const active = activeTab === tab;
            const TabIcon = TAB_ICONS[tab];
            return (
              <TouchableOpacity
                key={tab}
                accessibilityRole="tab"
                accessibilityLabel={tab[0].toUpperCase() + tab.slice(1)}
                accessibilityState={{selected: active}}
                onPress={() => setActiveTab(tab)}
                style={[styles.compactTab, active && styles.compactTabActive]}
                activeOpacity={0.7}>
                <TabIcon
                  size={17}
                  color={active ? Colors.hopeWhite : Colors.sage}
                />
              </TouchableOpacity>
            );
          })}
        </Animated.View>
        <View style={styles.topBarActions}>
          <TouchableOpacity onPress={handleEdit} style={styles.cornerActionButton} activeOpacity={0.7} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}} accessibilityRole="button" accessibilityLabel="Edit sermon notes">
            <Pencil size={17} color={Colors.sage} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} style={styles.cornerActionButton} activeOpacity={0.7} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}} accessibilityRole="button" accessibilityLabel="Close sermon notes">
            <Ionicons name="close" size={17} color={Colors.sage} />
          </TouchableOpacity>
        </View>
      </View>

      <ScriptureReaderModal
        visible={scriptureReaderOpen}
        passages={mainScriptureRefs.map(r => ({reference: r}))}
        initialIndex={scriptureReaderIndex}
        version={bibleVersion}
        onClose={() => setScriptureReaderOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    color: Colors.textGray,
  },
  topBar: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topBarSpacer: {
    width: 94,
  },
  cornerActionButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 6,
  },
  compactTabs: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  compactTab: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.2)',
    backgroundColor: Colors.cardBackground,
  },
  compactTabActive: {
    borderColor: Colors.sage,
    backgroundColor: Colors.sage,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  pillActive: {
    backgroundColor: Colors.sageMuted,
    borderColor: Colors.sage,
  },
  pillText: {
    fontSize: 15,
    color: Colors.text,
  },
  pillTextActive: {
    color: Colors.hopeWhite,
  },
  emptyTab: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  reflectionItem: {
    marginBottom: 16,
  },
  question: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.textGray,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  answer: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 21,
  },
});

export default SermonNotesDetailScreen;
