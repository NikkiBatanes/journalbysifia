/**
 * Faith Points Event System
 * Simple event emitter for notifying components when faith points are updated
 */

type FaithPointsEventListener = (data: any) => void;

class FaithPointsEventEmitter {
  private listeners: { [event: string]: FaithPointsEventListener[] } = {};

  on(event: string, listener: FaithPointsEventListener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: FaithPointsEventListener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== listener);
  }

  emit(event: string, data?: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(listener => listener(data));
  }
}

export const faithPointsEvents = new FaithPointsEventEmitter();

// Event types
export const FAITH_POINTS_EVENTS = {
  POINTS_UPDATED: 'points_updated',
  PROFILE_UPDATED: 'profile_updated',
  LEVEL_UP: 'level_up',
} as const;
