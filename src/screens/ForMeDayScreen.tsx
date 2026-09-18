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
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.circle}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={21} color={Colors.text} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>My For Me Day</ThemedText>
        <TouchableOpacity
          style={styles.circle}
          onPress={() => setEditing(value => !value)}>
          <Ionicons
            name={editing ? 'close' : 'settings-outline'}
            size={20}
            color={Colors.text}
          />
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
              <View style={styles.introIcon}>
                <Ionicons name="sparkles" size={30} color={Colors.hopeWhite} />
              </View>
              <ThemedText style={styles.setupTitle}>
                A day worth remembering.
              </ThemedText>
              <ThemedText style={styles.setupBody}>
                Save the day the good news of Jesus became personal to you.
              </ThemedText>
              <ThemedText style={styles.label}>YOUR FOR ME DAY</ThemedText>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowPicker(true)}>
                <Ionicons
                  name="calendar-outline"
                  size={19}
                  color={Colors.sage}
                />
                <ThemedText style={styles.inputText}>
                  {format(birthdayDate, 'MMMM d, yyyy')}
                </ThemedText>
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
              <ThemedText style={styles.label}>
                WHAT HAPPENED THAT DAY? · OPTIONAL
              </ThemedText>
              <TextInput
                multiline
                value={settings.originalStory || ''}
                onChangeText={originalStory =>
                  setSettings(current => ({...current, originalStory}))
                }
                placeholder="The Gospel became more than something I knew..."
                placeholderTextColor={Colors.textGray}
                style={[styles.input, styles.storyInput]}
              />
              {[
                [
                  'Remind me every year',
                  'A gentle notification on this day',
                  'reminderEnabled',
                ],
                [
                  'Save annual reflections in Moments',
                  'Build a private anniversary timeline',
                  'showInMoments',
                ],
                [
                  'Show anniversary count when sharing',
                  'You choose what leaves the app',
                  'includeYearWhenSharing',
                ],
              ].map(([title, subtitle, key]) => (
                <View style={styles.toggleRow} key={key}>
                  <View style={styles.toggleCopy}>
                    <ThemedText style={styles.toggleTitle}>{title}</ThemedText>
                    <ThemedText style={styles.toggleSubtitle}>
                      {subtitle}
                    </ThemedText>
                  </View>
                  <Switch
                    value={Boolean(settings[key as keyof typeof settings])}
                    onValueChange={value =>
                      setSettings(current => ({...current, [key]: value}))
                    }
                    trackColor={{
                      false: Colors.lightGray,
                      true: Colors.sageMuted,
                    }}
                    thumbColor={Colors.hopeWhite}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.primary} onPress={saveSettings}>
                <ThemedText style={styles.primaryText}>
                  Save My For Me Day
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ViewShot
                ref={shotRef}
                options={{format: 'png', quality: 1, result: 'tmpfile'}}
                style={styles.shareCard}>
                <View style={styles.shareTop}>
                  <Image
                    source={require('../../assets/images/journalbysifia.png')}
                    resizeMode="contain"
                    style={styles.shareLogo}
                  />
                  <Ionicons
                    name="sparkles-outline"
                    size={22}
                    color={Colors.faithGold}
                  />
                </View>
                <View style={styles.shareCenter}>
                  {settings.includeYearWhenSharing && years ? (
                    <>
                      <ThemedText style={styles.yearNumber}>{years}</ThemedText>
                      <ThemedText style={styles.yearLabel}>
                        {years === 1 ? 'YEAR' : 'YEARS'} OF GRACE
                      </ThemedText>
                    </>
                  ) : null}
                  <ThemedText style={styles.shareTitle}>
                    The Gospel became personal.
                  </ThemedText>
                  <ThemedText style={styles.shareBody}>
                    {'It wasn’t only good news.\nIt was good news for me.'}
                  </ThemedText>
                </View>
                <ThemedText style={styles.shareDate}>
                  MY FOR ME DAY · {format(birthdayDate, 'MMMM d').toUpperCase()}
                </ThemedText>
              </ViewShot>
              <View style={styles.storyCard}>
                <ThemedText style={styles.label}>YOUR STORY</ThemedText>
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
                        Reflect on this year
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
    height: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {fontFamily: Fonts.semiBold, fontSize: 15, color: Colors.text},
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  content: {
    padding: 18,
    paddingBottom: 50,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },
  introIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
  },
  setupTitle: {
    fontFamily: Fonts.lora.semiBold,
    fontSize: 29,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 18,
  },
  setupBody: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 26,
  },
  label: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 1.3,
    color: Colors.sage,
    marginTop: 16,
    marginBottom: 7,
  },
  input: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  inputText: {fontFamily: Fonts.regular, fontSize: 14, color: Colors.text},
  storyInput: {height: 110, textAlignVertical: 'top', paddingTop: 15},
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    marginTop: 10,
  },
  toggleCopy: {flex: 1, paddingRight: 12},
  toggleTitle: {fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.text},
  toggleSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: Colors.textGray,
    marginTop: 3,
  },
  primary: {
    minHeight: 54,
    borderRadius: 18,
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
    borderRadius: 18,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  secondaryText: {fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.sage},
  shareCard: {
    height: 455,
    borderRadius: 24,
    backgroundColor: Colors.modalBlue,
    padding: 25,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  shareTop: {flexDirection: 'row', justifyContent: 'space-between'},
  shareLogo: {
    width: 44,
    height: 44,
  },
  shareCenter: {alignItems: 'center'},
  yearNumber: {
    fontFamily: Fonts.lora.semiBold,
    fontSize: 72,
    lineHeight: 76,
    color: Colors.hopeWhite,
  },
  yearLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    letterSpacing: 2.6,
    color: Colors.faithGold,
  },
  shareTitle: {
    fontFamily: Fonts.lora.semiBold,
    fontSize: 28,
    lineHeight: 35,
    textAlign: 'center',
    color: Colors.hopeWhite,
    marginTop: 22,
  },
  shareBody: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 23,
    textAlign: 'center',
    color: Colors.hopeWhite,
    opacity: 0.9,
    marginTop: 12,
  },
  shareDate: {
    fontFamily: Fonts.semiBold,
    fontSize: 9,
    letterSpacing: 1.4,
    textAlign: 'center',
    color: Colors.hopeWhite,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.2)',
    paddingTop: 14,
  },
  storyCard: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    padding: 17,
    marginTop: 14,
  },
  storyText: {
    fontFamily: Fonts.lora.regular,
    fontSize: 16,
    lineHeight: 25,
    color: Colors.text,
  },
  reflectionCard: {marginTop: 16},
  reflectionPrompt: {
    fontFamily: Fonts.lora.semiBold,
    fontSize: 20,
    lineHeight: 28,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  reflectionInput: {
    height: 150,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    padding: 15,
    textAlignVertical: 'top',
    fontFamily: Fonts.regular,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
});
export default ForMeDayScreen;
