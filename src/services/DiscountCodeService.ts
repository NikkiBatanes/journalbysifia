import { supabase } from './supabaseClient';
import { NewSubscriptionService } from './NewSubscriptionService';

export interface DiscountCode {
  id: string;
  code: string;
  discount_percentage?: number;
  discount_amount?: number;
  valid_from: string;
  valid_until?: string;
  max_uses?: number;
  current_uses: number;
  applicable_tiers: string[];
  created_at: string;
  is_active: boolean;
}

export interface DiscountValidationResult {
  isValid: boolean;
  discount: DiscountCode | null;
  error?: string;
  discountAmount?: number;
}

export interface CreateDiscountCodeOptions {
  code?: string; // If not provided, will be auto-generated
  discount_percentage?: number;
  discount_amount?: number;
  valid_from?: Date;
  valid_until?: Date;
  max_uses?: number;
  applicable_tiers?: string[];
}

export class DiscountCodeService {
  /**
   * Generate a post-cancellation discount code for a user
   */
  static async generatePostCancellationDiscount(
    userId: string,
    previousTier: string
  ): Promise<DiscountCode> {
    try {
      // Calculate discount based on previous tier
      let discountPercentage = 20; // Default 20% off
      let validDays = 30; // Valid for 30 days

      switch (previousTier) {
        case 'spark':
          discountPercentage = 25;
          break;
        case 'growth':
          discountPercentage = 30;
          break;
        case 'transformation':
        case 'family':
          discountPercentage = 35;
          validDays = 60; // Longer validity for premium tiers
          break;
      }

      const code = this.generateDiscountCode('COMEBACK');
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validDays);

      const discountData = {
        code,
        discount_percentage: discountPercentage,
        valid_from: new Date().toISOString(),
        valid_until: validUntil.toISOString(),
        max_uses: 1, // Single use per user
        current_uses: 0,
        applicable_tiers: ['spark', 'growth', 'transformation', 'family'],
      };

      const { data, error } = await supabase
        .from('discount_codes')
        .insert(discountData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create discount code: ${error.message}`);
      }

      console.log('[DiscountService] Post-cancellation discount created:', code);
      return { ...data, is_active: true };
    } catch (error) {
      console.error('[DiscountService] Failed to generate post-cancellation discount:', error);
      throw error;
    }
  }

  /**
   * Generate a personalized discount code based on user behavior
   */
  static async generatePersonalizedDiscount(
    userId: string,
    discountType: 'trial_extension' | 'upgrade_incentive' | 'retention'
  ): Promise<DiscountCode> {
    try {
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      let code: string;
      let discountPercentage: number;
      let validDays: number;
      let applicableTiers: string[];

      switch (discountType) {
        case 'trial_extension':
          code = this.generateDiscountCode('EXTEND');
          discountPercentage = 15;
          validDays = 7;
          applicableTiers = ['spark', 'growth'];
          break;

        case 'upgrade_incentive':
          code = this.generateDiscountCode('UPGRADE');
          discountPercentage = 20;
          validDays = 14;
          applicableTiers = subscription.tier === 'spark' ? ['growth', 'transformation'] : ['transformation', 'family'];
          break;

        case 'retention':
          code = this.generateDiscountCode('STAY');
          discountPercentage = 25;
          validDays = 30;
          applicableTiers = [subscription.tier];
          break;

        default:
          throw new Error('Invalid discount type');
      }

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + validDays);

      const discountData = {
        code,
        discount_percentage: discountPercentage,
        valid_from: new Date().toISOString(),
        valid_until: validUntil.toISOString(),
        max_uses: 1,
        current_uses: 0,
        applicable_tiers: applicableTiers,
      };

      const { data, error } = await supabase
        .from('discount_codes')
        .insert(discountData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create personalized discount: ${error.message}`);
      }

      console.log('[DiscountService] Personalized discount created:', code);
      return { ...data, is_active: true };
    } catch (error) {
      console.error('[DiscountService] Failed to generate personalized discount:', error);
      throw error;
    }
  }

  /**
   * Validate a discount code for a specific user and tier
   */
  static async validateDiscountCode(
    code: string,
    userId: string,
    targetTier: string
  ): Promise<DiscountValidationResult> {
    try {
      // Get discount code from database
      const { data: discount, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (error || !discount) {
        return {
          isValid: false,
          discount: null,
          error: 'Invalid discount code',
        };
      }

      // Check if code is still valid (not expired)
      const now = new Date();
      const validFrom = new Date(discount.valid_from);
      const validUntil = discount.valid_until ? new Date(discount.valid_until) : null;

      if (now < validFrom) {
        return {
          isValid: false,
          discount: null,
          error: 'Discount code is not yet active',
        };
      }

      if (validUntil && now > validUntil) {
        return {
          isValid: false,
          discount: null,
          error: 'Discount code has expired',
        };
      }

      // Check usage limits
      if (discount.max_uses && discount.current_uses >= discount.max_uses) {
        return {
          isValid: false,
          discount: null,
          error: 'Discount code has reached maximum usage',
        };
      }

      // Check if applicable to target tier
      if (!discount.applicable_tiers.includes(targetTier)) {
        return {
          isValid: false,
          discount: null,
          error: `Discount code is not applicable to ${targetTier} tier`,
        };
      }

      // Check if user has already used this code
      const { data: existingUsage } = await supabase
        .from('user_subscriptions_new')
        .select('discount_code')
        .eq('user_id', userId)
        .eq('discount_code', code.toUpperCase())
        .single();

      if (existingUsage) {
        return {
          isValid: false,
          discount: null,
          error: 'You have already used this discount code',
        };
      }

      // Calculate discount amount (this would depend on your pricing structure)
      const discountAmount = discount.discount_percentage
        ? this.calculatePercentageDiscount(targetTier, discount.discount_percentage)
        : discount.discount_amount || 0;

      return {
        isValid: true,
        discount: { ...discount, is_active: true },
        discountAmount,
      };
    } catch (error) {
      console.error('[DiscountService] Failed to validate discount code:', error);
      return {
        isValid: false,
        discount: null,
        error: 'Failed to validate discount code',
      };
    }
  }

  /**
   * Apply a discount code to a user's subscription
   */
  static async applyDiscountCode(
    userId: string,
    code: string,
    targetTier: string
  ): Promise<boolean> {
    try {
      // Validate the discount code first
      const validation = await this.validateDiscountCode(code, userId, targetTier);

      if (!validation.isValid || !validation.discount) {
        throw new Error(validation.error || 'Invalid discount code');
      }

      // Update user's subscription with discount code
      const { error: subscriptionError } = await supabase
        .from('user_subscriptions_new')
        .update({
          discount_code: code.toUpperCase(),
          discount_applied_amount: validation.discountAmount,
        })
        .eq('user_id', userId);

      if (subscriptionError) {
        throw new Error(`Failed to apply discount: ${subscriptionError.message}`);
      }

      // Increment usage count for the discount code
      const { error: usageError } = await supabase
        .from('discount_codes')
        .update({
          current_uses: validation.discount.current_uses + 1,
        })
        .eq('id', validation.discount.id);

      if (usageError) {
        console.error('[DiscountService] Failed to update usage count:', usageError);
      }

      console.log('[DiscountService] Discount code applied successfully:', code);
      return true;
    } catch (error) {
      console.error('[DiscountService] Failed to apply discount code:', error);
      throw error;
    }
  }

  /**
   * Get all active discount codes (admin function)
   */
  static async getActiveDiscountCodes(): Promise<DiscountCode[]> {
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .gte('valid_until', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get discount codes: ${error.message}`);
      }

      return (data || []).map(code => ({ ...code, is_active: true }));
    } catch (error) {
      console.error('[DiscountService] Failed to get active discount codes:', error);
      return [];
    }
  }

  /**
   * Create a custom discount code (admin function)
   */
  static async createCustomDiscountCode(options: CreateDiscountCodeOptions): Promise<DiscountCode> {
    try {
      const code = options.code || this.generateDiscountCode('CUSTOM');

      const discountData = {
        code: code.toUpperCase(),
        discount_percentage: options.discount_percentage,
        discount_amount: options.discount_amount,
        valid_from: (options.valid_from || new Date()).toISOString(),
        valid_until: options.valid_until?.toISOString(),
        max_uses: options.max_uses,
        current_uses: 0,
        applicable_tiers: options.applicable_tiers || ['spark', 'growth', 'transformation', 'family'],
      };

      const { data, error } = await supabase
        .from('discount_codes')
        .insert(discountData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create custom discount code: ${error.message}`);
      }

      console.log('[DiscountService] Custom discount code created:', code);
      return { ...data, is_active: true };
    } catch (error) {
      console.error('[DiscountService] Failed to create custom discount code:', error);
      throw error;
    }
  }

  /**
   * Generate a unique discount code
   */
  private static generateDiscountCode(prefix: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}${timestamp}${random}`.substring(0, 12);
  }

  /**
   * Calculate percentage discount amount based on tier pricing
   */
  private static calculatePercentageDiscount(tier: string, percentage: number): number {
    // This should be updated with your actual pricing structure
    const tierPricing = {
      spark: 9.99,
      growth: 19.99,
      transformation: 39.99,
      family: 49.99,
    };

    const basePrice = tierPricing[tier as keyof typeof tierPricing] || 0;
    return Math.round((basePrice * percentage / 100) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Deactivate expired discount codes (cleanup function)
   */
  static async cleanupExpiredDiscountCodes(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('discount_codes')
        .update({ current_uses: -1 }) // Mark as inactive
        .lt('valid_until', new Date().toISOString())
        .select('id');

      if (error) {
        throw new Error(`Failed to cleanup expired codes: ${error.message}`);
      }

      const cleanedCount = data?.length || 0;
      console.log('[DiscountService] Cleaned up expired discount codes:', cleanedCount);
      return cleanedCount;
    } catch (error) {
      console.error('[DiscountService] Failed to cleanup expired codes:', error);
      return 0;
    }
  }
}

export default DiscountCodeService;
