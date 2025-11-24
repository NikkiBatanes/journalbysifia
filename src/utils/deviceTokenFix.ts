import { pushNotificationService } from '../services/pushNotificationService';
import { supabase } from '../services/supabaseClient';
import { Logger } from './ProductionLogger';

/**
 * Device Token Registration Fix
 * Forces device token registration and verification
 */

export const deviceTokenFix = {
  /**
   * Force register device token
   */
  async forceRegisterToken(userId: string): Promise<{
    success: boolean;
    token: string | null;
    error?: string;
    steps: string[];
  }> {
    const steps: string[] = [];
    
    try {
      Logger.info('🔧 Starting device token registration fix', { userId });
      steps.push('📍 Starting token registration...');
      
      // Step 1: Check if push notifications are available
      steps.push('🔍 Checking push notification availability...');
      const isAvailable = await this.checkPushNotificationAvailability();
      if (!isAvailable) {
        steps.push('❌ Push notifications not available on this device');
        return { success: false, token: null, error: 'Push notifications not available', steps };
      }
      steps.push('✅ Push notifications available');
      
      // Step 2: Re-initialize push service
      steps.push('🔄 Re-initializing push notification service...');
      await pushNotificationService.initialize(userId);
      
      // Step 3: Request permissions
      steps.push('🔐 Requesting notification permissions...');
      const hasPermissions = await pushNotificationService.requestPermissions();
      if (!hasPermissions) {
        steps.push('❌ Notification permissions denied');
        return { success: false, token: null, error: 'Notification permissions denied', steps };
      }
      steps.push('✅ Notification permissions granted');
      
      // Step 4: Get current token
      steps.push('📱 Getting device token...');
      const token = await pushNotificationService.getStoredToken();
      
      if (!token) {
        steps.push('❌ No token available after initialization');
        return { success: false, token: null, error: 'No token available', steps };
      }
      
      steps.push(`✅ Token found: ${token.substring(0, 10)}...`);
      
      // Step 5: Force save to database
      steps.push('💾 Saving token to database...');
      await pushNotificationService.saveDeviceToken(userId, token);
      
      // Step 6: Verify in database
      steps.push('🔍 Verifying token in database...');
      const verified = await this.verifyTokenInDatabase(userId, token);
      
      if (!verified) {
        steps.push('❌ Token verification failed');
        return { success: false, token, error: 'Token verification failed', steps };
      }
      
      steps.push('✅ Token successfully registered and verified');
      
      return { success: true, token, steps };
      
    } catch (error) {
      Logger.error('Device token fix failed', error as Error, { userId });
      steps.push(`❌ Error: ${(error as Error).message}`);
      return { 
        success: false, 
        token: null, 
        error: (error as Error).message, 
        steps 
      };
    }
  },

  /**
   * Check push notification availability
   */
  async checkPushNotificationAvailability(): Promise<boolean> {
    try {
      // Check if the push notification module is available
      const { isNativeModuleAvailable } = await import('../modules/PushNotificationBridge');
      return isNativeModuleAvailable();
    } catch (error) {
      Logger.error('Failed to check push notification availability', error as Error);
      return false;
    }
  },

  /**
   * Verify token exists in database
   */
  async verifyTokenInDatabase(userId: string, expectedToken: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('device_tokens')
        .select('token, is_active')
        .eq('user_id', userId)
        .eq('token', expectedToken)
        .single();

      if (error || !data) {
        return false;
      }

      return data.token === expectedToken && data.is_active;
    } catch (error) {
      Logger.error('Failed to verify token in database', error as Error);
      return false;
    }
  },

  /**
   * Manual token registration (for debugging)
   */
  async manualTokenRegistration(userId: string): Promise<{
    success: boolean;
    steps: string[];
    error?: string;
  }> {
    const steps: string[] = [];
    
    try {
      steps.push('🔧 Starting manual token registration...');
      
      // Check current token
      const currentToken = await pushNotificationService.getStoredToken();
      
      if (!currentToken) {
        steps.push('❌ No token found - trying to initialize...');
        await pushNotificationService.initialize(userId);
        
        // Check again
        const tokenAfterInit = await pushNotificationService.getStoredToken();
        if (!tokenAfterInit) {
          steps.push('❌ Still no token - requesting permissions...');
          await pushNotificationService.requestPermissions();
          
          // Final check
          const tokenAfterPermission = await pushNotificationService.getStoredToken();
          if (!tokenAfterPermission) {
            steps.push('❌ No token available - you may need to restart the app');
            return { 
              success: false, 
              steps, 
              error: 'No token available after all attempts' 
            };
          }
        }
      }
      
      const finalToken = await pushNotificationService.getStoredToken();
      if (!finalToken) {
        return { 
          success: false, 
          steps, 
          error: 'Failed to obtain token' 
        };
      }
      
      steps.push(`✅ Token obtained: ${finalToken.substring(0, 10)}...`);
      
      // Save to database
      steps.push('💾 Saving token to database...');
      await pushNotificationService.saveDeviceToken(userId, finalToken);
      
      // Verify
      const verified = await this.verifyTokenInDatabase(userId, finalToken);
      if (verified) {
        steps.push('✅ Token successfully registered!');
        return { success: true, steps };
      } else {
        steps.push('❌ Token verification failed');
        return { 
          success: false, 
          steps, 
          error: 'Token verification failed' 
        };
      }
      
    } catch (error) {
      Logger.error('Manual token registration failed', error as Error);
      steps.push(`❌ Error: ${(error as Error).message}`);
      return { 
        success: false, 
        steps, 
        error: (error as Error).message 
      };
    }
  },
};
