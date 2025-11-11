/**
 * Enterprise Circuit Breaker Pattern
 * Prevents cascading failures by stopping requests to failing services
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are blocked
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  successThreshold: number; // Number of successes in HALF_OPEN before closing
  timeout: number; // Time in ms to wait before trying HALF_OPEN
  monitoringPeriod: number; // Time window to track failures
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

/**
 * Default circuit breaker configuration for OpenAI API
 */
export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Open circuit after 5 consecutive failures
  successThreshold: 2, // Close circuit after 2 consecutive successes
  timeout: 60000, // Wait 60 seconds before trying again
  monitoringPeriod: 120000, // Track failures over 2 minutes
};

/**
 * In-memory circuit breaker store
 * Tracks state per service endpoint
 */
const circuitStates = new Map<string, CircuitBreakerState>();

/**
 * Circuit Breaker implementation
 * Protects against cascading failures
 */
export class CircuitBreaker {
  /**
   * Execute a function with circuit breaker protection
   */
  static async execute<T>(
    serviceKey: string,
    fn: () => Promise<T>,
    config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG
  ): Promise<T> {
    const state = this.getState(serviceKey);

    // Check if circuit is OPEN
    if (state.state === CircuitState.OPEN) {
      const now = Date.now();
      
      // Check if timeout has passed
      if (state.nextAttemptTime && now < state.nextAttemptTime) {
        const waitTime = Math.ceil((state.nextAttemptTime - now) / 1000);
        console.error(`[CircuitBreaker] Circuit OPEN for ${serviceKey}. Retry in ${waitTime}s`);
        throw new Error(
          `Service temporarily unavailable. Our AI assistant is experiencing issues. Please try again in ${waitTime} seconds.`
        );
      }

      // Timeout passed, transition to HALF_OPEN
      console.log(`[CircuitBreaker] ${serviceKey} transitioning to HALF_OPEN`);
      this.transitionToHalfOpen(serviceKey);
    }

    // Execute the function
    try {
      const result = await fn();
      this.recordSuccess(serviceKey, config);
      return result;
    } catch (error) {
      this.recordFailure(serviceKey, config);
      throw error;
    }
  }

  /**
   * Get current state for a service
   */
  private static getState(serviceKey: string): CircuitBreakerState {
    if (!circuitStates.has(serviceKey)) {
      circuitStates.set(serviceKey, {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
      });
    }
    return circuitStates.get(serviceKey)!;
  }

  /**
   * Record a successful execution
   */
  private static recordSuccess(serviceKey: string, config: CircuitBreakerConfig): void {
    const state = this.getState(serviceKey);

    if (state.state === CircuitState.HALF_OPEN) {
      state.successes++;
      console.log(`[CircuitBreaker] ${serviceKey} success in HALF_OPEN (${state.successes}/${config.successThreshold})`);

      // Check if we should close the circuit
      if (state.successes >= config.successThreshold) {
        console.log(`[CircuitBreaker] ${serviceKey} transitioning to CLOSED`);
        this.transitionToClosed(serviceKey);
      }
    } else if (state.state === CircuitState.CLOSED) {
      // Reset failure count on success
      state.failures = 0;
      state.lastFailureTime = undefined;
    }
  }

  /**
   * Record a failed execution
   */
  private static recordFailure(serviceKey: string, config: CircuitBreakerConfig): void {
    const state = this.getState(serviceKey);
    const now = Date.now();

    // Reset failure count if outside monitoring period
    if (state.lastFailureTime && (now - state.lastFailureTime) > config.monitoringPeriod) {
      state.failures = 0;
    }

    state.failures++;
    state.lastFailureTime = now;

    console.error(`[CircuitBreaker] ${serviceKey} failure recorded (${state.failures}/${config.failureThreshold})`);

    // Check if we should open the circuit
    if (state.state === CircuitState.CLOSED && state.failures >= config.failureThreshold) {
      console.error(`[CircuitBreaker] ${serviceKey} transitioning to OPEN`);
      this.transitionToOpen(serviceKey, config);
    } else if (state.state === CircuitState.HALF_OPEN) {
      // Failed in HALF_OPEN, go back to OPEN
      console.error(`[CircuitBreaker] ${serviceKey} failed in HALF_OPEN, back to OPEN`);
      this.transitionToOpen(serviceKey, config);
    }
  }

  /**
   * Transition to CLOSED state
   */
  private static transitionToClosed(serviceKey: string): void {
    circuitStates.set(serviceKey, {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
    });
  }

  /**
   * Transition to OPEN state
   */
  private static transitionToOpen(serviceKey: string, config: CircuitBreakerConfig): void {
    const now = Date.now();
    circuitStates.set(serviceKey, {
      state: CircuitState.OPEN,
      failures: 0,
      successes: 0,
      lastFailureTime: now,
      nextAttemptTime: now + config.timeout,
    });
  }

  /**
   * Transition to HALF_OPEN state
   */
  private static transitionToHalfOpen(serviceKey: string): void {
    const state = this.getState(serviceKey);
    state.state = CircuitState.HALF_OPEN;
    state.failures = 0;
    state.successes = 0;
  }

  /**
   * Get current circuit state (for monitoring)
   */
  static getCircuitState(serviceKey: string): CircuitBreakerState {
    return this.getState(serviceKey);
  }

  /**
   * Manually reset circuit (admin function)
   */
  static reset(serviceKey: string): void {
    console.log(`[CircuitBreaker] Manually resetting ${serviceKey}`);
    this.transitionToClosed(serviceKey);
  }

  /**
   * Get all circuit states (for monitoring dashboard)
   */
  static getAllStates(): Map<string, CircuitBreakerState> {
    return new Map(circuitStates);
  }
}

/**
 * Service keys for different endpoints
 */
export const CIRCUIT_KEYS = {
  OPENAI_DEVOTIONAL: 'openai:devotional',
  OPENAI_PLAYBOOK: 'openai:playbook',
  OPENAI_QUESTION: 'openai:question',
  OPENAI_COACHING: 'openai:coaching',
} as const;
