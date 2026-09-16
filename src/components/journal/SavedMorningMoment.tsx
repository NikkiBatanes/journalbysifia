import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil, X } from 'lucide-react-native';
import { JournalCard } from './JournalCard';
import ScriptureReaderModal from '../ScriptureReaderModal';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';
import { useMomentsPalette } from '../../context/MomentsPaletteContext';
import { MorningMoment } from '../../storage/morningMomentsStorage';

export const SavedMorningMoment = ({ moment, viewMode = 'inline' }: { moment: MorningMoment; viewMode?: 'carousel' | 'inline' | 'moments' }) => {
  const momentsPalette = useMomentsPalette();
  const hideReadStatusIcon = momentsPalette || viewMode === 'moments';
  const [open, setOpen] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  if (moment.pluginId === 'morningcheckin') {
    const [scriptureOpen, setScriptureOpen] = useState(false);
    return <>
      <JournalCard title="MORNING CHECK-IN" variant="inline" viewMode={viewMode} cardStyle={viewMode === 'moments' ? styles.checkinCardMoments : undefined}>
        <ThemedText style={styles.feelingLabel}>HOW YOU FELT</ThemedText>
        <View style={styles.feelingRow}>
          {moment.feelingIconType === 'material'
            ? <MaterialCommunityIcons name={moment.feelingIcon || 'heart-outline'} size={16} color={Colors.sage} />
            : <Ionicons name={moment.feelingIcon || 'heart-outline'} size={16} color={Colors.sage} />}
          <ThemedText weight="semiBold" style={styles.feeling}>{moment.feeling || moment.lines[0]}</ThemedText>
        </View>
        {!!moment.scripture?.reference && (
          <>
            <View style={{ height: 16 }} />
            <ThemedText style={styles.feelingLabel}>SCRIPTURE</ThemedText>
            <TouchableOpacity onPress={() => setScriptureOpen(true)} style={[styles.feelingRow, styles.passageRow]} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Read ${moment.scripture.reference}`}>
              <ThemedText weight="regular" style={styles.checkinScripture}>{moment.scripture.reference}</ThemedText>
              <MaterialCommunityIcons name="script-text" size={12} color={Colors.sage} />
            </TouchableOpacity>
          </>
        )}
        {!!moment.underneathIt?.trim() && (
          <>
            <View style={styles.divider} />
            <ThemedText style={styles.feelingLabel}>WHAT WAS UNDERNEATH IT</ThemedText>
            <ThemedText style={styles.reflection}>{moment.underneathIt}</ThemedText>
          </>
        )}
      </JournalCard>
      {!!moment.scripture?.reference && (
        <ScriptureReaderModal visible={scriptureOpen} passages={[{ reference: moment.scripture.passageReference || moment.scripture.reference }]} initialIndex={0} onClose={() => setScriptureOpen(false)} version={moment.scripture.translation || 'NASB'} />
      )}
    </>;
  }
  if (moment.pluginId === 'morningpsalm') {
    const observationText = (moment.observations || []).join(' · ').trim();
    return <>
      <JournalCard title="DAILY PSALMS" variant="inline" viewMode={viewMode}>
        <TouchableOpacity onPress={() => setOpen(true)} style={[styles.feelingRow, styles.psalmPassageRow]} accessibilityRole="button" accessibilityLabel={`Read ${moment.title}`}>
          <ThemedText weight="semiBold" style={styles.passageTitle}>{moment.title}</ThemedText>
          <MaterialCommunityIcons name="script-text" size={16} color={Colors.sage} />
        </TouchableOpacity>
        <View style={styles.feelingRow}>
          {!hideReadStatusIcon && <Ionicons name={moment.markedRead ? 'checkmark-circle' : 'book-outline'} size={14} color={Colors.sage} />}
          <ThemedText style={styles.readStatus}>{moment.markedRead ? 'Passage read' : 'Reading in progress'}</ThemedText>
        </View>
        {!!observationText && (
          <View style={styles.observations}>
            <ThemedText style={styles.feelingLabel}>WHAT YOU SAW ABOUT GOD</ThemedText>
            {(moment.observations || []).filter(text => text.trim()).map((text, index) => (
              <ThemedText key={index} weight="semiBold" style={[styles.feeling, styles.centered, styles.observationText]}>{text}</ThemedText>
            ))}
          </View>
        )}
      </JournalCard>
      <ScriptureReaderModal visible={open} passages={[{ reference: moment.title }]} initialIndex={0} onClose={() => setOpen(false)} />
    </>;
  }
  if (moment.pluginId === 'eveningproverb') {
    const wisdomSelections = moment.wisdomSelections || [];
    const wisdomText = (moment.observations || []).join(' · ').trim();
    const [year, month, day] = moment.date.split('-').map(Number);
    const proverbDate = format(new Date(year, month - 1, day), 'MMMM d, yyyy');
    const handleEdit = () => {
      (navigation as any).navigate('EveningFlow', { screen: 'Proverbs', params: { selectedDate: moment.date } });
    };
    return <>
      <TouchableOpacity style={styles.proverbCard} onPress={() => setReflectionOpen(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`View reflection for ${moment.title}`}>
        <JournalCard title="EVENING PROVERBS" subtitle={proverbDate} variant="inline" viewMode={viewMode} showAddButton onAdd={handleEdit}>
          <View style={styles.proverbContent}>
            <TouchableOpacity onPress={() => setOpen(true)} style={[styles.feelingRow, styles.passageRow]} accessibilityRole="button" accessibilityLabel={`Read ${moment.title}`}>
              <ThemedText weight="semiBold" style={styles.passageTitle}>{moment.title}</ThemedText>
              <MaterialCommunityIcons name="script-text" size={16} color={Colors.sage} />
            </TouchableOpacity>
            <View style={styles.feelingRow}>
              {!hideReadStatusIcon && <Ionicons name={moment.markedRead ? 'checkmark-circle' : 'book-outline'} size={14} color={Colors.sage} />}
              <ThemedText style={styles.readStatus}>{moment.markedRead ? 'Passage read' : 'Reading in progress'}</ThemedText>
            </View>
            {!!wisdomText && (
              <>
                <View style={styles.divider} />
                <ThemedText style={styles.feelingLabel}>WISDOM YOU NOTICED</ThemedText>
                {wisdomSelections.length ? wisdomSelections.map(selection => (
                  <View key={selection.id || selection.label} style={styles.wisdomSelection}>
                    <ThemedText weight="semiBold" style={[styles.feeling, styles.centered]}>{selection.label}</ThemedText>
                    {!!selection.verses && <ThemedText style={styles.wisdomVerses}>{selection.verses}</ThemedText>}
                  </View>
                )) : <ThemedText weight="semiBold" style={[styles.feeling, styles.centered]}>{wisdomText}</ThemedText>}
              </>
            )}
          </View>
        </JournalCard>
      </TouchableOpacity>
      <ScriptureReaderModal visible={open} passages={[{ reference: moment.title }]} initialIndex={0} onClose={() => setOpen(false)} />
      <Modal visible={reflectionOpen} animationType="slide" onRequestClose={() => setReflectionOpen(false)}>
        <View style={[styles.page, { paddingHorizontal: 0 }]}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 80, paddingBottom: insets.bottom + 30, flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            <ThemedText style={styles.proverbDateText}>{proverbDate.toUpperCase()}</ThemedText>
            <ThemedText weight="semiBold" style={styles.label}>EVENING PROVERBS</ThemedText>
            <ThemedText weight="semiBold" style={styles.title}>{moment.title}</ThemedText>
            {!!wisdomText && <><View style={styles.divider} /><ThemedText style={styles.feelingLabel}>WISDOM YOU NOTICED</ThemedText>{wisdomSelections.length ? wisdomSelections.map(selection => <View key={selection.id || selection.label} style={styles.wisdomSelection}><ThemedText weight="semiBold" style={styles.detailWisdomLabel}>{selection.label}</ThemedText>{!!selection.verses && <ThemedText style={styles.wisdomVerses}>{selection.verses}</ThemedText>}{!!selection.prompt && <ThemedText style={styles.wisdomPrompt}>{selection.prompt}</ThemedText>}{!!selection.application && <ThemedText style={styles.answer}>{selection.application}</ThemedText>}</View>) : <ThemedText style={styles.answer}>{wisdomText}</ThemedText>}</>}
          </ScrollView>
          <View style={[styles.proverbTopBar, { top: insets.top + 16 }]}>
            <TouchableOpacity onPress={() => { setReflectionOpen(false); handleEdit(); }} style={styles.proverbTopButton} activeOpacity={0.7} accessibilityLabel="Edit" accessibilityRole="button"><Pencil size={20} color={Colors.sage} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setReflectionOpen(false)} style={styles.proverbTopButton} activeOpacity={0.7} accessibilityLabel="Close" accessibilityRole="button"><X size={20} color={Colors.sage} /></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>;
  }
  return <>
    <TouchableOpacity style={styles.card} onPress={() => setOpen(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`View ${moment.title}`}>
      <ThemedText weight="semiBold" style={styles.label}>{moment.title.toUpperCase()}</ThemedText>
      {moment.lines.filter(line => moment.markedRead === undefined || line !== 'Passage read').map((line, index) => <ThemedText key={index} numberOfLines={3} style={index === 0 ? styles.title : styles.answer}>{line}</ThemedText>)}
      {moment.markedRead !== undefined && <View style={styles.feelingRow}>{!hideReadStatusIcon && <Ionicons name={moment.markedRead ? 'checkmark-circle' : 'book-outline'} size={16} color={Colors.sage} />}<ThemedText style={styles.readStatus}>{moment.markedRead ? 'Passage read' : 'Reading in progress'}</ThemedText></View>}
    </TouchableOpacity>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={[styles.page, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity style={styles.close} onPress={() => setOpen(false)} accessibilityLabel="Close" accessibilityRole="button"><Ionicons name="close" size={20} color={Colors.sage} /></TouchableOpacity>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
          <ThemedText weight="semiBold" style={styles.label}>{moment.title.toUpperCase()}</ThemedText>
          {moment.lines.map((line, index) => <ThemedText key={index} style={index === 0 ? styles.title : styles.answer}>{line}</ThemedText>)}
        </ScrollView>
      </View>
    </Modal>
  </>;
};
const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  proverbCard: {},
  proverbContent: { borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 24, padding: 20 },
  proverbTopBar: { position: 'absolute', left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, paddingHorizontal: 20, backgroundColor: 'transparent' },
  proverbTopButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.cardBackground, alignItems: 'center', justifyContent: 'center' },
  proverbDateText: { color: Colors.textGray, fontSize: 11, letterSpacing: 1.5, textAlign: 'center', marginBottom: 16 },
  psalmPassageRow: { marginTop: 0, marginBottom: 8 },
  passageRow: { marginTop: 0, marginBottom: 8, alignSelf: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9 },
  checkinScripture: { color: Colors.sage, fontSize: 12, lineHeight: 18 },
  passageTitle: { color: Colors.sage, fontSize: 14 },
  reflection: { color: Colors.text, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  viewAllButton: { alignSelf: 'center', paddingHorizontal: 12, paddingTop: 8 },
  viewAllText: { color: Colors.sage, fontSize: 12 },
  observations: { marginTop: 16, borderWidth: 1.5, borderColor: Colors.inputBorder, borderRadius: 24, padding: 20 },
  observationText: { marginTop: 6 },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 16 },
  feelingLabel: { color: Colors.sage, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginBottom: 8 },
  feelingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  feeling: { color: Colors.text, fontSize: 20, lineHeight: 26 },
  wisdomSelection: { alignItems: 'center', marginBottom: 16 },
  wisdomVerses: { color: Colors.textGray, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  wisdomPrompt: { color: Colors.text, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 12, marginBottom: 8, fontWeight: '600' },
  detailWisdomLabel: { color: Colors.text, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  readStatus: { color: Colors.sage, fontSize: 12 },
  checkinCardMoments: { backgroundColor: Colors.hopeWhite, borderWidth: 1.5, borderColor: Colors.cardBorder, borderRadius: 24, padding: 16, overflow: 'hidden' },
  card: { backgroundColor: Colors.hopeWhite, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, padding: 20 },
  label: { color: Colors.textGray, fontSize: 12, letterSpacing: 1.5, marginBottom: 16 },
  title: { color: Colors.text, fontSize: 24, lineHeight: 32, marginBottom: 12 },
  answer: { color: Colors.text, fontSize: 16, lineHeight: 25, marginBottom: 12 },
  page: { flex: 1, backgroundColor: Colors.lightBackground, paddingHorizontal: 24 },
  close: { alignSelf: 'flex-end', backgroundColor: Colors.cardBackground, borderRadius: 21, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
});
