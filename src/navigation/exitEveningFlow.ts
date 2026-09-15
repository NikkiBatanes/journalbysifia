import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Keyboard } from 'react-native';

import { triggerLightHaptic } from '../utils/haptics';

export function exitEveningFlow(navigation: NavigationProp<ParamListBase>, destination: 'Today' | 'Moments') {
  triggerLightHaptic();
  Keyboard.dismiss();
  const params = destination === 'Today'
    ? { screen: 'Today', params: { screen: 'TodayHome' } }
    : { screen: 'Journal', params: { screen: 'JournalMoments' } };

  let root = navigation;
  while (!root.getState().routeNames.includes('MainTabs')) {
    const parent = root.getParent<NavigationProp<ParamListBase>>();
    if (!parent) {return;}
    root = parent;
  }
  // Remove the flow from the root stack as we return to the requested tab.
  root.dispatch({ ...StackActions.popTo('MainTabs', params), target: root.getState().key });
}

export const exitMorningFlow = exitEveningFlow;
