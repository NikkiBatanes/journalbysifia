import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { format } from 'date-fns';
import { BookOpen, Highlighter, MessageCircle, Sparkles, Leaf } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import {
  BibleStudyContent,
} from '../../storage/bibleStudyStorage';
import { LocalReflectionEntry } from '../../storage/reflectionStorage';
import { getSavedBibleStudyReflections, parseSavedBibleStudy } from '../../storage/bibleStudyMomentsStorage';
import { toLocalDateString } from '../../utils/date';

interface Props {
  selectedDate: Date;
  refreshKey?: number;
  reflectionId?: string;
}

type SavedStudy = { reflection: LocalReflectionEntry; content: BibleStudyContent };

export const BibleStudyReactQuery: React.FC<Props> = ({ selectedDate, refreshKey, reflectionId }) => {
  const navigation = useNavigation();
  const [studies, setStudies] = useState<SavedStudy[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const reflections = (await getSavedBibleStudyReflections()).filter(entry =>
        reflectionId ? entry.id === reflectionId : entry.selected_date === toLocalDateString(selectedDate),
      );
      const loaded = reflections.map(reflection => ({ reflection, content: parseSavedBibleStudy(reflection)! }));
      if (mounted) {setStudies(loaded);}
    })().catch(error => console.warn('[BibleStudyReactQuery] load error', error));
    return () => { mounted = false; };
  }, [refreshKey, selectedDate, reflectionId]);

  if (!studies.length) {return null;}

  return (
    <View style={styles.container}>
      {studies.map(({ reflection, content }) => {
        const timestamp = reflection.metadata?.bibleStudyCompletedAt || reflection.created_at;
        const time = timestamp ? format(new Date(timestamp), 'h:mm a') : '';
        const preview = [content.observation.text, content.understanding.text, content.response.text, content.highlights[0]?.text]
          .find(text => text?.trim());
        const savedPrayer = content.prayer.saveToPrayerJournal && !!content.prayer.text.trim();
        const observationCount = content.observation.text.trim() ? 1 : 0;
        const responseCount = content.response.text.trim() ? 1 : 0;
        return (
          <TouchableOpacity
            key={reflection.id}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => (navigation as any).navigate('Journal', {
              screen: 'BibleStudy',
              params: { openMode: 'view', sessionId: reflection.metadata?.bibleStudySessionId, reflectionId: reflection.id, selectedDate: reflection.selected_date },
            })}
          >
            <View style={styles.header}>
              <ThemedText weight="bold" style={styles.eyebrow}>BIBLE STUDY</ThemedText>
              {!!time && <ThemedText style={styles.time}>{time}</ThemedText>}
            </View>
            <ThemedText weight="bold" style={styles.title}>{reflection.title || reflection.metadata?.passage?.reference || 'Bible Study'}</ThemedText>
            <ThemedText style={styles.subtitle}>Read · Understand · Respond</ThemedText>
            {!!preview && (
              <View style={styles.quoteBox}>
                <ThemedText numberOfLines={3} style={styles.quote}>{preview}</ThemedText>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.footer}>
              {content.passageRead && <View style={styles.footerItem}><BookOpen size={14} color={Colors.textGray} /><ThemedText style={styles.footerText}>Passage read</ThemedText></View>}
              <View style={styles.footerItem}><Highlighter size={14} color={Colors.textGray} /><ThemedText style={styles.footerText}>{content.highlights.length} Highlights</ThemedText></View>
              <View style={styles.footerItem}><Sparkles size={14} color={Colors.textGray} /><ThemedText style={styles.footerText}>{observationCount} Observation</ThemedText></View>
              <View style={styles.footerItem}><MessageCircle size={14} color={Colors.textGray} /><ThemedText style={styles.footerText}>{responseCount} Response</ThemedText></View>
              {savedPrayer && <View style={styles.footerItem}><Leaf size={14} color={Colors.textGray} /><ThemedText style={styles.footerText}>Prayer saved</ThemedText></View>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  card: { backgroundColor: Colors.hopeWhite, borderRadius: 24, borderWidth: 1, borderColor: Colors.cardBorder, padding: 20, shadowColor: '#29342E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  eyebrow: { fontSize: 12, color: Colors.textGray, letterSpacing: 1.5 },
  time: { fontSize: 13, color: Colors.textGray },
  title: { fontFamily: Fonts.lora.bold, fontSize: 32, lineHeight: 38, color: Colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.textGray, marginBottom: 12 },
  quoteBox: { borderLeftWidth: 3, borderLeftColor: Colors.sage, paddingLeft: 14, marginVertical: 4 },
  quote: { fontFamily: Fonts.lora.regular, fontSize: 17, lineHeight: 26, color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginTop: 16, marginBottom: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 14 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 13, color: Colors.textGray },
});
