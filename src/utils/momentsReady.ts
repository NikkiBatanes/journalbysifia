export const canRevealMomentsContent = (
  isFocused: boolean,
  completedRefreshKey: number,
  expectedRefreshKey: number,
): boolean => isFocused && completedRefreshKey === expectedRefreshKey;
