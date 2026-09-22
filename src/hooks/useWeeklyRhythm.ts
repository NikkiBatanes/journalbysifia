import { useCallback, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getWeeklyRhythm, type WeeklyRhythm } from '../services/weeklyRhythmService';
import { toLocalDateString } from '../utils/date';

export const useWeeklyRhythm = (start: string, end: string, referenceDate = toLocalDateString(new Date())) => {
  const [result, setResult] = useState<{ key: string; rhythm: WeeklyRhythm } | null>(null);
  const key = `${start}:${end}:${referenceDate}`;
  useFocusEffect(useCallback(() => {
    let active = true;
    let version = 0;
    const load = async () => {
      const request = ++version;
      try {
        const rhythm = await getWeeklyRhythm(start, end, referenceDate);
        if (active && request === version) setResult({ key, rhythm });
      } catch {
        if (active && request === version) setResult(null);
      }
    };
    void load();
    const listeners = ['reflection_saved', 'prayerSaved', 'prayerDeleted'].map(event =>
      DeviceEventEmitter.addListener(event, () => { void load(); }));
    return () => { active = false; listeners.forEach(listener => listener.remove()); };
  }, [start, end, referenceDate, key]));
  return result?.key === key ? result.rhythm : null;
};
