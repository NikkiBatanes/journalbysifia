import { NavigationProp } from '@react-navigation/native';

export type JournalType =
  | 'prayer'
  | 'reflection'
  | 'gratitude'
  | 'timeblock'
  | 'none';

export type SubTask = {
  id: string;
  text: string;
  completed: boolean;
  detected_journal_type?: string;
  is_example?: boolean;
  example_interactive?: boolean;
};

/**
 * Smart Journaling Navigation Service
 * Handles navigation from playbook subtasks to appropriate journaling components
 */
export class SmartJournalingNavigation {
  private navigation: NavigationProp<any>;

  constructor(navigation: NavigationProp<any>) {
    this.navigation = navigation;
  }

  /**
   * Navigate to appropriate journaling component based on journal type
   */
  navigateToJournaling(journalType: JournalType, subTask: SubTask, context?: any) {
    console.log('[SmartJournalingNavigation] Navigating to:', { journalType, subTask });

    switch (journalType) {
      case 'prayer':
        this.navigateToPrayer(subTask, context);
        break;

      case 'reflection':
        this.navigateToReflection(subTask, context);
        break;

      case 'gratitude':
        this.navigateToGratitude(subTask, context);
        break;

      case 'timeblock':
        this.navigateToTimeBlock(subTask, context);
        break;

      case 'none':
        // No navigation needed for 'none' type
        console.log('[SmartJournalingNavigation] No journaling needed for this task');
        break;

      default:
        console.warn('[SmartJournalingNavigation] Unknown journal type:', journalType);
        this.navigateToJournalDefault(subTask, context);
        break;
    }
  }

  /**
   * Navigate to Prayer tab with context
   */
  private navigateToPrayer(subTask: SubTask, _context?: any) {
    console.log('[SmartJournalingNavigation] Navigating to Prayer for:', subTask.text);
    this.navigation.navigate('Journal' as never);
  }

  /**
   * Navigate to Reflection component with context
   */
  private navigateToReflection(subTask: SubTask, _context?: any) {
    console.log('[SmartJournalingNavigation] Navigating to Reflection for:', subTask.text);
    this.navigation.navigate('Journal' as never);
  }

  /**
   * Navigate to Gratitude component with context
   */
  private navigateToGratitude(subTask: SubTask, _context?: any) {
    console.log('[SmartJournalingNavigation] Navigating to Gratitude for:', subTask.text);
    this.navigation.navigate('Journal' as never);
  }

  /**
   * Navigate to TimeBlock component with context
   */
  private navigateToTimeBlock(subTask: SubTask, _context?: any) {
    console.log('[SmartJournalingNavigation] Navigating to TimeBlock for:', subTask.text);
    // TimeBlock smart journaling is handled via modal in ActionStepsCard
    // This navigation method is for fallback cases where modal isn't available
    this.navigation.navigate('Journal' as never);
  }

  /**
   * Default navigation to journal screen
   */
  private navigateToJournalDefault(subTask: SubTask, _context?: any) {
    console.log('[SmartJournalingNavigation] Navigating to Journal (default) for:', subTask.text);
    this.navigation.navigate('Journal' as never);
  }

  /**
   * Static helper to create navigation instance
   */
  static create(navigation: NavigationProp<any>) {
    return new SmartJournalingNavigation(navigation);
  }

  /**
   * Static helper to parse multiple journal types and navigate to the first one
   */
  static navigateToFirstType(
    navigation: NavigationProp<any>,
    journalTypes: string,
    subTask: SubTask,
    context?: any
  ) {
    const types = journalTypes.split(',').map(type => type.trim()).filter(type => type && type !== 'none');
    if (types.length > 0) {
      const navService = SmartJournalingNavigation.create(navigation);
      navService.navigateToJournaling(types[0] as JournalType, subTask, context);
    }
  }
}

/**
 * Hook for using smart journaling navigation
 */
export const useSmartJournalingNavigation = (navigation: NavigationProp<any>) => {
  return SmartJournalingNavigation.create(navigation);
};
