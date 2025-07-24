/**
 * Analytics utility for tracking user interactions
 * This provides a foundation for future analytics integration
 */

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp?: number;
  userId?: string;
}

interface TodoAnalyticsEvents {
  'todo_created': {
    text_length: number;
    has_priority: boolean;
    date: string;
  };
  'todo_completed': {
    todo_id: string;
    completion_time_ms: number;
    date: string;
  };
  'todo_deleted': {
    todo_id: string;
    was_completed: boolean;
    date: string;
  };
  'todo_priority_toggled': {
    todo_id: string;
    new_priority: boolean;
    date: string;
  };
  'todos_loaded': {
    count: number;
    load_time_ms: number;
    date: string;
  };
  'todo_error': {
    error_type: string;
    operation: string;
    date: string;
  };
}

interface FocusAnalyticsEvents {
  'focus_updated': {
    focus_length: number;
    has_priorities: boolean;
    priorities_count: number;
    date: string;
  };
  'focus_priority_completed': {
    priority_index: number;
    priority_text_length: number;
    date: string;
  };
  'focus_priority_added': {
    priority_index: number;
    priority_text_length: number;
    date: string;
  };
  'focus_priority_removed': {
    priority_index: number;
    was_completed: boolean;
    date: string;
  };
  'focus_loaded': {
    has_focus: boolean;
    priorities_count: number;
    completed_priorities: number;
    load_time_ms: number;
    date: string;
  };
  'focus_error': {
    error_type: string;
    operation: string;
    date: string;
  };
}

interface GratitudeAnalyticsEvents {
  'gratitude_items_saved': {
    items_count: number;
    total_text_length: number;
    is_editing: boolean;
    date: string;
  };
  'gratitude_item_deleted': {
    item_id: string;
    item_text_length: number;
    date: string;
  };
  'gratitude_field_added': {
    field_count: number;
    date: string;
  };
  'gratitude_loaded': {
    items_count: number;
    load_time_ms: number;
    date: string;
  };
  'gratitude_error': {
    error_type: string;
    operation: string;
    date: string;
  };
}

interface WinAnalyticsEvents {
  'win_created': {
    text_length: number;
    date: string;
  };
  'win_updated': {
    text_length: number;
    previous_text_length: number;
    date: string;
  };
  'win_deleted': {
    win_id: string;
    text_length: number;
    date: string;
  };
  'win_loaded': {
    has_win: boolean;
    load_time_ms: number;
    date: string;
  };
  'win_error': {
    error_type: string;
    operation: string;
    date: string;
  };
}

interface LookingForwardAnalyticsEvents {
  'looking_forward_created': {
    text_length: number;
    date: string;
  };
  'looking_forward_updated': {
    text_length: number;
    previous_text_length: number;
    date: string;
  };
  'looking_forward_deleted': {
    entry_id: string;
    text_length: number;
    date: string;
  };
  'looking_forward_loaded': {
    has_entry: boolean;
    load_time_ms: number;
    date: string;
  };
  'looking_forward_error': {
    error_type: string;
    operation: string;
    date: string;
  };
}

class Analytics {
  private events: AnalyticsEvent[] = [];
  private isEnabled: boolean = __DEV__; // Only enable in development for now

  /**
   * Track a todo-specific event
   */
  trackTodoEvent<T extends keyof TodoAnalyticsEvents>(
    event: T,
    properties: TodoAnalyticsEvents[T],
    userId?: string
  ): void {
    if (!this.isEnabled) {return;}

    this.track(event, properties, userId);
  }

  /**
   * Track a Today's Focus-specific event
   */
  trackFocusEvent<T extends keyof FocusAnalyticsEvents>(
    event: T,
    properties: FocusAnalyticsEvents[T],
    userId?: string
  ): void {
    if (!this.isEnabled) {return;}

    this.track(event, properties, userId);
  }

  /**
   * Track a Gratitude List-specific event
   */
  trackGratitudeEvent<T extends keyof GratitudeAnalyticsEvents>(
    event: T,
    properties: GratitudeAnalyticsEvents[T],
    userId?: string
  ): void {
    if (!this.isEnabled) {return;}

    this.track(event, properties, userId);
  }

  /**
   * Track a Today's Win-specific event
   */
  trackWinEvent<T extends keyof WinAnalyticsEvents>(
    event: T,
    properties: WinAnalyticsEvents[T],
    userId?: string
  ): void {
    if (!this.isEnabled) {return;}

    this.track(event, properties, userId);
  }

  /**
   * Track a Looking Forward-specific event
   */
  trackLookingForwardEvent<T extends keyof LookingForwardAnalyticsEvents>(
    event: T,
    properties: LookingForwardAnalyticsEvents[T],
    userId?: string
  ): void {
    if (!this.isEnabled) {return;}

    this.track(event, properties, userId);
  }

  /**
   * Track a general event
   */
  track(event: string, properties?: Record<string, any>, userId?: string): void {
    if (!this.isEnabled) {return;}

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: Date.now(),
      userId,
    };

    this.events.push(analyticsEvent);

    // In development, log to console
    if (__DEV__) {
      console.log('📊 Analytics:', analyticsEvent);
    }

    // Keep only last 100 events to prevent memory issues
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
  }

  /**
   * Get all tracked events (for debugging)
   */
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Batch send events (placeholder for future implementation)
   */
  async flush(): Promise<void> {
    if (!this.isEnabled || this.events.length === 0) {return;}

    // TODO: Implement actual analytics service integration
    // For now, just clear the events
    console.log('📊 Flushing analytics events:', this.events.length);
    this.clear();
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Export types for use in components
export type { TodoAnalyticsEvents, FocusAnalyticsEvents, GratitudeAnalyticsEvents, WinAnalyticsEvents, LookingForwardAnalyticsEvents, AnalyticsEvent };
