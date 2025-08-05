/**
 * Enterprise Security Service
 * Provides comprehensive security utilities, validation, and monitoring
 * for enterprise-grade security compliance
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { supabase } from './supabaseClient';

export interface SecurityEvent {
  id: string;
  userId?: string;
  eventType: 'auth_attempt' | 'data_access' | 'api_call' | 'suspicious_activity' | 'security_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SecurityPolicy {
  maxLoginAttempts: number;
  passwordMinLength: number;
  sessionTimeout: number;
  requireMFA: boolean;
  allowedOrigins: string[];
  rateLimitPerMinute: number;
}

export interface DataClassification {
  level: 'public' | 'internal' | 'confidential' | 'restricted';
  encryption: boolean;
  auditRequired: boolean;
  retentionDays: number;
}

class EnterpriseSecurityService {
  private securityPolicy: SecurityPolicy;
  private loginAttempts: Map<string, number> = new Map();
  private rateLimitTracker: Map<string, number[]> = new Map();

  constructor() {
    this.securityPolicy = {
      maxLoginAttempts: 5,
      passwordMinLength: 8,
      sessionTimeout: 3600000, // 1 hour
      requireMFA: false,
      allowedOrigins: ['localhost', '127.0.0.1'],
      rateLimitPerMinute: 100
    };
  }

  /**
   * Validate input data against security policies
   */
  async validateInput(input: string, type: 'email' | 'password' | 'general'): Promise<{
    isValid: boolean;
    errors: string[];
    sanitized: string;
  }> {
    const errors: string[] = [];
    let sanitized = input.trim();

    try {
      // Basic sanitization
      sanitized = this.sanitizeInput(sanitized);

      switch (type) {
        case 'email':
          if (!this.isValidEmail(sanitized)) {
            errors.push('Invalid email format');
          }
          break;
        case 'password':
          const passwordValidation = this.validatePassword(sanitized);
          if (!passwordValidation.isValid) {
            errors.push(...passwordValidation.errors);
          }
          break;
        case 'general':
          if (this.containsSuspiciousPatterns(sanitized)) {
            errors.push('Input contains suspicious patterns');
          }
          break;
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitized
      };
    } catch (error) {
      await this.logSecurityEvent({
        eventType: 'security_violation',
        severity: 'medium',
        description: 'Input validation error',
        metadata: { type, error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return {
        isValid: false,
        errors: ['Validation failed'],
        sanitized: ''
      };
    }
  }

  /**
   * Check rate limiting for API calls
   */
  async checkRateLimit(identifier: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    if (!this.rateLimitTracker.has(identifier)) {
      this.rateLimitTracker.set(identifier, []);
    }

    const requests = this.rateLimitTracker.get(identifier)!;
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (recentRequests.length >= this.securityPolicy.rateLimitPerMinute) {
      await this.logSecurityEvent({
        eventType: 'suspicious_activity',
        severity: 'medium',
        description: 'Rate limit exceeded',
        metadata: { identifier, requestCount: recentRequests.length }
      });
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.rateLimitTracker.set(identifier, recentRequests);
    
    return true;
  }

  /**
   * Track login attempts and detect brute force attacks
   */
  async trackLoginAttempt(identifier: string, success: boolean): Promise<boolean> {
    const currentAttempts = this.loginAttempts.get(identifier) || 0;

    if (success) {
      this.loginAttempts.delete(identifier);
      await this.logSecurityEvent({
        eventType: 'auth_attempt',
        severity: 'low',
        description: 'Successful login',
        metadata: { identifier }
      });
      return true;
    }

    const newAttempts = currentAttempts + 1;
    this.loginAttempts.set(identifier, newAttempts);

    if (newAttempts >= this.securityPolicy.maxLoginAttempts) {
      await this.logSecurityEvent({
        eventType: 'suspicious_activity',
        severity: 'high',
        description: 'Multiple failed login attempts detected',
        metadata: { identifier, attempts: newAttempts }
      });
      return false;
    }

    await this.logSecurityEvent({
      eventType: 'auth_attempt',
      severity: 'medium',
      description: 'Failed login attempt',
      metadata: { identifier, attempts: newAttempts }
    });

    return true;
  }

  /**
   * Encrypt sensitive data
   */
  async encryptData(data: string, classification: DataClassification): Promise<string> {
    if (!classification.encryption) {
      return data;
    }

    try {
      const key = await this.getEncryptionKey();
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      encrypted = iv.toString('hex') + ':' + encrypted;

      await this.logSecurityEvent({
        eventType: 'data_access',
        severity: 'low',
        description: 'Data encrypted',
        metadata: { classification: classification.level }
      });

      return encrypted;
    } catch (error) {
      await this.logSecurityEvent({
        eventType: 'security_violation',
        severity: 'high',
        description: 'Encryption failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decryptData(encryptedData: string, classification: DataClassification): Promise<string> {
    if (!classification.encryption) {
      return encryptedData;
    }

    try {
      const key = await this.getEncryptionKey();
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = createDecipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      await this.logSecurityEvent({
        eventType: 'data_access',
        severity: 'low',
        description: 'Data decrypted',
        metadata: { classification: classification.level }
      });

      return decrypted;
    } catch (error) {
      await this.logSecurityEvent({
        eventType: 'security_violation',
        severity: 'high',
        description: 'Decryption failed',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw new Error('Decryption failed');
    }
  }

  /**
   * Generate secure tokens
   */
  generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data
   */
  hashData(data: string, salt?: string): string {
    const actualSalt = salt || randomBytes(16).toString('hex');
    const hash = createHash('sha256');
    hash.update(data + actualSalt);
    return hash.digest('hex');
  }

  /**
   * Log security events
   */
  private async logSecurityEvent(event: Partial<SecurityEvent>): Promise<void> {
    try {
      const securityEvent: SecurityEvent = {
        id: this.generateSecureToken(16),
        eventType: event.eventType!,
        severity: event.severity!,
        description: event.description!,
        metadata: event.metadata || {},
        timestamp: new Date().toISOString(),
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent
      };

      // Store in database
      const { error } = await supabase
        .from('security_events')
        .insert(securityEvent);

      if (error) {
        console.error('[SecurityService] Failed to log security event:', error);
      }

      // For critical events, also log to console immediately
      if (event.severity === 'critical' || event.severity === 'high') {
        console.warn(`[SECURITY ALERT] ${event.severity.toUpperCase()}: ${event.description}`, event.metadata);
      }
    } catch (error) {
      console.error('[SecurityService] Error logging security event:', error);
    }
  }

  /**
   * Get security metrics and alerts
   */
  async getSecurityMetrics(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    topThreats: Array<{ type: string; count: number; description: string }>;
    recommendations: string[];
  }> {
    try {
      const hoursBack = timeframe === 'hour' ? 1 : timeframe === 'day' ? 24 : 168;
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

      const { data: events, error } = await supabase
        .from('security_events')
        .select('*')
        .gte('timestamp', since);

      if (error) throw error;

      const totalEvents = events?.length || 0;
      const eventsByType: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};

      events?.forEach(event => {
        eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
        eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
      });

      const topThreats = Object.entries(eventsByType)
        .map(([type, count]) => ({
          type,
          count,
          description: this.getThreatDescription(type)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const recommendations = this.generateSecurityRecommendations(eventsBySeverity, topThreats);

      return {
        totalEvents,
        eventsByType,
        eventsBySeverity,
        topThreats,
        recommendations
      };
    } catch (error) {
      console.error('[SecurityService] Error getting security metrics:', error);
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsBySeverity: {},
        topThreats: [],
        recommendations: ['Unable to retrieve security metrics']
      };
    }
  }

  /**
   * Private helper methods
   */
  private sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/[<>'"]/g, '');
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.securityPolicy.passwordMinLength) {
      errors.push(`Password must be at least ${this.securityPolicy.passwordMinLength} characters`);
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private containsSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /<script/i,
      /javascript:/i,
      /eval\(/i,
      /exec\(/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  private async getEncryptionKey(): Promise<string> {
    // In production, this should come from a secure key management service
    return process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  private getThreatDescription(eventType: string): string {
    const descriptions: Record<string, string> = {
      'auth_attempt': 'Authentication attempts',
      'data_access': 'Data access events',
      'api_call': 'API call monitoring',
      'suspicious_activity': 'Suspicious behavior detected',
      'security_violation': 'Security policy violations'
    };

    return descriptions[eventType] || 'Unknown threat type';
  }

  private generateSecurityRecommendations(
    eventsBySeverity: Record<string, number>,
    topThreats: Array<{ type: string; count: number }>
  ): string[] {
    const recommendations: string[] = [];

    if (eventsBySeverity.critical > 0) {
      recommendations.push('Immediate attention required: Critical security events detected');
    }

    if (eventsBySeverity.high > 5) {
      recommendations.push('High priority: Multiple high-severity security events');
    }

    if (topThreats.find(t => t.type === 'suspicious_activity' && t.count > 10)) {
      recommendations.push('Consider implementing additional rate limiting');
    }

    if (topThreats.find(t => t.type === 'auth_attempt' && t.count > 20)) {
      recommendations.push('Review authentication security measures');
    }

    if (recommendations.length === 0) {
      recommendations.push('Security status: Normal - Continue monitoring');
    }

    return recommendations;
  }
}

export const enterpriseSecurityService = new EnterpriseSecurityService();
