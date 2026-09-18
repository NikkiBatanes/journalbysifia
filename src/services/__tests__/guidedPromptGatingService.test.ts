import { GUIDED_PROMPTS } from '../../components/journal/reflectionConstants';
import { checkGuidedPromptAccess } from '../../utils/guidedPromptGating';
import { GuidedPromptGatingService } from '../guidedPromptGatingService';

describe('GuidedPromptGatingService', () => {
  it.each(['seeker', 'spark', 'growth', 'transformation', 'free_trial'] as const)(
    'includes every guided prompt for %s metadata',
    tier => {
    const allocation = new GuidedPromptGatingService().getDailyPrompts('user-1', tier);

    expect(allocation.freePrompts).toEqual(GUIDED_PROMPTS);
    expect(allocation.lockedPrompts).toEqual([]);
    expect(allocation.allPrompts).toEqual(GUIDED_PROMPTS);
    },
  );

  it('has a complete local allocation for signed-out Guided Reflection', () => {
    const allocation = new GuidedPromptGatingService().getDailyPrompts('local', 'seeker');

    expect(allocation.freePrompts).toEqual(GUIDED_PROMPTS);
    expect(allocation.lockedPrompts).toEqual([]);
  });

  it.each(['seeker', 'spark', 'growth', 'transformation', 'free_trial'] as const)(
    'never requires an upgrade to use a guided prompt for %s metadata',
    async tier => {
    const service = new GuidedPromptGatingService();
    jest.spyOn(service, 'getCompletedPrompts').mockResolvedValue([]);

    await expect(service.canUsePrompt('user-1', tier, GUIDED_PROMPTS[0])).resolves.toEqual({
      canUse: true,
      isCompleted: false,
      requiresUpgrade: false,
    });
    },
  );

  it('reports full compatibility access for a legacy seeker tier', () => {
    expect(checkGuidedPromptAccess('seeker')).toMatchObject({
      hasAccess: true,
      canUsePrompt: true,
      upgradeRequired: false,
      lockIconVisible: false,
    });
  });
});
