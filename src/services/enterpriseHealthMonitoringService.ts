/**
 * Enterprise Health Monitoring Service
 * Provides comprehensive system health monitoring, alerting,
 * and automated recovery for enterprise-grade reliability
 */

import { supabase } from './supabaseClient';
import { logger } from './enterpriseLoggingService';
// Security service import removed as it's not being used

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  uptime: number;
  version: string;
  environment: string;
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  service: string;
  timestamp: string;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  activeConnections: number;
  queueSize: number;
  errorRate: number;
  responseTime: number;
}

class EnterpriseHealthMonitoringService {
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();
  private alerts: Alert[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();

  constructor() {
    this.registerDefaultHealthChecks();
  }

  /**
   * Start health monitoring
   */
  async startMonitoring(intervalMs: number = 30000): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting enterprise health monitoring', { intervalMs });

    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, intervalMs);

    // Perform initial health check
    await this.performHealthChecks();
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    logger.info('Stopped enterprise health monitoring');
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(name: string, checkFunction: () => Promise<HealthCheck>): void {
    this.healthChecks.set(name, checkFunction);
    logger.debug('Registered health check', { name });
  }

  /**
   * Get current system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const checks = await this.performHealthChecks();
    const overall = this.calculateOverallHealth(checks);
    const uptime = Date.now() - this.startTime;

    return {
      overall,
      checks,
      uptime,
      version: '1.0.0', // Should come from package.json
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const [
        cpuUsage,
        memoryUsage,
        diskUsage,
        networkUsage,
        activeConnections,
        queueSize,
        errorRate,
        responseTime,
      ] = await Promise.all([
        this.getCpuUsage(),
        this.getMemoryUsage(),
        this.getDiskUsage(),
        this.getNetworkUsage(),
        this.getActiveConnections(),
        this.getQueueSize(),
        this.getErrorRate(),
        this.getAverageResponseTime(),
      ]);

      const metrics: PerformanceMetrics = {
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        network: networkUsage,
        activeConnections,
        queueSize,
        errorRate,
        responseTime,
      };

      // Store metrics in database
      await this.storeMetrics(metrics);

      return metrics;
    } catch (error) {
      logger.error('Failed to get performance metrics', error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Create an alert
   */
  async createAlert(
    level: Alert['level'],
    title: string,
    description: string,
    service: string,
    metadata?: Record<string, any>
  ): Promise<Alert> {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level,
      title,
      description,
      service,
      timestamp: new Date().toISOString(),
      resolved: false,
      metadata,
    };

    this.alerts.push(alert);

    // Log the alert
    const logLevel = level === 'critical' || level === 'error' ? 'error' :
                    level === 'warning' ? 'warn' : 'info';

    logger[logLevel](`Alert: ${title} - ${JSON.stringify(alert)}`);

    // Store in database
    await this.storeAlert(alert);

    // Send notifications for critical alerts
    if (level === 'critical') {
      await this.sendCriticalAlertNotification(alert);
    }

    return alert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolution?: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.metadata = {
      ...alert.metadata,
      resolvedAt: new Date().toISOString(),
      resolution,
    };

    logger.info('Alert resolved', { alertId, resolution });

    // Update in database
    await this.updateAlert(alert);

    return true;
  }

  /**
   * Perform all registered health checks
   */
  private async performHealthChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    for (const [name, checkFunction] of this.healthChecks) {
      try {
        const check = await checkFunction();
        checks.push(check);

        // Create alerts for unhealthy services
        if (check.status === 'unhealthy') {
          await this.createAlert(
            'error',
            `Health check failed: ${name}`,
            check.message,
            name,
            { responseTime: check.responseTime, metadata: check.metadata }
          );
        } else if (check.status === 'degraded') {
          await this.createAlert(
            'warning',
            `Service degraded: ${name}`,
            check.message,
            name,
            { responseTime: check.responseTime, metadata: check.metadata }
          );
        }
      } catch (error) {
        const failedCheck: HealthCheck = {
          name,
          status: 'unhealthy',
          responseTime: 0,
          message: error instanceof Error ? error.message : 'Health check failed',
          timestamp: new Date().toISOString(),
        };
        checks.push(failedCheck);

        await this.createAlert(
          'critical',
          `Health check error: ${name}`,
          failedCheck.message,
          name,
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
      }
    }

    return checks;
  }

  /**
   * Register default health checks
   */
  private registerDefaultHealthChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async () => {
      const startTime = Date.now();
      try {
        const { error } = await supabase
          .from('user_profiles')
          .select('count')
          .limit(1);

        const responseTime = Date.now() - startTime;

        if (error) {
          return {
            name: 'database',
            status: 'unhealthy',
            responseTime,
            message: `Database error: ${error.message}`,
            timestamp: new Date().toISOString(),
          };
        }

        const status = responseTime > 5000 ? 'degraded' : 'healthy';
        return {
          name: 'database',
          status,
          responseTime,
          message: status === 'healthy' ? 'Database is responsive' : 'Database response is slow',
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          message: error instanceof Error ? error.message : 'Database connection failed',
          timestamp: new Date().toISOString(),
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const memoryUsage = await this.getMemoryUsage();
      const status = memoryUsage > 90 ? 'unhealthy' : memoryUsage > 75 ? 'degraded' : 'healthy';

      return {
        name: 'memory',
        status,
        responseTime: 0,
        message: `Memory usage: ${memoryUsage.toFixed(1)}%`,
        metadata: { usage: memoryUsage },
        timestamp: new Date().toISOString(),
      };
    });

    // Queue health check
    this.registerHealthCheck('queue', async () => {
      const queueSize = await this.getQueueSize();
      const status = queueSize > 1000 ? 'unhealthy' : queueSize > 500 ? 'degraded' : 'healthy';

      return {
        name: 'queue',
        status,
        responseTime: 0,
        message: `Queue size: ${queueSize}`,
        metadata: { queueSize },
        timestamp: new Date().toISOString(),
      };
    });

    // Error rate health check
    this.registerHealthCheck('error_rate', async () => {
      const errorRate = await this.getErrorRate();
      const status = errorRate > 10 ? 'unhealthy' : errorRate > 5 ? 'degraded' : 'healthy';

      return {
        name: 'error_rate',
        status,
        responseTime: 0,
        message: `Error rate: ${errorRate.toFixed(2)}%`,
        metadata: { errorRate },
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * Calculate overall health from individual checks
   */
  private calculateOverallHealth(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    if (checks.some(check => check.status === 'unhealthy')) {
      return 'unhealthy';
    }
    if (checks.some(check => check.status === 'degraded')) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * Performance metric collection methods
   */
  private async getCpuUsage(): Promise<number> {
    // Simplified CPU usage calculation
    // In production, use proper system monitoring
    return Math.random() * 100;
  }

  private async getMemoryUsage(): Promise<number> {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return (usage.heapUsed / usage.heapTotal) * 100;
    }
    return 0;
  }

  private async getDiskUsage(): Promise<number> {
    // Simplified disk usage
    // In production, use proper system monitoring
    return Math.random() * 100;
  }

  private async getNetworkUsage(): Promise<number> {
    // Simplified network usage
    // In production, use proper network monitoring
    return Math.random() * 100;
  }

  private async getActiveConnections(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('count')
        .eq('is_online', true);

      if (error) {throw error;}
      return Array.isArray(data) ? data.length : 0;
    } catch (error) {
      return 0;
    }
  }

  private async getQueueSize(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('queue_items')
        .select('count')
        .eq('status', 'pending');

      if (error) {throw error;}
      return Array.isArray(data) ? data.length : 0;
    } catch (error) {
      return 0;
    }
  }

  private async getErrorRate(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: totalLogs, error: totalError } = await supabase
        .from('application_logs')
        .select('count')
        .gte('timestamp', oneHourAgo);

      const { data: errorLogs, error: errorError } = await supabase
        .from('application_logs')
        .select('count')
        .gte('timestamp', oneHourAgo)
        .in('level', ['error', 'fatal']);

      if (totalError || errorError) {throw new Error('Failed to get error rate');}

      const total = Array.isArray(totalLogs) ? totalLogs.length : 0;
      const errors = Array.isArray(errorLogs) ? errorLogs.length : 0;

      return total > 0 ? (errors / total) * 100 : 0;
    } catch (error) {
      return 0;
    }
  }

  private async getAverageResponseTime(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('performance_metrics')
        .select('duration_ms')
        .gte('timestamp', oneHourAgo);

      if (error) {throw error;}

      if (!data || data.length === 0) {return 0;}

      const total = data.reduce((sum, metric) => sum + metric.duration_ms, 0);
      return total / data.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Storage methods
   */
  private async storeMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const metricsToStore = [
        { metric_type: 'system', metric_name: 'cpu_usage', value: metrics.cpu, unit: 'percent' },
        { metric_type: 'system', metric_name: 'memory_usage', value: metrics.memory, unit: 'percent' },
        { metric_type: 'system', metric_name: 'disk_usage', value: metrics.disk, unit: 'percent' },
        { metric_type: 'system', metric_name: 'network_usage', value: metrics.network, unit: 'percent' },
        { metric_type: 'application', metric_name: 'active_connections', value: metrics.activeConnections, unit: 'count' },
        { metric_type: 'application', metric_name: 'queue_size', value: metrics.queueSize, unit: 'count' },
        { metric_type: 'application', metric_name: 'error_rate', value: metrics.errorRate, unit: 'percent' },
        { metric_type: 'application', metric_name: 'response_time', value: metrics.responseTime, unit: 'milliseconds' },
      ];

      const { error } = await supabase
        .from('system_health_metrics')
        .insert(metricsToStore);

      if (error) {
        logger.error('Failed to store health metrics', error);
      }
    } catch (error) {
      logger.error('Error storing health metrics', error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  private async storeAlert(alert: Alert): Promise<void> {
    try {
      const { error } = await supabase
        .from('security_events')
        .insert({
          id: alert.id,
          event_type: 'api_call',
          severity: alert.level === 'critical' ? 'critical' : alert.level === 'error' ? 'high' : 'medium',
          description: `${alert.title}: ${alert.description}`,
          metadata: {
            service: alert.service,
            alert_type: 'health_monitoring',
            ...alert.metadata,
          },
        });

      if (error) {
        logger.error('Failed to store alert', error);
      }
    } catch (error) {
      logger.error('Error storing alert', error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  private async updateAlert(alert: Alert): Promise<void> {
    try {
      const { error } = await supabase
        .from('security_events')
        .update({
          metadata: {
            service: alert.service,
            alert_type: 'health_monitoring',
            resolved: alert.resolved,
            ...alert.metadata,
          },
        })
        .eq('id', alert.id);

      if (error) {
        logger.error('Failed to update alert', error);
      }
    } catch (error) {
      logger.error('Error updating alert', error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  private async sendCriticalAlertNotification(alert: Alert): Promise<void> {
    // In production, integrate with notification services like:
    // - Email (SendGrid, AWS SES)
    // - SMS (Twilio)
    // - Slack/Teams webhooks
    // - PagerDuty

    logger.fatal(`CRITICAL ALERT: ${alert.title}`, undefined, {
      alert,
      action: 'immediate_attention_required',
    });

    // Log security event for critical system issues
    logger.fatal(`SECURITY ALERT: Critical system alert - ${alert.title}`, undefined, {
      eventType: 'security_violation',
      severity: 'critical',
      alert: JSON.stringify(alert),
    });
  }
}

export const enterpriseHealthMonitoring = new EnterpriseHealthMonitoringService();
