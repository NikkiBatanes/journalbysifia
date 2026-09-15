export interface Emotion {
  id: string;
  name: string;
  icon: string;
}

export const LOOKING_FORWARD_EMOTIONS: Emotion[] = [
  { id: 'hopeful', name: 'Hopeful', icon: 'heart' },
  { id: 'trusting', name: 'Trusting', icon: 'shield-check-outline' },
  { id: 'anxious', name: 'Anxious', icon: 'alert-circle-outline' },
  { id: 'frustrated', name: 'Frustrated', icon: 'emoticon-angry-outline' },
  { id: 'reluctant', name: 'Reluctant', icon: 'pause-circle-outline' },
  { id: 'tired', name: 'Tired', icon: 'bed-outline' },
  { id: 'unprepared', name: 'Unprepared', icon: 'book-open-page-variant-outline' },
  { id: 'open-handed', name: 'Open-handed', icon: 'hand-coin' },
  { id: 'surrendered', name: 'Surrendered', icon: 'white-balance-sunny' },
  { id: 'excited', name: 'Excited', icon: 'star-face' },
  { id: 'expectant', name: 'Expectant', icon: 'clock-outline' },
  { id: 'ready', name: 'Ready', icon: 'check-circle-outline' },
  { id: 'prayerful', name: 'Prayerful', icon: 'hands-pray' },
  { id: 'calm', name: 'Calm', icon: 'weather-sunny' },
  { id: 'steady', name: 'Steady', icon: 'anchor' },
  { id: 'overwhelmed', name: 'Overwhelmed', icon: 'wave' },
  { id: 'nervous', name: 'Nervous', icon: 'lightning-bolt-outline' },
  { id: 'hesitant', name: 'Hesitant', icon: 'dots-horizontal-circle-outline' },
  { id: 'heavy', name: 'Heavy', icon: 'weight' },
  { id: 'cautious', name: 'Cautious', icon: 'shield-outline' },
  { id: 'curious', name: 'Curious', icon: 'lightbulb-outline' },
  { id: 'thankful', name: 'Thankful', icon: 'flower' },
  { id: 'eager', name: 'Eager', icon: 'rocket-launch-outline' },
  { id: 'stretched', name: 'Stretched', icon: 'arrow-expand-horizontal' },
  { id: 'unsure', name: 'Unsure', icon: 'help-circle-outline' },
  { id: 'waiting', name: 'Waiting', icon: 'timer-outline' },
  { id: 'other', name: 'Other', icon: 'plus-circle-outline' },
];

