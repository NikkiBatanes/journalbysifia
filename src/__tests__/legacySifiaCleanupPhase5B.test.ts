import fs from 'fs';
import path from 'path';

const read = (relative: string) => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

describe('legacy siFia cleanup phase 5B', () => {
  it('keeps obsolete dashboard cards deleted', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../components/dashboard/DailyAffirmationCard.tsx'))).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, '../components/dashboard/DailyBibleVerseCard.tsx'))).toBe(false);
  });

  it('does not expose active playbook or refinement quota actions', () => {
    const service = read('services/NewSubscriptionService.ts');
    const hook = read('hooks/useNewSubscription.ts');
    expect(service).not.toContain("action: 'playbook'");
    expect(service).not.toContain("case 'refinement'");
    expect(hook).not.toContain('canGeneratePlaybook');
    expect(hook).not.toContain('playbooksRemaining');
  });

  it('keeps guided reflection, smart journaling, and future planning free of tier locks', () => {
    expect(read('hooks/useGuidedPromptGating.ts')).toContain('return true;');
    expect(read('hooks/useSmartJournalingGating.ts')).toContain('canUseFeature: true');
    expect(read('hooks/usePlanningGating.ts')).toContain('const shouldShowLock = false');
  });

  it('removes active legacy notification candidates and zero-producer analytics', () => {
    const candidates = read('services/notifications/notificationCandidateResolver.ts');
    const notificationTypes = read('services/notifications/notificationTypes.ts');
    const analytics = read('services/analyticsService.ts');
    const monitoring = read('utils/monitoring.ts');
    for (const obsolete of ['create_playbook', 'usage_room_playbook', 'content_refresh_wait', 'upgrade_room']) {
      expect(candidates).not.toContain(obsolete);
      expect(notificationTypes).not.toContain(obsolete);
    }
    expect(analytics).not.toContain("'playbook_generation': 'playbooks_used'");
    expect(monitoring).not.toContain("'generation_success'");
  });

  it('preserves product identifiers while removing obsolete product counters', () => {
    const platformSubscriptions = read('services/platformSubscriptionService.ts');
    expect(platformSubscriptions).toContain('productId');
    expect(fs.existsSync(path.resolve(__dirname, '../components/SubscriptionPlanModal.tsx'))).toBe(false);
  });
});
