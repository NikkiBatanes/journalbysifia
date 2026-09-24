import fs from 'fs';
import path from 'path';

const read = (relativePath: string): string =>
  fs.readFileSync(path.resolve(__dirname, '../..', relativePath), 'utf8');

describe('More destination return behavior', () => {
  it('marks every screen launched from the More tab', () => {
    const profile = read('screens/UserProfileScreen.tsx');
    const rhythms = read('components/dashboard/FaithfulRhythmsCard.tsx');

    expect(profile).toContain("screen: 'PastReviews'");
    expect(profile).toContain("params: isMoreTab ? {returnTo: 'More'} : undefined");
    expect(profile).toContain("navigation.navigate('Gospel', isMoreTab ? {returnTo: 'More'} : undefined)");
    expect(profile).toContain("...(isMoreTab ? {returnTo: 'More'} : {})");
    expect(profile).toContain("navigation.navigate('AdminDashboard', isMoreTab ? {returnTo: 'More'} : undefined)");
    expect(profile).toContain('returnToMore={isMoreTab}');
    expect(rhythms).toContain("returnToMore ? {returnTo: 'More'} : undefined");
  });

  it('returns root-stack destinations explicitly to More', () => {
    [
      'screens/GospelScreen.tsx',
      'screens/ForMeDayScreen.tsx',
      'screens/FaithfulRhythmsScreen.tsx',
      'screens/AdminDashboardScreen.tsx',
    ].forEach(relativePath => {
      const source = read(relativePath);
      expect(source).toContain("route?.params?.returnTo === 'More'");
      expect(source).toContain("returnToMainTab(navigation, 'More')");
    });
  });

  it('unwinds the Journal review stack before returning to More', () => {
    const reviews = read('screens/PastReviewsScreen.tsx');
    const journalStack = read('navigation/JournalStackNavigator.tsx');

    expect(reviews).toContain("route?.params?.returnTo === 'More'");
    expect(reviews).toContain('navigation.popToTop()');
    expect(reviews).toContain("navigation.getParent()?.navigate('More')");
    expect(reviews).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(journalStack).toContain(".returnTo !== 'More'");
  });
});
