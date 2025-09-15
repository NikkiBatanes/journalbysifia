import { Colors } from '../../theme/colors';

export interface TimeBlockCategory {
  name: string;
  icon: string;
  color: string;
}

export const TIMEBLOCK_CATEGORIES: TimeBlockCategory[] = [
  { name: 'Appointments', icon: 'calendar', color: Colors.alertCoral },
  { name: 'Break Time', icon: 'cafe', color: Colors.spiritualPink }, // Light pink -> spiritual pink
  { name: 'Career Growth', icon: 'rocket', color: Colors.growthGreen },
  { name: 'Church Activities', icon: 'people', color: Colors.alertCoral }, // Community activities
  { name: 'Deep Work', icon: 'code-working', color: Colors.clarityTeal }, // Focus and clarity
  { name: 'Events', icon: 'calendar-number', color: Colors.playbookBlue }, // Planning and events
  { name: 'Family Time', icon: 'people-circle', color: Colors.heartRed }, // Love and family
  { name: 'Life Admin', icon: 'document-text', color: Colors.journeyGray }, // Administrative tasks
  { name: 'Mental Health', icon: 'heart', color: Colors.treasureGold }, // Precious mental wellness
  { name: 'Ministry', icon: 'hand-left', color: Colors.devotionalPurple }, // Spiritual service
  { name: 'Personal Growth', icon: 'person', color: Colors.wisdomIndigo }, // Wisdom and growth
  { name: 'Physical Health', icon: 'barbell', color: Colors.prosperityGreen }, // Health prosperity
  { name: 'Projects', icon: 'folder', color: Colors.winGold }, // Achievement and completion
  { name: 'Quiet Time', icon: 'book', color: Colors.anchorBlueLight }, // Peaceful devotion
  { name: 'Recreation', icon: 'airplane', color: Colors.gratitudeRed }, // Joy and recreation
  { name: 'Sleep & Recovery', icon: 'moon', color: Colors.lightPurple }, // Rest and restoration
  { name: 'Work Meetings', icon: 'briefcase', color: Colors.timeblockGreen }, // Productive work
  { name: 'Others', icon: 'ellipsis-horizontal', color: Colors.contemplationGray }, // Miscellaneous
];

export const getCategoryColor = (categoryName: string): string => {
  const category = TIMEBLOCK_CATEGORIES.find(cat => cat.name === categoryName);
  return category?.color || Colors.contemplationGray;
};

export const getCategoryIcon = (categoryName: string): string => {
  const category = TIMEBLOCK_CATEGORIES.find(cat => cat.name === categoryName);
  return category?.icon || 'ellipsis-horizontal';
};
