/**
 * Pastoral Care Integration Service
 * Connects Christ acceptance events to pastoral follow-up systems
 * Phase 4: Pastoral Care Integration
 */

import { supabase } from './supabaseClient';
// import { onboardingService } from './onboardingService';

export interface PastoralCareRequest {
  id: string;
  userId: string;
  userProfile: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    location?: string;
  };
  eventType: 'christ_acceptance' | 'baptism_interest' | 'prayer_request' | 'spiritual_guidance';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  description: string;
  context: Record<string, any>;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'closed';
  assignedPastor?: string;
  createdAt: string;
  updatedAt: string;
  followUpScheduled?: string;
  notes: string[];
}

export interface PastoralFollowUp {
  id: string;
  requestId: string;
  userId: string;
  pastorId: string;
  followUpType: 'phone_call' | 'email' | 'in_person' | 'video_call' | 'text_message';
  scheduledAt: string;
  completedAt?: string;
  outcome: 'successful' | 'no_response' | 'rescheduled' | 'declined';
  notes: string;
  nextFollowUpAt?: string;
}

export interface PastoralCareMetrics {
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  averageResponseTime: number; // in hours
  followUpCompletionRate: number;
  christAcceptanceFollowUps: number;
  baptismInterestFollowUps: number;
  responseTimeByPriority: Record<string, number>;
}

class PastoralCareIntegrationService {
  private supabase = supabase;

  /**
   * Create pastoral care request from Christ acceptance event
   */
  async createPastoralCareRequest(
    userId: string,
    eventType: PastoralCareRequest['eventType'],
    context: Record<string, any>
  ): Promise<string> {
    try {
      // Get user profile information
      const { data: userProfile, error: profileError } = await this.supabase
        .from('user_profiles')
        .select('first_name, last_name, email, phone, location')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        console.warn('Could not fetch user profile:', profileError);
      }

      // Determine priority based on event type and context
      const priority = this.determinePriority(eventType, context);

      // Generate description
      const description = this.generateDescription(eventType, context, userProfile);

      const request: Omit<PastoralCareRequest, 'id'> = {
        userId,
        userProfile: userProfile || {
          firstName: 'Unknown',
          lastName: 'User',
          email: context.email || 'unknown@example.com',
        },
        eventType,
        priority,
        description,
        context,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: [],
      };

      const { data, error } = await this.supabase
        .from('pastoral_care_requests')
        .insert([{
          user_id: request.userId,
          user_profile: request.userProfile,
          event_type: request.eventType,
          priority: request.priority,
          description: request.description,
          context: request.context,
          status: request.status,
          created_at: request.createdAt,
          updated_at: request.updatedAt,
          notes: request.notes,
        }])
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create pastoral care request: ${error.message}`);
      }

      // Send notification to pastoral team
      await this.notifyPastoralTeam(data.id, request);

      return data.id;
    } catch (error) {
      console.error('Error creating pastoral care request:', error);
      throw error;
    }
  }

  /**
   * Determine priority based on event type and context
   */
  private determinePriority(
    eventType: PastoralCareRequest['eventType'],
    context: Record<string, any>
  ): PastoralCareRequest['priority'] {
    switch (eventType) {
      case 'christ_acceptance':
        return context.isFirstTime ? 'urgent' : 'high';
      case 'baptism_interest':
        return 'high';
      case 'prayer_request':
        return context.isUrgent ? 'urgent' : 'medium';
      case 'spiritual_guidance':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Generate description for pastoral care request
   */
  private generateDescription(
    eventType: PastoralCareRequest['eventType'],
    context: Record<string, any>,
    userProfile: any
  ): string {
    const name = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'User';

    switch (eventType) {
      case 'christ_acceptance':
        return `${name} has accepted Christ as their personal savior during onboarding. ${
          context.acceptanceContext ? `Context: ${context.acceptanceContext}. ` : ''
        }${context.prayerText ? `Prayer: "${context.prayerText}"` : ''}`;

      case 'baptism_interest':
        return `${name} has expressed interest in baptism during onboarding. ${
          context.previousBaptism ? 'Previously baptized. ' : 'First-time baptism interest. '
        }${context.churchConnection ? 'Interested in church connection.' : ''}`;

      case 'prayer_request':
        return `${name} has submitted a prayer request: ${context.request || 'No details provided'}`;

      case 'spiritual_guidance':
        return `${name} is seeking spiritual guidance. ${
          context.area ? `Area of concern: ${context.area}` : ''
        }`;

      default:
        return `${name} requires pastoral care attention.`;
    }
  }

  /**
   * Notify pastoral team of new request
   */
  private async notifyPastoralTeam(requestId: string, request: Omit<PastoralCareRequest, 'id'>): Promise<void> {
    // In a real implementation, this would send notifications via:
    // - Email to pastoral team
    // - SMS for urgent requests
    // - Push notifications to pastoral care app
    // - Slack/Teams integration

    console.log(`Pastoral care notification sent for request ${requestId}:`, {
      type: request.eventType,
      priority: request.priority,
      user: `${request.userProfile.firstName} ${request.userProfile.lastName}`,
    });

    // Log notification in database
    await this.supabase
      .from('pastoral_care_notifications')
      .insert([{
        request_id: requestId,
        notification_type: 'team_alert',
        sent_at: new Date().toISOString(),
        priority: request.priority,
      }]);
  }

  /**
   * Assign pastoral care request to pastor
   */
  async assignRequest(requestId: string, pastorId: string): Promise<void> {
    const { error } = await this.supabase
      .from('pastoral_care_requests')
      .update({
        assigned_pastor: pastorId,
        status: 'assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      throw new Error(`Failed to assign request: ${error.message}`);
    }

    // Notify assigned pastor
    await this.notifyAssignedPastor(requestId, pastorId);
  }

  /**
   * Notify assigned pastor
   */
  private async notifyAssignedPastor(requestId: string, pastorId: string): Promise<void> {
    // Send notification to specific pastor
    console.log(`Pastor ${pastorId} assigned to request ${requestId}`);

    await this.supabase
      .from('pastoral_care_notifications')
      .insert([{
        request_id: requestId,
        pastor_id: pastorId,
        notification_type: 'assignment',
        sent_at: new Date().toISOString(),
      }]);
  }

  /**
   * Schedule follow-up
   */
  async scheduleFollowUp(
    requestId: string,
    pastorId: string,
    followUpType: PastoralFollowUp['followUpType'],
    scheduledAt: string
  ): Promise<string> {
    const followUp: Omit<PastoralFollowUp, 'id'> = {
      requestId,
      userId: '', // Will be populated from request
      pastorId,
      followUpType,
      scheduledAt,
      outcome: 'successful', // Will be updated after completion
      notes: '',
    };

    // Get user ID from request
    const { data: request } = await this.supabase
      .from('pastoral_care_requests')
      .select('user_id')
      .eq('id', requestId)
      .single();

    if (request) {
      followUp.userId = request.user_id;
    }

    const { data, error } = await this.supabase
      .from('pastoral_follow_ups')
      .insert([{
        request_id: followUp.requestId,
        user_id: followUp.userId,
        pastor_id: followUp.pastorId,
        follow_up_type: followUp.followUpType,
        scheduled_at: followUp.scheduledAt,
        outcome: followUp.outcome,
        notes: followUp.notes,
      }])
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to schedule follow-up: ${error.message}`);
    }

    // Update request with follow-up scheduled
    await this.supabase
      .from('pastoral_care_requests')
      .update({
        follow_up_scheduled: scheduledAt,
        status: 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    return data.id;
  }

  /**
   * Complete follow-up
   */
  async completeFollowUp(
    followUpId: string,
    outcome: PastoralFollowUp['outcome'],
    notes: string,
    nextFollowUpAt?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('pastoral_follow_ups')
      .update({
        completed_at: new Date().toISOString(),
        outcome,
        notes,
        next_follow_up_at: nextFollowUpAt,
      })
      .eq('id', followUpId);

    if (error) {
      throw new Error(`Failed to complete follow-up: ${error.message}`);
    }

    // If no next follow-up scheduled and outcome is successful, mark request as completed
    if (!nextFollowUpAt && outcome === 'successful') {
      const { data: followUp } = await this.supabase
        .from('pastoral_follow_ups')
        .select('request_id')
        .eq('id', followUpId)
        .single();

      if (followUp) {
        await this.supabase
          .from('pastoral_care_requests')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', followUp.request_id);
      }
    }
  }

  /**
   * Get pastoral care metrics
   */
  async getPastoralCareMetrics(): Promise<PastoralCareMetrics> {
    try {
      // Get all requests
      const { data: requests } = await this.supabase
        .from('pastoral_care_requests')
        .select('*');

      if (!requests) {
        throw new Error('No requests data found');
      }

      const totalRequests = requests.length;
      const pendingRequests = requests.filter(r => r.status === 'pending').length;
      const completedRequests = requests.filter(r => r.status === 'completed').length;

      // Calculate average response time
      const assignedRequests = requests.filter(r => r.assigned_pastor);
      const responseTimes = assignedRequests.map(r => {
        const created = new Date(r.created_at).getTime();
        const updated = new Date(r.updated_at).getTime();
        return (updated - created) / (1000 * 60 * 60); // hours
      });
      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

      // Get follow-up data
      const { data: followUps } = await this.supabase
        .from('pastoral_follow_ups')
        .select('*');

      const followUpCompletionRate = followUps && followUps.length > 0
        ? (followUps.filter(f => f.completed_at).length / followUps.length) * 100
        : 0;

      const christAcceptanceFollowUps = requests.filter(r => r.event_type === 'christ_acceptance').length;
      const baptismInterestFollowUps = requests.filter(r => r.event_type === 'baptism_interest').length;

      // Response time by priority
      const responseTimeByPriority: Record<string, number> = {};
      ['urgent', 'high', 'medium', 'low'].forEach(priority => {
        const priorityRequests = assignedRequests.filter(r => r.priority === priority);
        if (priorityRequests.length > 0) {
          const priorityTimes = priorityRequests.map(r => {
            const created = new Date(r.created_at).getTime();
            const updated = new Date(r.updated_at).getTime();
            return (updated - created) / (1000 * 60 * 60);
          });
          responseTimeByPriority[priority] = priorityTimes.reduce((sum, time) => sum + time, 0) / priorityTimes.length;
        } else {
          responseTimeByPriority[priority] = 0;
        }
      });

      return {
        totalRequests,
        pendingRequests,
        completedRequests,
        averageResponseTime,
        followUpCompletionRate,
        christAcceptanceFollowUps,
        baptismInterestFollowUps,
        responseTimeByPriority,
      };
    } catch (error) {
      console.error('Error getting pastoral care metrics:', error);
      return {
        totalRequests: 0,
        pendingRequests: 0,
        completedRequests: 0,
        averageResponseTime: 0,
        followUpCompletionRate: 0,
        christAcceptanceFollowUps: 0,
        baptismInterestFollowUps: 0,
        responseTimeByPriority: {},
      };
    }
  }

  /**
   * Auto-create pastoral care requests from onboarding events
   */
  async handleOnboardingEvent(userId: string, eventType: string, eventData: Record<string, any>): Promise<void> {
    try {
      switch (eventType) {
        case 'christ_acceptance':
          await this.createPastoralCareRequest(userId, 'christ_acceptance', {
            acceptanceContext: eventData.acceptance_context,
            prayerText: eventData.prayer_text,
            isFirstTime: !eventData.previous_acceptance,
            baptismInterest: eventData.baptism_interest,
            churchConnection: eventData.church_connection_interest,
          });
          break;

        case 'baptism_interest':
          await this.createPastoralCareRequest(userId, 'baptism_interest', {
            previousBaptism: eventData.previous_baptism,
            churchConnection: eventData.church_connection_interest,
            timeline: eventData.preferred_timeline,
          });
          break;

        case 'prayer_request':
          await this.createPastoralCareRequest(userId, 'prayer_request', {
            request: eventData.prayer_text,
            isUrgent: eventData.is_urgent,
            category: eventData.category,
          });
          break;

        default:
          console.log(`No pastoral care handler for event type: ${eventType}`);
      }
    } catch (error) {
      console.error('Error handling onboarding event for pastoral care:', error);
    }
  }

  /**
   * Get pending requests for pastoral dashboard
   */
  async getPendingRequests(): Promise<PastoralCareRequest[]> {
    const { data, error } = await this.supabase
      .from('pastoral_care_requests')
      .select('*')
      .in('status', ['pending', 'assigned'])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get pending requests: ${error.message}`);
    }

    return data || [];
  }
}

export const pastoralCareIntegrationService = new PastoralCareIntegrationService();
