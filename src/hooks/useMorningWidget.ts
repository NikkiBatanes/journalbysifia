import { useEffect } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { notificationDeepLinkService } from '../services/notificationDeepLinkService';
import { initMorningWidgetSync, syncMorningWidget } from '../services/morningWidgetService';

const MORNING_LINK_PREFIX = 'sifia://morning';

/**
 * Wires the Morning Home Screen widget into the app:
 * - forwards `sifia://morning/...` widget URLs into notificationDeepLinkService
 *   (queued until the navigation ref is ready on cold start);
 * - reconciles pending widget check-ins and refreshes the widget snapshot on
 *   app launch and every foreground.
 */
export const useMorningWidget = (): void => {
  useEffect(() => {
    if (Platform.OS !== 'ios') { return; }

    initMorningWidgetSync();

    const handleUrl = (url?: string | null) => {
      if (url && url.startsWith(MORNING_LINK_PREFIX)) {
        notificationDeepLinkService.handleExternalUrl(url);
      }
    };

    const linkSub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    void Linking.getInitialURL().then(handleUrl);

    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        void syncMorningWidget();
      }
    });

    return () => {
      linkSub.remove();
      appStateSub.remove();
    };
  }, []);
};
