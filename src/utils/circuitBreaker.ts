/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by stopping requests to failing services
 * ZERO UI/UX IMPACT - Transparent failure handling
 */

import { Logger } from './ProductionLogger';
import { monitoring } from './monitoring';

// ============================================================================
// TYPES
// ============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Time in ms before trying half-open
  monitoringPeriod: number; // Time window for counting failures
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttemptTime: number | null = null;
  private failureTimestamps: number[] = [];

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (this.nextAttemptTime && Date.now() < this.nextAttemptTime) {
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        
        Logger.warn(`🔴 Circuit OPEN: ${this.name}`, {
          component: 'circuitBreaker',
          data: {
            nextAttempt: new Date(this.nextAttemptTime).toISOString(),
            failures: this.failures,
          },
        });

        monitoring.trackMetric('circuit_breaker_open', 1, {
          service: this.name,
        });

        throw error;
      } else {
        // Timeout expired, try half-open
        this.state = 'HALF_OPEN';
        this.successes = 0;
        
        Logger.info(`🟡 Circuit HALF-OPEN: ${this.name}`, {
          component: 'circuitBreaker',
        });
      }
    }

    try {
      // Execute the function
      const result = await fn();

      // Success!
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.successes++;

      if (this.successes >= this.config.successThreshold) {
        // Close the circuit
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
        this.failureTimestamps = [];
        this.nextAttemptTime = null;

        Logger.info(`✅ Circuit CLOSED: ${this.name}`, {
          component: 'circuitBreaker',
        });

        monitoring.trackMetric('circuit_breaker_closed', 1, {
          service: this.name,
        });
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failures = 0;
      this.failureTimestamps = [];
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failures++;
    this.failureTimestamps.push(now);

    // Remove old failures outside monitoring period
    this.failureTimestamps = this.failureTimestamps.filter(
      (timestamp) => now - timestamp < this.config.monitoringPeriod
    );

    if (this.state === 'HALF_OPEN') {
      // Failure in half-open state - reopen circuit
      this.state = 'OPEN';
      this.nextAttemptTime = now + this.config.timeout;
      this.successes = 0;

      Logger.warn(`🔴 Circuit RE-OPENED: ${this.name}`, {
        component: 'circuitBreaker',
      });

      monitoring.trackMetric('circuit_breaker_reopened', 1, {
        service: this.name,
      });
    } else if (
      this.state === 'CLOSED' &&
      this.failureTimestamps.length >= this.config.failureThreshold
    ) {
      // Too many failures - open circuit
      this.state = 'OPEN';
      this.nextAttemptTime = now + this.config.timeout;

      Logger.warn(`🔴 Circuit OPENED: ${this.name}`, {
        component: 'circuitBreaker',
        data: {
          failures: this.failures,
          threshold: this.config.failureThreshold,
        },
      });

      monitoring.trackMetric('circuit_breaker_opened', 1, {
        service: this.name,
        failures: this.failures,
      });
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually reset circuit breaker
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.failureTimestamps = [];
    this.lastFailureTime = null;
    this.nextAttemptTime = null;

    Logger.info(`🔄 Circuit RESET: ${this.name}`, {
      component: 'circuitBreaker',
    });
  }

  /**
   * Check if circuit allows requests
   */
  isAvailable(): boolean {
    if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
      return true;
    }

    if (this.nextAttemptTime && Date.now() >= this.nextAttemptTime) {
      return true; // Will transition to half-open
    }

    return false;
  }
}

// ============================================================================
// CIRCUIT BREAKER REGISTRY
// ============================================================================

class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker
   */
  getBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5, // Open after 5 failures
        successThreshold: 2, // Close after 2 successes
        timeout: 60000, // Try again after 60 seconds
        monitoringPeriod: 120000, // Count failures in 2-minute window
      };

      const finalConfig = { ...defaultConfig, ...config };
      this.breakers.set(name, new CircuitBreaker(name, finalConfig));
    }

    return this.breakers.get(name)!;
  }

  /**
   * Get all breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  /**
   * Get stats for all breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });

    return stats;
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    this.breakers.forEach((breaker) => breaker.reset());
    Logger.info('🔄 All circuit breakers reset', {
      component: 'circuitBreaker',
    });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Execute function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  const breaker = circuitBreakerRegistry.getBreaker(serviceName, config);
  return breaker.execute(fn);
}

/**
 * Check if service is available
 */
export function isServiceAvailable(serviceName: string): boolean {
  const breaker = circuitBreakerRegistry.getBreaker(serviceName);
  return breaker.isAvailable();
}

/**
 * Get circuit breaker stats
 */
export function getCircuitStats(serviceName: string): CircuitBreakerStats {
  const breaker = circuitBreakerRegistry.getBreaker(serviceName);
  return breaker.getStats();
}

/**
 * Reset circuit breaker
 */
export function resetCircuit(serviceName: string): void {
  const breaker = circuitBreakerRegistry.getBreaker(serviceName);
  breaker.reset();
}
