export type DailyLineCategory =
  | 'stillness'
  | 'attention'
  | 'faithfulness'
  | 'grace'
  | 'scripture'
  | 'gratitude';

export type DailyLinePeriod = 'morning' | 'evening';

type DailyLineTime = 'any' | 'morning' | 'evening';

export interface DailyLine {
  text: string;
  category: DailyLineCategory;
  time: DailyLineTime;
}

// Stillness — slowing down, quiet, breathing room.
// Attention — noticing, paying attention, being present.
// Faithfulness — steps, showing up, purpose, ordinary work.
// Grace — permission, enough, beginning again, gentleness.
// Scripture — God, Scripture, truth, Word.
// Gratitude — noticing the good, gratitude, open hands.
export const DAILY_LINES: DailyLine[] = [
  { text: 'Let your heart settle.', category: 'stillness', time: 'any' },
  { text: 'Let go of the rush.', category: 'stillness', time: 'any' },
  { text: 'Make space for stillness.', category: 'stillness', time: 'any' },
  { text: 'You don’t have to rush.', category: 'stillness', time: 'any' },
  { text: 'Take a quiet moment.', category: 'stillness', time: 'any' },
  { text: 'Take your time today.', category: 'stillness', time: 'any' },
  { text: 'Pause before you move forward.', category: 'stillness', time: 'morning' },
  { text: 'Make space to breathe.', category: 'stillness', time: 'any' },
  { text: 'Let today unfold slowly.', category: 'stillness', time: 'morning' },
  { text: 'Pause here for a moment.', category: 'stillness', time: 'any' },
  { text: 'Make room to listen.', category: 'stillness', time: 'any' },
  { text: 'Let today have its pace.', category: 'stillness', time: 'any' },
  { text: 'Give yourself room to reflect.', category: 'stillness', time: 'evening' },
  { text: 'Let the noise settle.', category: 'stillness', time: 'evening' },
  { text: 'Let your thoughts become clear.', category: 'stillness', time: 'any' },
  { text: 'Listen before you hurry.', category: 'stillness', time: 'morning' },
  { text: 'What matters can be quiet.', category: 'stillness', time: 'any' },
  { text: 'You can slow down here.', category: 'stillness', time: 'any' },
  { text: 'Leave room for reflection.', category: 'stillness', time: 'evening' },
  { text: 'Let yourself be still.', category: 'stillness', time: 'any' },
  { text: 'Take a moment before moving.', category: 'stillness', time: 'morning' },
  { text: 'Let peace have some room.', category: 'stillness', time: 'any' },
  { text: 'Choose presence over hurry.', category: 'stillness', time: 'any' },
  { text: 'Let today settle gently.', category: 'stillness', time: 'evening' },
  { text: 'Let the day grow quiet.', category: 'stillness', time: 'evening' },
  { text: 'Make room to reflect.', category: 'stillness', time: 'evening' },

  { text: 'Notice what matters today.', category: 'attention', time: 'any' },
  { text: 'Be present for today.', category: 'attention', time: 'any' },
  { text: 'Take a moment to notice.', category: 'attention', time: 'any' },
  { text: 'Make room for what matters.', category: 'attention', time: 'any' },
  { text: 'Stay present in this moment.', category: 'attention', time: 'any' },
  { text: 'Pay attention to today.', category: 'attention', time: 'any' },
  { text: 'Start with what matters.', category: 'attention', time: 'morning' },
  { text: 'Small moments matter too.', category: 'attention', time: 'any' },
  { text: 'There is more to notice.', category: 'attention', time: 'any' },
  { text: 'Leave room for what matters.', category: 'attention', time: 'any' },
  { text: 'Give today your attention.', category: 'attention', time: 'morning' },
  { text: 'Pay attention to the small things.', category: 'attention', time: 'any' },
  { text: 'Take notice of what matters.', category: 'attention', time: 'any' },
  { text: 'Keep your heart attentive.', category: 'attention', time: 'any' },
  { text: 'Notice what’s already here.', category: 'attention', time: 'any' },
  { text: 'Keep what matters close.', category: 'attention', time: 'any' },
  { text: 'This moment matters too.', category: 'attention', time: 'any' },
  { text: 'There is time to notice.', category: 'attention', time: 'any' },
  { text: 'Don’t overlook the ordinary.', category: 'attention', time: 'any' },
  { text: 'Notice where your heart is.', category: 'attention', time: 'evening' },
  { text: 'Let the small things count.', category: 'attention', time: 'any' },
  { text: 'Pay attention to your heart.', category: 'attention', time: 'any' },
  { text: 'Today is worth noticing.', category: 'attention', time: 'any' },
  { text: 'Notice what today held.', category: 'attention', time: 'evening' },
  { text: 'Leave room to look back.', category: 'attention', time: 'evening' },

  { text: 'Take the next faithful step.', category: 'faithfulness', time: 'morning' },
  { text: 'There is good work ahead.', category: 'faithfulness', time: 'morning' },
  { text: 'Keep showing up faithfully.', category: 'faithfulness', time: 'any' },
  { text: 'There is purpose in today.', category: 'faithfulness', time: 'any' },
  { text: 'Small steps still move forward.', category: 'faithfulness', time: 'any' },
  { text: 'Choose what matters today.', category: 'faithfulness', time: 'morning' },
  { text: 'Faithfulness happens in small things.', category: 'faithfulness', time: 'any' },
  { text: 'Let today be intentional.', category: 'faithfulness', time: 'morning' },
  { text: 'Take today one step at a time.', category: 'faithfulness', time: 'any' },
  { text: 'Show up for what matters.', category: 'faithfulness', time: 'morning' },
  { text: 'Take the faithful next step.', category: 'faithfulness', time: 'morning' },
  { text: 'Let this day have meaning.', category: 'faithfulness', time: 'morning' },
  { text: 'Keep going with purpose.', category: 'faithfulness', time: 'any' },
  { text: 'Stay faithful in the ordinary.', category: 'faithfulness', time: 'any' },
  { text: 'Do the next right thing.', category: 'faithfulness', time: 'any' },
  { text: 'The ordinary matters too.', category: 'faithfulness', time: 'any' },
  { text: 'Be faithful with today.', category: 'faithfulness', time: 'any' },
  { text: 'Today has its own work.', category: 'faithfulness', time: 'any' },
  { text: 'Keep walking faithfully.', category: 'faithfulness', time: 'any' },
  { text: 'Take courage into today.', category: 'faithfulness', time: 'morning' },
  { text: 'Carry forward what matters.', category: 'faithfulness', time: 'evening' },

  { text: 'Begin where you are.', category: 'grace', time: 'any' },
  { text: 'Let this moment be enough.', category: 'grace', time: 'any' },
  { text: 'Start from right here.', category: 'grace', time: 'any' },
  { text: 'Take today as it comes.', category: 'grace', time: 'morning' },
  { text: 'Come as you are.', category: 'grace', time: 'any' },
  { text: 'Take the day gently.', category: 'grace', time: 'morning' },
  { text: 'Begin again if needed.', category: 'grace', time: 'any' },
  { text: 'Today doesn’t need perfection.', category: 'grace', time: 'any' },
  { text: 'There’s room to begin again.', category: 'grace', time: 'any' },
  { text: 'Faithfulness is enough for today.', category: 'grace', time: 'any' },
  { text: 'You can begin again today.', category: 'grace', time: 'any' },
  { text: 'There is grace for today.', category: 'grace', time: 'any' },
  { text: 'Let grace meet you here.', category: 'grace', time: 'any' },
  { text: 'There is mercy for today.', category: 'grace', time: 'any' },
  { text: 'You are allowed to pause.', category: 'grace', time: 'any' },
  { text: 'Not everything needs solving today.', category: 'grace', time: 'evening' },
  { text: 'Some things can wait.', category: 'grace', time: 'evening' },
  { text: 'Let today be enough.', category: 'grace', time: 'evening' },
  { text: 'Give today what you can.', category: 'grace', time: 'morning' },
  { text: 'Give your heart some room.', category: 'grace', time: 'any' },
  { text: 'Stay open to today.', category: 'grace', time: 'any' },
  { text: 'Let unfinished things rest.', category: 'grace', time: 'evening' },
  { text: 'Release what can wait until tomorrow.', category: 'grace', time: 'evening' },

  { text: 'Bring your heart before Him.', category: 'scripture', time: 'evening' },
  { text: 'Let Scripture shape today.', category: 'scripture', time: 'morning' },
  { text: 'Make room for God today.', category: 'scripture', time: 'any' },
  { text: 'Return to what is true.', category: 'scripture', time: 'any' },
  { text: 'Bring this moment to God.', category: 'scripture', time: 'any' },
  { text: 'Keep His truth close.', category: 'scripture', time: 'any' },
  { text: 'Stay near to Him today.', category: 'scripture', time: 'any' },
  { text: 'Let truth steady you.', category: 'scripture', time: 'any' },
  { text: 'Rest in His faithfulness.', category: 'scripture', time: 'evening' },
  { text: 'Rest in what is true.', category: 'scripture', time: 'evening' },
  { text: 'Let your heart turn to Him.', category: 'scripture', time: 'any' },
  { text: 'Remember what does not change.', category: 'scripture', time: 'any' },
  { text: 'Bring today before God.', category: 'scripture', time: 'morning' },
  { text: 'Let truth lead the way.', category: 'scripture', time: 'morning' },
  { text: 'Make space to listen.', category: 'scripture', time: 'any' },
  { text: 'Carry His Word with you.', category: 'scripture', time: 'morning' },
  { text: 'Remember who holds today.', category: 'scripture', time: 'any' },
  { text: 'Come back to Scripture.', category: 'scripture', time: 'any' },
  { text: 'Let His Word settle in.', category: 'scripture', time: 'evening' },
  { text: 'Keep returning to truth.', category: 'scripture', time: 'any' },

  { text: 'Look for what is good.', category: 'gratitude', time: 'any' },
  { text: 'Hold today with open hands.', category: 'gratitude', time: 'any' },
  { text: 'Let gratitude find you today.', category: 'gratitude', time: 'any' },
  { text: 'Receive today with open hands.', category: 'gratitude', time: 'morning' },
  { text: 'Notice the good around you.', category: 'gratitude', time: 'any' },
  { text: 'Welcome the day before you.', category: 'gratitude', time: 'morning' },
  { text: 'There is something worth remembering.', category: 'gratitude', time: 'evening' },
  { text: 'Keep your hands open.', category: 'gratitude', time: 'any' },
  { text: 'Make today worth remembering.', category: 'gratitude', time: 'morning' },
  { text: 'Make space for gratitude.', category: 'gratitude', time: 'any' },
  { text: 'Remember what matters most.', category: 'gratitude', time: 'any' },
  { text: 'Remember what mattered today.', category: 'gratitude', time: 'evening' },
  { text: 'Hold onto what was good.', category: 'gratitude', time: 'evening' },
  { text: 'Notice what you want to remember.', category: 'gratitude', time: 'evening' },
  { text: 'Notice what was worth keeping.', category: 'gratitude', time: 'evening' },
];

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

// Sequential day count from the local calendar date, independent of timezone.
function localDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

// FNV-1a string hash — fixed seeds keep the shuffled order deterministic.
function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isCycleArranged(
  order: DailyLine[],
  requireLastCategory: DailyLineCategory,
  avoidFirstCategory: DailyLineCategory,
): boolean {
  for (let i = 1; i < order.length; i++) {
    if (order[i].category === order[i - 1].category) {
      return false;
    }
  }
  return (
    order[0].category !== avoidFirstCategory &&
    order[order.length - 1].category === requireLastCategory
  );
}

// Moves the entry at `from` to a random valid slot between `min` and `max`
// (inclusive) where both neighbours have a different category.
function reinsert(
  order: DailyLine[],
  from: number,
  min: number,
  max: number,
  rng: () => number,
): boolean {
  const [entry] = order.splice(from, 1);
  const spots: number[] = [];
  const upper = Math.min(max, order.length);
  for (let k = min; k <= upper; k++) {
    const leftOk = k === 0 || order[k - 1].category !== entry.category;
    const rightOk = k === order.length || order[k].category !== entry.category;
    if (leftOk && rightOk) {
      spots.push(k);
    }
  }
  const target = spots.length ? spots[Math.floor(rng() * spots.length)] : from;
  order.splice(target, 0, entry);
  return spots.length > 0;
}

// Relocates the first entry whose category matches `category` to the end of
// the order, provided removal keeps its former neighbours apart.
function moveCategoryToEnd(
  order: DailyLine[],
  category: DailyLineCategory,
  rng: () => number,
): boolean {
  const last = order.length - 1;
  const candidates: number[] = [];
  for (let j = 0; j < last; j++) {
    if (order[j].category !== category) {
      continue;
    }
    if (j === 0 || order[j - 1].category !== order[j + 1].category) {
      candidates.push(j);
    }
  }
  if (!candidates.length) {
    return false;
  }
  const [entry] = order.splice(
    candidates[Math.floor(rng() * candidates.length)],
    1,
  );
  order.push(entry);
  return true;
}

// Pushes same-category neighbours apart, then enforces the cycle-edge
// constraints: the last entry must carry `requireLastCategory` and the
// first must differ from the previous cycle's last category.
function arrange(
  order: DailyLine[],
  rng: () => number,
  requireLastCategory: DailyLineCategory,
  avoidFirstCategory: DailyLineCategory,
): void {
  let i = 1;
  let guard = order.length * 4;
  while (i < order.length && guard-- > 0) {
    if (order[i].category === order[i - 1].category) {
      if (reinsert(order, i, i + 1, order.length, rng)) {
        continue;
      }
    }
    i++;
  }
  guard = order.length;
  while (
    order[order.length - 1].category !== requireLastCategory &&
    guard-- > 0
  ) {
    if (!moveCategoryToEnd(order, requireLastCategory, rng)) {
      break;
    }
  }
  guard = order.length;
  while (order[0].category === avoidFirstCategory && guard-- > 0) {
    if (!reinsert(order, 0, 1, order.length - 2, rng)) {
      break;
    }
  }
}

const CATEGORY_LIST: DailyLineCategory[] = [
  'stillness',
  'attention',
  'faithfulness',
  'grace',
  'scripture',
  'gratitude',
];

const ANY_POOL = DAILY_LINES.filter(line => line.time === 'any');
const SPECIFIC_POOLS: Record<DailyLinePeriod, DailyLine[]> = {
  morning: DAILY_LINES.filter(line => line.time === 'morning'),
  evening: DAILY_LINES.filter(line => line.time === 'evening'),
};

// Each 40-day cycle serves 15 period-specific lines (37.5%) and 25 any-time
// lines. Slot positions vary per cycle, so there is no fixed weekday-style
// pattern to notice.
const CYCLE_DAYS = 40;
const SPECIFIC_PER_CYCLE = 15;
const ANY_PER_CYCLE = CYCLE_DAYS - SPECIFIC_PER_CYCLE;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// Golden-ratio stride coprime to the pool length. Because
// gcd(stride, pool.length) === 1, ANY `pool.length` consecutive draws form
// a complete permutation of the pool — a line can only repeat after its
// whole pool has been exhausted, with no block-boundary exceptions.
function strideFor(length: number): number {
  let step = Math.max(1, Math.floor(length * 0.618));
  while (gcd(step, length) !== 1) {
    step--;
  }
  return step;
}

function streamItem(
  pool: DailyLine[],
  seedKey: string,
  n: number,
): DailyLine {
  const offset = hashSeed(seedKey) % pool.length;
  return pool[mod(n * strideFor(pool.length) + offset, pool.length)];
}

// The multiset a 40-day cycle draws from: the next ANY_PER_CYCLE lines of
// the shared any-stream and the next SPECIFIC_PER_CYCLE lines of the
// period's specific stream.
function cycleItems(period: DailyLinePeriod, cycle: number): DailyLine[] {
  const items: DailyLine[] = [];
  for (let i = 0; i < ANY_PER_CYCLE; i++) {
    items.push(streamItem(ANY_POOL, 'any', cycle * ANY_PER_CYCLE + i));
  }
  const specific = SPECIFIC_POOLS[period];
  for (let i = 0; i < SPECIFIC_PER_CYCLE; i++) {
    items.push(
      streamItem(specific, `specific:${period}`, cycle * SPECIFIC_PER_CYCLE + i),
    );
  }
  return items;
}

// Picks the category a cycle must end on: deterministic per cycle, always
// one present in that cycle's items. The next cycle avoids it first, which
// keeps the cross-cycle day boundary category-safe without chaining builds.
function requiredLastCategory(
  items: DailyLine[],
  cycle: number,
): DailyLineCategory {
  const present = CATEGORY_LIST.filter(cat =>
    items.some(line => line.category === cat),
  );
  return present[mod(cycle, present.length)];
}

const cycleOrderCache = new Map<string, DailyLine[]>();

function cycleOrder(period: DailyLinePeriod, cycle: number): DailyLine[] {
  const key = `${period}:${cycle}`;
  const cached = cycleOrderCache.get(key);
  if (cached) {
    return cached;
  }
  const items = cycleItems(period, cycle);
  const requireLast = requiredLastCategory(items, cycle);
  const avoidFirst = requiredLastCategory(
    cycleItems(period, cycle - 1),
    cycle - 1,
  );
  const seed = hashSeed(`daily-line:${period}:${cycle}`);
  let result = items;
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);
    const order = [...items];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    arrange(order, rng, requireLast, avoidFirst);
    if (isCycleArranged(order, requireLast, avoidFirst)) {
      result = order;
      break;
    }
  }
  if (cycleOrderCache.size > 64) {
    cycleOrderCache.clear();
  }
  cycleOrderCache.set(key, result);
  return result;
}

/**
 * Deterministic daily line for the dashboard subtitle.
 *
 * Each 40-day cycle serves the next 25 any-time lines and the next 15
 * period-specific lines (37.5% period flavour), seeded-shuffled and arranged
 * so no two consecutive days share a category — including across cycle
 * boundaries. A given local calendar day always resolves to the same line
 * without storage or randomness, and a line cannot repeat until its own
 * pool (any / morning / evening) has been exhausted.
 */
export function getDailyLine(date: Date, period: DailyLinePeriod): DailyLine {
  const day = localDayNumber(date);
  const order = cycleOrder(period, Math.floor(day / CYCLE_DAYS));
  return order[mod(day, CYCLE_DAYS)];
}
