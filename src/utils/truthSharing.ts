export const removeLeadingUserNameForShare = (text: string, userName: string): string => {
  const cleanName = userName.trim();
  if (!cleanName) {
    return text.trim();
  }
  const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withoutLeadingName = text
    .replace(new RegExp(`^\\s*${escapedName}\\s*[,—–:-]\\s*`, 'i'), '')
    .trim();
  return withoutLeadingName.replace(
    /^([^A-Za-z]*)([a-z])/,
    (_match, prefix: string, firstLetter: string) => `${prefix}${firstLetter.toUpperCase()}`
  );
};

export const buildTruthPostText = (primaryTruth: string, supportingTruth: string | undefined, userName: string): string =>
  [removeLeadingUserNameForShare(primaryTruth, userName), supportingTruth?.trim()]
    .filter(Boolean)
    .join('\n\n');
