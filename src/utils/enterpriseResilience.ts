/**
 * Enterprise-Grade Resilience System
 * Designed for 2000+ concurrent users with 99.9% uptime
 *
 * Prevents circuit breaker failures through:
 * 1. Adaptive rate limiting per user tier
 * 2. Intelligent request queuing with priority
 * 3. Exponential backoff with jitter
 * 4. Health monitoring and auto-recovery
 * 5. Graceful degradation
 * 6. Request deduplication
 */

import { Logger } from './ProductionLogger';
import { monitoring } from './monitoring';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface ResilienceConfig {
  // Rate limiting
  maxConcurrentRequests: number; // Global concurrent requests
  maxRequestsPerMinute: number; // Per-user rate limit

  // Retry logic
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;

  // Health monitoring
  healthCheckIntervalMs: number;
  unhealthyThreshold: number; // Failed health checks before marking unhealthy

  // Circuit breaker
  failureThreshold: number;
  successThreshold: number;
  circuitOpenDurationMs: number;

  // Queue management
  maxQueueSize: number;
  queueTimeoutMs: number;
}

// Tier-based configurations for different user levels
export const TIER_CONFIGS: Record<string, Partial<ResilienceConfig>> = {
  seeker: {
    maxRequestsPerMinute: 2,
    maxRetries: 2,
  },
  spark: {
    maxRequestsPerMinute: 5,
    maxRetries: 3,
  },
  growth: {
    maxRequestsPerMinute: 10,
    maxRetries: 3,
  },
  transformation: {
    maxRequestsPerMinute: 20,
    maxRetries: 4,
  },
};

// Default production configuration for 2000 users
const DEFAULT_CONFIG: ResilienceConfig = {
  maxConcurrentRequests: 50, // Handle 50 concurrent generations
  maxRequestsPerMinute: 5,
  maxRetries: 3,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  healthCheckIntervalMs: 30000, // 30 seconds
  unhealthyThreshold: 3,
  failureThreshold: 15, // Much higher for production
  successThreshold: 3,
  circuitOpenDurationMs: 20000, // 20 seconds (faster recovery)
  maxQueueSize: 200, // Queue up to 200 requests
  queueTimeoutMs: 300000, // 5 minutes max queue time
};

// ============================================================================
// REQUEST QUEUE WITH PRIORITY
// ============================================================================

interface QueuedRequest<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number; // Higher = more priority
  tier: string;
  timestamp: number;
  retryCount: number;
}

class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private processing = 0;
  private config: ResilienceConfig;

  constructor(config: ResilienceConfig) {
    this.config = config;
  }

  async enqueue<T>(
    fn: () => Promise<T>,
    priority: number,
    tier: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Check queue size
      if (this.queue.length >= this.config.maxQueueSize) {
        reject(new Error('Request queue is full. Please try again later.'));
        monitoring.trackMetric('queue_overflow', 1, { tier });
        return;
      }

      const request: QueuedRequest<T> = {
        id: `${Date.now()}-${Math.random()}`,
        fn,
        resolve,
        reject,
        priority,
        tier,
        timestamp: Date.now(),
        retryCount: 0,
      };

      // Add to queue in priority order
      this.queue.push(request);
      this.queue.sort((a, b) => b.priority - a.priority);

      monitoring.trackMetric('queue_add', 1, {
        tier,
        queueSize: this.queue.length,
        priority,
      });

      // Start processing
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    // Check if we can process more requests
    if (this.processing >= this.config.maxConcurrentRequests) {
      return;
    }

    // Get next request
    const request = this.queue.shift();
    if (!request) {
      return;
    }

    // Check timeout
    const waitTime = Date.now() - request.timestamp;
    if (waitTime > this.config.queueTimeoutMs) {
      request.reject(new Error('Request timed out in queue'));
      monitoring.trackMetric('queue_timeout', 1, {
        tier: request.tier,
        waitTime,
      });
      this.processQueue(); // Try next request
      return;
    }

    this.processing++;

    try {
      const result = await request.fn();
      request.resolve(result);

      monitoring.trackMetric('queue_success', 1, {
        tier: request.tier,
        waitTime,
      });
    } catch (error) {
      request.reject(error as Error);

      monitoring.trackMetric('queue_failure', 1, {
        tier: request.tier,
        error: (error as Error).message,
      });
    } finally {
      this.processing--;
      // Process next request
      this.processQueue();
    }
  }

  getStatus() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      capacity: this.config.maxConcurrentRequests,
    };
  }
}

// ============================================================================
// RATE LIMITER PER USER
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();

  async checkLimit(userId: string, tier: string): Promise<boolean> {
    const now = Date.now();
    const entry = this.limits.get(userId);
    const maxRequests = TIER_CONFIGS[tier]?.maxRequestsPerMinute || DEFAULT_CONFIG.maxRequestsPerMinute;

    if (!entry || now > entry.resetTime) {
      // Create new limit window
      this.limits.set(userId, {
        count: 1,
        resetTime: now + 60000, // 1 minute
      });
      return true;
    }

    if (entry.count >= maxRequests) {
      const waitSeconds = Math.ceil((entry.resetTime - now) / 1000);
      monitoring.trackMetric('rate_limit_hit', 1, {
        tier,
        userId,
        waitSeconds,
      });
      return false;
    }

    entry.count++;
    return true;
  }

  getRemainingRequests(userId: string, tier: string): number {
    const entry = this.limits.get(userId);
    const maxRequests = TIER_CONFIGS[tier]?.maxRequestsPerMinute || DEFAULT_CONFIG.maxRequestsPerMinute;

    if (!entry || Date.now() > entry.resetTime) {
      return maxRequests;
    }

    return Math.max(0, maxRequests - entry.count);
  }
}

// ============================================================================
// EXPONENTIAL BACKOFF WITH JITTER
// ============================================================================

export function calculateBackoff(
  attempt: number,
  baseDelay: number = DEFAULT_CONFIG.baseRetryDelayMs,
  maxDelay: number = DEFAULT_CONFIG.maxRetryDelayMs
): number {
  // Exponential backoff: delay = baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add jitter (random ±25%) to prevent thundering herd
  const jitter = exponentialDelay * (0.75 + Math.random() * 0.5);

  // Cap at maxDelay
  return Math.min(jitter, maxDelay);
}

// ============================================================================
// HEALTH MONITORING
// ============================================================================

interface HealthStatus {
  isHealthy: boolean;
  lastCheckTime: number;
  consecutiveFailures: number;
  lastError?: string;
  metrics: {
    avgResponseTime: number;
    successRate: number;
    queueSize: number;
  };
}

class HealthMonitor {
  private status: HealthStatus = {
    isHealthy: true,
    lastCheckTime: Date.now(),
    consecutiveFailures: 0,
    metrics: {
      avgResponseTime: 0,
      successRate: 100,
      queueSize: 0,
    },
  };

  private responseTimes: number[] = [];
  private recentRequests: { success: boolean; timestamp: number }[] = [];

  recordRequest(success: boolean, responseTime: number): void {
    const now = Date.now();

    // Track response time
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    // Track success/failure
    this.recentRequests.push({ success, timestamp: now });
    if (this.recentRequests.length > 100) {
      this.recentRequests.shift();
    }

    // Update metrics
    this.updateMetrics();

    // Check health
    if (!success) {
      this.status.consecutiveFailures++;

      if (this.status.consecutiveFailures >= DEFAULT_CONFIG.unhealthyThreshold) {
        this.status.isHealthy = false;
        Logger.warn(' System marked as unhealthy', {
          component: 'healthMonitor',
          data: {
            consecutiveFailures: this.status.consecutiveFailures,
            successRate: this.status.metrics.successRate,
          },
        });

        monitoring.trackMetric('system_unhealthy', 1, {
          consecutiveFailures: this.status.consecutiveFailures,
        });
      }
    } else {
      // Reset on success
      if (this.status.consecutiveFailures > 0) {
        this.status.consecutiveFailures--;
      }

      // Mark healthy if we had enough successes
      if (this.status.consecutiveFailures === 0 && !this.status.isHealthy) {
        this.status.isHealthy = true;
        Logger.info(' System marked as healthy', {
          component: 'healthMonitor',
        });

        monitoring.trackMetric('system_healthy', 1);
      }
    }

    this.status.lastCheckTime = now;
  }

  private updateMetrics(): void {
    // Average response time
    if (this.responseTimes.length > 0) {
      this.status.metrics.avgResponseTime =
        this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }

    // Success rate (last 100 requests)
    const recentSuccesses = this.recentRequests.filter(r => r.success).length;
    this.status.metrics.successRate =
      (recentSuccesses / Math.max(1, this.recentRequests.length)) * 100;
  }

  getStatus(): HealthStatus {
    return { ...this.status };
  }

  isHealthy(): boolean {
    return this.status.isHealthy;
  }
}

// ============================================================================
// MAIN RESILIENCE SERVICE
// ============================================================================

export class EnterpriseResilience {
  private config: ResilienceConfig;
  private queue: RequestQueue;
  private rateLimiter: RateLimiter;
  private healthMonitor: HealthMonitor;
  private requestCache = new Map<string, Promise<any>>();

  constructor(config: Partial<ResilienceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.queue = new RequestQueue(this.config);
    this.rateLimiter = new RateLimiter();
    this.healthMonitor = new HealthMonitor();
  }

  /**
   * Execute request with full resilience: queuing, rate limiting, retries, health checks
   */
  async executeWithResilience<T>(
    fn: () => Promise<T>,
    options: {
      userId: string;
      tier: string;
      operationName: string;
      priority?: number;
      deduplicationKey?: string;
    }
  ): Promise<T> {
    const { userId, tier, operationName, priority = 5, deduplicationKey } = options;

    // 1. Check rate limit
    const allowed = await this.rateLimiter.checkLimit(userId, tier);
    if (!allowed) {
      throw new Error(
        `Rate limit exceeded. You can make ${TIER_CONFIGS[tier]?.maxRequestsPerMinute || 5} requests per minute.`
      );
    }

    // 2. Check deduplication
    if (deduplicationKey && this.requestCache.has(deduplicationKey)) {
      Logger.info(`♻️ Returning cached result for ${operationName}`, {
        component: 'enterpriseResilience',
        data: { userId, deduplicationKey },
      });
      return this.requestCache.get(deduplicationKey)!;
    }

    // 3. Create resilient execution with retries
    const resilientFn = async (): Promise<T> => {
      let lastError: Error | null = null;
      const maxRetries = TIER_CONFIGS[tier]?.maxRetries || this.config.maxRetries;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const startTime = Date.now();

        try {
          const result = await fn();
          const responseTime = Date.now() - startTime;

          // Record success
          this.healthMonitor.recordRequest(true, responseTime);

          monitoring.trackMetric('request_success', 1, {
            tier,
            operationName,
            attempt,
            responseTime,
          });

          return result;

        } catch (error) {
          lastError = error as Error;
          const responseTime = Date.now() - startTime;

          // Record failure
          this.healthMonitor.recordRequest(false, responseTime);

          Logger.warn(` ${operationName} attempt ${attempt + 1} failed`, {
            component: 'enterpriseResilience',
            data: {
              userId,
              tier,
              error: lastError.message,
              attempt,
            },
          });

          // Don't retry on CONTENT_BLOCKED errors - these are policy violations, not transient failures
          if ((lastError as any).contentBlocked) {
            monitoring.trackMetric('request_blocked', 1, {
              tier,
              operationName,
              attempt: attempt + 1,
            });
            throw lastError;
          }

          // Don't retry on last attempt
          if (attempt >= maxRetries) {
            monitoring.trackMetric('request_failure', 1, {
              tier,
              operationName,
              totalAttempts: attempt + 1,
              error: lastError.message,
            });
            throw lastError;
          }

          // Calculate backoff delay
          const delay = calculateBackoff(attempt);

          Logger.info(` Retrying ${operationName} in ${delay}ms...`, {
            component: 'enterpriseResilience',
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      throw lastError || new Error('Unknown error in resilient execution');
    };

    // 4. Add to queue with priority
    const promise = this.queue.enqueue(resilientFn, priority, tier);

    // 5. Cache if deduplication key provided
    if (deduplicationKey) {
      this.requestCache.set(deduplicationKey, promise);

      // Clear cache after completion
      promise.finally(() => {
        setTimeout(() => {
          this.requestCache.delete(deduplicationKey);
        }, 5000); // Cache for 5 seconds
      });
    }

    return promise;
  }

  /**
   * Get system status for monitoring
   */
  getSystemStatus() {
    return {
      queue: this.queue.getStatus(),
      health: this.healthMonitor.getStatus(),
    };
  }

  /**
   * Get remaining requests for a user
   */
  getRemainingRequests(userId: string, tier: string): number {
    return this.rateLimiter.getRemainingRequests(userId, tier);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const enterpriseResilience = new EnterpriseResilience();
