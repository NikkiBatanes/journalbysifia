import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { format } from 'date-fns';
import { BookOpen, Highlighter, MessageCircle, Sparkles, Leaf } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import ThemedText from '../common/ThemedText';
import ScriptureReaderModal from '../ScriptureReaderModal';
import { BibleCopyrightModal } from '../BibleCopyrightModal';
import { triggerLightHaptic } from '../../utils/haptics';
import { Colors } from '../../theme/colors';
import { useMomentsPalette } from '../../context/MomentsPaletteContext';
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
  const momentsPalette = useMomentsPalette();
  const [studies, setStudies] = useState<SavedStudy[]>([]);
  const [readerPassage, setReaderPassage] = useState<{ reference: string; version: string } | null>(null);
  const [copyrightVersion, setCopyrightVersion] = useState<string | null>(null);

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
        const reference = reflection.title || reflection.metadata?.passage?.reference || 'Bible Study';
        const version = reflection.metadata?.passage?.translation || 'NASB';
        const textColor = Colors.text;
        const secondaryColor = Colors.textGray;
        return (
          <TouchableOpacity
            key={reflection.id}
            style={[styles.card, momentsPalette && styles.momentsCard]}
            activeOpacity={0.8}
            onPress={() => (navigation as any).navigate('Journal', {
              screen: 'BibleStudy',
              params: { openMode: 'view', sessionId: reflection.metadata?.bibleStudySessionId, reflectionId: reflection.id, selectedDate: reflection.selected_date },
            })}
          >
            <View style={styles.header}>
              <ThemedText weight="semiBold" style={[styles.eyebrow, momentsPalette && styles.momentsEyebrow]}>BIBLE STUDY</ThemedText>
              {!!time && (
                <View style={styles.timePill}>
                  <ThemedText style={styles.time}>{time}</ThemedText>
                </View>
              )}
            </View>
            <ThemedText weight="semiBold" style={[styles.title, { color: textColor }]}>{reference}</ThemedText>
            <View style={styles.passageMetaRow}>
              <ThemedText style={styles.passageMeta}>{version}</ThemedText>
              <View style={styles.passageButtons}>
                <TouchableOpacity
                  onPress={event => {
                    event.stopPropagation();
                    triggerLightHaptic();
                    setReaderPassage({ reference, version });
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Read ${reference}`}
                >
                  <MaterialCommunityIcons name="script-text" size={16} color={Colors.sage} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={event => {
                    event.stopPropagation();
                    triggerLightHaptic();
                    setCopyrightVersion(version);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${version} Bible translation information`}
                >
                  <Ionicons name="information-circle-outline" size={16} color={Colors.sage} />
                </TouchableOpacity>
              </View>
            </View>
            {!!preview && (
              <View style={styles.quoteBox}>
                <ThemedText numberOfLines={3} ellipsizeMode="tail" style={[styles.quote, { color: textColor }]}>{preview}</ThemedText>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.footer}>
              {content.passageRead && <View style={styles.footerItem}>{!momentsPalette && <BookOpen size={14} color={secondaryColor} />}<ThemedText style={styles.footerText}>Passage read</ThemedText></View>}
              <View style={styles.footerItem}><Highlighter size={14} color={secondaryColor} /><ThemedText style={styles.footerText}>{content.highlights.length} Highlights</ThemedText></View>
              <View style={styles.footerItem}><Sparkles size={14} color={secondaryColor} /><ThemedText style={styles.footerText}>{observationCount} Observation</ThemedText></View>
              <View style={styles.footerItem}><MessageCircle size={14} color={secondaryColor} /><ThemedText style={styles.footerText}>{responseCount} Response</ThemedText></View>
              {savedPrayer && <View style={styles.footerItem}><Leaf size={14} color={secondaryColor} /><ThemedText style={styles.footerText}>Prayer saved</ThemedText></View>}
            </View>
          </TouchableOpacity>
        );
      })}
      <ScriptureReaderModal
        visible={!!readerPassage}
        passages={readerPassage ? [{ reference: readerPassage.reference }] : []}
        initialIndex={0}
        version={readerPassage?.version || 'NASB'}
        onClose={() => setReaderPassage(null)}
      />
      <BibleCopyrightModal
        visible={!!copyrightVersion}
        bibleVersion={copyrightVersion || 'NASB'}
        onClose={() => setCopyrightVersion(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  card: { backgroundColor: Colors.hopeWhite, borderRadius: 24, borderWidth: 1, borderColor: Colors.cardBorder, padding: 20, shadowColor: '#29342E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  momentsCard: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  header: { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  eyebrow: { fontSize: 10, color: Colors.textGray, letterSpacing: 1.2, textAlign: 'center' },
  momentsEyebrow: { color: Colors.sage },
  timePill: { backgroundColor: Colors.anchorBlueLight, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginTop: 10, alignItems: 'center', justifyContent: 'center' },
  time: { fontSize: 12, color: Colors.textGray },
  title: { fontSize: 20, lineHeight: 26, textAlign: 'center', marginBottom: 8 },
  quoteBox: { alignItems: 'center', marginTop: 12, marginBottom: 4, paddingHorizontal: 8 },
  quote: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  passageMetaRow: { flexDirection: 'row', minHeight: 20, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 },
  passageMeta: { color: Colors.textGray, fontSize: 11, lineHeight: 16 },
  passageButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginTop: 16, marginBottom: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 14 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 13, color: Colors.textGray },
});
