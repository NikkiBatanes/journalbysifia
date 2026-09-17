export const getMomentsListStructureKey = (
  groupBy: string,
  sectionKeys: Array<string | null | undefined>,
): string => [groupBy, ...sectionKeys.map(key => key || '')].join('|');

export const hasMomentsListStructureChanged = (
  previousKey: string | null,
  nextKey: string,
): boolean => previousKey !== nextKey;
