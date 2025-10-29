import { Colors } from '../../theme/colors';

export interface TimeBlockCategory {
  name: string;
  icon: string;
  color: string;
}

export const TIMEBLOCK_CATEGORIES: TimeBlockCategory[] = [
  { name: 'Appointments', icon: 'calendar', color: Colors.alertCoral },
  { name: 'Birthdays', icon: 'gift', color: Colors.treasureGold }, // Celebrations
  { name: 'Break Time', icon: 'cafe', color: 'rgba(255, 182, 193, 0.4)' }, // Subtle light pink
  { name: 'Career Growth', icon: 'rocket', color: Colors.growthGreen },
  { name: 'Church Activities', icon: 'people', color: Colors.alertCoral }, // Community activities
  { name: 'Deep Work', icon: 'code-working', color: Colors.clarityTeal }, // Focus and clarity
  { name: 'Evening Routine', icon: 'moon-outline', color: Colors.mysticalViolet }, // Evening rituals
  { name: 'Events', icon: 'calendar-number', color: Colors.playbookBlue }, // Planning and events
  { name: 'Family Time', icon: 'people-circle', color: Colors.alertCoral }, // Love and family
  { name: 'Life Admin', icon: 'document-text', color: '#9B8B6F' }, // Khaki
  { name: 'Mental Health', icon: 'heart', color: Colors.treasureGold }, // Precious mental wellness
  { name: 'Ministry', icon: 'hand-left', color: Colors.devotionalPurple }, // Spiritual service
  { name: 'Morning Routine', icon: 'sunny-outline', color: Colors.faithGold }, // Morning rituals
  { name: 'Personal Growth', icon: 'person', color: Colors.wisdomIndigo }, // Wisdom and growth
  { name: 'Physical Health', icon: 'barbell', color: Colors.prosperityGreen }, // Health prosperity
  { name: 'Projects', icon: 'folder', color: Colors.winGold }, // Achievement and completion
  { name: 'Quiet Time', icon: 'book', color: '#4A7BA7' }, // Slightly darker blue for contrast
  { name: 'Recreation', icon: 'airplane', color: Colors.gratitudeRed }, // Joy and recreation
  { name: 'Sleep & Recovery', icon: 'moon', color: '#8B7BA8' }, // Slightly darker purple for contrast
  { name: 'Work Meetings', icon: 'briefcase', color: Colors.timeblockGreen }, // Productive work
  { name: 'Others', icon: 'ellipsis-horizontal', color: '#6B7280' }, // Neutral gray
];

export const getCategoryColor = (categoryName: string): string => {
  const category = TIMEBLOCK_CATEGORIES.find(cat => cat.name === categoryName);
  return category?.color || '#6B7280'; // Default neutral gray
};

export const getCategoryIcon = (categoryName: string): string => {
  const category = TIMEBLOCK_CATEGORIES.find(cat => cat.name === categoryName);
  return category?.icon || 'ellipsis-horizontal';
};
