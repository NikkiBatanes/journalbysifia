import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { Feather, FileText, Sparkles, Leaf } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import ThemedText from '../common/ThemedText';
import { getLocalReflections } from '../../storage/reflectionStorage';
import { toLocalDateString } from '../../utils/date';
import { safeJsonParse } from '../../utils/safeJsonParse';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { preloadScripturePassages } from '../../services/scriptureReaderService';

interface SermonNotesProps {
  selectedDate: Date;
  refreshKey?: number;
  viewMode?: 'carousel' | 'inline' | 'moments';
  navigation?: any;
}

interface SermonBlock {
  kind: string;
  text?: string;
  secondary?: string;
  note?: string;
  points?: string[];
}

export const SermonNotesReactQuery: React.FC<SermonNotesProps> = ({
  selectedDate,
  refreshKey,
}) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const bibleVersion = (user as any)?.user_metadata?.preferences?.content?.bibleVersion || 'NASB';
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const dateStr = toLocalDateString(selectedDate);
        const sermons = await getLocalReflections('sermon', dateStr);
        if (!mounted) {return;}
        setEntries(sermons);
      } catch (e) {
        console.warn('[SermonNotesReactQuery] load error', e);
      } finally {
        if (mounted) {setLoading(false);}
      }
    })();
    return () => { mounted = false; };
  }, [selectedDate, refreshKey]);

  useEffect(() => {
    const references = entries.flatMap(entry =>
      String(entry.metadata?.main_scripture || '')
        .split(/[;\n]+/)
        .map(reference => reference.trim())
        .filter(Boolean),
    );
    if (references.length > 0) {
      void preloadScripturePassages([...new Set<string>(references)], bibleVersion);
    }
  }, [bibleVersion, entries]);

  if (loading) {return null;}
  if (!entries.length) {return null;}

  const handleOpenSermon = (entry: any) => {
    (navigation as any).navigate('Journal', {
      screen: 'SermonNotesDetail',
      params: {
        reflectionId: entry.id,
        selectedDate: entry.selected_date || toLocalDateString(selectedDate),
      },
    });
  };

  const getFeaturedQuote = (blocks: SermonBlock[], metadata: Record<string, any>): string => {
    const quoteBlock = blocks.find(b => b.kind === 'quote' && b.text?.trim());
    if (quoteBlock) {return quoteBlock.text?.trim() || '';}
    const carry = metadata.carry?.trim();
    if (carry) {return carry;}
    const remember = blocks.find(b => b.kind === 'remember' && b.text?.trim());
    if (remember) {return remember.text?.trim() || '';}
    const prayer = blocks.find(b => b.kind === 'prayer' && b.text?.trim());
    if (prayer) {return prayer.text?.trim() || '';}
    return '';
  };

  const renderFooterItem = (icon: React.ReactNode, label: string, count: number) => (
    <View style={styles.footerItem}>
      {icon}
      <ThemedText style={styles.footerText}>
        {count > 1 ? `${count} ${label.toLowerCase()}` : label}
      </ThemedText>
    </View>
  );

  const renderSermon = (entry: any) => {
    const metadata = entry.metadata || {};
    const content = safeJsonParse<{ blocks?: SermonBlock[] }>(entry.content, { fallback: { blocks: [] } });
    const blocks = (content?.blocks || []).filter((b: SermonBlock) => {
      if (b.text?.trim()) {return true;}
      if (b.secondary?.trim()) {return true;}
      if (b.note?.trim()) {return true;}
      if (b.points?.some(p => p.trim())) {return true;}
      return false;
    });

    const title = entry.title || 'Sermon Notes';
    const seriesLine = [metadata.series, metadata.part ? `Part ${metadata.part}` : ''].filter(Boolean).join(' · ');
    const detailLine = [metadata.speaker, metadata.main_scripture].filter(Boolean).join(' · ');
    const quote = getFeaturedQuote(blocks, metadata);
    const time = entry.created_at ? format(new Date(entry.created_at), 'h:mm a') : '';

    const noteBlocks = blocks.filter(b =>
      !['prayer', 'question', 'reflection_question', 'response', 'remember', 'revisit'].includes(b.kind)
    );
    const reflectionBlocks = blocks.filter(b =>
      ['question', 'reflection_question', 'response', 'remember', 'revisit'].includes(b.kind)
    );
    const reflectiveFields = ['notice', 'carry', 'prayer', 'prayer_answer'];
    const reflectiveCount = reflectionBlocks.length + reflectiveFields.filter(f => metadata[f]?.trim()).length;
    const hasPrayer = Boolean(metadata.prayer?.trim() || blocks.some(b => b.kind === 'prayer' && b.text?.trim()));

    return (
      <TouchableOpacity key={entry.id} style={styles.card} activeOpacity={0.8} onPress={() => handleOpenSermon(entry)}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText weight="bold" style={styles.headerTitle}>SERMON NOTES</ThemedText>
          </View>
          {!!time && <ThemedText style={styles.time}>{time}</ThemedText>}
        </View>

        <View>
          <ThemedText weight="bold" style={styles.title}>{title}</ThemedText>
          {!!seriesLine && <ThemedText style={styles.series}>{seriesLine}</ThemedText>}
          {!!detailLine && <ThemedText style={styles.detail}>{detailLine}</ThemedText>}

          {!!quote && (
            <View style={styles.quoteBox}>
              <ThemedText style={styles.quote}>“{quote}”</ThemedText>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {renderFooterItem(<FileText size={14} color={Colors.textGray} />, 'Notes', noteBlocks.length)}
            {renderFooterItem(<Sparkles size={14} color={Colors.textGray} />, 'Reflections', reflectiveCount)}
            {renderFooterItem(<Leaf size={14} color={Colors.textGray} />, 'Prayer', hasPrayer ? 1 : 0)}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {entries.map(renderSermon)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  card: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 20,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 12,
    color: Colors.textGray,
    letterSpacing: 1.5,
  },
  time: {
    fontSize: 13,
    color: Colors.textGray,
  },
  title: {
    fontFamily: Fonts.lora.bold,
    fontSize: 32,
    lineHeight: 38,
    color: Colors.text,
    marginBottom: 8,
  },
  series: {
    fontSize: 15,
    color: Colors.textGray,
    marginBottom: 2,
  },
  detail: {
    fontSize: 14,
    color: Colors.textGray,
    marginBottom: 16,
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.sage,
    paddingLeft: 14,
    marginVertical: 4,
  },
  quote: {
    fontFamily: Fonts.lora.regular,
    fontSize: 17,
    lineHeight: 26,
    color: Colors.text,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginTop: 16,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textGray,
  },

});
