import {canRevealMomentsContent} from '../momentsReady';

describe('Moments content readiness', () => {
  it('does not reveal a refresh that completed while Moments is blurred', () => {
    expect(canRevealMomentsContent(false, 3, 3)).toBe(false);
  });

  it('does not reveal an older refresh after a focused visit requests a newer one', () => {
    expect(canRevealMomentsContent(true, 3, 4)).toBe(false);
  });

  it('reveals only the current refresh for the focused visit', () => {
    expect(canRevealMomentsContent(true, 4, 4)).toBe(true);
  });
});
