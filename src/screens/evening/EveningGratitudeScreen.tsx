import { exitEveningFlow } from '../../navigation/exitEveningFlow';
import * as React from 'react';
import { DeviceEventEmitter, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import GratitudeLogEditor from '../../components/journal/GratitudeLogEditor';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { Colors } from '../../theme/colors';
import { toLocalDateString } from '../../utils/date';
import { useRoutine } from '../../context/RoutineContext';
import { fromLocalDateString } from '../../utils/date';
import { preloadScripturePassages } from '../../services/scriptureReaderService';
import {
  createLocalJournalEntry,
  getLocalJournalEntries,
  getLocalJournalEntry,
  updateLocalJournalEntry,
} from '../../storage/journalStorage';

const EveningGratitudeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { selectedDate, markStepCompleted } = useRoutine();
  const selectedDateObj = fromLocalDateString(selectedDate);
  const dateStr = toLocalDateString(selectedDateObj);

  const [gratitudeId, setGratitudeId] = React.useState<string | null>(null);
  const [initialItems, setInitialItems] = React.useState<string[]>(['', '', '']);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const day = parseInt(selectedDate.split('-')[2] || '0', 10);
    const proverbNumber = Math.min(Math.max(day, 1), 31);
    preloadScripturePassages([`Proverbs ${proverbNumber}`]);
  }, [selectedDate]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const entries = await getLocalJournalEntries('gratitude', dateStr);
      const existing = entries.find((e: any) => !e.metadata?.subtask_id) || null;
      if (existing && mounted) {
        setGratitudeId(existing.id);
        try {
          const parsed = typeof existing.content === 'string'
            ? JSON.parse(existing.content)
            : existing.content;
          if (Array.isArray(parsed?.items)) {
            setInitialItems(parsed.items);
          }
        } catch (error) {
          console.warn('Error parsing evening gratitude:', error);
        }
      }
      if (mounted) {
        setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [dateStr]);

  const handleSave = async (data: { items: string[]; date: Date }) => {
    const savedDateStr = toLocalDateString(data.date);
    const content = JSON.stringify({ items: data.items });
    let id = gratitudeId;

    try {
      if (id) {
        const existing = await getLocalJournalEntry(id, 'gratitude', savedDateStr);
        if (existing) {
          const updated = await updateLocalJournalEntry({
            ...existing,
            content,
            metadata: { ...existing.metadata, source: 'evening' },
          });
          id = updated.id;
        } else {
          const created = await createLocalJournalEntry({
            content_type: 'gratitude',
            selected_date: savedDateStr,
            content,
            metadata: { source: 'evening' },
          });
          id = created.id;
        }
      } else {
        const created = await createLocalJournalEntry({
          content_type: 'gratitude',
          selected_date: savedDateStr,
          content,
          metadata: { source: 'evening' },
        });
        id = created.id;
      }
      setGratitudeId(id);
    } catch (error) {
      console.error('Error saving evening gratitude:', error);
      throw error;
    }

    await markStepCompleted('gratitude', {
      domain: 'journal',
      content_type: 'gratitude',
      local_id: id,
    });

    DeviceEventEmitter.emit('reflection_saved', { type: 'gratitude', date: savedDateStr });

    navigation.navigate('Win', {
      selectedDate,
      gratitude: data.items.join('\n'),
      gratitudeItems: data.items,
      gratitudeId: id,
    });
  };

  const handleCancel = () => {
    exitEveningFlow(navigation, 'Today');
  };


  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.lightBackground }} />
    );
  }

  return (
    <GratitudeLogEditor
      onSave={handleSave}
      onCancel={handleCancel}
      selectedDate={selectedDateObj}
      initialItems={initialItems}
      routineDraft={{ routine: 'evening', selectedDate, step: 'gratitude' }}
    />
  );
};

export default withErrorBoundary(EveningGratitudeScreen, 'EveningGratitudeScreen');
