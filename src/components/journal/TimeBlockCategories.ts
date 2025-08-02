import { Colors } from '../../theme/colors';

export interface TimeBlockCategory {
  name: string;
  icon: string;
  color: string;
}

export const TIMEBLOCK_CATEGORIES: TimeBlockCategory[] = [
  { name: 'Appointments', icon: 'calendar', color: Colors.alertCoral },
  { name: 'Break Time', icon: 'cafe', color: '#FFB6C1' }, // Light pink
  { name: 'Career Growth', icon: 'rocket', color: Colors.growthGreen },
  { name: 'Church Activities', icon: 'people', color: '#FF6B6B' },
  { name: 'Deep Work', icon: 'code-working', color: '#4ECDC4' },
  { name: 'Events', icon: 'calendar-number', color: '#45B7D1' },
  { name: 'Family Time', icon: 'people-circle', color: '#FFA07A' },
  { name: 'Life Admin', icon: 'document-text', color: '#98D8C8' },
  { name: 'Mental Health', icon: 'heart', color: '#F7DC6F' },
  { name: 'Ministry', icon: 'hand-left', color: '#BB8FCE' },
  { name: 'Personal Growth', icon: 'person', color: '#85C1E9' },
  { name: 'Physical Health', icon: 'barbell', color: '#58D68D' },
  { name: 'Projects', icon: 'folder', color: '#F8C471' },
  { name: 'Quiet Time', icon: 'book', color: '#AED6F1' },
  { name: 'Recreation', icon: 'airplane', color: '#F1948A' },
  { name: 'Sleep & Recovery', icon: 'moon', color: '#D2B4DE' },
  { name: 'Work Meetings', icon: 'briefcase', color: '#82E0AA' },
  { name: 'Others', icon: 'ellipsis-horizontal', color: '#FADBD8' },
];

export const getCategoryColor = (categoryName: string): string => {
  const category = TIMEBLOCK_CATEGORIES.find(cat => cat.name === categoryName);
  return category?.color || '#95A5A6';
};

export const getCategoryIcon = (categoryName: string): string => {
  const category = TIMEBLOCK_CATEGORIES.find(cat => cat.name === categoryName);
  return category?.icon || 'ellipsis-horizontal';
};
