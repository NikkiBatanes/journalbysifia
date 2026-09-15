import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import PrayerResponseSheet from '../components/prayer/PrayerResponseSheet';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { visibleStreakService } from '../services/visibleStreakService';
import { exitPrayerFlow } from '../navigation/exitPrayerFlow';

type PrayerEditorRoutes = {
  PrayerEditor: { prayerRequest: { person_name: string; content: string; id: string; user_id: string; selected_date: string } };
};
export default function PrayerEditorScreen({ route, navigation }: NativeStackScreenProps<PrayerEditorRoutes, 'PrayerEditor'>) {
  const { user } = useAuth();
  const saved = async () => {
    if (user?.id && await visibleStreakService.shouldShowCelebration(user.id, 'prayer_for_now')) {
      await visibleStreakService.markShownToday(user.id);
      (navigation as any).navigate('StreakPlan', { userId: user.id, source: 'prayer_for_now', dismissRouteCount: 2 });
      return;
    }
    exitPrayerFlow(navigation as any);
  };
  return <PrayerResponseSheet request={route.params.prayerRequest} onClose={() => navigation.goBack()} onSaved={saved} />;
}
