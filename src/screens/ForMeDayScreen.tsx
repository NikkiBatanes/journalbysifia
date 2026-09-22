import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {SafeAreaView} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Share from 'react-native-share';
import ViewShot from 'react-native-view-shot';
import {format} from 'date-fns';
import ThemedText from '../components/common/ThemedText';
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
  const [settings, setSettings] = useState<Omit<ForMeDaySettings, 'updatedAt'>>(
    defaults(),
  );
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(route?.params?.mode === 'settings');
  const [showPicker, setShowPicker] = useState(false);
  const [reflection, setReflection] = useState('');
  const [showReflection, setShowReflection] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shotRef = useRef<ViewShot>(null);

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

  const shareCard = useCallback(async () => {
    if (!shotRef.current?.capture || sharing) {
      return;
    }
    setSharing(true);
    try {
      const uri = await shotRef.current.capture();
      await Share.open({
        title: 'My For Me Day',
        message:
          'The Gospel became personal. It was good news for me. — Journal by siFia',
        url: uri.startsWith('file://') ? uri : `file://${uri}`,
        type: 'image/png',
        failOnCancel: false,
      });
    } catch (error: any) {
      if (
        !String(error?.message || '')
          .toLowerCase()
          .includes('cancel')
      ) {
        Alert.alert('Unable to share', 'Please try again.');
      }
    } finally {
      setSharing(false);
    }
  }, [sharing]);

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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={Colors.sage} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>My For Me Day</ThemedText>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={editing ? saveSettings : () => setEditing(true)}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Save settings' : 'Edit For Me Day'}>
          {editing ? (
            <ThemedText style={styles.headerSave}>Save</ThemedText>
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
              <View style={styles.settingsIntro}>
                <View style={styles.settingsIntroIcon}>
                  <Ionicons name="sparkles-outline" size={20} color={Colors.sage} />
                </View>
                <View style={styles.settingsIntroCopy}>
                  <ThemedText style={styles.settingsIntroTitle}>Remember your spiritual birthday</ThemedText>
                  <ThemedText style={styles.settingsIntroBody}>
                    The day the Gospel became personal to you.
                  </ThemedText>
                </View>
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
              <ThemedText style={styles.eyebrow}>A PERSONAL MILESTONE</ThemedText>
              <ThemedText style={styles.pageTitle}>The day grace became personal.</ThemedText>
              <ThemedText style={styles.pageIntro}>
                A place to remember how your story with Jesus began—and how He has carried you since.
              </ThemedText>
              <ViewShot
                ref={shotRef}
                options={{format: 'png', quality: 1, result: 'tmpfile'}}
                style={styles.milestoneCard}>
                <View style={styles.decorativeOrbOne} />
                <View style={styles.decorativeOrbTwo} />
                <View style={styles.milestoneTop}>
                  <ThemedText style={styles.milestoneKicker}>MY FOR ME DAY</ThemedText>
                  <Ionicons name="sparkles-outline" size={20} color={Colors.faithGold} />
                </View>
                <View style={styles.milestoneCenter}>
                  {settings.includeYearWhenSharing && years ? (
                    <>
                      <ThemedText style={styles.yearNumber}>{years}</ThemedText>
                      <ThemedText style={styles.yearLabel}>
                        {years === 1 ? 'YEAR OF GRACE' : 'YEARS OF GRACE'}
                      </ThemedText>
                    </>
                  ) : null}
                  <View style={styles.goldRule} />
                  <ThemedText style={styles.milestoneQuote}>“It was good news for me.”</ThemedText>
                </View>
                <View style={styles.milestoneBottom}>
                  <ThemedText style={styles.milestoneDate}>{format(birthdayDate, 'MMMM d, yyyy').toUpperCase()}</ThemedText>
                  <Image source={require('../../assets/images/journalbysifia.png')} resizeMode="contain" style={styles.shareLogo} />
                </View>
              </ViewShot>

              <View style={styles.sectionHeadingRow}>
                <ThemedText style={styles.sectionHeading}>Your story</ThemedText>
                <Ionicons name="book-outline" size={19} color={Colors.sage} />
              </View>
              <View style={styles.storyCard}>
                <ThemedText style={styles.storyText}>
                  {settings.originalStory?.trim() ||
                    'This is the day you chose to remember when the Gospel became personal.'}
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
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color={Colors.hopeWhite}
                      />
                      <ThemedText style={styles.primaryText}>
                        Write this year’s reflection
                      </ThemedText>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.secondary}
                    onPress={shareCard}>
                    <Ionicons
                      name="share-outline"
                      size={18}
                      color={Colors.sage}
                    />
                    <ThemedText style={styles.secondaryText}>
                      {sharing ? 'Preparing…' : 'Share this milestone'}
                    </ThemedText>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.reflectionCard}>
                  <ThemedText style={styles.reflectionEyebrow}>THIS YEAR</ThemedText>
                  <ThemedText style={styles.reflectionPrompt}>
                    What does the Gospel being “for me” mean in this season?
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: Colors.lightBackground},
  flex: {flex: 1},
  loading: {flex: 1, backgroundColor: Colors.lightBackground},
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.hopeWhite,
  },
  headerTitle: {fontFamily: Fonts.bold, fontSize: 18, color: Colors.text},
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSave: {fontFamily: Fonts.semiBold, fontSize: 14, color: Colors.sage},
  content: {
    paddingHorizontal: 12,
    paddingTop: 18,
    paddingBottom: 48,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  settingsIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 4,
  },
  settingsIntroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.anchorBlueLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.lightBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIntroCopy: {flex: 1, marginLeft: 12},
  settingsIntroTitle: {fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text},
  settingsIntroBody: {fontFamily: Fonts.regular, fontSize: 12, color: Colors.textGray, marginTop: 3},
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
    fontSize: 12,
    letterSpacing: 0.6,
    color: Colors.textGray,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 20,
  },
  dateCard: {
    minHeight: 64,
    borderRadius: 20,
    backgroundColor: Colors.hopeWhite,
    borderWidth: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.anchorBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCopy: {flex: 1, marginLeft: 14},
  dateMonth: {fontFamily: Fonts.medium, fontSize: 15, color: Colors.text},
  dateYear: {fontFamily: Fonts.regular, fontSize: 11, color: Colors.textGray, marginTop: 2},
  changeText: {fontFamily: Fonts.medium, fontSize: 12, color: Colors.sage},
  storyInput: {
    height: 120,
    textAlignVertical: 'top',
    padding: 16,
    borderRadius: 20,
    backgroundColor: Colors.hopeWhite,
    borderWidth: 0,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  preferencesCard: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 20,
    borderWidth: 0,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingHorizontal: 16,
  },
  toggleDivider: {borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder},
  preferenceIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.anchorBlueLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.lightBorder,
    marginRight: 10,
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
    marginTop: 18,
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
  milestoneCard: {
    height: 390,
    borderRadius: 28,
    backgroundColor: Colors.sage,
    padding: 24,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  decorativeOrbOne: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    top: -100,
    right: -70,
  },
  decorativeOrbTwo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -62,
    left: -38,
  },
  milestoneTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  milestoneKicker: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: Colors.hopeWhite,
    opacity: 0.9,
  },
  milestoneCenter: {alignItems: 'center'},
  yearNumber: {
    fontFamily: Fonts.lora.semiBold,
    fontSize: 88,
    lineHeight: 92,
    color: Colors.hopeWhite,
  },
  yearLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 2.5,
    color: Colors.faithGold,
  },
  goldRule: {width: 28, height: 1, backgroundColor: Colors.faithGold, marginVertical: 20},
  milestoneQuote: {
    fontFamily: Fonts.lora.regular,
    fontSize: 22,
    lineHeight: 29,
    fontStyle: 'italic',
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
  milestoneBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.24)',
    paddingTop: 14,
  },
  milestoneDate: {
    fontFamily: Fonts.semiBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: Colors.hopeWhite,
    opacity: 0.85,
  },
  shareLogo: {width: 32, height: 32},
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionHeading: {fontFamily: Fonts.bold, fontSize: 20, color: Colors.text},
  storyCard: {
    backgroundColor: Colors.cardBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.cardBorder,
    borderRadius: 20,
    padding: 20,
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
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.cardBorder,
    padding: 18,
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
