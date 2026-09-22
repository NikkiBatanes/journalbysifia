import {
  EVENING_CLOSING_MESSAGES,
  getDailyClosingMessage,
  MORNING_CLOSING_MESSAGES,
} from '../dailyClosingMessageService';

const dateAtOffset = (offset: number): string => {
  const date = new Date(Date.UTC(2026, 0, 1 + offset));
  return date.toISOString().slice(0, 10);
};

describe('daily closing messages', () => {
  it('contains 90 unique messages for each flow', () => {
    expect(MORNING_CLOSING_MESSAGES).toHaveLength(90);
    expect(EVENING_CLOSING_MESSAGES).toHaveLength(90);
    expect(new Set(MORNING_CLOSING_MESSAGES).size).toBe(90);
    expect(new Set(EVENING_CLOSING_MESSAGES).size).toBe(90);
  });

  it('does not share messages between the morning and evening pools', () => {
    const morningMessages = new Set<string>(MORNING_CLOSING_MESSAGES);
    expect(EVENING_CLOSING_MESSAGES.filter(message => morningMessages.has(message))).toEqual([]);
  });

  it.each(['morning', 'evening'] as const)('does not repeat during a 90-day %s cycle', flow => {
    const messages = Array.from({length: 90}, (_, offset) => getDailyClosingMessage({
      userId: 'user-one',
      date: dateAtOffset(offset),
      flow,
    }));
    expect(new Set(messages).size).toBe(90);
  });

  it('returns the same message for the same user, date, and flow', () => {
    const request = {userId: 'user-one', date: '2026-09-22', flow: 'morning' as const};
    expect(getDailyClosingMessage(request)).toBe(getDailyClosingMessage(request));
  });

  it('gives different users different 90-day rotations', () => {
    const firstRotation = Array.from({length: 90}, (_, offset) => getDailyClosingMessage({
      userId: 'user-one',
      date: dateAtOffset(offset),
      flow: 'morning',
    }));
    const secondRotation = Array.from({length: 90}, (_, offset) => getDailyClosingMessage({
      userId: 'user-two',
      date: dateAtOffset(offset),
      flow: 'morning',
    }));
    expect(secondRotation).not.toEqual(firstRotation);
  });
});
