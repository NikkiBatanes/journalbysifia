import { supabase } from './supabaseClient';
import { NewSubscriptionService } from './NewSubscriptionService';

export interface WisdomRequest {
  playbookId: string;
  userId: string;
  userName: string;
  actionId: string;
  actionTitle: string;
  actionBody: string;
  userQuestion: string;
  truthSummary: string;
  truthInLove: string;
}

export interface WisdomResponse {
  success: boolean;
  wisdom?: string;
  actionId?: string;
  error?: string;
  message?: string;
  wisdomCount?: number;
  wisdomLimit?: number;
}

export async function getActionWisdom(request: WisdomRequest): Promise<WisdomResponse> {
  const {
    playbookId,
    userId,
    userName,
    actionId,
    actionTitle,
    actionBody,
    userQuestion,
    truthSummary,
    truthInLove,
  } = request;

  // Check wisdom limits before making the API call
  const limitCheck = await NewSubscriptionService.checkUsageLimit(userId, 'wisdom');
  
  if (limitCheck.show_upgrade_prompt && limitCheck.upgrade_message) {
    // Limit reached, return upgrade prompt
    const subscription = await NewSubscriptionService.getUserSubscription(userId);
    return {
      success: false,
      error: 'WISDOM_LIMIT_REACHED',
      message: limitCheck.upgrade_message,
      wisdomCount: (subscription as any).wisdom_count || 0,
      wisdomLimit: subscription.wisdom_limit || 0,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('get-action-guidance', {
      body: {
        playbookId,
        userId,
        userName,
        actionId,
        actionTitle,
        actionBody,
        userQuestion,
        truthSummary,
        truthInLove,
      },
    });

    if (error) {
      let parsed: any = null;
      try {
        if (error.context && typeof error.context.json === 'function') {
          parsed = await error.context.json();
        }
      } catch {}
      
      if (!parsed && error.message) {
        try {
          parsed = JSON.parse(error.message);
        } catch {}
      }

      return {
        success: false,
        error: parsed?.error || 'WISDOM_FAILED',
        message: parsed?.message || 'siFia could not provide wisdom right now. Please try again in a moment.',
      };
    }

    if (!data?.success || !data?.wisdom) {
      return {
        success: false,
        error: data?.error || 'WISDOM_FAILED',
        message: data?.message || 'siFia could not provide wisdom right now. Please try again in a moment.',
      };
    }

    // Increment wisdom usage count
    await NewSubscriptionService.incrementUsage(userId, 'wisdom');

    // Get updated subscription for count
    const subscription = await NewSubscriptionService.getUserSubscription(userId);

    return {
      success: true,
      wisdom: data.wisdom,
      actionId: data.actionId,
      wisdomCount: (subscription as any).wisdom_count || 0,
      wisdomLimit: subscription.wisdom_limit || 0,
    };
  } catch (error) {
    console.error('[actionWisdomService] Error:', error);
    return {
      success: false,
      error: 'WISDOM_FAILED',
      message: 'siFia could not provide wisdom right now. Please try again in a moment.',
    };
  }
}
