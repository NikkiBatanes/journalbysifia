import { tierRestrictionService } from '../tierRestrictionService';
import { subscriptionService } from '../subscriptionService';

jest.mock('../subscriptionService', () => ({
  subscriptionService: {
    getUserSubscription: jest.fn(),
    getSubscriptionLimits: jest.fn(() => ({})),
    getCurrentUsage: jest.fn(() => ({})),
  },
}));

const TIERS = ['seeker', 'spark', 'growth', 'transformation', 'free_trial'] as const;
const CORE_FEATURES = [
  'guided_prompts',
  'unlimited_guided_prompts',
  'smart_journaling',
  'future_planning',
  'copy_incomplete_todos',
  'repeat_options',
  'location_services',
  'delete_time_block_series',
  'calendar_sync',
  'export_pdf',
] as const;

describe('paid-app core feature access', () => {
  it.each(TIERS)('does not restrict core Journal features for %s metadata', async tier => {
    (subscriptionService.getUserSubscription as jest.Mock).mockResolvedValue({ tier });

    for (const feature of CORE_FEATURES) {
      await expect(tierRestrictionService.checkFeatureAccess('user-1', feature))
        .resolves.toEqual({ hasAccess: true });
    }
  });

  it('keeps the incomplete DOCX capability separate', () => {
    expect(tierRestrictionService.getRestrictionsForTier('seeker')).toContain('export_docx');
  });
});
