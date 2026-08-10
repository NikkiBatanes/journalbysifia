import { validatePlaybookInputQuality } from '../playbookInputValidation';

describe('validatePlaybookInputQuality', () => {
  it('accepts a detailed real-life entry with property and money shorthand', () => {
    const input = 'During the pandemic we were about to buy a lot that is really my dream lot, but today 2026 i saw they are selling it again twice the price. Ive been praying for that lot for a long time now like 5 yrs now. Then it became more expensive like times 2. We were about to buy it 10 m then the owner gave it to someone else then now its 20m for 500sqm. My heart breaks. I feel like its not teally for me. Since pandemic we never regained how we used to earn in our business. So we are much lesser income now than before. Maybe im just having wishful thinking. And now, we are planning to build in a lot my mother in law wanted for us to build but not yet transferred to us. Then when i was computing the cost we cant afford it either. It will cost us more than 10m to build in this economy. And my app doesnt even break even.';

    expect(validatePlaybookInputQuality(input)).toEqual({ isValid: true });
  });

  it('accepts common numeric shorthand for units, time, and amounts', () => {
    const input = 'The 500sqm lot is now php20m after 5yrs, and the 1000sqft option is also too much.';

    expect(validatePlaybookInputQuality(input)).toEqual({ isValid: true });
  });

  it('still rejects random mixed alphanumeric tokens', () => {
    expect(validatePlaybookInputQuality('abc123xyz')).toMatchObject({ isValid: false });
  });
});
