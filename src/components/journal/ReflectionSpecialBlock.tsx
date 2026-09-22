import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  NativeModules,
  PermissionsAndroid,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Sound from 'react-native-sound';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../common/ThemedText';
import JournalTextInput from './shared/JournalTextInput';
import {Colors} from '../../theme/colors';
import {getFontFamily} from '../../theme/fonts';
import {useTheme} from '../../hooks/useTheme';
import {triggerLightHaptic} from '../../utils/haptics';
import type {GuidedReflectionNote} from '../../types/guidedReflection';
import {
  JOURNAL_BLOCK_GAP,
  type JournalBlock,
} from './shared/journalBlocks';
import ExpandableJournalPhoto from './shared/ExpandableJournalPhoto';

const formatDuration = (millis = 0) => {
  const seconds = Math.max(0, Math.round(millis / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

type VoiceRecordingResult = {
  uri: string;
  durationMillis: number;
};

type VoiceRecorderModule = {
  startRecording: () => Promise<string>;
  stopRecording: () => Promise<VoiceRecordingResult>;
  cancelRecording: () => Promise<void>;
};

const voiceRecorder = NativeModules.SifiaVoiceRecorder as VoiceRecorderModule | undefined;

export default function ReflectionSpecialBlock({
  block,
  onChange,
  onDelete,
  registerInput,
  onCreateNextAction,
  onFocus,
  tone = 'onDark',
}: {
  block: GuidedReflectionNote | JournalBlock;
  onChange: (changes: Partial<GuidedReflectionNote & JournalBlock>) => void;
  onDelete: () => void;
  registerInput: (input: TextInput | null) => void;
  onCreateNextAction?: () => void;
  onFocus?: () => void;
  tone?: 'default' | 'onDark';
}) {
  const recordingRef = useRef(false);
  const soundRef = useRef<Sound | null>(null);
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const {currentFont} = useTheme();
  const sectionFontFamily = getFontFamily(currentFont || 'lexend', 'bold');
  const onDark = tone === 'onDark';
  const foreground = onDark ? Colors.hopeWhite : Colors.text;
  const muted = onDark ? 'rgba(255,255,255,0.65)' : Colors.textGray;
  const accent = onDark ? Colors.hopeWhite : Colors.sage;
  const border = onDark ? 'rgba(255,255,255,0.24)' : Colors.cardBorder;
  const surface = onDark ? 'rgba(255,255,255,0.06)' : Colors.cardBackground;

  useEffect(() => () => {
    if (recordingRef.current) {
      void voiceRecorder?.cancelRecording().catch(() => undefined);
    }
    soundRef.current?.release();
  }, []);

  const startRecording = async () => {
    if (!voiceRecorder) {
      Alert.alert(
        'Voice notes need an app update',
        'Rebuild and reinstall the app once to enable voice recording.',
      );
      return;
    }
    try {
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Microphone access needed', 'Allow microphone access to record a voice note.');
          return;
        }
      }
      await voiceRecorder.startRecording();
      recordingRef.current = true;
      setRecording(true);
    } catch (error) {
      if ((error as {code?: string})?.code === 'permission_denied') {
        Alert.alert('Microphone access needed', 'Allow microphone access to record a voice note.');
        return;
      }
      Alert.alert('Could not record', 'Please try recording your voice note again.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current || !voiceRecorder) return;
    try {
      const result = await voiceRecorder.stopRecording();
      onChange({uri: result.uri, durationMillis: result.durationMillis});
    } catch {
      Alert.alert('Could not save recording', 'Please try recording your voice note again.');
    } finally {
      recordingRef.current = false;
      setRecording(false);
    }
  };

  const togglePlayback = async () => {
    if (!block.uri) return;
    if (soundRef.current && playing) {
      soundRef.current.pause();
      setPlaying(false);
      return;
    }
    if (!soundRef.current) {
      Sound.setCategory('Playback');
      const sound = await new Promise<Sound>((resolve, reject) => {
        const nextSound = new Sound(block.uri!, '', error => {
          if (error) {
            nextSound.release();
            reject(error);
            return;
          }
          resolve(nextSound);
        });
      });
      soundRef.current = sound;
    }
    setPlaying(true);
    soundRef.current.play(success => {
      setPlaying(false);
      if (success) {
        soundRef.current?.setCurrentTime(0);
      } else {
        Alert.alert('Could not play voice note', 'Please try playing the recording again.');
      }
    });
  };

  const remove = () => { triggerLightHaptic(); onDelete(); };

  if (block.kind === 'section') {
    return (
      <View onTouchStart={onFocus} style={{flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 15, marginBottom: JOURNAL_BLOCK_GAP}}>
        <View style={{width: 4, height: 30, borderRadius: 2, backgroundColor: accent}} />
        <JournalTextInput themed ref={registerInput} accentColor={accent} value={block.text} onChangeText={text => onChange({text})}
          placeholder="Section title" placeholderTextColor={onDark ? 'rgba(255,255,255,0.45)' : Colors.textGray}
          style={{flex: 1, color: foreground, fontFamily: sectionFontFamily, fontSize: 18, paddingVertical: 6}} />
        <TouchableOpacity onPress={remove}><Ionicons name="close" size={17} color={muted} /></TouchableOpacity>
      </View>
    );
  }

  if (block.kind === 'photo') {
    return (
      <View onTouchStart={onFocus} style={{width: '100%', alignSelf: 'stretch', marginBottom: JOURNAL_BLOCK_GAP}}>
        {!!block.uri && (
          <ExpandableJournalPhoto
            uri={block.uri}
            imageStyle={{width: '100%', height: 220, borderRadius: 16}}
          />
        )}
        <TouchableOpacity onPress={remove} style={{position: 'absolute', right: 10, top: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center'}}>
          <Ionicons name="close" size={18} color={Colors.hopeWhite} />
        </TouchableOpacity>
        <JournalTextInput themed ref={registerInput} accentColor={accent} value={block.text} onChangeText={text => onChange({text})}
          placeholder="Add a caption…" placeholderTextColor={onDark ? 'rgba(255,255,255,0.45)' : Colors.textGray}
          style={{color: foreground, fontSize: 14, paddingVertical: 10}} />
      </View>
    );
  }

  if (block.kind === 'action') {
    return (
      <View onTouchStart={onFocus} style={{flexDirection: 'row', alignItems: 'center', marginBottom: JOURNAL_BLOCK_GAP}}>
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{checked: Boolean(block.completed)}}
          accessibilityLabel="Mark action complete"
          onPress={() => onChange({completed: !block.completed})}
          style={{padding: 5}}>
          <View
            style={{
              width: 19,
              height: 19,
              borderRadius: 7,
              borderWidth: 2,
              borderColor: accent,
              backgroundColor: block.completed ? accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {block.completed && (
              <Ionicons name="checkmark" size={13} color={onDark ? Colors.sage : Colors.hopeWhite} />
            )}
          </View>
        </TouchableOpacity>
        <JournalTextInput themed
          ref={registerInput}
          accentColor={accent}
          value={block.text}
          onChangeText={text => onChange({text})}
          onSubmitEditing={() => onCreateNextAction?.()}
          submitBehavior="submit"
          returnKeyType="next"
          placeholder="Add an action item…" placeholderTextColor={onDark ? 'rgba(255,255,255,0.45)' : Colors.textGray}
          multiline style={{flex: 1, color: foreground, fontSize: 16, paddingVertical: 8, textDecorationLine: block.completed ? 'line-through' : 'none'}} />
        <TouchableOpacity onPress={remove}><Ionicons name="close" size={17} color={muted} /></TouchableOpacity>
      </View>
    );
  }

  return (
    <View onTouchStart={onFocus} style={{marginBottom: JOURNAL_BLOCK_GAP, borderWidth: 1, borderColor: border, backgroundColor: surface, borderRadius: 16, padding: 14}}>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <TouchableOpacity onPress={block.uri ? togglePlayback : (recording ? stopRecording : startRecording)}
          style={{width: 42, height: 42, borderRadius: 21, backgroundColor: accent, alignItems: 'center', justifyContent: 'center'}}>
          <Ionicons name={recording ? 'stop' : playing ? 'pause' : block.uri ? 'play' : 'mic'} size={20} color={onDark ? Colors.sage : Colors.hopeWhite} />
        </TouchableOpacity>
        <View style={{flex: 1, marginLeft: 12}}>
          <ThemedText weight="bold" style={{color: foreground}}>{recording ? 'Recording…' : 'Voice Note'}</ThemedText>
          <ThemedText style={{color: muted, fontSize: 12}}>{block.uri ? formatDuration(block.durationMillis) : recording ? 'Tap stop when finished' : 'Tap to record'}</ThemedText>
        </View>
        <TouchableOpacity onPress={remove}><Ionicons name="close" size={17} color={muted} /></TouchableOpacity>
      </View>
      {!!block.uri && <JournalTextInput themed ref={registerInput} accentColor={accent} value={block.text} onChangeText={text => onChange({text})} placeholder="Add a note…" placeholderTextColor={onDark ? 'rgba(255,255,255,0.45)' : Colors.textGray} style={{color: foreground, paddingTop: 12}} />}
    </View>
  );
}
