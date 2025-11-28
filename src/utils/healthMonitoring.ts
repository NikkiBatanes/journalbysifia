/**
 * Health Monitoring Dashboard
 * Real-time system health monitoring for 2000+ users
 * Prevents circuit breaker issues through proactive monitoring
 */

import { Logger } from './ProductionLogger';
import { enterpriseResilience } from './enterpriseResilience';
import { circuitBreakerRegistry } from './circuitBreaker';
import { monitoring } from './monitoring';

export interface SystemHealth {
  timestamp: number;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    queue: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      queueSize: number;
      processing: number;
      capacity: number;
      utilizationPercent: number;
    };
    circuitBreakers: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      breakers: Array<{
        name: string;
        state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
        failures: number;
        lastFailureTime: number | null;
      }>;
    };
    apiHealth: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      avgResponseTime: number;
      successRate: number;
      consecutiveFailures: number;
    };
  };
  alerts: Array<{
    severity: 'warning' | 'critical';
    component: string;
    message: string;
  }>;
}

/**
 * Get comprehensive system health status
 */
export function getSystemHealth(): SystemHealth {
  const alerts: SystemHealth['alerts'] = [];

  // Get queue status
  const queueStatus = enterpriseResilience.getSystemStatus();
  const queueHealth = queueStatus.queue;
  const utilizationPercent = (queueHealth.processing / queueHealth.capacity) * 100;

  let queueComponentStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (utilizationPercent > 90) {
    queueComponentStatus = 'unhealthy';
    alerts.push({
      severity: 'critical',
      component: 'queue',
      message: `Queue utilization at ${utilizationPercent.toFixed(1)}%. System at capacity.`,
    });
  } else if (utilizationPercent > 70) {
    queueComponentStatus = 'degraded';
    alerts.push({
      severity: 'warning',
      component: 'queue',
      message: `Queue utilization at ${utilizationPercent.toFixed(1)}%. Approaching capacity.`,
    });
  }

  if (queueHealth.queueSize > 100) {
    alerts.push({
      severity: 'warning',
      component: 'queue',
      message: `${queueHealth.queueSize} requests queued. Users may experience delays.`,
    });
  }

  // Get circuit breaker status
  const allBreakers = circuitBreakerRegistry.getAllStats();
  const breakerArray = Object.entries(allBreakers).map(([name, stats]) => ({
    name,
    state: stats.state,
    failures: stats.failures,
    lastFailureTime: stats.lastFailureTime,
  }));

  const openBreakers = breakerArray.filter(b => b.state === 'OPEN');
  const halfOpenBreakers = breakerArray.filter(b => b.state === 'HALF_OPEN');

  let circuitBreakerStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (openBreakers.length > 0) {
    circuitBreakerStatus = 'unhealthy';
    openBreakers.forEach(breaker => {
      alerts.push({
        severity: 'critical',
        component: 'circuit-breaker',
        message: `Circuit breaker '${breaker.name}' is OPEN. Service degraded.`,
      });
    });
  } else if (halfOpenBreakers.length > 0) {
    circuitBreakerStatus = 'degraded';
    halfOpenBreakers.forEach(breaker => {
      alerts.push({
        severity: 'warning',
        component: 'circuit-breaker',
        message: `Circuit breaker '${breaker.name}' is testing recovery.`,
      });
    });
  }

  // Get API health
  const apiHealth = queueStatus.health;
  let apiStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (!apiHealth.isHealthy) {
    apiStatus = 'unhealthy';
    alerts.push({
      severity: 'critical',
      component: 'api',
      message: `API health check failing. ${apiHealth.consecutiveFailures} consecutive failures.`,
    });
  } else if (apiHealth.metrics.successRate < 95) {
    apiStatus = 'degraded';
    alerts.push({
      severity: 'warning',
      component: 'api',
      message: `API success rate at ${apiHealth.metrics.successRate.toFixed(1)}%. Below 95% target.`,
    });
  }

  if (apiHealth.metrics.avgResponseTime > 10000) {
    alerts.push({
      severity: 'warning',
      component: 'api',
      message: `Average response time ${(apiHealth.metrics.avgResponseTime / 1000).toFixed(1)}s. Users may experience slowness.`,
    });
  }

  // Determine overall health
  let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (
    queueComponentStatus === 'unhealthy' ||
    circuitBreakerStatus === 'unhealthy' ||
    apiStatus === 'unhealthy'
  ) {
    overall = 'unhealthy';
  } else if (
    queueComponentStatus === 'degraded' ||
    circuitBreakerStatus === 'degraded' ||
    apiStatus === 'degraded'
  ) {
    overall = 'degraded';
  }

  return {
    timestamp: Date.now(),
    overall,
    components: {
      queue: {
        status: queueComponentStatus,
        queueSize: queueHealth.queueSize,
        processing: queueHealth.processing,
        capacity: queueHealth.capacity,
        utilizationPercent,
      },
      circuitBreakers: {
        status: circuitBreakerStatus,
        breakers: breakerArray,
      },
      apiHealth: {
        status: apiStatus,
        avgResponseTime: apiHealth.metrics.avgResponseTime,
        successRate: apiHealth.metrics.successRate,
        consecutiveFailures: apiHealth.consecutiveFailures,
      },
    },
    alerts,
  };
}

/**
 * Log system health to console (for development)
 */
export function logSystemHealth(): void {
  const health = getSystemHealth();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SYSTEM HEALTH DASHBOARD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Overall status
  const statusEmoji = health.overall === 'healthy' ? '' :
                      health.overall === 'degraded' ? '' : '';
  console.log(`\n${statusEmoji} Overall Status: ${health.overall.toUpperCase()}`);

  // Queue
  console.log('\n📦 Request Queue:');
  console.log(`   Status: ${health.components.queue.status}`);
  console.log(`   Queue Size: ${health.components.queue.queueSize}`);
  console.log(`   Processing: ${health.components.queue.processing}/${health.components.queue.capacity}`);
  console.log(`   Utilization: ${health.components.queue.utilizationPercent.toFixed(1)}%`);

  // Circuit Breakers
  console.log('\n Circuit Breakers:');
  console.log(`   Status: ${health.components.circuitBreakers.status}`);
  health.components.circuitBreakers.breakers.forEach(breaker => {
    const emoji = breaker.state === 'CLOSED' ? '' :
                  breaker.state === 'HALF_OPEN' ? '' : '';
    console.log(`   ${emoji} ${breaker.name}: ${breaker.state} (${breaker.failures} failures)`);
  });

  // API Health
  console.log('\n🌐 API Health:');
  console.log(`   Status: ${health.components.apiHealth.status}`);
  console.log(`   Avg Response: ${(health.components.apiHealth.avgResponseTime / 1000).toFixed(2)}s`);
  console.log(`   Success Rate: ${health.components.apiHealth.successRate.toFixed(1)}%`);
  console.log(`   Consecutive Failures: ${health.components.apiHealth.consecutiveFailures}`);

  // Alerts
  if (health.alerts.length > 0) {
    console.log('\n  Active Alerts:');
    health.alerts.forEach(alert => {
      const emoji = alert.severity === 'critical' ? '🔴' : '';
      console.log(`   ${emoji} [${alert.component}] ${alert.message}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Log to monitoring system
  monitoring.trackMetric('system_health_check', 1, {
    overall: health.overall,
    queueSize: health.components.queue.queueSize,
    utilizationPercent: health.components.queue.utilizationPercent,
    successRate: health.components.apiHealth.successRate,
    alertCount: health.alerts.length,
  });
}

/**
 * Start periodic health monitoring (call in App.tsx for production)
 */
export function startHealthMonitoring(intervalMs: number = 60000): () => void {
  Logger.info('🏥 Starting health monitoring', {
    component: 'healthMonitoring',
    data: { intervalMs },
  });

  const intervalId = setInterval(() => {
    const health = getSystemHealth();

    // Log if not healthy
    if (health.overall !== 'healthy') {
      Logger.warn(' System health degraded', {
        component: 'healthMonitoring',
        data: {
          overall: health.overall,
          alerts: health.alerts,
        },
      });
    }

    // In development, log to console
    if (__DEV__) {
      logSystemHealth();
    }

    // Track metrics
    monitoring.trackMetric('system_health_check', 1, {
      overall: health.overall,
      alertCount: health.alerts.length,
    });
  }, intervalMs);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    Logger.info('🏥 Stopped health monitoring', {
      component: 'healthMonitoring',
    });
  };
}

/**
 * Get user-friendly status message
 */
export function getStatusMessage(): string {
  const health = getSystemHealth();

  if (health.overall === 'healthy') {
    return 'All systems operational';
  }

  if (health.overall === 'degraded') {
    return 'Some services experiencing issues. Your request may take longer than usual.';
  }

  return 'We\'re experiencing high demand. Please try again in a few moments.';
}
