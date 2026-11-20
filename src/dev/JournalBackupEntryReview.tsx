import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {ReviewGroup, ReviewItem} from '../services/compareJournalBackupEntries';
import {useTheme} from '../theme/ThemeContext';

const categories: {group: ReviewGroup; label: string; explanation: string}[] = [
  {group: 'review', label: 'Need review', explanation: 'These versions need a decision before restore.'},
  {group: 'backupOnly', label: 'Only in backup', explanation: 'These entries could be added to this device.'},
  {group: 'deviceOnly', label: 'Only on device', explanation: 'Keep these entries as they are on this device.'},
  {group: 'matching', label: 'Matching', explanation: 'These entries already match. Skip them during restore.'},
  {group: 'backupOnlyDeletions', label: 'Deletion records only in backup', explanation: 'These entries were deleted in the backup and are already absent here.'},
];
const pageSize = 5;

export function JournalBackupEntryReview({groups}: {groups: Record<ReviewGroup, ReviewItem[]>}) {
  const {colors, fontFamily} = useTheme();
  const [selected, setSelected] = useState<ReviewGroup | null>(null);
  const [page, setPage] = useState(0);
  const text = {color: colors.text, fontFamily};
  const category = categories.find(value => value.group === selected);
  const items = selected ? groups[selected] : [];
  function action(label: string, onPress: () => void) {
    return <Pressable key={label} accessibilityRole="button" onPress={onPress} style={styles.action}>
      <Text style={[text, styles.bold]}>{label}</Text>
    </Pressable>;
  }
  function version(label: string, entry: ReviewItem['device'][number]) {
    return <View key={label}>
      <Text style={text}>{label} · {entry.kind} · {entry.date}</Text>
      {entry.deleted ? <Text style={text}>Marked deleted</Text> : <>
        {!!entry.title && <Text style={[text, styles.bold]}>{entry.title}</Text>}
        {!!entry.excerpt && entry.excerpt !== entry.title && <Text style={text}>{entry.excerpt}</Text>}
        {entry.photos > 0 && <Text style={text}>{entry.photos} {entry.photos === 1 ? 'photo' : 'photos'}</Text>}
      </>}
    </View>;
  }
  return <View style={styles.review}>
    <Text accessibilityRole="header" style={[text, styles.bold]}>Restore review</Text>
    <Text style={text}>Compare journal entries, reflections and prayers. This preview makes no changes.</Text>
    {category ? <>
      <Text accessibilityRole="header" style={[text, styles.bold]}>{category.label}</Text>
      <Text style={text}>{category.explanation}</Text>
      <Text accessibilityLiveRegion="polite" style={text}>Entries {page * pageSize + 1}–{Math.min((page + 1) * pageSize, items.length)} of {items.length}</Text>
      {items.slice(page * pageSize, (page + 1) * pageSize).map(item => <View key={item.id}
        style={[styles.row, {borderColor: colors.borderLight}]}>
        {!!item.reason && <Text style={[text, styles.bold]}>{item.reason}</Text>}
        {item.backup && version('Backup', item.backup)}
        {item.device.map((entry, i) => version(item.device.length === 1 ? 'On device' : 'On device ' + (i + 1), entry))}
      </View>)}
      {page > 0 && action('Previous entries', () => setPage(page - 1))}
      {(page + 1) * pageSize < items.length && action('Next entries', () => setPage(page + 1))}
      {action('Back to summary', () => setSelected(null))}
    </> : categories.map(({group, label}) => {
      const count = groups[group].length;
      if (!count && group === 'backupOnlyDeletions') {return null;}
      const summary = label + ' · ' + count;
      return count ? action(summary, () => {setPage(0); setSelected(group);}) : <Text key={group} style={text}>{summary}</Text>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  review: {paddingVertical: 4}, bold: {fontWeight: '600'}, action: {minHeight: 44, justifyContent: 'center'},
  row: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth},
});
