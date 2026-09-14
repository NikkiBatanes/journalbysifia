import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil, Trash2, X } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import ThemedText from '../components/common/ThemedText';
import { deleteLocalReflection, getLocalReflection } from '../storage/reflectionStorage';
import { safeJsonParse } from '../utils/safeJsonParse';
import { triggerLightHaptic } from '../utils/haptics';
import { getScripturePassage } from '../services/scriptureReaderService';
import { formatBibleVerse } from '../utils/textFormatting';
import { useNetworkStore } from '../services/network/networkManager';
import { useAuth } from '../context/IndustryStandardAuthContext';
import ScriptureReaderModal from '../components/ScriptureReaderModal';
import { BLOCKS, BlockIcon, SermonNotesStyles } from './SermonNotesScreen';

type NoteBlock = {
  id: string;
  kind: string;
  text: string;
  secondary?: string;
  note?: string;
  reference?: string;
  scriptureText?: string;
  scriptureReference?: string;
  points?: string[];
  outlineStyle?: 'numbered' | 'acronym' | 'simple';
  historyTypes?: string[];
  eraPeriod?: 'BC' | 'AD';
  languageKind?: string;
  languageDetails?: string[];
  meaning?: string;
  origin?: string;
  tableRows?: string[][];
};

const TAB_ICONS = {
  notes: 'book-outline',
  reflection: 'chatbubbles-outline',
  prayer: 'leaf-outline',
} as const;

const SermonNotesDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const isOnline = useNetworkStore(state => state.isOnline);
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

  const dateStr = useMemo(() => {
    const raw = entry?.selected_date || selectedDate;
    if (!raw) {return '';}
    const [year, month, day] = String(raw).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return format(date, 'MMMM d, yyyy').toUpperCase();
  }, [entry, selectedDate]);

  const title = useMemo(() => entry?.title?.trim() || 'Sermon Notes', [entry]);
  const speaker = useMemo(() => metadata.speaker?.trim() || '', [metadata]);
  const series = useMemo(() => metadata.series?.trim() || '', [metadata]);
  const church = useMemo(() => metadata.church?.trim() || '', [metadata]);
  const mainScripture: string = useMemo(() => metadata.main_scripture?.trim() || '', [metadata]);
  const mainScriptureRefs = useMemo(() => {
    return mainScripture
      .split(/[;\n]+/)
      .map((r: string) => r.trim())
      .filter(Boolean);
  }, [mainScripture]);

  useEffect(() => {
    if (mainScriptureRefs.length === 0) {
      setMainScriptureTexts([]);
      return;
    }
    if (!isOnline) {
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

  const hasAdditionalDetails = useMemo(() => series || church, [series, church]);

  const reflectionKinds = useMemo(() => ['question', 'reflection_question', 'remember', 'revisit', 'response'], []);
  const notesBlocks = useMemo(() => {
    return blocks.filter((b: NoteBlock) => b.text?.trim() && !reflectionKinds.includes(b.kind) && b.kind !== 'prayer');
  }, [blocks, reflectionKinds]);
  const reflectionBlocks = useMemo(() => {
    return blocks.filter((b: NoteBlock) => b.text?.trim() && reflectionKinds.includes(b.kind));
  }, [blocks, reflectionKinds]);
  const prayerBlocks = useMemo(() => {
    return blocks.filter((b: NoteBlock) => b.text?.trim() && b.kind === 'prayer');
  }, [blocks]);
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

  const normalizeLink = (text: string) => {
    if (!text) {return null;}
    let url = text.trim();
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
      url = `https://${url}`;
    }
    return url;
  };

  const renderNoteBlock = (block: NoteBlock) => {
    if (block.kind === 'text') {
      return (
        <ThemedText key={block.id} style={SermonNotesStyles.freeText}>
          {block.text}
        </ThemedText>
      );
    }
    if (block.kind === 'section') {
      return (
        <View key={block.id} style={SermonNotesStyles.sectionDivider}>
          <View style={SermonNotesStyles.sectionLine} />
          <ThemedText weight="bold" style={SermonNotesStyles.sectionDividerText}>
            {block.text}
          </ThemedText>
        </View>
      );
    }

    const config = (BLOCKS as any)[block.kind];
    const captureStyle = (SermonNotesStyles as any)[`${block.kind}Capture`] || {};

    const renderContent = () => {
      switch (block.kind) {
        case 'scripture':
          return (
            <View>
              <ThemedText style={SermonNotesStyles.captureInput}>{block.text}</ThemedText>
              {!!block.scriptureText && (
                <View style={SermonNotesStyles.scripturePreview}>
                  <ThemedText style={SermonNotesStyles.scripturePreviewText}>{block.scriptureText}</ThemedText>
                  {!!(block.scriptureReference || block.text) && (
                    <View style={SermonNotesStyles.scripturePreviewReferenceRow}>
                      <ThemedText style={SermonNotesStyles.scripturePreviewReference}>
                        {(block.scriptureReference || block.text).toUpperCase()} NASB
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        case 'outline':
          return (
            <>
              <ThemedText style={[SermonNotesStyles.captureInput, SermonNotesStyles.outlineTitleInput]}>
                {block.text}
              </ThemedText>
              {(block.points || []).map((point, index) => (
                <View key={`${block.id}-p-${index}`} style={SermonNotesStyles.outlinePointRow}>
                  <ThemedText weight="bold" style={SermonNotesStyles.outlineMarker}>
                    {block.outlineStyle === 'numbered'
                      ? `${index + 1}.`
                      : block.outlineStyle === 'acronym'
                      ? `${point.trim().charAt(0).toUpperCase() || '•'} —`
                      : '•'}
                  </ThemedText>
                  <ThemedText style={SermonNotesStyles.outlinePointInput}>{point}</ThemedText>
                </View>
              ))}
            </>
          );
        case 'table':
          return (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={SermonNotesStyles.savedTableHorizontalScroll}
              contentContainerStyle={SermonNotesStyles.savedTableGrid}>
              <View>
                {(block.tableRows || []).map((row, rowIndex) => (
                  <View key={rowIndex} style={SermonNotesStyles.savedTableRow}>
                    {row.map((cell, columnIndex) => (
                      <ThemedText
                        key={columnIndex}
                        weight={rowIndex === 0 ? 'bold' : 'regular'}
                        style={[
                          SermonNotesStyles.savedTableCell,
                          rowIndex === 0 && SermonNotesStyles.savedTableHeaderCell,
                        ]}>
                        {cell}
                      </ThemedText>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          );
        case 'history':
          return (
            <View>
              <ThemedText style={SermonNotesStyles.captureInput}>{block.text}</ThemedText>
              {!!block.historyTypes?.length && (
                <View style={[SermonNotesStyles.historyChoices, {marginTop: 10}]}>
                  {block.historyTypes.map(type => (
                    <View key={type} style={SermonNotesStyles.historyChoiceActive}>
                      <ThemedText style={SermonNotesStyles.historyChoiceTextActive}>
                        {type[0].toUpperCase() + type.slice(1)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
              {!!block.eraPeriod && (
                <ThemedText style={[SermonNotesStyles.secondaryInput, {marginTop: 10}]}>
                  {block.secondary} {block.eraPeriod}
                </ThemedText>
              )}
            </View>
          );
        case 'language':
          return (
            <View>
              {!!block.languageKind && (
                <View style={[SermonNotesStyles.languageKindChoices, {marginBottom: 10}]}>
                  <View style={SermonNotesStyles.languageKindChoiceActive}>
                    <ThemedText style={SermonNotesStyles.languageKindTextActive}>
                      {block.languageKind === 'hebrew'
                        ? 'א Hebrew'
                        : block.languageKind === 'greek'
                        ? 'α Greek'
                        : block.languageKind === 'aramaic'
                        ? '𐡀 Aramaic'
                        : 'L Latin'}
                    </ThemedText>
                  </View>
                </View>
              )}
              <ThemedText style={SermonNotesStyles.captureInput}>{block.text}</ThemedText>
              {!!block.languageDetails?.length && (
                <View style={[SermonNotesStyles.languageKindChoices, {marginTop: 10}]}>
                  {block.languageDetails.map(d => (
                    <View key={d} style={SermonNotesStyles.languageKindChoiceActive}>
                      <ThemedText style={SermonNotesStyles.languageKindTextActive}>
                        {d === 'origin' ? 'Word Origin' : d[0].toUpperCase() + d.slice(1)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
              {!!block.meaning && (
                <ThemedText style={SermonNotesStyles.secondaryInput}>Meaning: {block.meaning}</ThemedText>
              )}
              {!!block.origin && (
                <ThemedText style={SermonNotesStyles.secondaryInput}>Origin: {block.origin}</ThemedText>
              )}
            </View>
          );
        case 'link':
          const url = normalizeLink(block.text);
          return (
            <View>
              <ThemedText style={SermonNotesStyles.captureInput}>{block.text}</ThemedText>
              {url && (
                <TouchableOpacity
                  onPress={() => {
                    Linking.openURL(url).catch(() =>
                      Alert.alert('Could not open link', 'Please check the address.'),
                    );
                  }}
                  style={SermonNotesStyles.openLink}>
                  <Ionicons name="open-outline" size={15} color={Colors.sage} />
                  <ThemedText weight="bold" style={SermonNotesStyles.openLinkText}>
                    Open link
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          );
        case 'character':
          return (
            <View>
              <ThemedText style={SermonNotesStyles.characterName}>{block.text}</ThemedText>
              {!!block.note && (
                <ThemedText style={SermonNotesStyles.characterReflection}>{block.note}</ThemedText>
              )}
              {!!(block.secondary || block.reference) && (
                <ThemedText style={[SermonNotesStyles.secondaryInput, SermonNotesStyles.characterScripture]}>
                  {block.secondary || block.reference}
                </ThemedText>
              )}
            </View>
          );
        case 'reflection_question':
          return (
            <View>
              <ThemedText style={SermonNotesStyles.captureInput}>{block.text}</ThemedText>
              {!!block.note && (
                <>
                  <ThemedText
                    weight="bold"
                    style={[SermonNotesStyles.detailLabel, {marginTop: 12}]}>
                    ANSWER
                  </ThemedText>
                  <ThemedText style={SermonNotesStyles.captureInput}>{block.note}</ThemedText>
                </>
              )}
            </View>
          );
        default:
          return (
            <View>
              <ThemedText
                style={[
                  SermonNotesStyles.captureInput,
                  (block.kind === 'quote' || block.kind === 'prayer') && SermonNotesStyles.serifInput,
                  block.kind === 'character' && SermonNotesStyles.characterName,
                ]}>
                {block.text}
              </ThemedText>
              {!!block.secondary && (['quote', 'song', 'book'].includes(block.kind)) && (
                <ThemedText style={SermonNotesStyles.secondaryInput}>{block.secondary}</ThemedText>
              )}
            </View>
          );
      }
    };

    return (
      <View
        key={block.id}
        style={[SermonNotesStyles.capture, captureStyle]}>
        {config && (
          <View style={SermonNotesStyles.captureHeader}>
            <View style={SermonNotesStyles.captureLabelRow}>
              <BlockIcon config={config} size={14} color={Colors.sage} />
              <ThemedText weight="bold" style={SermonNotesStyles.captureLabel}>
                {config.label}
              </ThemedText>
            </View>
          </View>
        )}
        {renderContent()}
      </View>
    );
  };

  const handleDelete = () => {
    triggerLightHaptic();
    Alert.alert(
      'Delete sermon note?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (reflectionId) {
                await deleteLocalReflection(reflectionId, 'sermon', selectedDate);
              }
              navigation.goBack();
            } catch (error) {
              console.warn('Error deleting sermon note:', error);
            }
          },
        },
      ],
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
      params.initialReflectionStep = 2;
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
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.pill, active && styles.pillActive]}
            activeOpacity={0.7}>
            <Ionicons
              name={TAB_ICONS[tab]}
              size={17}
              color={active ? Colors.hopeWhite : Colors.sage}
            />
            <ThemedText
              weight="medium"
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
          {!!dateStr && (
            <ThemedText style={SermonNotesStyles.sermonDate}>{dateStr}</ThemedText>
          )}
          <ThemedText weight="bold" style={SermonNotesStyles.sermonEyebrow}>
            SERMON NOTES
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

          {hasAdditionalDetails && (
            <>
              <View style={SermonNotesStyles.divider} />
              <View style={SermonNotesStyles.detailGrid}>
                {!!series && (
                  <View style={SermonNotesStyles.detailItem}>
                    <ThemedText weight="bold" style={SermonNotesStyles.detailLabel}>
                      SERIES
                    </ThemedText>
                    <ThemedText weight="bold" style={SermonNotesStyles.detailValue}>
                      {series}
                    </ThemedText>
                  </View>
                )}
                {!!church && (
                  <View style={SermonNotesStyles.detailItem}>
                    <ThemedText weight="bold" style={SermonNotesStyles.detailLabel}>
                      CHURCH / EVENT
                    </ThemedText>
                    <ThemedText weight="bold" style={SermonNotesStyles.detailValue}>
                      {church}
                    </ThemedText>
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
                {notesBlocks.map(renderNoteBlock)}
              </>
            ) : (
              <ThemedText style={styles.emptyTab}>No notes saved.</ThemedText>
            )}
          </View>
        )}

        {activeTab === 'reflection' && (
          <View style={[SermonNotesStyles.editor, {paddingHorizontal: 22, paddingTop: 20}]}>
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
                {reflectionBlocks.map(renderNoteBlock)}
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
                {prayerBlocks.map(renderNoteBlock)}
              </>
            ) : (
              <ThemedText style={styles.emptyTab}>No prayer saved.</ThemedText>
            )}
          </View>
        )}
        </View>
      </Animated.ScrollView>

      <View style={[styles.topBar, {top: insets.top + 16}]}>
        <TouchableOpacity onPress={handleDelete} style={SermonNotesStyles.floatingBackButton} activeOpacity={0.7}>
          <Trash2 size={18} color={Colors.textGray} />
        </TouchableOpacity>
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
            return (
              <TouchableOpacity
                key={tab}
                accessibilityRole="tab"
                accessibilityLabel={tab[0].toUpperCase() + tab.slice(1)}
                accessibilityState={{selected: active}}
                onPress={() => setActiveTab(tab)}
                style={[styles.compactTab, active && styles.compactTabActive]}
                activeOpacity={0.7}>
                <Ionicons
                  name={TAB_ICONS[tab]}
                  size={17}
                  color={active ? Colors.hopeWhite : Colors.sage}
                />
              </TouchableOpacity>
            );
          })}
        </Animated.View>
        <View style={styles.topBarActions}>
          <TouchableOpacity onPress={handleEdit} style={SermonNotesStyles.floatingBackButton} activeOpacity={0.7}>
            <Pencil size={20} color={Colors.sage} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} style={SermonNotesStyles.floatingBackButton} activeOpacity={0.7}>
            <X size={20} color={Colors.sage} />
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
  pills: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 6,
  },
  compactTabs: {
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingVertical: 11,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(82, 106, 91, 0.2)',
  },
  pillActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  pillText: {
    fontSize: 13,
    color: Colors.sage,
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
