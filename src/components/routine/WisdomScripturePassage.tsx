import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { BibleCopyrightModal } from '../BibleCopyrightModal';
import ThemedText from '../common/ThemedText';
import { getScripturePassage, type ScriptureReaderResult } from '../../services/scriptureReaderService';
import { Colors } from '../../theme/colors';

export default function WisdomScripturePassage({ reference, version = 'NASB', first = true }: { reference: string; version?: string; first?: boolean }) {
  const [passage, setPassage] = useState<ScriptureReaderResult | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [showCopyright, setShowCopyright] = useState(false);

  useEffect(() => {
    let active = true;
    setPassage(null);
    setError(false);
    getScripturePassage(reference.replace(/–/g, '-'), version)
      .then(result => { if (active) {setPassage(result);} })
      .catch(() => { if (active) {setError(true);} });
    return () => { active = false; };
  }, [reference, version, retry]);

  return (
    <View style={[styles.container, !first && { marginTop: 12 }]}>
      <View style={styles.leftBar} />
      <View style={styles.content}>
      <View style={styles.referenceRow}>
        <ThemedText weight="medium" style={styles.reference}>{passage?.reference || reference} · {passage?.version || version}</ThemedText>
        <TouchableOpacity onPress={() => setShowCopyright(true)} accessibilityRole="button" accessibilityLabel="Bible translation information" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.sage} />
        </TouchableOpacity>
      </View>
      {error ? (
        <TouchableOpacity onPress={() => setRetry(value => value + 1)} accessibilityRole="button" accessibilityLabel="Retry loading passage">
          <ThemedText style={styles.reference}>Could not load this passage. Tap to retry.</ThemedText>
        </TouchableOpacity>
      ) : !passage ? <ActivityIndicator color={Colors.sage} /> : (
        <Text style={styles.verseText}>
          {passage.verses?.length ? passage.verses.map(verse => verse.lines.join('\n')).join('\n') : passage.text}
        </Text>
      )}
      </View>
      <BibleCopyrightModal visible={showCopyright} onClose={() => setShowCopyright(false)} bibleVersion={passage?.version || version} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24, marginBottom: 0, flexDirection: 'row' },
  leftBar: { width: 1, backgroundColor: Colors.text, opacity: 0.3, marginRight: 12, borderRadius: 2, alignSelf: 'stretch' },
  content: { flex: 1 },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  reference: { fontSize: 8, lineHeight: 12, letterSpacing: 2, textTransform: 'uppercase', color: Colors.text, opacity: 0.6, flexShrink: 1 },
  verseText: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontStyle: 'italic', fontSize: 14, lineHeight: 22, color: Colors.text, opacity: 0.6, textAlign: 'left' },
});
