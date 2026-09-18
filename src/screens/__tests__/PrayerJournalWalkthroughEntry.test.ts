import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, '../PrayerJournalWalkthroughScreen.tsx'), 'utf8');
const rootStackSource = fs.readFileSync(path.resolve(__dirname, '../../navigation/RootStackNavigator.tsx'), 'utf8');

describe('Prayer journal walkthrough entry', () => {
  it('uses an in-screen spring entrance over an opaque background', () => {
    expect(source).toContain('const entranceOpacity = useRef(new Animated.Value(0)).current');
    expect(source).toContain('const entranceProgress = useRef(new Animated.Value(0)).current');
    expect(source).toContain('duration: 180');
    expect(source).toContain('stiffness: 240');
    expect(source).toContain('damping: 24');
    expect(source).toContain('outputRange: [10, 0]');
    expect(source).toContain('outputRange: [0.985, 1]');
    expect(source).toMatch(/container:\s*\{[\s\S]*?backgroundColor: Colors\.lightBackground/);
  });

  it('measures the CAST timeline from the first icon center to the heart center', () => {
    expect(source).toContain('const [castTimelineTargetHeight, setCastTimelineTargetHeight] = React.useState(0)');
    expect(source).toContain('measureTimelinePoint(index, y, height)');
    expect(source).toContain('lastCenter - firstCenter');
    expect(source).toContain('{ top: 14, height: timelineHeight.interpolate({');
    expect(source).not.toContain("const castTimelineTargetHeight = Platform.OS === 'android'");
  });

  it('keeps the CAST streak destination available outside the authenticated screen group', () => {
    const streakRegistration = rootStackSource.indexOf('name="StreakPlan"');
    const authBranch = rootStackSource.indexOf('{!isAuthenticated ? (');
    expect(streakRegistration).toBeGreaterThan(-1);
    expect(streakRegistration).toBeLessThan(authBranch);
    expect(rootStackSource.match(/name="StreakPlan"/g)).toHaveLength(1);
  });
});
