import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Keyboard } from 'react-native';

export function exitPrayerFlow(navigation: NavigationProp<ParamListBase>) {
  Keyboard.dismiss();

  let root = navigation;
  while (!root.getState().routeNames.includes('MainTabs')) {
    const parent = root.getParent<NavigationProp<ParamListBase>>();
    if (!parent) {return;}
    root = parent;
  }

  root.dispatch({
    ...StackActions.popTo('MainTabs', { screen: 'Prayer' }),
    target: root.getState().key,
  });
}
