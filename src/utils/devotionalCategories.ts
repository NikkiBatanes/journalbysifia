import { DEVOTIONAL_CATEGORIES, DevotionalCategory } from '../interfaces/devotional';

const CATEGORY_SET = new Set<string>(DEVOTIONAL_CATEGORIES);

const LEGACY_CATEGORY_MAP: Record<string, DevotionalCategory> = {
  growth: 'Faith & Obedience',
  prayer: 'Faith & Obedience',
  faith: 'Faith & Obedience',
  'spiritual growth': 'Faith & Obedience',
  wisdom: 'Decision-Making',
  purpose: 'Calling & Purpose',
  career: 'Work & Career',
  finances: 'Finance & Stewardship',
  finance: 'Finance & Stewardship',
  health: 'Health & Wellness',
  healing: 'Hurt & Forgiveness',
  forgiveness: 'Hurt & Forgiveness',
  'mental health': 'Emotions & Inner Life',
  peace: 'Anxiety & Peace',
  hope: 'Waiting & Uncertainty',
  gratitude: 'Faith & Obedience',
};

export function isDevotionalCategory(value: unknown): value is DevotionalCategory {
  return typeof value === 'string' && CATEGORY_SET.has(value);
}

export function deriveDevotionalCategoryFromText(content: string): DevotionalCategory {
  const base = content.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

  if (base.includes('marriage') || base.includes('spouse') || base.includes('husband') || base.includes('wife')) {
    return 'Marriage';
  }
  if (base.includes('single') || base.includes('singleness') || base.includes('dating')) {
    return 'Singleness';
  }
  if (base.includes('parent') || base.includes('child') || base.includes('father') || base.includes('mother') || base.includes('kids')) {
    return 'Parenting';
  }
  if (base.includes('family') || base.includes('home')) {
    return 'Family';
  }
  if (base.includes('friend') || base.includes('friendship')) {
    return 'Friendship';
  }
  if (base.includes('relationship') || base.includes('love') || base.includes('partner')) {
    return 'Relationships';
  }
  if (base.includes('work') || base.includes('career') || base.includes('job') || base.includes('vocation')) {
    return 'Work & Career';
  }
  if (base.includes('calling') || base.includes('purpose') || base.includes('mission')) {
    return 'Calling & Purpose';
  }
  if (base.includes('money') || base.includes('finance') || base.includes('stewardship') || base.includes('financial') || base.includes('debt')) {
    return 'Finance & Stewardship';
  }
  if (base.includes('decision') || base.includes('wisdom') || base.includes('guidance') || base.includes('discern')) {
    return 'Decision-Making';
  }
  if (base.includes('conflict') || base.includes('boundary') || base.includes('boundaries')) {
    return 'Conflict & Boundaries';
  }
  if (base.includes('hurt') || base.includes('forgive') || base.includes('healing') || base.includes('restoration')) {
    return 'Hurt & Forgiveness';
  }
  if (base.includes('church') || base.includes('ministry') || base.includes('serve')) {
    return 'Church & Ministry';
  }
  if (base.includes('emotion') || base.includes('feeling') || base.includes('inner') || base.includes('heart') || base.includes('mental')) {
    return 'Emotions & Inner Life';
  }
  if (base.includes('health') || base.includes('wellness') || base.includes('body') || base.includes('physical')) {
    return 'Health & Wellness';
  }
  if (base.includes('anxiety') || base.includes('worry') || base.includes('stress') || base.includes('peace') || base.includes('calm')) {
    return 'Anxiety & Peace';
  }
  if (base.includes('fear') || base.includes('trust') || base.includes('courage') || base.includes('brave')) {
    return 'Fear & Trust';
  }
  if (base.includes('wait') || base.includes('uncertain') || base.includes('hope')) {
    return 'Waiting & Uncertainty';
  }
  if (base.includes('grief') || base.includes('loss') || base.includes('mourn')) {
    return 'Grief & Loss';
  }
  if (base.includes('shame') || base.includes('guilt')) {
    return 'Shame & Guilt';
  }

  return 'Faith & Obedience';
}

export function normalizeDevotionalCategory(value: unknown, fallbackContent = ''): DevotionalCategory {
  if (isDevotionalCategory(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (LEGACY_CATEGORY_MAP[normalized]) {
      return LEGACY_CATEGORY_MAP[normalized];
    }
  }

  return deriveDevotionalCategoryFromText(fallbackContent);
}
