import { Devotional, DevotionalDay } from '../interfaces/devotional';

export function createDefaultDay(dayNumber: number, isError = false): DevotionalDay {
  return {
    id: `day_${Date.now()}_${dayNumber}`,
    dayNumber,
    title: isError ? 'Daily Reflection' : `Day ${dayNumber}`,
    scripture: {
      text: isError
        ? 'Be strong and courageous. Do not be afraid; do not be discouraged, for the LORD your God will be with you wherever you go.'
        : 'The Lord is good, a refuge in times of trouble. He cares for those who trust in him.',
      reference: isError ? 'JOSHUA 1:9' : 'NAHUM 1:7',
    },
    reflection: isError
      ? 'We encountered an issue generating your devotional content. Please try again later.'
      : 'Take a moment to reflect on today\'s scripture and how it applies to your life.',
    reflectionQuestions: [
      { id: `q1_${Date.now()}`, text: 'What is God saying to me through this scripture?' },
      { id: `q2_${Date.now()}`, text: 'How can I apply this to my life today?' },
    ],
    prayer: isError
      ? 'Dear God, thank you for your presence even when things don\'t go as planned. Help me to trust in you today. Amen.'
      : 'Lord, open my heart to receive your word today. Guide me and help me to apply your truth to my life. Amen.',
    completed: false,
  };
}

export function createFallbackDevotional(duration: number, playbookId?: string, userInput?: string): Devotional {
  const days: DevotionalDay[] = [];
  for (let i = 0; i < duration; i++) {
    days.push(createDefaultDay(i + 1, true));
  }

  return {
    id: `dev_${Date.now()}`,
    title: 'Daily Devotional',
    description: userInput || 'A personal time of reflection and prayer',
    category: 'Growth',
    categories: ['Growth'],
    days,
    currentDay: 1,
    totalDays: duration,
    progress: 0,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    playbookId,
    userInput,
    isFallback: true, // Mark as fallback content
  };
}
