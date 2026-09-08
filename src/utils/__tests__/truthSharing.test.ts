import { buildTruthPostText, removeLeadingUserNameForShare } from '../truthSharing';

describe('removeLeadingUserNameForShare', () => {
  it('removes a leading personalized address', () => {
    expect(removeLeadingUserNameForShare('Nikki, Jesus calls you to rest.', 'Nikki'))
      .toBe('Jesus calls you to rest.');
  });

  it('supports a leading name followed by a dash', () => {
    expect(removeLeadingUserNameForShare('Nikki — grace is already yours.', 'Nikki'))
      .toBe('Grace is already yours.');
  });

  it('capitalizes through an opening quote after removing the name', () => {
    expect(removeLeadingUserNameForShare('Nikki: “you are held by Christ.”', 'Nikki'))
      .toBe('“You are held by Christ.”');
  });

  it('does not remove a name used elsewhere in the truth', () => {
    expect(removeLeadingUserNameForShare('Jesus meets Nikki with grace.', 'Nikki'))
      .toBe('Jesus meets Nikki with grace.');
  });

  it('builds a post from the complete primary and supporting truths', () => {
    expect(buildTruthPostText(
      'Nikki, Jesus calls you to receive grace.',
      'You do not need to earn what Christ gives freely.',
      'Nikki'
    )).toBe('Jesus calls you to receive grace.\n\nYou do not need to earn what Christ gives freely.');
  });
});
