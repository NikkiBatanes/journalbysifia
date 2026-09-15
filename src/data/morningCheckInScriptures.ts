export type ScriptureRole =
  | 'affirm'
  | 'comfort'
  | 'redirect'
  | 'confront'
  | 'remind'
  | 'ground'
  | 'guide'
  | 'direct'
  | 'encourage'
  | 'prayer';

export interface MorningCheckInScripture {
  passageReference: string;
  displayReference: string;
  role: ScriptureRole;
}

export interface PreviousScripture {
  reference: string;
  passageReference?: string;
}

export type MorningCheckInScriptureMap = Record<string, MorningCheckInScripture[]>;

export const MORNING_CHECK_IN_SCRIPTURES: MorningCheckInScriptureMap = {
  peaceful: [
    { passageReference: 'John 14:27', displayReference: 'John 14:27', role: 'ground' },
    { passageReference: 'Isaiah 26:3-4', displayReference: 'Isaiah 26:3-4', role: 'ground' },
    { passageReference: 'John 16:33', displayReference: 'John 16:33', role: 'affirm' },
    { passageReference: 'Colossians 3:15-17', displayReference: 'Colossians 3:15-17', role: 'ground' },
    { passageReference: 'Hebrews 4:9-11', displayReference: 'Hebrews 4:9-10', role: 'guide' },
  ],
  grateful: [
    { passageReference: 'Ephesians 5:18-20', displayReference: 'Ephesians 5:20', role: 'direct' },
    { passageReference: '1 Thessalonians 5:16-18', displayReference: '1 Thessalonians 5:16-18', role: 'direct' },
    { passageReference: '1 Chronicles 16:34', displayReference: '1 Chronicles 16:34', role: 'affirm' },
    { passageReference: 'Colossians 3:15-17', displayReference: 'Colossians 3:15-17', role: 'ground' },
    { passageReference: 'James 1:16-17', displayReference: 'James 1:16-17', role: 'remind' },
  ],
  hopeful: [
    { passageReference: 'Romans 15:13', displayReference: 'Romans 15:13', role: 'ground' },
    { passageReference: 'Hebrews 10:23', displayReference: 'Hebrews 10:23', role: 'ground' },
    { passageReference: 'Lamentations 3:21-24', displayReference: 'Lamentations 3:22-23', role: 'remind' },
    { passageReference: '1 Peter 1:3-5', displayReference: '1 Peter 1:3-5', role: 'ground' },
    { passageReference: 'Romans 5:1-5', displayReference: 'Romans 5:3-5', role: 'redirect' },
  ],
  joyful: [
    { passageReference: 'Romans 12:12', displayReference: 'Romans 12:12', role: 'ground' },
    { passageReference: 'Philippians 4:4-7', displayReference: 'Philippians 4:4', role: 'direct' },
    { passageReference: 'John 15:9-11', displayReference: 'John 15:9-11', role: 'ground' },
    { passageReference: 'Luke 10:20', displayReference: 'Luke 10:20', role: 'remind' },
    { passageReference: 'Nehemiah 8:10', displayReference: 'Nehemiah 8:10', role: 'affirm' },
  ],
  anxious: [
    { passageReference: 'Philippians 4:6-7', displayReference: 'Philippians 4:6-7', role: 'redirect' },
    { passageReference: '1 Peter 5:6-7', displayReference: '1 Peter 5:6-7', role: 'direct' },
    { passageReference: 'Matthew 6:25-34', displayReference: 'Matthew 6:33-34', role: 'redirect' },
    { passageReference: '2 Thessalonians 3:16', displayReference: '2 Thessalonians 3:16', role: 'ground' },
    { passageReference: 'Zephaniah 3:17', displayReference: 'Zephaniah 3:17', role: 'comfort' },
  ],
  tired: [
    { passageReference: 'Matthew 11:28-30', displayReference: 'Matthew 11:28-30', role: 'comfort' },
    { passageReference: 'Isaiah 40:28-31', displayReference: 'Isaiah 40:29-31', role: 'remind' },
    { passageReference: 'Mark 6:31', displayReference: 'Mark 6:31', role: 'comfort' },
    { passageReference: '2 Corinthians 4:16-18', displayReference: '2 Corinthians 4:16-18', role: 'encourage' },
    { passageReference: 'Galatians 6:9-10', displayReference: 'Galatians 6:9-10', role: 'encourage' },
  ],
  overwhelmed: [
    { passageReference: '2 Corinthians 12:9-10', displayReference: '2 Corinthians 12:9', role: 'comfort' },
    { passageReference: 'Deuteronomy 31:8', displayReference: 'Deuteronomy 31:8', role: 'ground' },
    { passageReference: '2 Corinthians 1:8-10', displayReference: '2 Corinthians 1:9-10', role: 'encourage' },
    { passageReference: '2 Corinthians 4:7-9', displayReference: '2 Corinthians 4:7-9', role: 'encourage' },
    { passageReference: 'Isaiah 43:1-2', displayReference: 'Isaiah 43:1-2', role: 'remind' },
  ],
  sad: [
    { passageReference: 'Matthew 5:4', displayReference: 'Matthew 5:4', role: 'comfort' },
    { passageReference: 'John 11:32-36', displayReference: 'John 11:33-35', role: 'redirect' },
    { passageReference: 'Habakkuk 1:2-3', displayReference: 'Habakkuk 1:2', role: 'prayer' },
    { passageReference: '2 Corinthians 1:3-5', displayReference: '2 Corinthians 1:3-5', role: 'comfort' },
    { passageReference: 'Revelation 21:3-5', displayReference: 'Revelation 21:3-5', role: 'ground' },
  ],
  frustrated: [
    { passageReference: 'James 1:19-20', displayReference: 'James 1:19-20', role: 'confront' },
    { passageReference: 'Ecclesiastes 7:9', displayReference: 'Ecclesiastes 7:9', role: 'redirect' },
    { passageReference: 'Proverbs 14:29', displayReference: 'Proverbs 14:29', role: 'confront' },
    { passageReference: 'Proverbs 16:32', displayReference: 'Proverbs 16:32', role: 'guide' },
    { passageReference: 'Ephesians 4:26-32', displayReference: 'Ephesians 4:26-27', role: 'guide' },
  ],
  excited: [
    { passageReference: 'James 1:17', displayReference: 'James 1:17', role: 'ground' },
    { passageReference: 'Proverbs 16:3', displayReference: 'Proverbs 16:3', role: 'direct' },
    { passageReference: '1 Peter 4:10-11', displayReference: '1 Peter 4:10-11', role: 'redirect' },
    { passageReference: '1 Corinthians 1:4-5', displayReference: '1 Corinthians 1:4-5', role: 'affirm' },
    { passageReference: 'James 4:13-15', displayReference: 'James 4:13-15', role: 'redirect' },
  ],
  calm: [
    { passageReference: 'Colossians 3:15', displayReference: 'Colossians 3:15', role: 'ground' },
    { passageReference: 'John 14:27', displayReference: 'John 14:27', role: 'ground' },
    { passageReference: 'Isaiah 30:15', displayReference: 'Isaiah 30:15', role: 'ground' },
    { passageReference: 'Romans 14:19', displayReference: 'Romans 14:19', role: 'remind' },
    { passageReference: 'Exodus 14:13-14', displayReference: 'Exodus 14:13-14', role: 'affirm' },
  ],
  content: [
    { passageReference: 'Philippians 4:11-13', displayReference: 'Philippians 4:11-13', role: 'affirm' },
    { passageReference: '1 Timothy 6:6-8', displayReference: '1 Timothy 6:6-8', role: 'ground' },
    { passageReference: 'Hebrews 13:5-6', displayReference: 'Hebrews 13:5-6', role: 'ground' },
    { passageReference: 'Luke 12:13-15', displayReference: 'Luke 12:15', role: 'redirect' },
    { passageReference: 'Matthew 6:33', displayReference: 'Matthew 6:33', role: 'remind' },
  ],
  stressed: [
    { passageReference: 'Matthew 11:28-30', displayReference: 'Matthew 11:28-30', role: 'comfort' },
    { passageReference: 'Luke 10:41-42', displayReference: 'Luke 10:41-42', role: 'confront' },
    { passageReference: 'Philippians 4:6-7', displayReference: 'Philippians 4:6-7', role: 'redirect' },
    { passageReference: 'Jeremiah 17:7-8', displayReference: 'Jeremiah 17:7-8', role: 'direct' },
    { passageReference: 'Matthew 6:31-34', displayReference: 'Matthew 6:33-34', role: 'redirect' },
  ],
  lonely: [
    { passageReference: 'John 14:16-18', displayReference: 'John 14:16-18', role: 'comfort' },
    { passageReference: 'Hebrews 13:5-6', displayReference: 'Hebrews 13:5-6', role: 'remind' },
    { passageReference: 'Isaiah 41:10', displayReference: 'Isaiah 41:10', role: 'comfort' },
    { passageReference: 'Ephesians 2:19-22', displayReference: 'Ephesians 2:19-20', role: 'ground' },
    { passageReference: '2 Timothy 4:16-18', displayReference: '2 Timothy 4:16-17', role: 'ground' },
  ],
  confident: [
    { passageReference: '2 Corinthians 3:4-5', displayReference: '2 Corinthians 3:4-5', role: 'ground' },
    { passageReference: 'Philippians 1:6', displayReference: 'Philippians 1:6', role: 'ground' },
    { passageReference: '2 Timothy 1:12', displayReference: '2 Timothy 1:12', role: 'redirect' },
    { passageReference: 'Proverbs 3:5-7', displayReference: 'Proverbs 3:5-7', role: 'redirect' },
    { passageReference: 'Jeremiah 9:23-24', displayReference: 'Jeremiah 9:23-24', role: 'ground' },
  ],
  worried: [
    { passageReference: 'Matthew 6:31-34', displayReference: 'Matthew 6:33-34', role: 'confront' },
    { passageReference: '1 Peter 5:6-7', displayReference: '1 Peter 5:6-7', role: 'direct' },
    { passageReference: 'Philippians 4:6-7', displayReference: 'Philippians 4:6-7', role: 'redirect' },
    { passageReference: 'Romans 8:31', displayReference: 'Romans 8:31', role: 'ground' },
    { passageReference: 'Luke 12:22-32', displayReference: 'Luke 12:29-31', role: 'comfort' },
  ],
  restless: [
    { passageReference: 'James 4:7-8', displayReference: 'James 4:7-8', role: 'redirect' },
    { passageReference: 'Matthew 6:6', displayReference: 'Matthew 6:6', role: 'guide' },
    { passageReference: 'Matthew 11:28-30', displayReference: 'Matthew 11:28-30', role: 'comfort' },
    { passageReference: 'Isaiah 30:15', displayReference: 'Isaiah 30:15', role: 'ground' },
    { passageReference: 'Romans 8:25', displayReference: 'Romans 8:25', role: 'redirect' },
  ],
  inspired: [
    { passageReference: 'Ephesians 2:10', displayReference: 'Ephesians 2:10', role: 'ground' },
    { passageReference: 'Colossians 3:17', displayReference: 'Colossians 3:17', role: 'direct' },
    { passageReference: 'Colossians 3:23-24', displayReference: 'Colossians 3:23-24', role: 'redirect' },
    { passageReference: '1 Corinthians 10:31', displayReference: '1 Corinthians 10:31', role: 'direct' },
    { passageReference: 'Colossians 1:9-10', displayReference: 'Colossians 1:10', role: 'prayer' },
  ],
  bored: [
    { passageReference: 'Colossians 3:23-24', displayReference: 'Colossians 3:23-24', role: 'direct' },
    { passageReference: 'Ephesians 5:15-17', displayReference: 'Ephesians 5:15-17', role: 'confront' },
    { passageReference: '1 Corinthians 10:31', displayReference: '1 Corinthians 10:31', role: 'redirect' },
    { passageReference: '1 Corinthians 15:58', displayReference: '1 Corinthians 15:58', role: 'prayer' },
    { passageReference: 'Ecclesiastes 9:10', displayReference: 'Ecclesiastes 9:10', role: 'direct' },
  ],
  angry: [
    { passageReference: 'James 1:19-20', displayReference: 'James 1:19-20', role: 'confront' },
    { passageReference: 'Ephesians 4:26-32', displayReference: 'Ephesians 4:31-32', role: 'confront' },
    { passageReference: 'Proverbs 15:1', displayReference: 'Proverbs 15:1', role: 'guide' },
    { passageReference: 'Romans 12:17-21', displayReference: 'Romans 12:19-21', role: 'redirect' },
    { passageReference: 'Colossians 3:8', displayReference: 'Colossians 3:8', role: 'direct' },
  ],
  discouraged: [
    { passageReference: '2 Corinthians 4:16-18', displayReference: '2 Corinthians 4:16-18', role: 'encourage' },
    { passageReference: 'Galatians 6:9-10', displayReference: 'Galatians 6:9-10', role: 'encourage' },
    { passageReference: 'Hebrews 10:35-36', displayReference: 'Hebrews 10:35-36', role: 'encourage' },
    { passageReference: 'Hebrews 12:1-3', displayReference: 'Hebrews 12:1-3', role: 'remind' },
    { passageReference: 'Isaiah 40:28-31', displayReference: 'Isaiah 40:31', role: 'encourage' },
  ],
  brave: [
    { passageReference: 'Joshua 1:7-9', displayReference: 'Joshua 1:7-9', role: 'affirm' },
    { passageReference: 'Deuteronomy 31:6-8', displayReference: 'Deuteronomy 31:6-8', role: 'ground' },
    { passageReference: '1 Chronicles 28:20', displayReference: '1 Chronicles 28:20', role: 'ground' },
    { passageReference: 'Hebrews 13:5-6', displayReference: 'Hebrews 13:5-6', role: 'affirm' },
    { passageReference: '2 Timothy 1:7-8', displayReference: '2 Timothy 1:7-8', role: 'remind' },
  ],
  hopeless: [
    { passageReference: 'Lamentations 3:21-26', displayReference: 'Lamentations 3:22-23', role: 'remind' },
    { passageReference: 'Romans 15:13', displayReference: 'Romans 15:13', role: 'remind' },
    { passageReference: 'John 11:25-26', displayReference: 'John 11:25-26', role: 'redirect' },
    { passageReference: 'Romans 8:31-39', displayReference: 'Romans 8:38-39', role: 'ground' },
    { passageReference: '2 Corinthians 4:7-9', displayReference: '2 Corinthians 4:7-9', role: 'encourage' },
  ],
  grumpy: [
    { passageReference: 'Philippians 2:14-16', displayReference: 'Philippians 2:14-16', role: 'confront' },
    { passageReference: 'Colossians 3:12-17', displayReference: 'Colossians 3:12-14', role: 'confront' },
    { passageReference: 'James 1:19-20', displayReference: 'James 1:19-20', role: 'guide' },
    { passageReference: 'Philippians 4:8-9', displayReference: 'Philippians 4:8-9', role: 'redirect' },
    { passageReference: 'Ephesians 4:29-32', displayReference: 'Ephesians 4:29', role: 'confront' },
  ],
  stuck: [
    { passageReference: 'James 1:5-8', displayReference: 'James 1:5-6', role: 'direct' },
    { passageReference: 'Proverbs 3:5-7', displayReference: 'Proverbs 3:5-7', role: 'redirect' },
    { passageReference: 'Philippians 2:13', displayReference: 'Philippians 2:13', role: 'remind' },
    { passageReference: 'Isaiah 30:21', displayReference: 'Isaiah 30:21', role: 'guide' },
    { passageReference: 'Proverbs 16:9', displayReference: 'Proverbs 16:9', role: 'direct' },
  ],
  loved: [
    { passageReference: '1 John 3:1', displayReference: '1 John 3:1', role: 'affirm' },
    { passageReference: 'Romans 8:35-39', displayReference: 'Romans 8:38-39', role: 'ground' },
    { passageReference: 'Ephesians 3:17-19', displayReference: 'Ephesians 3:17-19', role: 'remind' },
    { passageReference: '1 John 4:9-10', displayReference: '1 John 4:9-10', role: 'ground' },
    { passageReference: 'John 15:9-10', displayReference: 'John 15:9-10', role: 'affirm' },
  ],
  general: [
    { passageReference: 'Matthew 11:28-30', displayReference: 'Matthew 11:28-30', role: 'comfort' },
    { passageReference: 'Lamentations 3:22-24', displayReference: 'Lamentations 3:22-24', role: 'remind' },
    { passageReference: 'Proverbs 3:5-7', displayReference: 'Proverbs 3:5-7', role: 'redirect' },
    { passageReference: 'Hebrews 4:14-16', displayReference: 'Hebrews 4:14-16', role: 'ground' },
    { passageReference: 'James 1:5-6', displayReference: 'James 1:5-6', role: 'guide' },
  ],
};

function feelingIdToPoolKey(feelingId: string | undefined): string {
  const id = (feelingId || '').toLowerCase().trim();
  const pool = MORNING_CHECK_IN_SCRIPTURES[id];
  if (pool && pool.length) { return id; }
  return 'general';
}

export function getMorningCheckInPoolKey(feelingId: string | undefined): string {
  return feelingIdToPoolKey(feelingId);
}

export function getMorningCheckInScripturePool(feelingId: string | undefined): MorningCheckInScripture[] {
  return MORNING_CHECK_IN_SCRIPTURES[feelingIdToPoolKey(feelingId)];
}

export function getNextScriptureIndexFromHistory(
  pool: MorningCheckInScripture[],
  previousScriptures: PreviousScripture[]
): number {
  for (const prev of previousScriptures) {
    const lastIndex = pool.findIndex(s =>
      s.displayReference === prev.reference ||
      s.passageReference === prev.reference ||
      (prev.passageReference && (s.displayReference === prev.passageReference || s.passageReference === prev.passageReference))
    );
    if (lastIndex >= 0) {
      return (lastIndex + 1) % pool.length;
    }
  }
  return 0;
}
