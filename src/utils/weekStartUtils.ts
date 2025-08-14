/**
 * Week Start Utilities
 * 
 * Provides consistent handling of week start preferences across the app.
 * Fixes calendar misalignment issues when week starts on days other than Sunday.
 */

export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday, etc.

/**
 * Adjusts a day index (0-6) based on the week start preference.
 * 
 * @param dayIndex - Raw day index from getDay() (0=Sunday, 1=Monday, etc.)
 * @param weekStartsOn - Week start preference (0=Sunday, 1=Monday, etc.)
 * @returns Adjusted day index relative to the week start
 * 
 * @example
 * // If week starts on Monday (1) and today is Wednesday (3):
 * adjustDayIndexForWeekStart(3, 1) // Returns 2 (Wednesday is 2nd day in Monday-started week)
 * 
 * // If week starts on Sunday (0) and today is Wednesday (3):
 * adjustDayIndexForWeekStart(3, 0) // Returns 3 (Wednesday is 3rd day in Sunday-started week)
 */
export function adjustDayIndexForWeekStart(dayIndex: number, weekStartsOn: WeekStartDay): number {
  // Adjust the day index relative to the week start
  let adjustedIndex = dayIndex - weekStartsOn;
  
  // Handle negative wrap-around (e.g., Sunday when week starts Monday)
  if (adjustedIndex < 0) {
    adjustedIndex += 7;
  }
  
  return adjustedIndex;
}

/**
 * Gets the raw day index (0-6) from an adjusted day index.
 * This is the inverse of adjustDayIndexForWeekStart.
 * 
 * @param adjustedIndex - Day index relative to week start (0-6)
 * @param weekStartsOn - Week start preference (0=Sunday, 1=Monday, etc.)
 * @returns Raw day index that can be used with Date.getDay()
 */
export function getRawDayIndexFromAdjusted(adjustedIndex: number, weekStartsOn: WeekStartDay): number {
  return (adjustedIndex + weekStartsOn) % 7;
}

/**
 * Gets the start of week for a given date, accounting for week start preference.
 * 
 * @param date - The date to get week start for
 * @param weekStartsOn - Week start preference (0=Sunday, 1=Monday, etc.)
 * @returns Date representing the start of the week
 */
export function getWeekStart(date: Date, weekStartsOn: WeekStartDay): Date {
  const dayOfWeek = date.getDay();
  const adjustedDayIndex = adjustDayIndexForWeekStart(dayOfWeek, weekStartsOn);
  
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - adjustedDayIndex);
  weekStart.setHours(0, 0, 0, 0);
  
  return weekStart;
}

/**
 * Gets the end of week for a given date, accounting for week start preference.
 * 
 * @param date - The date to get week end for
 * @param weekStartsOn - Week start preference (0=Sunday, 1=Monday, etc.)
 * @returns Date representing the end of the week
 */
export function getWeekEnd(date: Date, weekStartsOn: WeekStartDay): Date {
  const weekStart = getWeekStart(date, weekStartsOn);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return weekEnd;
}

/**
 * Gets the day names in order based on week start preference.
 * 
 * @param weekStartsOn - Week start preference (0=Sunday, 1=Monday, etc.)
 * @param format - 'short' for 3-letter abbreviations, 'long' for full names
 * @returns Array of day names in week start order
 */
export function getDayNamesInWeekOrder(
  weekStartsOn: WeekStartDay, 
  format: 'short' | 'long' = 'short'
): string[] {
  const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const longDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const days = format === 'short' ? shortDays : longDays;
  
  // Reorder based on week start
  const reorderedDays = [];
  for (let i = 0; i < 7; i++) {
    const dayIndex = (weekStartsOn + i) % 7;
    reorderedDays.push(days[dayIndex]);
  }
  
  return reorderedDays;
}
