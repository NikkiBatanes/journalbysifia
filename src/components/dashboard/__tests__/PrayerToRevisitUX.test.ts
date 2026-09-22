import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, '../PrayerToRevisit.tsx'), 'utf8');
const presentationSource = fs.readFileSync(path.resolve(__dirname, '../PrayerIntelligenceCardPresentation.tsx'), 'utf8');
const trackingSource = fs.readFileSync(path.resolve(__dirname, '../../prayer/PrayerTrackingModal.tsx'), 'utf8');
const activitySource = fs.readFileSync(path.resolve(__dirname, '../../../services/prayerActivityService.ts'), 'utf8');
const prayerCardSource = fs.readFileSync(path.resolve(__dirname, '../../journal/PrayerCard.tsx'), 'utf8');
const requestsScreenSource = fs.readFileSync(path.resolve(__dirname, '../../../screens/PrayerListScreen.tsx'), 'utf8');
const peopleWalkthroughSource = fs.readFileSync(path.resolve(__dirname, '../../../screens/PrayersForPeopleWalkthroughScreen.tsx'), 'utf8');

describe('Today Prayer intelligence presentation', () => {
  it('does not expose queue-processing actions', () => {
    expect(source + presentationSource).not.toContain('Show another');
    expect(source + presentationSource).not.toContain('Not now');
    expect(source).not.toContain("action('Record answer'");
    expect(source).not.toContain("action('Still praying'");
    expect(source).not.toContain("action('Keep praying'");
  });

  it('uses plain-language purpose headings and destination-matched actions', () => {
    expect(presentationSource).toContain("'A prayer to revisit'");
    expect(presentationSource).toContain("'How is this prayer now?'");
    expect(presentationSource).toContain("'A prayer request to follow up on'");
    expect(presentationSource).toContain("'From your prayer journal'");
    expect(presentationSource).toContain("'A prayer you marked Answered'");
    expect(presentationSource).toContain("action('I prayed for this today'");
    expect(presentationSource).toContain("action('Update'");
    expect(presentationSource).toContain("? 'Open request'");
    expect(presentationSource).toContain("action('Look back'");
    expect(presentationSource).toContain("'Open prayer'");
    expect(presentationSource).toContain("action('View journey'");
    expect(presentationSource).toContain('!redundantAction');
    expect(presentationSource).not.toContain('RETURN');
    expect(presentationSource).not.toContain('CHECK IN');
    expect(presentationSource).not.toContain('CELEBRATE');
    expect(presentationSource).toContain('{primary}');
    expect(source).toContain('<PrayerIntelligenceCardPresentation');
    expect(presentationSource).toContain("action('Pray now'");
    expect(presentationSource).toContain("action('Follow up'");
    expect(source).toContain("'PrayersForPeopleWalkthrough'");
    expect(source).toContain('originalRequestId: target.id');
    expect(source).toContain('originalRequestText: target.content');
    expect(source).toContain('setTimeout(() => navigateToPrayForSomeone(target), 300)');
  });

  it('renders Request state, origin, subject, and the linked Prayer preview separately', () => {
    expect(presentationSource).toContain("'PRAYED FOR'");
    expect(presentationSource).toContain('>Prayer Request</ThemedText>');
    expect(presentationSource).toContain('journey.subject');
    expect(presentationSource).toContain('journey.content');
    expect(source).toContain('linkedPrayer={linkedPrayer}');
  });

  it('keeps Requests buckets distinct and surfaces journey disposition/origin in Prayer cards', () => {
    expect(requestsScreenSource).toContain("{ key: 'requests', label: 'Needs Prayer' }");
    expect(requestsScreenSource).toContain('groupedPrayers.filter(hasAnswerHistory)');
    expect(requestsScreenSource).toContain('groupedPrayers.filter(isPrayerLetGo)');
    expect(prayerCardSource).toContain("'PRAYER REQUEST'");
    expect(prayerCardSource).toContain("'PRAYED FOR'");
    expect(prayerCardSource).toContain("'ANSWERED'");
    expect(prayerCardSource).toContain("'LET GO'");
    expect(prayerCardSource).toContain('Prayer Request · {requestContext}');
  });

  it('routes complex choices through the existing Prayer modal', () => {
    expect(source).toContain("setMode('update')");
    expect(source).toContain("setMode('details')");
    expect(source).toContain('<PrayerTrackingModal');
    expect(source).not.toContain('answerPrayer(');
    expect(source).not.toContain('releasePrayer(');
    expect(source).not.toContain('continuePrayer(');
  });

  it('keeps Pray Again on the canonical existing-record update path', () => {
    expect(source).toContain('prayAgainExistingPrayer(prayer, candidate?.needId)');
    expect(activitySource).toContain('prayer_count: (prayer.prayer_count');
    expect(activitySource).toContain('last_prayed_at: stamp');
    expect(activitySource).toContain('PrayerApi.updatePrayer(prayer.id');
    expect(activitySource).not.toContain('PrayerApi.createPrayer');
  });

  it('links a Prayer Request only after the Pray for Someone record is created', () => {
    expect(peopleWalkthroughSource).toContain('route.params?.originalRequestId');
    expect(peopleWalkthroughSource).toContain('original_request_id: route.params.originalRequestId');
    expect(peopleWalkthroughSource).toContain('original_request_content: route.params.originalRequestText ||');
    expect(peopleWalkthroughSource).toContain('requestContext={route.params?.originalRequestText}');
    const createAt = peopleWalkthroughSource.indexOf('result = await createPrayerMutation.mutateAsync(prayerData)');
    const linkAt = peopleWalkthroughSource.indexOf('markPrayedMutation.mutateAsync({', createAt);
    expect(createAt).toBeGreaterThanOrEqual(0);
    expect(linkAt).toBeGreaterThan(createAt);
    expect(peopleWalkthroughSource).toContain("selectedType?.id === 'pray-for-someone' && route.params?.originalRequestId");
  });

  it('keeps answer recording explicit and on the canonical Phase 1 path', () => {
    expect(trackingSource).toContain('WHAT HAS CHANGED?');
    expect(trackingSource).toContain('WHEN DID YOU NOTICE THIS ANSWER?');
    expect(trackingSource).toContain('Continue praying');
    expect(trackingSource).toContain('describePrayerUpdate(prayer');
    expect(trackingSource).toContain("updateKind === 'answered' ? answerDate.toISOString()");
  });
});
