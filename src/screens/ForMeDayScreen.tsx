import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {Pencil} from 'lucide-react-native';
import ShareComposer from '../components/TruthToCarryShareComposer';
import ForMeDayShareCard, {getForMeDayShareText, type ForMeDayShareData} from '../components/ForMeDayShareCard';
import {format} from 'date-fns';
import ThemedText from '../components/common/ThemedText';
import HeaderBackButton from '../components/common/HeaderBackButton';
import {Colors} from '../theme/colors';
import {Fonts} from '../theme/fonts';
import {gospelStorage, type ForMeDaySettings} from '../storage/gospelStorage';
import {createLocalReflection} from '../storage/reflectionStorage';
import {
  getForMeDayYears,
  scheduleForMeDayReminder,
} from '../services/forMeDayService';
import {triggerLightHaptic, triggerSuccessHaptic} from '../utils/haptics';

const defaults = (): Omit<ForMeDaySettings, 'updatedAt'> => ({
  spiritualBirthday: format(new Date(), 'yyyy-MM-dd'),
  originalStory: '',
  reminderEnabled: true,
  reminderTime: '09:00',
  showInMoments: true,
  includeYearWhenSharing: true,
});

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
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(route?.params?.mode === 'settings');
  const [showPicker, setShowPicker] = useState(false);
  const [reflection, setReflection] = useState('');
  const [showReflection, setShowReflection] = useState(false);
  const [shareComposerOpen, setShareComposerOpen] = useState(false);
  const [sharePreviewWidth, setSharePreviewWidth] = useState(Dimensions.get('window').width - 44);

  useEffect(() => {
    gospelStorage.getForMeDaySettings().then(value => {
      if (value) {
        setSettings(value);
      } else {
        setEditing(true);
      }
      setLoaded(true);
    });
  }, []);

  const birthdayDate = new Date(`${settings.spiritualBirthday}T12:00:00`);
  const years = getForMeDayYears(settings.spiritualBirthday);
  const isFirstDay = settings.spiritualBirthday === format(new Date(), 'yyyy-MM-dd');

  const saveSettings = useCallback(async () => {
    const saved = await gospelStorage.saveForMeDaySettings(settings);
    await scheduleForMeDayReminder(saved);
    setSettings(saved);
    setEditing(false);
    triggerSuccessHaptic();
  }, [settings]);

  const saveReflection = useCallback(async () => {
    const text = reflection.trim();
    if (!text) {
      Alert.alert(
        'Write a reflection',
        'Add a few words you want to remember.',
      );
      return;
    }
    await createLocalReflection({
      title: years ? `My ${ordinal(years)} For Me Day` : 'My For Me Day',
      content: text,
      type: 'gospel_anniversary',
      source: 'for_me_day',
      selected_date: format(new Date(), 'yyyy-MM-dd'),
      metadata: {
        journalClassification: 'milestone',
        anniversaryNumber: years,
        spiritualBirthday: settings.spiritualBirthday,
      },
    });
    DeviceEventEmitter.emit('reflection_saved', {source: 'for_me_day'});
    setReflection('');
    setShowReflection(false);
    triggerSuccessHaptic();
    Alert.alert(
      'Saved to Moments',
      'Your For Me Day reflection is now part of your story.',
    );
  }, [reflection, settings.spiritualBirthday, years]);

  const milestone: ForMeDayShareData = {
    title: isFirstDay ? 'Today, I begin\nmy life with Jesus.' : 'My life with Jesus\nbegan here.',
    occasion: isFirstDay
      ? 'A NEW BEGINNING'
      : settings.includeYearWhenSharing && years
        ? `${years} ${years === 1 ? 'YEAR' : 'YEARS'} OF FOLLOWING JESUS`
        : 'A BEGINNING WORTH CELEBRATING',
    date: format(birthdayDate, 'MMMM d, yyyy'),
  };

  if (!loaded) {
    return <View style={styles.loading} />;
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
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <View style={[styles.header, {paddingTop: insets.top + 10}]}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
        />
        <ThemedText style={styles.headerTitle}>My For Me Day</ThemedText>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={editing ? saveSettings : () => setEditing(true)}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Save settings' : 'Edit For Me Day'}>
          {editing ? (
            <Ionicons name="checkmark" size={21} color={Colors.sage} />
          ) : (
            <Ionicons name="settings-outline" size={19} color={Colors.sage} />
          )}
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {editing ? (
            <>
              <View style={styles.settingsHero}>
                <View style={styles.settingsHeroTop}>
                  <View style={styles.settingsHeroIcon}>
                    <Ionicons name="gift-outline" size={20} color={Colors.faithGold} />
                  </View>
                  <ThemedText style={styles.settingsHeroEyebrow}>
                    MY FOR ME DAY
                  </ThemedText>
                </View>
                <ThemedText style={styles.settingsHeroTitle}>
                  Your spiritual birthday
                </ThemedText>
                <ThemedText style={styles.settingsHeroBody}>
                  The day you accepted Jesus as your Lord and Savior and committed your life to following Him.
                </ThemedText>
              </View>

              <ThemedText style={styles.sectionLabel}>THE DATE</ThemedText>
              <TouchableOpacity
                style={styles.dateCard}
                onPress={() => setShowPicker(true)}
                accessibilityRole="button"
                accessibilityLabel={`For Me Day, ${format(birthdayDate, 'MMMM d, yyyy')}`}>
                <View style={styles.dateIcon}>
                  <Ionicons name="calendar-outline" size={21} color={Colors.sage} />
                </View>
                <View style={styles.dateCopy}>
                  <ThemedText style={styles.dateMonth}>{format(birthdayDate, 'MMMM d')}</ThemedText>
                  <ThemedText style={styles.dateYear}>{format(birthdayDate, 'yyyy')}</ThemedText>
                </View>
                <ThemedText style={styles.changeText}>Change</ThemedText>
              </TouchableOpacity>
              {showPicker && (
                <DateTimePicker
                  value={birthdayDate}
                  maximumDate={new Date()}
                  mode="date"
                  onChange={(_, value) => {
                    if (Platform.OS !== 'ios') {
                      setShowPicker(false);
                    }
                    if (value) {
                      setSettings(current => ({
                        ...current,
                        spiritualBirthday: format(value, 'yyyy-MM-dd'),
                      }));
                    }
                  }}
                />
              )}
              <ThemedText style={styles.sectionLabel}>YOUR STORY · OPTIONAL</ThemedText>
              <TextInput
                multiline
                value={settings.originalStory || ''}
                onChangeText={originalStory =>
                  setSettings(current => ({...current, originalStory}))
                }
                placeholder="What do you remember about that day?"
                placeholderTextColor={Colors.textGray}
                style={styles.storyInput}
              />
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
                      onValueChange={value =>
                        setSettings(current => ({...current, [item.key]: value}))
                      }
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
              <View style={styles.milestonePreview} onLayout={event => setSharePreviewWidth(event.nativeEvent.layout.width)}>
                <ForMeDayShareCard data={milestone} width={sharePreviewWidth} />
              </View>

              <View style={styles.sectionHeadingRow}>
                <ThemedText style={styles.sectionHeading}>Your story</ThemedText>
                <Ionicons name="book-outline" size={19} color={Colors.sage} />
              </View>
              <View style={styles.storyCard}>
                <ThemedText style={styles.storyText}>
                  {settings.originalStory?.trim() ||
                    'This is the day you accepted Jesus as your Lord and Savior and committed your life to following Him.'}
                </ThemedText>
              </View>
              {!showReflection ? (
                <>
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
              ) : (
                <View style={styles.reflectionCard}>
                  <ThemedText style={styles.reflectionEyebrow}>{isFirstDay ? 'TODAY' : 'THIS YEAR'}</ThemedText>
                  <ThemedText style={styles.reflectionPrompt}>
                    {isFirstDay
                      ? 'What is on your heart as you begin following Jesus today?'
                      : 'How is Jesus leading you as you continue to follow Him?'}
                  </ThemedText>
                  <TextInput
                    multiline
                    autoFocus
                    value={reflection}
                    onChangeText={setReflection}
                    placeholder="Write what is on your heart..."
                    placeholderTextColor={Colors.textGray}
                    style={styles.reflectionInput}
                  />
                  <TouchableOpacity
                    style={styles.primary}
                    onPress={saveReflection}>
                    <ThemedText style={styles.primaryText}>
                      Save to Moments
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: Colors.lightBackground},
  flex: {flex: 1},
  loading: {flex: 1, backgroundColor: Colors.lightBackground},
  header: {
    minHeight: 60,
    paddingHorizontal: 22,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.lightBackground,
  },
  headerTitle: {fontFamily: Fonts.semiBold, fontSize: 16, color: Colors.text},
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
  content: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 56,
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
  storyInput: {
    minHeight: 132,
    textAlignVertical: 'top',
    padding: 18,
    borderRadius: 24,
    backgroundColor: Colors.hopeWhite,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    shadowColor: Colors.modalBlue,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
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
  milestonePreview: {borderRadius: 24, overflow: 'hidden'},
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionHeading: {fontFamily: Fonts.bold, fontSize: 20, color: Colors.text},
  storyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    padding: 20,
    shadowColor: Colors.modalBlue,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
  storyText: {
    fontFamily: Fonts.lora.regular,
    fontSize: 17,
    lineHeight: 27,
    color: Colors.text,
  },
  reflectionCard: {
    marginTop: 18,
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    padding: 20,
    shadowColor: Colors.modalBlue,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
  reflectionEyebrow: {
    fontFamily: Fonts.semiBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: Colors.sage,
    textAlign: 'center',
    marginBottom: 8,
  },
  reflectionPrompt: {
    fontFamily: Fonts.lora.semiBold,
    fontSize: 19,
    lineHeight: 27,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  reflectionInput: {
    height: 145,
    backgroundColor: Colors.lightBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 15,
    textAlignVertical: 'top',
    fontFamily: Fonts.regular,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
});
export default ForMeDayScreen;
