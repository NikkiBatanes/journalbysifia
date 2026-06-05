import { normalizePrayerText } from '../prayerFormatting';

describe('normalizePrayerText', () => {
  it('removes generated missing-section validation lines from prayers', () => {
    const raw = [
      'Heavenly Father,',
      '',
      'Help me cling to Christ when rejection feels heavy.',
      '',
      'In Jesus name amen',
      '',
      'TITLE: This section is missing. Please ensure all required sections are included.',
      '',
      "In Jesus's Name, Amen",
    ].join('\n');

    expect(normalizePrayerText(raw).trim()).toBe([
      'Heavenly Father,',
      '',
      'Help me cling to Christ when rejection feels heavy.',
      '',
      'In Jesus’ Name, Amen',
    ].join('\n'));
  });

  it('removes split missing-section labels before duplicate closings', () => {
    const raw = [
      'Heavenly Father,',
      '',
      'Help me cling to Christ when rejection feels heavy.',
      '',
      'In Jesus name amen',
      '',
      'TITLE:',
      'This section is missing. Please ensure all required sections are included.',
      '',
      "In Jesus's Name, Amen",
    ].join('\n');

    expect(normalizePrayerText(raw).trim()).toBe([
      'Heavenly Father,',
      '',
      'Help me cling to Christ when rejection feels heavy.',
      '',
      'In Jesus’ Name, Amen',
    ].join('\n'));
  });
});
