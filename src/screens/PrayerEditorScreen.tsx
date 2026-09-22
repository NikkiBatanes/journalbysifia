import React from 'react';
import {DeviceEventEmitter} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import PrayerResponseSheet from '../components/prayer/PrayerResponseSheet';
import {claimFaithfulRhythmCelebration, FAITHFUL_RHYTHM_UPDATED} from '../services/faithfulRhythmService';
import { exitPrayerFlow } from '../navigation/exitPrayerFlow';

type PrayerEditorRoutes = {
  PrayerEditor: { prayerRequest: { person_name: string; content: string; id: string; user_id: string; selected_date: string } };
};
export default function PrayerEditorScreen({ route, navigation }: NativeStackScreenProps<PrayerEditorRoutes, 'PrayerEditor'>) {
  const saved = async () => {
    DeviceEventEmitter.emit(FAITHFUL_RHYTHM_UPDATED, {rhythm: 'prayer', selectedDate: route.params.prayerRequest.selected_date});
    if (await claimFaithfulRhythmCelebration('prayer', route.params.prayerRequest.selected_date)) {
      (navigation as any).navigate('StreakPlan', {
        rhythm: 'prayer',
        source: 'prayer_for_now',
        returnTo: 'prayer',
      });
      return;
    }
    exitPrayerFlow(navigation as any);
  };
  return <PrayerResponseSheet request={route.params.prayerRequest} onClose={() => navigation.goBack()} onSaved={saved} />;
}
