export interface DashboardHeaderScripture {
  /** Reference used to open the full passage in ScriptureReaderModal. */
  passageReference: string;
  /** Reference displayed beneath the header verse text. */
  displayReference: string;
}

// Morning orientation: faithfulness, new mercy, seeking God, walking with God,
// gratitude, hope, strength, God's presence, beginning the day in Christ, praise.
export const MORNING_HEADER_SCRIPTURES: DashboardHeaderScripture[] = [
  { passageReference: 'Lamentations 3:23', displayReference: 'Lamentations 3:23' },
  { passageReference: 'Isaiah 50:4', displayReference: 'Isaiah 50:4' },
  { passageReference: 'Matthew 6:34', displayReference: 'Matthew 6:34' },
  { passageReference: 'Isaiah 26:3', displayReference: 'Isaiah 26:3' },
  { passageReference: 'Romans 15:13', displayReference: 'Romans 15:13' },
  { passageReference: 'Colossians 3:23', displayReference: 'Colossians 3:23' },
  { passageReference: 'Ephesians 2:10', displayReference: 'Ephesians 2:10' },
  { passageReference: 'Zephaniah 3:5', displayReference: 'Zephaniah 3:5' },
  { passageReference: 'Isaiah 40:31', displayReference: 'Isaiah 40:31' },
  { passageReference: 'Mark 1:35', displayReference: 'Mark 1:35' },
  { passageReference: 'Hebrews 10:23', displayReference: 'Hebrews 10:23' },
  { passageReference: 'Philippians 4:13', displayReference: 'Philippians 4:13' },
  { passageReference: '1 Thessalonians 5:16', displayReference: '1 Thessalonians 5:16' },
  { passageReference: '1 Thessalonians 5:17', displayReference: '1 Thessalonians 5:17' },
  { passageReference: '1 Thessalonians 5:18', displayReference: '1 Thessalonians 5:18' },
  { passageReference: 'James 1:17', displayReference: 'James 1:17' },
  { passageReference: '2 Corinthians 5:7', displayReference: '2 Corinthians 5:7' },
  { passageReference: 'Hebrews 13:6', displayReference: 'Hebrews 13:6' },
  { passageReference: 'Hebrews 13:8', displayReference: 'Hebrews 13:8' },
  { passageReference: '1 Corinthians 15:58', displayReference: '1 Corinthians 15:58' },
  { passageReference: 'Micah 6:8', displayReference: 'Micah 6:8' },
  { passageReference: 'James 1:5', displayReference: 'James 1:5' },
  { passageReference: 'Romans 12:12', displayReference: 'Romans 12:12' },
  { passageReference: '2 Thessalonians 3:16', displayReference: '2 Thessalonians 3:16' },
  { passageReference: 'Proverbs 3:5', displayReference: 'Proverbs 3:5' },
  { passageReference: 'Psalm 5:3', displayReference: 'Psalm 5:3' },
  { passageReference: 'Psalm 118:24', displayReference: 'Psalm 118:24' },
  { passageReference: 'Psalm 19:14', displayReference: 'Psalm 19:14' },
  { passageReference: 'Psalm 143:8', displayReference: 'Psalm 143:8' },
  { passageReference: 'Psalm 46:5', displayReference: 'Psalm 46:5' },
];

// Evening orientation: faithfulness, peace, rest, surrender, God's presence, grace,
// remembering God's goodness, releasing anxiety, trust, thanksgiving, closing the day.
export const EVENING_HEADER_SCRIPTURES: DashboardHeaderScripture[] = [
  { passageReference: 'Matthew 11:28', displayReference: 'Matthew 11:28' },
  { passageReference: 'John 14:27', displayReference: 'John 14:27' },
  { passageReference: 'Hebrews 4:10', displayReference: 'Hebrews 4:10' },
  { passageReference: 'Hebrews 13:5', displayReference: 'Hebrews 13:5' },
  { passageReference: '1 Peter 5:7', displayReference: '1 Peter 5:7' },
  { passageReference: 'Philippians 4:7', displayReference: 'Philippians 4:7' },
  { passageReference: 'Isaiah 41:10', displayReference: 'Isaiah 41:10' },
  { passageReference: 'Matthew 7:7', displayReference: 'Matthew 7:7' },
  { passageReference: 'John 14:1', displayReference: 'John 14:1' },
  { passageReference: 'John 16:33', displayReference: 'John 16:33' },
  { passageReference: '1 John 4:18', displayReference: '1 John 4:18' },
  { passageReference: '2 Corinthians 1:3', displayReference: '2 Corinthians 1:3' },
  { passageReference: '2 Timothy 1:7', displayReference: '2 Timothy 1:7' },
  { passageReference: 'Colossians 3:15', displayReference: 'Colossians 3:15' },
  { passageReference: 'Matthew 5:4', displayReference: 'Matthew 5:4' },
  { passageReference: '2 Corinthians 4:16', displayReference: '2 Corinthians 4:16' },
  { passageReference: 'Philippians 1:6', displayReference: 'Philippians 1:6' },
  { passageReference: 'Colossians 3:2', displayReference: 'Colossians 3:2' },
  { passageReference: '1 John 3:18', displayReference: '1 John 3:18' },
  { passageReference: 'Proverbs 3:24', displayReference: 'Proverbs 3:24' },
  { passageReference: 'Psalm 4:8', displayReference: 'Psalm 4:8' },
  { passageReference: 'Psalm 31:5', displayReference: 'Psalm 31:5' },
  { passageReference: 'Psalm 46:10', displayReference: 'Psalm 46:10' },
  { passageReference: 'Psalm 63:6', displayReference: 'Psalm 63:6' },
  { passageReference: 'Psalm 121:4', displayReference: 'Psalm 121:4' },
  { passageReference: 'Psalm 23:1', displayReference: 'Psalm 23:1' },
  { passageReference: 'Psalm 62:5', displayReference: 'Psalm 62:5' },
  { passageReference: 'Psalm 34:4', displayReference: 'Psalm 34:4' },
  { passageReference: 'Psalm 116:7', displayReference: 'Psalm 116:7' },
  { passageReference: 'Psalm 91:4', displayReference: 'Psalm 91:4' },
];

const EVENING_PERIOD_OFFSET = 100_000_000;

function dateSeed(date: Date, isEvening: boolean): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const base = year * 10000 + month * 100 + day;
  return isEvening ? base + EVENING_PERIOD_OFFSET : base;
}

/**
 * Deterministic daily selection for the dashboard header Scripture.
 * A given local calendar day + period (morning/evening) always resolves
 * to the same entry. No Math.random(), no AsyncStorage history required.
 */
export function getDashboardHeaderScripture(
  date: Date,
  isEvening = false,
  previewOffset = 0,
): DashboardHeaderScripture {
  const pool = isEvening ? EVENING_HEADER_SCRIPTURES : MORNING_HEADER_SCRIPTURES;
  const seed = dateSeed(date, isEvening);
  const index = (seed + previewOffset) % pool.length;
  return pool[index];
}
