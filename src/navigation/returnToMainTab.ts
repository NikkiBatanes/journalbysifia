import {CommonActions} from '@react-navigation/native';

type NavigationLike = {
  canGoBack?: () => boolean;
  dispatch: (action: object) => void;
  getState: () => {
    routes: Array<{name: string; state?: {key?: string}}>;
  };
  goBack: () => void;
  navigate: (name: string, params?: object) => void;
};

/** Select an existing main tab before removing the root-stack screen above it. */
export const returnToMainTab = (
  navigation: NavigationLike,
  tabName: string,
) => {
  const mainTabsRoute = navigation
    .getState()
    .routes.find(route => route.name === 'MainTabs');
  const tabNavigatorKey = mainTabsRoute?.state?.key;

  if (tabNavigatorKey) {
    navigation.dispatch({
      ...CommonActions.navigate(tabName),
      target: tabNavigatorKey,
    });
    if (navigation.canGoBack?.() !== false) {
      navigation.goBack();
      return;
    }
  }

  navigation.navigate('MainTabs', {screen: tabName});
};
