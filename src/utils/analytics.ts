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
    if (!this.isEnabled) return;

    this.track(event, properties, userId);
  }

  /**
   * Track a general event
   */
  track(event: string, properties?: Record<string, any>, userId?: string): void {
    if (!this.isEnabled) return;

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
    if (!this.isEnabled || this.events.length === 0) return;

    // TODO: Implement actual analytics service integration
    // For now, just clear the events
    console.log('📊 Flushing analytics events:', this.events.length);
    this.clear();
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Export types for use in components
export type { TodoAnalyticsEvents, AnalyticsEvent };
