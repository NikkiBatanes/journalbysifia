import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, '../BottomTabNavigator.tsx'), 'utf8');

describe('main navigation pencil state', () => {
  it('tracks a pencil-launched flow separately from the open menu', () => {
    expect(source).toContain('const [showAddMenu, setShowAddMenu]');
    expect(source).toContain('const [addFlowActive, setAddFlowActive]');
    expect(source).toContain('if (showAddMenu || addFlowActive)');
    expect(source).toContain('updateSelectorPosition(addButtonLayout.current.x)');
  });

  it('closes stale menu state on destination and unrelated route changes', () => {
    expect(source).toContain('}, [currentRouteName, activeNestedRouteName]);');
    expect(source).toContain('activeAddRouteIdentityRef.current = routeIdentity');
    expect(source).toContain('activeAddRouteIdentityRef.current !== routeIdentity');
    expect(source).toContain("setMenuMode('main')");
  });

  it('keeps pencil selected after choosing an item and clears it on normal tabs', () => {
    expect(source).toMatch(/setShowAddMenu\(false\);\s*setAddFlowActive\(true\)/);
    expect(source).toMatch(/const onPress = \(\) => \{\s*setShowAddMenu\(false\);\s*setAddFlowActive\(false\)/);
  });

  it('clears pencil selection when its menu is dismissed without choosing', () => {
    expect(source).toContain('setAddFlowActive(opening)');
    expect(source).toMatch(/onPress=\{\(\) => \{\s*setShowAddMenu\(false\);\s*setAddFlowActive\(false\)/);
  });

  it('uses a blur instead of dimming the screen behind the pencil menu', () => {
    expect(source).toContain("import { BlurView } from '@react-native-community/blur'");
    expect(source).toContain('styles.addMenuBlur');
    expect(source).toContain('blurAmount={7}');
    expect(source).toContain('styles.addMenuDismissLayer');
    expect(source).not.toContain('styles.addMenuDim');
  });

  it('animates each menu heading in the same stagger as its choices', () => {
    expect(source).toContain('const menuTitleAnim = React.useRef(new Animated.Value(0)).current');
    expect(source).toContain('[...[...menuItemAnims].reverse(), menuTitleAnim]');
    expect(source).toContain('[...[...anims].reverse(), menuTitleAnim]');
    expect(source).toContain('opacity: menuTitleAnim');
    expect(source).toContain('React.useLayoutEffect(() => {');
  });

  it('finishes the current menu animation before opening a second-level menu', () => {
    expect(source).toContain('const transitionMenuMode = React.useCallback');
    expect(source).toContain("transitionMenuMode('prayer')");
    expect(source).toContain("transitionMenuMode('session')");
    expect(source).toContain('[menuTitleAnim, ...outgoing]');
    expect(source).toContain('disabled={menuModeTransitioning}');
  });
});
