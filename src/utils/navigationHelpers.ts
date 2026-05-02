import { Logger } from './ProductionLogger';

export const getRootNavigation = (navigation?: any): any => {
  if (!navigation) {
    return undefined;
  }

  let currentNavigation = navigation;
  let parentNavigation = currentNavigation.getParent?.();

  while (parentNavigation) {
    currentNavigation = parentNavigation;
    parentNavigation = currentNavigation.getParent?.();
  }

  return currentNavigation;
};

export const navigateFromRoot = (
  navigation: any,
  routeName: string,
  params?: Record<string, unknown>
): boolean => {
  const rootNavigation = getRootNavigation(navigation);

  Logger.info('[navigateFromRoot] Called', {
    routeName,
    hasRootNavigation: !!rootNavigation,
    hasNavigateMethod: !!rootNavigation?.navigate,
    params,
  });

  if (!rootNavigation?.navigate) {
    Logger.warn('[navigateFromRoot] Failed - no root navigation or navigate method');
    return false;
  }

  rootNavigation.navigate(routeName as never, params as never);
  Logger.info('[navigateFromRoot] Navigation called successfully');
  return true;
};
