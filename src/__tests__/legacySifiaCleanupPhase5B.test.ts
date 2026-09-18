import fs from 'fs';
import path from 'path';

const read = (relative: string) => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

describe('legacy siFia cleanup phase 5B', () => {
  it('keeps obsolete dashboard cards deleted', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../components/dashboard/DailyAffirmationCard.tsx'))).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, '../components/dashboard/DailyBibleVerseCard.tsx'))).toBe(false);
  });

  it('does not expose active playbook or refinement quota actions', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../services/NewSubscriptionService.ts'))).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, '../hooks/useNewSubscription.ts'))).toBe(false);
  });

  it('keeps guided reflection, smart journaling, and future planning free of tier locks', () => {
    expect(read('hooks/useGuidedPromptGating.ts')).toContain('return true;');
    expect(fs.existsSync(path.resolve(__dirname, '../hooks/useSmartJournalingGating.ts'))).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, '../hooks/usePlanningGating.ts'))).toBe(false);
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

  it('removes local store services and obsolete tier facades', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../services/AppleStoreKitService.ts'))).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, '../services/GooglePlayBillingService.ts'))).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, '../utils/paymentFailureLogger.ts'))).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, '../services/platformSubscriptionService.ts'))).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, '../components/SubscriptionPlanModal.tsx'))).toBe(false);
  });
});
