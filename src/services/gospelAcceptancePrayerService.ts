import {DeviceEventEmitter} from 'react-native';

import {toLocalDateString} from '../utils/date';
import {PrayerApi, type PrayerApiEntry} from './api/prayerApi';

export interface RecordGospelAcceptancePrayerInput {
  gospelPersonId: string;
  personName: string;
  prayerStartedAt: string;
  acceptedAt: string;
}

const answerId = (gospelPersonId: string): string =>
  `gospel-acceptance-${gospelPersonId}`;

const isGospelTrackPrayer = (
  prayer: PrayerApiEntry,
  gospelPersonId: string,
): boolean => prayer.metadata?.source === 'gospel_track'
  && prayer.metadata?.gospel_person_id === gospelPersonId;

export const recordGospelAcceptanceAsAnsweredPrayer = async (
  input: RecordGospelAcceptancePrayerInput,
): Promise<PrayerApiEntry> => {
  const personName = input.personName.trim() || 'Someone';
  const prayers = await PrayerApi.getAllPrayers('local');
  const existing = prayers.find(prayer =>
    isGospelTrackPrayer(prayer, input.gospelPersonId),
  );
  const savedAnswerHistory = existing?.metadata?.answer_history;
  const existingAnswers = Array.isArray(savedAnswerHistory)
    ? savedAnswerHistory
    : [];
  const acceptanceAnswer = {
    id: answerId(input.gospelPersonId),
    date: input.acceptedAt,
    note: 'Accepted Jesus as Lord and Savior.',
  };
  const answerHistory = existingAnswers.some(answer => answer?.id === acceptanceAnswer.id)
    ? existingAnswers
    : [...existingAnswers, acceptanceAnswer];
  const metadata = {
    ...existing?.metadata,
    source: 'gospel_track',
    origin: 'gospel_track',
    gospel_person_id: input.gospelPersonId,
    praying_since: input.prayerStartedAt,
    track_answered: true,
    is_active: false,
    tracking_status: 'answered',
    answer_history: answerHistory,
  };
  const content = `That ${personName} would know Jesus as Lord and Savior.`;

  const saved = existing
    ? await PrayerApi.updatePrayer(existing.id, {
        content,
        person_name: personName,
        status: 'answered',
        answered_date: existing.answered_date || input.acceptedAt,
        metadata,
      })
    : await PrayerApi.createPrayer({
        user_id: 'local',
        prayer_type: 'people',
        content,
        person_name: personName,
        selected_date: toLocalDateString(new Date(input.prayerStartedAt)),
        prayed: true,
        prayer_count: 1,
        last_prayed_at: input.acceptedAt,
        status: 'answered',
        answered_date: input.acceptedAt,
        metadata,
      });

  DeviceEventEmitter.emit('prayerSaved');
  return saved;
};
