import { Colors } from '../../theme/colors';

export interface TimeBlockCategory {
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const TIMEBLOCK_CATEGORIES: TimeBlockCategory[] = [
  { name: 'Appointments', icon: 'calendar', color: Colors.alertCoral, description: 'Scheduled meetings and events' },
  { name: 'Birthdays', icon: 'gift', color: Colors.treasureGold, description: 'Celebrations and special days' },
  { name: 'Break Time', icon: 'cafe', color: 'rgba(255, 182, 193, 0.4)', description: 'Rest and recharge moments' },
  { name: 'Career Growth', icon: 'rocket', color: Colors.growthGreen, description: 'Professional development' },
  { name: 'Church Activities', icon: 'people', color: Colors.alertCoral, description: 'Community and fellowship' },
  { name: 'Deep Work', icon: 'code-working', color: Colors.clarityTeal, description: 'Focused productive time' },
  { name: 'Evening Routine', icon: 'moon-outline', color: Colors.mysticalViolet, description: 'Wind down rituals' },
  { name: 'Events', icon: 'calendar-number', color: Colors.playbookBlue, description: 'Special occasions' },
  { name: 'Family Time', icon: 'people-circle', color: Colors.alertCoral, description: 'Quality time with loved ones' },
  { name: 'Life Admin', icon: 'document-text', color: '#9B8B6F', description: 'Personal management tasks' },
  { name: 'Mental Health', icon: 'heart', color: Colors.treasureGold, description: 'Self-care and wellness' },
  { name: 'Ministry', icon: 'hand-left', color: Colors.devotionalPurple, description: 'Service and spiritual work' },
  { name: 'Morning Routine', icon: 'sunny-outline', color: Colors.faithGold, description: 'Start the day right' },
  { name: 'Personal Growth', icon: 'person', color: Colors.wisdomIndigo, description: 'Self-improvement journey' },
  { name: 'Physical Health', icon: 'barbell', color: Colors.prosperityGreen, description: 'Exercise and wellness' },
  { name: 'Projects', icon: 'folder', color: Colors.winGold, description: 'Ongoing work and goals' },
  { name: 'Quiet Time', icon: 'book', color: '#4A7BA7', description: 'Reflection and stillness' },
  { name: 'Recreation', icon: 'airplane', color: Colors.gratitudeRed, description: 'Fun and leisure' },
  { name: 'Sleep & Recovery', icon: 'moon', color: '#8B7BA8', description: 'Rest and restoration' },
  { name: 'Work Meetings', icon: 'briefcase', color: Colors.timeblockGreen, description: 'Professional gatherings' },
  { name: 'Others', icon: 'ellipsis-horizontal', color: '#6B7280', description: 'Everything else' },
];

export const getCategoryColor = (categoryName: string): string => {
  const category = TIMEBLOCK_CATEGORIES.find(cat => cat.name === categoryName);
  return category?.color || '#6B7280'; // Default neutral gray
};

export const getCategoryIcon = (categoryName: string): string => {
  const category = TIMEBLOCK_CATEGORIES.find(cat => cat.name === categoryName);
  return category?.icon || 'ellipsis-horizontal';
};
