/**
 * Trial Billing Service
 * 
 * Handles the flow from free trial selection to billing conversion
 * Supports monthly/annual billing with pending charges after trial
 */

import { SubscriptionTier } from '../interfaces/subscription';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface SelectedPlan {
  tier: SubscriptionTier;
  displayName: string;
  billing: 'monthly' | 'annual';
  price: number; // in cents
  currency: string;
  features: string[];
}

export class TrialBillingService {
  
  /**
   * Start a free trial with pending billing information
   * This is called when user selects a plan and clicks "Start 3-Day Free Trial"
   */
  static async startTrialWithPendingBilling(
    userId: string,
    selectedPlan: SelectedPlan
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const trialEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
      
      console.log(`[TrialBilling] Starting trial for user ${userId}:`, {
        selectedTier: selectedPlan.tier,
        billing: selectedPlan.billing,
        price: selectedPlan.price,
        trialEnds: trialEndDate.toISOString()
      });
      
      // Create or update subscription with trial + pending billing info
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          
          // Current trial state
          tier: 'free_trial',
          status: 'trialing',
          trial_end_date: trialEndDate.toISOString(),
          
          // What they'll be billed for after trial
          pending_tier: selectedPlan.tier,
          pending_price_cents: selectedPlan.price,
          pending_currency: selectedPlan.currency,
          pending_interval: selectedPlan.billing === 'annual' ? 'year' : 'month',
          
          // Next billing date (after trial ends)
          next_billing_date: trialEndDate.toISOString(),
          
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id' // Update if user already has subscription
        });
      
      if (error) {
        console.error('[TrialBilling] Error creating trial subscription:', error);
        return { success: false, error: error.message };
      }
      
      console.log(`[TrialBilling] Successfully started trial for user ${userId}`);
      return { success: true };
      
    } catch (error) {
      console.error('[TrialBilling] Error in startTrialWithPendingBilling:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  /**
   * Handle trial expiration and attempt billing
   * This should be called by a cron job or background task
   */
  static async handleTrialExpiration(userId: string): Promise<void> {
    try {
      console.log(`[TrialBilling] Handling trial expiration for user ${userId}`);
      
      // Get subscription with pending billing info
      const { data: subscription, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('tier', 'free_trial')
        .eq('status', 'trialing')
        .single();
      
      if (error || !subscription) {
        console.log(`[TrialBilling] No active trial found for user ${userId}`);
        return;
      }
      
      // Check if trial has actually expired
      const now = new Date();
      const trialEnd = new Date(subscription.trial_end_date);
      
      if (now <= trialEnd) {
        console.log(`[TrialBilling] Trial not yet expired for user ${userId}. Expires: ${trialEnd}`);
        return;
      }
      
      // Attempt to charge for pending subscription
      if (subscription.pending_tier && subscription.pending_price_cents) {
        console.log(`[TrialBilling] Attempting to bill user ${userId} for ${subscription.pending_tier}: ${subscription.pending_price_cents} ${subscription.pending_currency}`);
        
        const billingResult = await this.attemptBilling({
          userId,
          tier: subscription.pending_tier,
          priceCents: subscription.pending_price_cents,
          currency: subscription.pending_currency || 'usd',
          interval: subscription.pending_interval || 'month'
        });
        
        if (billingResult.success) {
          // Billing successful - activate paid subscription
          await this.activatePaidSubscription(userId, subscription);
        } else {
          // Billing failed - move to basic (freemium)
          await this.moveToBasicTier(userId, billingResult.error || 'Billing failed');
        }
      } else {
        // No pending billing info - move to basic
        await this.moveToBasicTier(userId, 'No pending billing information');
      }
      
    } catch (error) {
      console.error('[TrialBilling] Error handling trial expiration:', error);
      // Fallback: move to basic tier to ensure user doesn't get stuck
      await this.moveToBasicTier(userId, 'Error during trial expiration handling');
    }
  }
  
  /**
   * Attempt to charge the user (integrate with your payment provider)
   */
  private static async attemptBilling(params: {
    userId: string;
    tier: SubscriptionTier;
    priceCents: number;
    currency: string;
    interval: string;
  }): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      console.log(`[TrialBilling] Attempting billing:`, params);
      
      // TODO: Integrate with your payment provider (Stripe, PayPal, etc.)
      // This is where you would:
      // 1. Get the user's saved payment method
      // 2. Create a charge/invoice
      // 3. Process the payment
      // 4. Handle success/failure
      
      // For now, simulate the billing process
      // In production, replace this with actual payment processing
      
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate success/failure (90% success rate for demo)
      const paymentSuccess = Math.random() > 0.1;
      
      if (paymentSuccess) {
        const transactionId = `txn_${Date.now()}_${params.userId.slice(-6)}`;
        console.log(`[TrialBilling] Payment successful. Transaction ID: ${transactionId}`);
        return { success: true, transactionId };
      } else {
        console.log(`[TrialBilling] Payment failed for user ${params.userId}`);
        return { success: false, error: 'Payment method declined' };
      }
      
    } catch (error) {
      console.error('[TrialBilling] Error during billing attempt:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Payment processing error' 
      };
    }
  }
  
  /**
   * Activate paid subscription after successful billing
   */
  private static async activatePaidSubscription(userId: string, trialSubscription: any): Promise<void> {
    try {
      // Calculate next billing date based on interval
      const nextBillingDate = trialSubscription.pending_interval === 'year' 
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);  // 1 month from now
      
      // Update subscription to active paid tier
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          tier: trialSubscription.pending_tier,
          status: 'active',
          next_billing_date: nextBillingDate.toISOString(),
          
          // Clear pending billing info
          pending_tier: null,
          pending_price_cents: null,
          pending_currency: null,
          pending_interval: null,
          
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (error) {
        throw error;
      }
      
      console.log(`[TrialBilling] Activated ${trialSubscription.pending_tier} subscription for user ${userId}. Next billing: ${nextBillingDate.toISOString()}`);
      
    } catch (error) {
      console.error('[TrialBilling] Error activating paid subscription:', error);
      throw error;
    }
  }
  
  /**
   * Move user to basic (freemium) tier when billing fails
   */
  private static async moveToBasicTier(userId: string, reason: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          tier: 'basic',
          status: 'trial_expired',
          
          // Clear pending billing info
          pending_tier: null,
          pending_price_cents: null,
          pending_currency: null,
          pending_interval: null,
          
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (error) {
        throw error;
      }
      
      console.log(`[TrialBilling] Moved user ${userId} to basic tier. Reason: ${reason}`);
      
    } catch (error) {
      console.error('[TrialBilling] Error moving user to basic tier:', error);
      throw error;
    }
  }
  
  /**
   * Get trial status for a user
   */
  static async getTrialStatus(userId: string): Promise<{
    isOnTrial: boolean;
    daysRemaining: number;
    pendingTier?: SubscriptionTier;
    pendingPrice?: number;
    trialEndDate?: Date;
  }> {
    try {
      const { data: subscription, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error || !subscription) {
        return { isOnTrial: false, daysRemaining: 0 };
      }
      
      const isOnTrial = subscription.tier === 'free_trial' && subscription.status === 'trialing';
      
      if (!isOnTrial) {
        return { isOnTrial: false, daysRemaining: 0 };
      }
      
      const trialEndDate = new Date(subscription.trial_end_date);
      const now = new Date();
      const daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      return {
        isOnTrial: true,
        daysRemaining,
        pendingTier: subscription.pending_tier,
        pendingPrice: subscription.pending_price_cents,
        trialEndDate
      };
      
    } catch (error) {
      console.error('[TrialBilling] Error getting trial status:', error);
      return { isOnTrial: false, daysRemaining: 0 };
    }
  }
}

export default TrialBillingService;
