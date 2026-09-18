import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GOSPEL_PAGES, GOSPEL_PRAYER, LISTEN_FIRST_QUESTIONS } from '../data/gospelContent';
import { GospelPerson, GospelResponse, gospelStorage } from '../storage/gospelStorage';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { useTheme } from '../theme/ThemeContext';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import { scheduleForMeDayReminder } from '../services/forMeDayService';
import { toLocalDateString } from '../utils/date';

type ViewName = 'home' | 'mode' | 'listen' | 'player' | 'response' | 'prayer' | 'assurance' | 'birthday' | 'next-steps' | 'other' | 'people' | 'add-person' | 'send';
type Mode = 'app_self' | 'app_together';

const RESPONSE_OPTIONS: Array<{ value: GospelResponse; label: string }> = [
  { value: 'trusted_jesus_today', label: 'Yes. I want to trust and follow Jesus.' },
  { value: 'has_questions', label: 'I have questions.' },
  { value: 'not_ready', label: "I'm not ready yet." },
  { value: 'already_follows_jesus', label: 'I already trust and follow Jesus.' },
];

const FIRST_STEPS = [
  ['Pray every day', 'Talk with God.'],
  ['Read the Bible', 'Begin with the Gospel of John.'],
  ['Join a discipleship group', 'Grow alongside other believers.'],
  ['Attend a Bible-believing church', 'Learn, worship, and live in community.'],
  ['Share the Gospel', 'Tell family, friends, and others the good news.'],
] as const;

const GOSPEL_BACKGROUNDS: Record<string, number> = {
  sin: require('../../assets/images/gospel/1.png'),
  effort: require('../../assets/images/gospel/2.png'),
  jesus: require('../../assets/images/gospel/3.png'),
  trust: require('../../assets/images/gospel/4.png'),
};

const GospelScreen: React.FC<any> = ({ navigation }) => {
  const theme = useTheme();
  const font = { fontFamily: theme.fontFamily };
  useScreenStatusBar('dark', '#FFFDF8');
  const [view, setView] = useState<ViewName>('home');
  const [, setHistory] = useState<ViewName[]>([]);
  const [mode, setMode] = useState<Mode>('app_self');
  const [listenIndex, setListenIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [response, setResponse] = useState<GospelResponse | null>(null);
  const [pickedChoice, setPickedChoice] = useState<number | null>(null);
  const [people, setPeople] = useState<GospelPerson[]>([]);
  const [personName, setPersonName] = useState('');
  const [personNote, setPersonNote] = useState('');

  const go = useCallback((next: ViewName) => {
    try { triggerLightHaptic(); } catch {}
    setHistory(current => [...current, view]);
    setView(next);
  }, [view]);

  const back = useCallback(() => {
    try { triggerLightHaptic(); } catch {}
    if (view === 'player' && pageIndex > 0) {
      setPageIndex(value => value - 1);
      return;
    }
    if (view === 'listen' && listenIndex > 0) {
      setListenIndex(value => value - 1);
      return;
    }
    setHistory(current => {
      if (!current.length) {
        navigation.goBack();
        return current;
      }
      const copy = [...current];
      setView(copy.pop() as ViewName);
      return copy;
    });
  }, [listenIndex, navigation, pageIndex, view]);

  const resetHome = useCallback(() => {
    setHistory([]);
    setView('home');
    setPageIndex(0);
    setListenIndex(0);
    setResponse(null);
  }, []);

  const loadPeople = useCallback(async () => setPeople(await gospelStorage.getPeople()), []);
  useEffect(() => { loadPeople(); }, [loadPeople]);
  useEffect(() => { setPickedChoice(null); }, [pageIndex, view]);

  const startPlayer = (selectedMode: Mode) => {
    setMode(selectedMode);
    setPageIndex(0);
    if (selectedMode === 'app_together') {
      setListenIndex(0);
      go('listen');
    } else {
      go('player');
    }
  };

  const continuePlayer = () => {
    if (pageIndex < GOSPEL_PAGES.length - 1) {
      setPageIndex(value => value + 1);
    } else {
      go('response');
    }
  };

  const submitResponse = async () => {
    if (!response) {
      Alert.alert('Choose a response', 'Choose the response closest to where you are.');
      return;
    }
    if (response === 'trusted_jesus_today') {
      go('prayer');
      return;
    }
    await gospelStorage.saveResponse(response, mode);
    go('other');
  };

  const saveTrustedResponse = async (saveDate: boolean) => {
    const date = saveDate ? toLocalDateString(new Date()) : undefined;
    await gospelStorage.saveResponse('trusted_jesus_today', mode, date);
    if (saveDate) {
      const settings = await gospelStorage.getForMeDaySettings();
      await scheduleForMeDayReminder(settings);
    }
    try { triggerSuccessHaptic(); } catch {}
    go('next-steps');
  };

  const addPerson = async () => {
    if (!personName.trim()) {
      Alert.alert('Add a name or initial', 'This can be as simple as one initial.');
      return;
    }
    await gospelStorage.addPerson(personName, personNote);
    setPersonName('');
    setPersonNote('');
    await loadPeople();
    try { triggerSuccessHaptic(); } catch {}
    setHistory(current => current.slice(0, -1));
    setView('people');
  };

  const shareGospel = async () => {
    try {
      await Share.share({
        title: 'The Gospel',
        message: "Hey, I wanted to share this with you. It's a short walkthrough of the Gospel you can read whenever you're ready. No pressure to respond to me. https://journalbysifia.app/gospel",
        url: 'https://journalbysifia.app/gospel',
      });
    } catch {
      Alert.alert('Unable to share', 'Please try again in a moment.');
    }
  };

  const responseCopy = useMemo(() => {
    if (response === 'has_questions') {
      return ['Your questions matter.', 'You can keep exploring what the Bible says about Jesus before making a decision.'];
    }
    if (response === 'not_ready') {
      return ["It's okay to keep considering this.", "You don't need to say yes just to finish this experience."];
    }
    return ['Keep returning to the Gospel.', 'The good news is not only how the Christian life begins. It is truth to remember and share.'];
  }, [response]);

  const headerTitle = useMemo(() => {
    switch (view) {
      case 'mode': return 'Go through the Gospel';
      case 'listen': return 'Listen first';
      case 'player': return pageIndex === 0 ? (mode === 'app_together' ? 'For us' : 'For me') : (GOSPEL_PAGES[pageIndex].headerTitle || GOSPEL_PAGES[pageIndex].eyebrow);
      case 'response': return 'Your response';
      case 'prayer': return 'Respond in faith';
      case 'assurance': return 'A new beginning';
      case 'birthday': return 'Remember this day';
      case 'next-steps': return 'First steps';
      case 'other': return 'Your response';
      case 'people': return "People I'm praying for";
      case 'add-person': return 'Add someone';
      case 'send': return 'Send the Gospel';
      default: return 'Gospel';
    }
  }, [mode, pageIndex, view]);

  const gospelBackground = view === 'player'
    ? GOSPEL_BACKGROUNDS[GOSPEL_PAGES[pageIndex].id]
    : undefined;

  const Header = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={back}
        style={styles.headerButton}
        activeOpacity={0.7}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
        accessibilityRole="button"
        accessibilityLabel={view === 'home' ? 'Close Gospel' : 'Go back'}>
        <Ionicons name={view === 'home' ? 'close' : 'chevron-back'} size={17} color={Colors.sage} />
      </TouchableOpacity>
      <Text numberOfLines={1} style={[styles.headerTitle, font]}>{headerTitle}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  const Action = ({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.action, secondary && styles.actionSecondary]}
      accessibilityRole="button">
      <Text style={[styles.actionText, secondary && styles.actionSecondaryText, font]}>{label}</Text>
    </TouchableOpacity>
  );

  const Card = ({ icon, title, body, onPress }: { icon: string; title: string; body: string; onPress?: () => void }) => {
    const content = (
      <View style={styles.cardRow}>
        <View style={styles.iconBox}><Ionicons name={icon as any} size={21} color={Colors.sage} /></View>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, font]}>{title}</Text>
          <Text style={[styles.cardBody, font]}>{body}</Text>
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={20} color={Colors.sage} /> : null}
      </View>
    );
    return onPress ? <TouchableOpacity style={styles.card} onPress={onPress}>{content}</TouchableOpacity> : <View style={styles.card}>{content}</View>;
  };

  const renderContent = () => {
    if (view === 'home') {
      return <>
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, font]}>THE GOOD NEWS OF JESUS</Text>
          <Text style={[styles.heroTitle, font]}>Know the Gospel.{`\n`}Share the Gospel.</Text>
          <Text style={[styles.heroBody, font]}>Whether you're here for yourself or someone else, begin with the same good news.</Text>
        </View>
        <Card icon="heart-outline" title="Go through the Gospel" body="Read it yourself or walk through it with someone beside you." onPress={() => go('mode')} />
        <Card icon="people-outline" title="People I'm praying for" body="Remember people, conversations, and follow-up." onPress={() => go('people')} />
        <View style={styles.divider} />
        <Card icon="paper-plane-outline" title="Send the Gospel" body="Let someone read it privately on their own device." onPress={() => go('send')} />
        <Text style={[styles.privacy, font]}>No spiritual response is required to access or share the Gospel.</Text>
      </>;
    }

    if (view === 'mode') {
      return <>
        <Text style={[styles.eyebrowCenter, font]}>BEFORE WE BEGIN</Text>
        <Text style={[styles.title, styles.center, font]}>Who is going through this?</Text>
        <Text style={[styles.body, styles.center, font]}>This only changes how the conversation begins. The Gospel itself stays the same.</Text>
        <Card icon="person-outline" title="I'm reading for myself" body="I want to understand or return to the Gospel." onPress={() => startPlayer('app_self')} />
        <Card icon="people-outline" title="Someone is with me" body="We'll go through it together." onPress={() => startPlayer('app_together')} />
        <View style={styles.note}><Text style={[styles.noteText, font]}>When someone is with you, begin with three gentle questions so you can listen before presenting the Gospel.</Text></View>
      </>;
    }

    if (view === 'listen') {
      const isPermission = listenIndex === LISTEN_FIRST_QUESTIONS.length;
      return <>
        <Text style={[styles.eyebrowCenter, font]}>{isPermission ? 'NOW SHARE' : `LISTEN · ${listenIndex + 1} OF 3`}</Text>
        <Text style={[styles.title, styles.center, font]}>{isPermission ? 'Can I show you what the Bible says?' : LISTEN_FIRST_QUESTIONS[listenIndex]}</Text>
        <Text style={[styles.body, styles.center, font]}>{isPermission ? 'About God, our problem, what Jesus has done, and how we can receive eternal life.' : 'Let them answer honestly. You can talk about their answer before continuing.'}</Text>
        <Action label={isPermission ? 'Begin the Gospel →' : 'Continue →'} onPress={() => isPermission ? go('player') : setListenIndex(value => value + 1)} />
        <Text style={[styles.privacy, font]}>These listening answers are not saved.</Text>
      </>;
    }

    if (view === 'player') {
      const page = GOSPEL_PAGES[pageIndex];
      return <>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((pageIndex + 1) / GOSPEL_PAGES.length) * 100}%` }]} /></View>
        <Text style={[styles.eyebrow, (page.centered || page.eyebrowCentered) && styles.center, font]}>{page.eyebrow}</Text>
        <Text style={[styles.title, page.centered && styles.center, font, page.serifTitle && styles.titleSerif]}>{page.title}</Text>
        {page.body ? <Text style={[styles.body, page.centered && styles.center, font]}>{page.body}</Text> : null}
        {page.scriptures?.map(scripture => <View key={scripture.ref} style={styles.scriptureCard}>
          <Text style={styles.scriptureText}>“{scripture.text}”</Text>
          <Text style={[styles.scriptureRef, font]}>{scripture.ref.toUpperCase()}</Text>
        </View>)}
        {page.points?.map((point, index) => <View key={point.title} style={styles.step}>
          {(page.points?.length ?? 0) > 1 && <View style={styles.stepNumber}><Text style={[styles.stepNumberText, font]}>{index + 1}</Text></View>}
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, font]}>{point.title}</Text>
            <Text style={[styles.cardBody, font]}>{point.body}</Text>
            {point.reference ? <Text style={[styles.reference, styles.pointRef, font]}>{point.reference}</Text> : null}
          </View>
        </View>)}
        {page.choices?.map((choice, choiceIndex) => {
          const answered = pickedChoice !== null;
          const isCorrect = choice.correct === true;
          const showFeedback = pickedChoice === choiceIndex && choice.feedback;
          return <TouchableOpacity key={choice.text} style={[styles.choice, answered && isCorrect && styles.choiceSelected]} onPress={() => { triggerLightHaptic(); setPickedChoice(choiceIndex); }} accessibilityRole="button">
            <View style={[styles.radio, answered && isCorrect && styles.radioSelected]} />
            <View style={styles.flex}>
              <Text style={[styles.choiceText, (isCorrect && answered) && styles.choiceTextCorrect, font]}>{choice.text}</Text>
              {choice.detail ? <Text style={[styles.choiceDetail, font]}>{choice.detail}</Text> : null}
              {showFeedback ? <Text style={[styles.choiceFeedback, isCorrect ? styles.choiceFeedbackRight : styles.choiceFeedbackWrong, font]}>{choice.feedback}</Text> : null}
            </View>
          </TouchableOpacity>;
        })}
        {page.references?.length ? <View style={styles.references}>{page.references.map(reference => <Text key={reference} style={[styles.reference, font]}>{reference}</Text>)}</View> : null}
        {page.note ? <View style={styles.note}><Text style={[styles.noteText, page.noteCentered === false && styles.noteTextLeft, font]}>{page.note}</Text></View> : null}
        <Action label={page.cta || (pageIndex === GOSPEL_PAGES.length - 1 ? "I'm ready to respond →" : 'Continue →')} onPress={continuePlayer} />
      </>;
    }

    if (view === 'response') {
      return <>
        <Text style={[styles.eyebrowCenter, font]}>THIS IS PERSONAL</Text>
        <Text style={[styles.title, styles.center, font]}>Are you willing to trust and follow Jesus as your Lord and Savior?</Text>
        <Text style={[styles.body, styles.center, font]}>Choose what honestly describes where you are today.</Text>
        {RESPONSE_OPTIONS.map(option => <TouchableOpacity key={option.value} style={[styles.choice, response === option.value && styles.choiceSelected]} onPress={() => setResponse(option.value)}>
          <View style={[styles.radio, response === option.value && styles.radioSelected]} />
          <Text style={[styles.choiceText, font]}>{option.label}</Text>
        </TouchableOpacity>)}
        <Action label="Continue →" onPress={submitResponse} />
      </>;
    }

    if (view === 'prayer') {
      return <>
        <Text style={[styles.eyebrowCenter, font]}>PRAY</Text>
        <Text style={[styles.title, styles.center, font]}>Talk to Jesus.</Text>
        <Text style={[styles.body, styles.center, font]}>Prayer doesn't earn salvation. It can express the faith, repentance, and surrender of your heart.</Text>
        <View style={styles.prayerCard}><Text style={[styles.prayerText, font]}>{GOSPEL_PRAYER}</Text></View>
        <Action label="I trust Jesus today →" onPress={() => go('assurance')} />
      </>;
    }

    if (view === 'assurance') {
      return <>
        <View style={styles.check}><Ionicons name="checkmark" size={34} color={Colors.hopeWhite} /></View>
        <Text style={[styles.title, styles.center, font]}>Your eternal life with God begins today.</Text>
        <Card icon="checkmark-circle-outline" title="Forgiven" body="Your sins are paid for and forgiven in Christ. · Hebrews 10:17" />
        <Card icon="leaf-outline" title="New life" body="You are a new person in God's eyes. · 2 Corinthians 5:17" />
        <Card icon="heart-outline" title="Child of God" body="Those who receive Christ and believe in Him become God's children. · John 1:12" />
        <Action label="Continue →" onPress={() => go('birthday')} />
      </>;
    }

    if (view === 'birthday') {
      const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      return <>
        <Text style={[styles.eyebrowCenter, font]}>SPIRITUAL BIRTHDAY</Text>
        <Text style={[styles.title, styles.center, font, styles.titleSerif]}>Today, I trusted Jesus to be my Lord and Savior.</Text>
        <Text style={[styles.body, styles.center, font]}>You can save this date as a personal reminder of your commitment.</Text>
        <View style={styles.dateCard}>
          <Text style={[styles.dateCardLabel, font]}>DATE</Text>
          <Text style={[styles.dateCardValue, font]}>{today}</Text>
        </View>
        <Action label="Save & continue →" onPress={() => saveTrustedResponse(true)} />
        <Action label="Continue without saving" onPress={() => saveTrustedResponse(false)} secondary />
      </>;
    }

    if (view === 'next-steps') {
      return <>
        <Text style={[styles.eyebrowCenter, font]}>WHAT'S NEXT?</Text>
        <Text style={[styles.title, styles.center, font]}>Grow in your relationship with Jesus.</Text>
        {FIRST_STEPS.map(([title, body], index) => <View key={title} style={styles.step}><View style={styles.stepNumber}><Text style={[styles.stepNumberText, font]}>{index + 1}</Text></View><View style={styles.flex}><Text style={[styles.cardTitle, font]}>{title}</Text><Text style={[styles.cardBody, font]}>{body}</Text></View></View>)}
        <Action label="Finish" onPress={resetHome} />
      </>;
    }

    if (view === 'other') {
      return <>
        <Text style={[styles.eyebrowCenter, font]}>THANK YOU FOR ANSWERING</Text>
        <Text style={[styles.title, styles.center, font]}>{responseCopy[0]}</Text>
        <Text style={[styles.body, styles.center, font]}>{responseCopy[1]}</Text>
        <Card icon="heart-outline" title="No pressure to manufacture a response." body="You can ask questions, read Scripture, talk with the person who shared this with you, and return whenever you want." />
        <Action label="Finish" onPress={resetHome} />
      </>;
    }

    if (view === 'people') {
      return <>
        <Text style={[styles.eyebrow, font]}>GOSPEL TRACK</Text>
        <Text style={[styles.title, font]}>Pray. Share. Follow up.</Text>
        <Text style={[styles.body, font]}>This is about remembering people, not collecting conversion numbers.</Text>
        <Card icon="person-add-outline" title="Add someone to pray for" body="Name or initial · private to you" onPress={() => go('add-person')} />
        {people.map(person => <View key={person.id} style={styles.personCard}>
          <View style={styles.personInitial}><Text style={[styles.personInitialText, font]}>{person.displayName.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.flex}><Text style={[styles.cardTitle, font]}>{person.displayName}</Text><Text style={[styles.cardBody, font]}>{person.note || 'Someone you want to remember in prayer.'}</Text></View>
          <TouchableOpacity accessibilityLabel={`Pray for ${person.displayName}`} onPress={() => navigation.navigate('PrayersForPeopleWalkthrough', { initialPersonName: person.displayName, initialPrayerType: 'pray-for-someone' })} style={styles.prayButton}>
            <Ionicons name="heart-outline" size={19} color={Colors.sage} />
          </TouchableOpacity>
        </View>)}
        {!people.length ? <Text style={[styles.emptyText, font]}>No one added yet. Names stay on this device and are private to you.</Text> : null}
      </>;
    }

    if (view === 'add-person') {
      return <>
        <Text style={[styles.eyebrowCenter, font]}>PRIVATE TO YOU</Text>
        <Text style={[styles.title, styles.center, font]}>Who do you want to remember?</Text>
        <TextInput value={personName} onChangeText={setPersonName} placeholder="Name or initial" placeholderTextColor="#7A857F" style={[styles.input, font]} autoFocus />
        <TextInput value={personNote} onChangeText={setPersonNote} placeholder="Optional note or prayer prompt" placeholderTextColor="#7A857F" style={[styles.input, styles.noteInput, font]} multiline />
        <Action label="Add to Gospel Track" onPress={addPerson} />
      </>;
    }

    return <>
      <Text style={[styles.eyebrowCenter, font]}>SHARE PRIVATELY</Text>
      <Text style={[styles.title, styles.center, font]}>Send the good news to someone.</Text>
      <Text style={[styles.body, styles.center, font]}>They can go through the Gospel privately, on their own device, at their own pace.</Text>
      <Card icon="paper-plane-outline" title="Gospel link" body="No Journal account is required to read it." />
      <View style={styles.note}><Text style={[styles.noteText, font]}>Their reading activity and private response are never visible to you. This share sends the public Gospel page; response sharing requires the future secure link service.</Text></View>
      <Action label="Share the Gospel ↗" onPress={shareGospel} />
      <Action label="Go through it together instead" onPress={() => startPlayer('app_together')} secondary />
    </>;
  };

  return (
    <ImageBackground
      source={gospelBackground}
      style={styles.screenBackground}
      imageStyle={styles.screenBackgroundImage}
      resizeMode="cover">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Header />
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {renderContent()}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  screenBackground: { flex: 1, backgroundColor: '#F4F0E7' },
  screenBackgroundImage: { opacity: 1 },
  header: { height: 52, marginTop: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D8DED8' },
  headerButton: { width: 42, height: 42, borderRadius: 999, backgroundColor: Colors.cardBackground, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: {width: 42, height: 42},
  headerTitle: { flex: 1, paddingHorizontal: 8, fontSize: 15, fontWeight: '700', color: '#24342C', textAlign: 'center' },
  content: { padding: 22, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  hero: { backgroundColor: '#30483A', padding: 26, borderRadius: 24, marginTop: 12, marginBottom: 18 },
  heroTitle: { color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '700', marginTop: 7 },
  heroBody: { color: '#E5ECE7', fontSize: 15, lineHeight: 23, marginTop: 12 },
  eyebrow: { color: '#607967', fontSize: 12, fontWeight: '800', letterSpacing: 1.3, marginBottom: 10 },
  eyebrowCenter: { color: '#607967', fontSize: 12, fontWeight: '800', letterSpacing: 1.3, marginBottom: 10, textAlign: 'center', marginTop: 26 },
  title: { color: '#24342C', fontSize: 32, lineHeight: 39, fontWeight: '700', marginBottom: 13 },
  titleSerif: { fontFamily: Fonts.lora.bold, fontSize: 36, lineHeight: 44, fontWeight: '700' },
  body: { color: '#66736C', fontSize: 16, lineHeight: 25, marginBottom: 24 },
  center: { textAlign: 'center' },
  card: { backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#DCE2DB', padding: 16, borderRadius: 18, marginBottom: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#E5ECE5', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#24342C', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  cardBody: { color: '#6F7D75', fontSize: 13.5, lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#DCE2DB', marginVertical: 8 },
  privacy: { color: '#758078', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  note: { backgroundColor: '#E5ECE5', padding: 16, borderRadius: 16, marginVertical: 14 },
  noteText: { color: '#425248', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  noteTextLeft: { textAlign: 'left' },
  action: { minHeight: 52, borderRadius: 16, backgroundColor: '#607967', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 16 },
  actionSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#607967', marginTop: 10 },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  actionSecondaryText: { color: '#526A59' },
  progressTrack: { height: 4, backgroundColor: '#DCE2DB', borderRadius: 2, overflow: 'hidden', marginBottom: 34 },
  progressFill: { height: 4, backgroundColor: '#607967' },
  scriptureCard: { backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#DCE2DB', borderRadius: 18, padding: 20, marginBottom: 12 },
  scriptureText: { color: '#30483A', fontFamily: Fonts.lora.regular, fontSize: 19, lineHeight: 30, marginBottom: 10 },
  scriptureRef: { color: '#607967', fontSize: 12, fontWeight: '800', letterSpacing: 1.3 },
  pointRef: { alignSelf: 'flex-start', marginTop: 10 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#FFFDF8', borderRadius: 16, borderWidth: 1, borderColor: '#DCE2DB', padding: 15, marginBottom: 10 },
  stepNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E5ECE5', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#526A59', fontSize: 13, fontWeight: '800' },
  references: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  reference: { color: '#526A59', fontSize: 12, fontWeight: '700', backgroundColor: '#E5ECE5', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#D7DED8', backgroundColor: '#FFFDF8', borderRadius: 16, padding: 16, marginBottom: 10 },
  choiceSelected: { borderColor: '#607967', backgroundColor: '#EAF0EA' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#A6B0AA' },
  radioSelected: { borderWidth: 6, borderColor: '#607967' },
  choiceText: { flex: 1, color: '#24342C', fontSize: 15, lineHeight: 21 },
  choiceTextCorrect: { fontWeight: '700' },
  choiceDetail: { color: '#24342C', fontSize: 15, lineHeight: 21 },
  choiceFeedback: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  choiceFeedbackRight: { color: '#526A59' },
  choiceFeedbackWrong: { color: '#A65A4A' },
  dateCard: { backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#DCE2DB', padding: 18, borderRadius: 18, marginBottom: 6 },
  dateCardLabel: { color: '#607967', fontSize: 12, fontWeight: '800', letterSpacing: 1.3, marginBottom: 4 },
  dateCardValue: { color: '#24342C', fontSize: 18, fontWeight: '700' },
  prayerCard: { backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#DCE2DB', padding: 22, borderRadius: 20 },
  prayerText: { color: '#30483A', textAlign: 'center', fontSize: 18, lineHeight: 29 },
  check: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#607967', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 18 },
  sectionTop: { marginTop: 32 },
  personCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#DCE2DB', borderRadius: 17, padding: 14, marginBottom: 10 },
  personInitial: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E5ECE5', alignItems: 'center', justifyContent: 'center' },
  personInitialText: { color: '#526A59', fontWeight: '800', fontSize: 17 },
  prayButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: '#C9D4CB', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#6F7D75', textAlign: 'center', lineHeight: 21, paddingVertical: 22 },
  input: { backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#D4DDD5', borderRadius: 15, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#24342C', marginBottom: 12 },
  noteInput: { minHeight: 110, textAlignVertical: 'top' },
});

export default GospelScreen;
