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

  if (!rootNavigation?.navigate) {
    return false;
  }

  rootNavigation.navigate(routeName as never, params as never);
  return true;
};
