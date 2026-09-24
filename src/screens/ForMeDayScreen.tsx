import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {Pencil} from 'lucide-react-native';
import ShareComposer from '../components/TruthToCarryShareComposer';
import NewSuccessModal from '../components/NewSuccessModal';
import {getForMeDayShareText, type ForMeDayShareData} from '../components/ForMeDayShareCard';
import ForMeDayFlipCard from '../components/ForMeDayFlipCard';
import {format} from 'date-fns';
import ThemedText from '../components/common/ThemedText';
import HeaderBackButton from '../components/common/HeaderBackButton';
import StepFadeIn from '../components/common/StepFadeIn';
import RoutineStepShell from '../components/routine/RoutineStepShell';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {gospelStorage, type ForMeDaySettings} from '../storage/gospelStorage';
import {createLocalReflection} from '../storage/reflectionStorage';
import {
  getForMeDayYears,
  scheduleForMeDayReminder,
} from '../services/forMeDayService';
import {syncForMeDayTestimonyMoment} from '../services/forMeDayTestimonyMomentService';
import {Logger} from '../utils/ProductionLogger';
import {
  triggerLightHaptic,
  triggerSelectionHaptic,
  triggerSuccessHaptic,
} from '../utils/haptics';
import {returnToMainTab} from '../navigation/returnToMainTab';
import {useSuccessModal} from '../hooks/useSuccessModal';
import {formatForMeDayTestimonyDate} from '../utils/forMeDayTestimonyDate';
import {getNewLifeDayCopy} from '../utils/newLifeDayCopy';

const defaults = (): Omit<ForMeDaySettings, 'updatedAt'> => ({
  spiritualBirthday: format(new Date(), 'yyyy-MM-dd'),
  originalStory: '',
  reminderEnabled: true,
  reminderTime: '09:00',
  showInMoments: true,
  includeYearWhenSharing: true,
});

const settingsSignature = (
  value: Omit<ForMeDaySettings, 'updatedAt'>,
): string => JSON.stringify([
  value.spiritualBirthday,
  value.originalStory || '',
  value.reminderEnabled,
  value.reminderTime,
  value.showInMoments,
  value.includeYearWhenSharing,
]);

const ordinal = (value: number): string => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }
  return `${value}${
    value % 10 === 1
      ? 'st'
      : value % 10 === 2
      ? 'nd'
      : value % 10 === 3
      ? 'rd'
      : 'th'
  }`;
};

const ForMeDayScreen: React.FC<any> = ({navigation, route}) => {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<Omit<ForMeDaySettings, 'updatedAt'>>(
    defaults(),
  );
  const [savedSettingsSignature, setSavedSettingsSignature] = useState<string | null>(null);
  const [hasSavedDate, setHasSavedDate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(route?.params?.mode === 'settings');
  const [showPicker, setShowPicker] = useState(false);
  const [pendingBirthdayDate, setPendingBirthdayDate] = useState(new Date());
  const [reflection, setReflection] = useState('');
  const [showReflection, setShowReflection] = useState(false);
  const [testimonyDraft, setTestimonyDraft] = useState('');
  const [showTestimonyEditor, setShowTestimonyEditor] = useState(false);
  const [savingTestimony, setSavingTestimony] = useState(false);
  const [shareComposerOpen, setShareComposerOpen] = useState(false);
  const [sharePreviewWidth, setSharePreviewWidth] = useState(Dimensions.get('window').width - 44);
  const saveSuccessModal = useSuccessModal();

  useEffect(() => {
    gospelStorage.getForMeDaySettings().then(async value => {
      const loadedSettings = value || defaults();
      if (value?.originalStory?.trim()) {
        try {
          await syncForMeDayTestimonyMoment(value);
        } catch (error) {
          Logger.warn('Failed to backfill For Me Day testimony Moment', {
            component: 'ForMeDayScreen',
            error: error as Error,
          });
        }
      }
      setSettings(loadedSettings);
      setHasSavedDate(Boolean(value?.spiritualBirthday));
      setTestimonyDraft(loadedSettings.originalStory || '');
      setSavedSettingsSignature(settingsSignature(loadedSettings));
      if (!value) {
        setEditing(true);
      }
      setLoaded(true);
    });
  }, []);

  const birthdayDate = new Date(`${settings.spiritualBirthday}T12:00:00`);
  const years = getForMeDayYears(settings.spiritualBirthday);
  const isFirstDay = settings.spiritualBirthday === format(new Date(), 'yyyy-MM-dd');
  const newLifeDayCopy = getNewLifeDayCopy(hasSavedDate);
  const hasUnsavedChanges = !hasSavedDate || (savedSettingsSignature !== null
    && settingsSignature(settings) !== savedSettingsSignature);
  const closeForMeDay = useCallback(() => {
    triggerLightHaptic();
    if (
      route?.params?.returnTo === 'More' ||
      route?.params?.mode === 'settings'
    ) {
      returnToMainTab(navigation, 'More');
      return;
    }
    navigation.goBack();
  }, [navigation, route?.params?.mode, route?.params?.returnTo]);

  const saveSettings = useCallback(async () => {
    triggerLightHaptic();
    const saved = await gospelStorage.saveForMeDaySettings(settings);
    if (saved.originalStory?.trim()) {
      await syncForMeDayTestimonyMoment(saved);
    }
    await scheduleForMeDayReminder(saved);
    setSettings(saved);
    setHasSavedDate(true);
    setSavedSettingsSignature(settingsSignature(saved));
    setEditing(false);
    triggerSuccessHaptic();
  }, [settings]);

  const saveReflection = useCallback(async () => {
    triggerLightHaptic();
    const text = reflection.trim();
    if (!text) {
      Alert.alert(
        'Write a reflection',
        'Add a few words you want to remember.',
      );
      return;
    }
    const writtenAt = new Date();
    await createLocalReflection({
      title: years ? `My ${ordinal(years)} New Life Day` : 'My New Life Day',
      content: text,
      type: 'gospel_anniversary',
      source: 'for_me_day',
      selected_date: format(writtenAt, 'yyyy-MM-dd'),
      metadata: {
        journalClassification: 'milestone',
        forMeDayEntry: 'annual_reflection',
        anniversaryNumber: years,
        reflectionYear: writtenAt.getFullYear(),
        writtenAt: writtenAt.toISOString(),
        spiritualBirthday: settings.spiritualBirthday,
      },
    });
    DeviceEventEmitter.emit('reflection_saved', {source: 'for_me_day'});
    setReflection('');
    setShowReflection(false);
    saveSuccessModal.showSuccess({
      title: 'Reflection Saved',
      message: 'Your reflection has been saved to your journal.',
    });
  }, [reflection, saveSuccessModal, settings.spiritualBirthday, years]);

  const saveTestimony = useCallback(async () => {
    if (savingTestimony) {
      return;
    }
    triggerLightHaptic();
    const testimony = testimonyDraft.trim();
    if (!testimony) {
      Alert.alert(
        'Write your testimony',
        'Add a few words about how Jesus met you.',
      );
      return;
    }
    const wasWritten = Boolean(settings.originalStory?.trim());
    setSavingTestimony(true);
    try {
      const persisted = await gospelStorage.getForMeDaySettings();
      const baseSettings = persisted || settings;
      const saved = await gospelStorage.saveForMeDaySettings({
        ...baseSettings,
        originalStory: testimony,
      });
      await syncForMeDayTestimonyMoment(saved);
      setSettings(current => ({
        ...current,
        originalStory: saved.originalStory,
        testimonyWrittenAt: saved.testimonyWrittenAt,
        testimonyUpdatedAt: saved.testimonyUpdatedAt,
      }));
      setSavedSettingsSignature(settingsSignature(saved));
      setTestimonyDraft(saved.originalStory || '');
      setShowTestimonyEditor(false);
      saveSuccessModal.showSuccess({
        title: wasWritten ? 'Testimony Updated' : 'Testimony Saved',
        message: 'Your testimony has been saved to your journal.',
      });
    } catch (error) {
      Logger.error('Failed to save For Me Day testimony', error as Error, {
        component: 'ForMeDayScreen',
      });
      Alert.alert(
        'Couldn’t save testimony',
        'Please try again in a moment.',
      );
    } finally {
      setSavingTestimony(false);
    }
  }, [saveSuccessModal, savingTestimony, settings, testimonyDraft]);

  const milestone: ForMeDayShareData = {
    title: isFirstDay ? 'Today, I begin\nmy life with Jesus.' : 'My life with Jesus\nbegan here.',
    occasion: isFirstDay
      ? 'A NEW BEGINNING'
      : settings.includeYearWhenSharing && years
        ? `${years} ${years === 1 ? 'YEAR' : 'YEARS'} OF FOLLOWING JESUS`
        : 'A BEGINNING WORTH CELEBRATING',
    date: format(birthdayDate, 'MMMM d, yyyy'),
  };
  const testimonyText = settings.originalStory?.trim() ||
    'This is the day you accepted Jesus as your Lord and Savior and committed your life to following Him.';
  const hasTestimony = Boolean(settings.originalStory?.trim());
  const testimonySavedLabel = settings.testimonyUpdatedAt
    ? formatForMeDayTestimonyDate(settings.testimonyUpdatedAt, true)
    : formatForMeDayTestimonyDate(settings.testimonyWrittenAt);
  const testimonyHasChanges = Boolean(testimonyDraft.trim()) &&
    testimonyDraft.trim() !== (settings.originalStory?.trim() || '');
  if (!loaded) {
    return <View style={styles.loading} />;
  }

  if (showTestimonyEditor) {
    return (
      <RoutineStepShell
        step={1}
        totalSteps={1}
        eyebrow="YOUR TESTIMONY"
        eyebrowIcon={<Pencil size={16} color={Colors.sage} strokeWidth={1.8} />}
        title={hasTestimony
          ? 'How would you tell your testimony today?'
          : 'How did Jesus meet you and begin changing your story?'}
        titleBottomSpacing={8}
        backgroundColor={Colors.lightBackground}
        extraScrollBottomPadding={80}
        onBack={() => {
          setTestimonyDraft(settings.originalStory || '');
          setShowTestimonyEditor(false);
        }}
        footer={(
          <TouchableOpacity
            style={[
              styles.walkthroughSaveButton,
              (!testimonyHasChanges || savingTestimony) &&
                styles.walkthroughSaveButtonDisabled,
            ]}
            disabled={!testimonyHasChanges || savingTestimony}
            accessibilityRole="button"
            accessibilityLabel={hasTestimony
              ? 'Update your testimony'
              : 'Save your testimony'}
            activeOpacity={0.75}
            onPress={saveTestimony}>
            <Ionicons
              name="checkmark"
              size={25}
              color={Colors.hopeWhite}
            />
          </TouchableOpacity>
        )}>
        <StepFadeIn delay={120}>
          <ThemedText style={styles.walkthroughReflectionSubtitle}>
            Write what you want to remember about meeting Jesus and the life
            He is continuing to shape in you.
          </ThemedText>
        </StepFadeIn>
        <StepFadeIn delay={180}>
          <TextInput
            multiline
            autoFocus
            value={testimonyDraft}
            onChangeText={setTestimonyDraft}
            placeholder="Begin your testimony..."
            placeholderTextColor={Colors.textGray}
            keyboardAppearance="light"
            textAlignVertical="top"
            accessibilityLabel="Your testimony"
            style={styles.walkthroughReflectionInput}
          />
        </StepFadeIn>
      </RoutineStepShell>
    );
  }

  if (showReflection) {
    return (
      <RoutineStepShell
        step={1}
        totalSteps={1}
        eyebrow="MY NEW LIFE DAY"
        eyebrowIcon={<Pencil size={16} color={Colors.sage} strokeWidth={1.8} />}
        title={isFirstDay
          ? 'What is on your heart as you begin following Jesus today?'
          : 'How is Jesus leading you as you continue to follow Him?'}
        titleBottomSpacing={8}
        backgroundColor={Colors.lightBackground}
        onBack={() => setShowReflection(false)}
        footer={(
          <TouchableOpacity
            style={[
              styles.walkthroughSaveButton,
              !reflection.trim() && styles.walkthroughSaveButtonDisabled,
            ]}
            disabled={!reflection.trim()}
            accessibilityRole="button"
            accessibilityLabel="Save My New Life Day reflection"
            activeOpacity={0.75}
            onPress={saveReflection}>
            <Ionicons
              name="checkmark"
              size={25}
              color={Colors.hopeWhite}
            />
          </TouchableOpacity>
        )}>
        <StepFadeIn delay={120}>
          <ThemedText style={styles.walkthroughReflectionSubtitle}>
            Write what you want to remember from this year with Jesus.
          </ThemedText>
        </StepFadeIn>
        <StepFadeIn delay={180}>
          <TextInput
            multiline
            autoFocus
            value={reflection}
            onChangeText={setReflection}
            placeholder="Write what is on your heart..."
            placeholderTextColor={Colors.textGray}
            keyboardAppearance="light"
            textAlignVertical="top"
            accessibilityLabel="My New Life Day reflection"
            style={styles.walkthroughReflectionInput}
          />
        </StepFadeIn>
      </RoutineStepShell>
    );
  }

  const preferences: Array<{
    icon: string;
    title: string;
    subtitle: string;
    key: 'reminderEnabled' | 'showInMoments' | 'includeYearWhenSharing';
  }> = [
    {
      icon: 'notifications-outline',
      title: 'Annual reminder',
      subtitle: 'A gentle reminder every year',
      key: 'reminderEnabled',
    },
    {
      icon: 'journal-outline',
      title: 'Save reflections',
      subtitle: 'Keep each year in Moments',
      key: 'showInMoments',
    },
    {
      icon: 'share-social-outline',
      title: 'Show anniversary count',
      subtitle: 'Include the number of years when sharing',
      key: 'includeYearWhenSharing',
    },
  ];

  return (
    <View style={styles.safe}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />
      <View
        pointerEvents="box-none"
        style={[
          styles.floatingControls,
          {
            top: insets.top + 8,
            paddingLeft: Math.max(22, insets.left + 12),
            paddingRight: Math.max(22, insets.right + 12),
          },
        ]}>
        <HeaderBackButton
          onPress={closeForMeDay}
        />
        {!editing || hasUnsavedChanges ? (
          <TouchableOpacity
            style={[styles.headerButton, editing && styles.saveHeaderButton]}
            onPress={editing ? saveSettings : () => {
              triggerLightHaptic();
              setEditing(true);
            }}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Save settings' : `Edit ${newLifeDayCopy.title}`}>
            {editing ? (
              <ThemedText weight="semiBold" style={styles.saveHeaderText}>
                Save
              </ThemedText>
            ) : (
              <Ionicons name="settings-outline" size={19} color={Colors.sage} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 74,
              paddingBottom: insets.bottom + 140,
            },
          ]}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {editing ? (
            <>
              <View style={styles.settingsHero}>
                <View style={styles.settingsHeroTop}>
                  <View style={styles.settingsHeroIcon}>
                    <Ionicons name="gift-outline" size={20} color={Colors.faithGold} />
                  </View>
                  <ThemedText style={styles.settingsHeroEyebrow}>
                    {newLifeDayCopy.title.toUpperCase()}
                  </ThemedText>
                </View>
                <ThemedText style={styles.settingsHeroTitle}>
                  {newLifeDayCopy.subtitle}
                </ThemedText>
                <ThemedText style={styles.settingsHeroBody}>
                  {hasSavedDate
                    ? 'The day you accepted Jesus as your Lord and Savior and committed your life to following Him.'
                    : 'When you choose to follow Jesus, you can save the date here and remember it each year.'}
                </ThemedText>
              </View>

              <ThemedText style={styles.sectionLabel}>THE DATE</ThemedText>
              <TouchableOpacity
                style={styles.dateCard}
                onPress={() => {
                  triggerLightHaptic();
                  setPendingBirthdayDate(birthdayDate);
                  setShowPicker(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${newLifeDayCopy.title}, ${format(birthdayDate, 'MMMM d, yyyy')}`}>
                <View style={styles.dateIcon}>
                  <Ionicons name="calendar-outline" size={21} color={Colors.sage} />
                </View>
                <View style={styles.dateCopy}>
                  <ThemedText style={styles.dateMonth}>{format(birthdayDate, 'MMMM d')}</ThemedText>
                  <ThemedText style={styles.dateYear}>{format(birthdayDate, 'yyyy')}</ThemedText>
                </View>
                <ThemedText style={styles.changeText}>Change</ThemedText>
              </TouchableOpacity>
              {showPicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={pendingBirthdayDate}
                  minimumDate={new Date(1900, 0, 1)}
                  maximumDate={new Date()}
                  mode="date"
                  display="spinner"
                  onChange={(event, value) => {
                    setShowPicker(false);
                    if (event.type === 'set' && value) {
                      triggerSuccessHaptic();
                      setSettings(current => ({
                        ...current,
                        spiritualBirthday: format(value, 'yyyy-MM-dd'),
                      }));
                    }
                  }}
                />
              )}
              {showPicker && Platform.OS !== 'android' && (
                <View style={styles.datePickerCard}>
                  <DateTimePicker
                    value={pendingBirthdayDate}
                    minimumDate={new Date(1900, 0, 1)}
                    maximumDate={new Date()}
                    mode="date"
                    display="spinner"
                    textColor={Colors.text}
                    themeVariant="light"
                    style={styles.datePicker}
                    onChange={(_event, value) => {
                      if (value) {
                        triggerSelectionHaptic();
                        setPendingBirthdayDate(value);
                      }
                    }}
                  />
                  <View style={styles.datePickerActions}>
                    <TouchableOpacity
                      style={styles.datePickerCancel}
                      onPress={() => {
                        triggerLightHaptic();
                        setShowPicker(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel date change">
                      <ThemedText weight="semiBold" style={styles.datePickerCancelText}>
                        Cancel
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.datePickerDone}
                      onPress={() => {
                        triggerSuccessHaptic();
                        setSettings(current => ({
                          ...current,
                          spiritualBirthday: format(pendingBirthdayDate, 'yyyy-MM-dd'),
                        }));
                        setShowPicker(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Confirm date change">
                      <ThemedText weight="semiBold" style={styles.datePickerDoneText}>
                        Done
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {hasSavedDate ? (
                <>
                  <ThemedText style={styles.sectionLabel}>YOUR TESTIMONY</ThemedText>
                  <TouchableOpacity
                    style={styles.dateCard}
                    onPress={() => {
                      triggerLightHaptic();
                      setTestimonyDraft(settings.originalStory || '');
                      setShowTestimonyEditor(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={hasTestimony
                      ? 'Update your testimony'
                      : 'Write your testimony'}>
                    <View style={styles.dateIcon}>
                      <Pencil size={19} color={Colors.sage} strokeWidth={1.8} />
                    </View>
                    <View style={styles.dateCopy}>
                      <ThemedText style={styles.dateMonth}>
                        {hasTestimony ? 'Your testimony' : 'Write your testimony'}
                      </ThemedText>
                      <ThemedText style={styles.dateYear}>
                        {testimonySavedLabel ||
                          'Remember how Jesus met you and changed your story'}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.changeText}>
                      {hasTestimony ? 'Update' : 'Write'}
                    </ThemedText>
                  </TouchableOpacity>
                </>
              ) : null}
              <ThemedText style={styles.sectionLabel}>PREFERENCES</ThemedText>
              <View style={styles.preferencesCard}>
                {preferences.map((item, index) => (
                  <View
                    style={[
                      styles.toggleRow,
                      index < preferences.length - 1 && styles.toggleDivider,
                    ]}
                    key={item.key}>
                    <View style={styles.preferenceIcon}>
                      <Ionicons name={item.icon as any} size={18} color={Colors.sage} />
                    </View>
                    <View style={styles.toggleCopy}>
                      <ThemedText style={styles.toggleTitle}>{item.title}</ThemedText>
                      <ThemedText style={styles.toggleSubtitle}>{item.subtitle}</ThemedText>
                    </View>
                    <Switch
                      value={Boolean(settings[item.key])}
                      onValueChange={value => {
                        triggerSelectionHaptic();
                        setSettings(current => ({...current, [item.key]: value}));
                      }}
                      trackColor={{false: Colors.lightGray, true: Colors.sageMuted}}
                      thumbColor={Colors.hopeWhite}
                    />
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              <ThemedText style={styles.eyebrow}>YOUR SPIRITUAL BIRTHDAY</ThemedText>
              <ThemedText weight="bold" style={styles.pageTitle}>
                {isFirstDay
                  ? 'Today, you committed your life to Jesus.'
                  : 'Remember the day you committed your life to Jesus.'}
              </ThemedText>
              <ThemedText style={styles.pageIntro}>
                {isFirstDay
                  ? 'Celebrate this beginning. You have accepted Him as Lord and Savior and begun following Him.'
                  : 'Celebrate the day you accepted Him as Lord and Savior and began following Him.'}
              </ThemedText>
              <View
                style={styles.milestonePreview}
                onLayout={event => setSharePreviewWidth(event.nativeEvent.layout.width)}>
                <ForMeDayFlipCard
                  data={milestone}
                  testimony={testimonyText}
                  writtenAt={settings.testimonyWrittenAt}
                  width={sharePreviewWidth}
                />
              </View>
              {settings.showInMoments ? (
                <TouchableOpacity
                  style={styles.primary}
                  onPress={() => {
                    triggerLightHaptic();
                    setShowReflection(true);
                  }}>
                  <Pencil
                    size={18}
                    color={Colors.hopeWhite}
                    strokeWidth={1.8}
                  />
                  <ThemedText style={styles.primaryText}>
                    {isFirstDay ? 'Write about today' : 'Write this year’s reflection'}
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
              {!hasTestimony ? (
                <TouchableOpacity
                  style={styles.secondary}
                  onPress={() => {
                    triggerLightHaptic();
                    setTestimonyDraft('');
                    setShowTestimonyEditor(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Write my testimony">
                  <Pencil size={18} color={Colors.sage} strokeWidth={1.8} />
                  <ThemedText style={styles.secondaryText}>
                    Write my testimony
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.secondary}
                onPress={() => { triggerLightHaptic(); setShareComposerOpen(true); }}>
                <Ionicons
                  name="paper-plane-outline"
                  size={18}
                  color={Colors.sage}
                />
                <ThemedText style={styles.secondaryText}>
                  Share this milestone
                </ThemedText>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {shareComposerOpen && <ShareComposer
        visible
        variant="for-me-day"
        milestone={milestone}
        text={getForMeDayShareText(milestone)}
        onClose={() => setShareComposerOpen(false)}
      />}
      <NewSuccessModal
        visible={saveSuccessModal.isVisible}
        config={saveSuccessModal.config}
        onDone={saveSuccessModal.handleDone}
        onEdit={saveSuccessModal.handleEdit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: Colors.lightBackground},
  flex: {flex: 1},
  scrollView: {flex: 1},
  loading: {flex: 1, backgroundColor: Colors.lightBackground},
  floatingControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.hopeWhite,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.modalBlue,
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  saveHeaderButton: {
    width: 68,
    paddingHorizontal: 16,
  },
  saveHeaderText: {
    fontSize: 14,
    color: Colors.sage,
  },
  content: {
    paddingHorizontal: 22,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  settingsHero: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 24,
    padding: 24,
    marginBottom: 2,
  },
  settingsHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  settingsHeroIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,254,250,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsHeroEyebrow: {
    color: Colors.faithGold,
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 1.8,
  },
  settingsHeroTitle: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
    fontSize: 28,
    lineHeight: 35,
  },
  settingsHeroBody: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.84,
    marginTop: 10,
  },
  eyebrow: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 2.1,
    color: Colors.sage,
    marginBottom: 10,
  },
  pageTitle: {
    maxWidth: 520,
    fontFamily: Fonts.bold,
    fontSize: 35,
    lineHeight: 43,
    letterSpacing: -0.7,
    color: Colors.text,
  },
  pageIntro: {
    maxWidth: 560,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textGray,
    marginTop: 10,
    marginBottom: 28,
  },
  sectionLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: Colors.textGray,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 2,
  },
  dateCard: {
    minHeight: 72,
    borderRadius: 24,
    backgroundColor: Colors.hopeWhite,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.modalBlue,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
  dateIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: Colors.anchorBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCopy: {flex: 1, marginLeft: 14},
  dateMonth: {fontFamily: Fonts.medium, fontSize: 15, color: Colors.text},
  dateYear: {fontFamily: Fonts.regular, fontSize: 11, color: Colors.textGray, marginTop: 2},
  changeText: {fontFamily: Fonts.medium, fontSize: 12, color: Colors.sage},
  datePickerCard: {
    marginTop: 12,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 14,
    backgroundColor: Colors.cardBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  datePicker: {
    width: '100%',
    height: 216,
    alignSelf: 'center',
  },
  datePickerActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
  },
  datePickerCancel: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.anchorBlueLight,
  },
  datePickerDone: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
  },
  datePickerCancelText: {fontSize: 13, color: Colors.sage},
  datePickerDoneText: {fontSize: 13, color: Colors.hopeWhite},
  preferencesCard: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: Colors.modalBlue,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 74,
    paddingHorizontal: 17,
  },
  toggleDivider: {borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder},
  preferenceIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.anchorBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toggleCopy: {flex: 1, paddingRight: 8},
  toggleTitle: {fontFamily: Fonts.regular, fontSize: 15, color: Colors.text},
  toggleSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 3,
  },
  primary: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 18,
  },
  primaryText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  secondary: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  secondaryText: {fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.sage},
  milestonePreview: {width: '100%'},
  walkthroughReflectionSubtitle: {
    maxWidth: 520,
    alignSelf: 'center',
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 28,
  },
  walkthroughReflectionInput: {
    minHeight: 220,
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontFamily: Fonts.regular,
    fontSize: 18,
    lineHeight: 28,
    color: Colors.text,
    backgroundColor: 'transparent',
  },
  walkthroughSaveButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sage,
    shadowColor: Colors.sage,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  walkthroughSaveButtonDisabled: {opacity: 0.35},
});
export default ForMeDayScreen;
