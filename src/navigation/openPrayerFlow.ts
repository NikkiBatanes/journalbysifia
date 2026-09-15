import { CommonActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';

type PrayerScreen = 'PrayerJournalWalkthrough' | 'PrayersForPeopleWalkthrough' | 'PrayerEditor';

export function openPrayerFlow(navigation: NavigationProp<ParamListBase>, screen: PrayerScreen, params: Record<string, any>) {
  let owner: NavigationProp<ParamListBase> | undefined = navigation;
  while (owner) {
    const state = owner.getState();
    if (state.routeNames.includes(screen)) {
      owner.dispatch({ ...CommonActions.navigate(screen, params), target: state.key });
      return;
    }
    owner = owner.getParent<NavigationProp<ParamListBase>>();
  }
}
