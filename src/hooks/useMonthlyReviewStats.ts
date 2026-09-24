import {useCallback, useState} from 'react';
import {DeviceEventEmitter} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';

import {
  getMonthlyReviewStats,
  type MonthlyReviewStats,
} from '../services/monthlyReviewStatsService';

export const useMonthlyReviewStats = (
  enabled: boolean,
  periodStart: string,
  periodEnd: string,
) => {
  const key = enabled ? `${periodStart}:${periodEnd}` : '';
  const [result, setResult] = useState<{key: string; stats: MonthlyReviewStats} | null>(null);

  useFocusEffect(useCallback(() => {
    if (!enabled) {return undefined;}
    let active = true;
    let version = 0;
    const load = async () => {
      const request = ++version;
      try {
        const stats = await getMonthlyReviewStats(periodStart, periodEnd);
        if (active && request === version) {setResult({key, stats});}
      } catch {
        if (active && request === version) {setResult(null);}
      }
    };
    void load();
    const listeners = ['reflection_saved', 'prayerSaved', 'prayerDeleted', 'gospelShareChanged'].map(event =>
      DeviceEventEmitter.addListener(event, () => {void load();}));
    return () => {
      active = false;
      listeners.forEach(listener => listener.remove());
    };
  }, [enabled, key, periodStart, periodEnd]));

  return result?.key === key ? result.stats : null;
};
