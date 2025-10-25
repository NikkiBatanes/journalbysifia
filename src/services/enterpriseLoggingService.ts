/**
 * Enterprise Logging Service
 * Provides structured, centralized logging with multiple levels,
 * correlation IDs, and enterprise-grade log management
 */

import { supabase } from './supabaseClient';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  userId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  performance?: {
    duration: number;
    memory: number;
    cpu?: number;
  };
}

export interface LogFilter {
  level?: LogLevel;
  service?: string;
  userId?: string;
  correlationId?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
}

export interface LogMetrics {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByService: Record<string, number>;
  errorRate: number;
  avgResponseTime: number;
  topErrors: Array<{ message: string; count: number; service: string }>;
}

class EnterpriseLoggingService {
  private correlationId: string | null = null;
  private serviceName: string = 'siFia-app';
  private logBuffer: LogEntry[] = [];
  private bufferSize: number = 100;
  private flushInterval: number = 5000; // 5 seconds
  private isFlushingLogs: boolean = false;

  constructor() {
    // Start periodic log flushing
    setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);

    // Flush logs on app termination
    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => {
        this.flushLogs();
      });
    }
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Generate new correlation ID
   */
  generateCorrelationId(): string {
    const correlationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.setCorrelationId(correlationId);
    return correlationId;
  }

  /**
   * Set service name for all logs
   */
  setServiceName(serviceName: string): void {
    this.serviceName = serviceName;
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>, userId?: string): void {
    this.log('debug', message, metadata, userId);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, any>, userId?: string): void {
    this.log('info', message, metadata, userId);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>, userId?: string): void {
    this.log('warn', message, metadata, userId);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>, userId?: string): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined;

    this.log('error', message, metadata, userId, errorData);
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error, metadata?: Record<string, any>, userId?: string): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined;

    this.log('fatal', message, metadata, userId, errorData);

    // Immediately flush fatal errors
    this.flushLogs();
  }

  /**
   * Log performance metrics
   */
  performance(
    message: string,
    duration: number,
    metadata?: Record<string, any>,
    userId?: string
  ): void {
    const performanceData = {
      duration,
      memory: this.getMemoryUsage(),
      cpu: this.getCpuUsage(),
    };

    this.log('info', message, metadata, userId, undefined, performanceData);
  }

  /**
   * Log API request/response
   */
  apiLog(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    userId?: string,
    requestId?: string
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    this.log(level, `API ${method} ${endpoint}`, {
      method,
      endpoint,
      statusCode,
      duration,
      requestId,
    }, userId, undefined, { duration, memory: this.getMemoryUsage() });
  }

  /**
   * Log user action
   */
  userAction(
    action: string,
    userId: string,
    metadata?: Record<string, any>
  ): void {
    this.log('info', `User action: ${action}`, {
      action,
      ...metadata,
    }, userId);
  }

  /**
   * Log business event
   */
  businessEvent(
    event: string,
    metadata?: Record<string, any>,
    userId?: string
  ): void {
    this.log('info', `Business event: ${event}`, {
      event,
      category: 'business',
      ...metadata,
    }, userId);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    userId?: string,
    error?: { name: string; message: string; stack?: string },
    performance?: { duration: number; memory: number; cpu?: number }
  ): void {
    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      userId,
      correlationId: this.correlationId || undefined,
      metadata,
      error,
      performance,
    };

    // Add to buffer
    this.logBuffer.push(logEntry);

    // Console output for development
    if (__DEV__ || process.env.NODE_ENV === 'development') {
      this.consoleLog(logEntry);
    }

    // Flush if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      this.flushLogs();
    }

    // Immediately flush errors and fatals
    if (level === 'error' || level === 'fatal') {
      this.flushLogs();
    }
  }

  /**
   * Flush logs to database
   */
  private async flushLogs(): Promise<void> {
    if (this.isFlushingLogs || this.logBuffer.length === 0) {
      return;
    }

    this.isFlushingLogs = true;
    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const { error } = await supabase
        .from('application_logs')
        .insert(logsToFlush);

      if (error) {
        console.error('[EnterpriseLogging] Failed to flush logs to database:', error);
        // Return logs to buffer for retry
        this.logBuffer.unshift(...logsToFlush);
      }
    } catch (error) {
      console.error('[EnterpriseLogging] Error flushing logs:', error);
      // Return logs to buffer for retry
      this.logBuffer.unshift(...logsToFlush);
    } finally {
      this.isFlushingLogs = false;
    }
  }

  /**
   * Query logs with filters
   */
  async queryLogs(filter: LogFilter = {}): Promise<LogEntry[]> {
    try {
      let query = supabase
        .from('application_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (filter.level) {
        query = query.eq('level', filter.level);
      }

      if (filter.service) {
        query = query.eq('service', filter.service);
      }

      if (filter.userId) {
        query = query.eq('userId', filter.userId);
      }

      if (filter.correlationId) {
        query = query.eq('correlationId', filter.correlationId);
      }

      if (filter.startTime) {
        query = query.gte('timestamp', filter.startTime);
      }

      if (filter.endTime) {
        query = query.lte('timestamp', filter.endTime);
      }

      if (filter.limit) {
        query = query.limit(filter.limit);
      }

      const { data, error } = await query;

      if (error) {throw error;}

      return data || [];
    } catch (error) {
      console.error('[EnterpriseLogging] Error querying logs:', error);
      return [];
    }
  }

  /**
   * Get log metrics and analytics
   */
  async getLogMetrics(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<LogMetrics> {
    try {
      const hoursBack = timeframe === 'hour' ? 1 : timeframe === 'day' ? 24 : 168;
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

      const logs = await this.queryLogs({
        startTime: since,
        limit: 10000,
      });

      const totalLogs = logs.length;
      const logsByLevel: Record<LogLevel, number> = {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0,
      };
      const logsByService: Record<string, number> = {};
      const errorMessages: Record<string, { count: number; service: string }> = {};

      let totalResponseTime = 0;
      let responseTimeCount = 0;

      logs.forEach(log => {
        logsByLevel[log.level]++;
        logsByService[log.service] = (logsByService[log.service] || 0) + 1;

        if (log.level === 'error' || log.level === 'fatal') {
          const key = log.error?.message || log.message;
          if (!errorMessages[key]) {
            errorMessages[key] = { count: 0, service: log.service };
          }
          errorMessages[key].count++;
        }

        if (log.performance?.duration) {
          totalResponseTime += log.performance.duration;
          responseTimeCount++;
        }
      });

      const errorCount = logsByLevel.error + logsByLevel.fatal;
      const errorRate = totalLogs > 0 ? (errorCount / totalLogs) * 100 : 0;
      const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

      const topErrors = Object.entries(errorMessages)
        .map(([message, data]) => ({
          message,
          count: data.count,
          service: data.service,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalLogs,
        logsByLevel,
        logsByService,
        errorRate,
        avgResponseTime,
        topErrors,
      };
    } catch (error) {
      console.error('[EnterpriseLogging] Error getting log metrics:', error);
      return {
        totalLogs: 0,
        logsByLevel: { debug: 0, info: 0, warn: 0, error: 0, fatal: 0 },
        logsByService: {},
        errorRate: 0,
        avgResponseTime: 0,
        topErrors: [],
      };
    }
  }

  /**
   * Clean old logs based on retention policy
   */
  async cleanOldLogs(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('application_logs')
        .delete()
        .lt('timestamp', cutoffDate);

      if (error) {throw error;}

      const deletedCount = Array.isArray(data) ? (data as any[]).length : 0;
      this.info(`Cleaned ${deletedCount} old log entries`, { retentionDays, cutoffDate });

      return deletedCount;
    } catch (error) {
      this.error('Failed to clean old logs', error instanceof Error ? error : new Error('Unknown error'));
      return 0;
    }
  }

  /**
   * Private helper methods
   */
  private generateLogId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private consoleLog(logEntry: LogEntry): void {
    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
    const prefix = `[${timestamp}] [${logEntry.level.toUpperCase()}] [${logEntry.service}]`;

    const message = logEntry.correlationId
      ? `${prefix} [${logEntry.correlationId}] ${logEntry.message}`
      : `${prefix} ${logEntry.message}`;

    switch (logEntry.level) {
      case 'debug':
        console.debug(message, logEntry.metadata);
        break;
      case 'info':
        console.info(message, logEntry.metadata);
        break;
      case 'warn':
        console.warn(message, logEntry.metadata);
        break;
      case 'error':
      case 'fatal':
        console.error(message, logEntry.error, logEntry.metadata);
        break;
    }
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  private getCpuUsage(): number | undefined {
    // CPU usage would require additional monitoring setup
    return undefined;
  }
}

// Create singleton instance
export const enterpriseLogger = new EnterpriseLoggingService();

// Export convenience methods
export const logger = {
  debug: (message: string, metadata?: Record<string, any>, userId?: string) =>
    enterpriseLogger.debug(message, metadata, userId),
  info: (message: string, metadata?: Record<string, any>, userId?: string) =>
    enterpriseLogger.info(message, metadata, userId),
  warn: (message: string, metadata?: Record<string, any>, userId?: string) =>
    enterpriseLogger.warn(message, metadata, userId),
  error: (message: string, error?: Error, metadata?: Record<string, any>, userId?: string) =>
    enterpriseLogger.error(message, error, metadata, userId),
  fatal: (message: string, error?: Error, metadata?: Record<string, any>, userId?: string) =>
    enterpriseLogger.fatal(message, error, metadata, userId),
  performance: (message: string, duration: number, metadata?: Record<string, any>, userId?: string) =>
    enterpriseLogger.performance(message, duration, metadata, userId),
  apiLog: (method: string, endpoint: string, statusCode: number, duration: number, userId?: string, requestId?: string) =>
    enterpriseLogger.apiLog(method, endpoint, statusCode, duration, userId, requestId),
  userAction: (action: string, userId: string, metadata?: Record<string, any>) =>
    enterpriseLogger.userAction(action, userId, metadata),
  businessEvent: (event: string, metadata?: Record<string, any>, userId?: string) =>
    enterpriseLogger.businessEvent(event, metadata, userId),
  setCorrelationId: (correlationId: string) => enterpriseLogger.setCorrelationId(correlationId),
  generateCorrelationId: () => enterpriseLogger.generateCorrelationId(),
};
