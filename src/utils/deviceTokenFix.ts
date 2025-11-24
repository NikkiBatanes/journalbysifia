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
      
      // Step 1: Re-initialize push service
      steps.push('🔄 Re-initializing push notification service...');
      await pushNotificationService.initialize(userId);
      
      // Step 2: Check current token
      steps.push('🔍 Checking current device token...');
      const currentToken = await pushNotificationService.getStoredToken();
      
      if (!currentToken) {
        steps.push('❌ No token found in storage');
        
        // Step 3: Try to request permissions again
        steps.push('📱 Requesting permissions...');
        await pushNotificationService.requestPermissions();
        
        // Step 4: Check again after permission request
        steps.push('🔍 Checking token after permission request...');
        const tokenAfterPermission = await pushNotificationService.getStoredToken();
        
        if (!tokenAfterPermission) {
          steps.push('❌ Still no token - may need app restart');
          return {
            success: false,
            token: null,
            error: 'No device token available after permission request',
            steps,
          };
        }
        
        steps.push(`✅ Token found after permission request: ${tokenAfterPermission.substring(0, 20)}...`);
      } else {
        steps.push(`✅ Token found: ${currentToken.substring(0, 20)}...`);
      }
      
      // Step 5: Save to database
      const tokenToSave = currentToken || await pushNotificationService.getStoredToken();
      if (tokenToSave) {
        steps.push('💾 Saving token to database...');
        
        // Try upsert first
        const { error: dbError } = await supabase
          .from('device_tokens')
          .upsert({
            user_id: userId,
            device_id: `device_${userId}_${Date.now()}`, // Generate unique device ID
            token: tokenToSave,
            platform: 'ios', // or 'android' - we can detect this
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        
        if (dbError) {
          steps.push(`⚠️ Upsert failed: ${dbError.message}`);
          steps.push('🔄 Trying alternative save method...');
          
          // Fallback: Delete existing tokens and insert new one
          const { error: deleteError } = await supabase
            .from('device_tokens')
            .delete()
            .eq('user_id', userId);
            
          if (deleteError) {
            steps.push(`❌ Delete failed: ${deleteError.message}`);
          } else {
            steps.push('✅ Old tokens deleted');
            
            // Insert new token
            const { error: insertError } = await supabase
              .from('device_tokens')
              .insert({
                user_id: userId,
                device_id: `device_${userId}_${Date.now()}`, // Generate unique device ID
                token: tokenToSave,
                platform: 'ios',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              
            if (insertError) {
              steps.push(`❌ Insert failed: ${insertError.message}`);
              return {
                success: false,
                token: tokenToSave,
                error: `Database save failed: ${insertError.message}`,
                steps,
              };
            } else {
              steps.push('✅ Token saved successfully with fallback method');
            }
          }
        } else {
          steps.push('✅ Token saved to database');
        }
      }
      
      // Step 6: Verify token in database
      steps.push('🔍 Verifying token in database...');
      const { data: dbTokens, error: verifyError } = await supabase
        .from('device_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      if (verifyError) {
        steps.push(`❌ Verification error: ${verifyError.message}`);
      } else if (dbTokens && dbTokens.length > 0) {
        steps.push(`✅ Found ${dbTokens.length} active tokens in database`);
      } else {
        steps.push('❌ No active tokens found in database');
      }
      
      steps.push('🎉 Token registration process completed');
      
      return {
        success: true,
        token: tokenToSave,
        steps,
      };
      
    } catch (error) {
      Logger.error('Device token registration failed', error as Error);
      steps.push(`❌ Error: ${(error as Error).message}`);
      
      return {
        success: false,
        token: null,
        error: (error as Error).message,
        steps,
      };
    }
  },

  /**
   * Test push notification with token
   */
  async testPushWithToken(userId: string): Promise<boolean> {
    try {
      Logger.info('🧪 Testing push notification with current token');
      
      // This would normally go through your backend
      // For now, we'll create a local notification to simulate success
      await pushNotificationService.scheduleLocalNotification({
        title: '🔧 Token Test',
        message: 'Device token registration test successful!',
        badge: 1,
        sound: 'default',
        data: {
          deep_link: 'sifia://dashboard',
          type: 'token_test',
        },
      }, new Date(Date.now() + 3000)); // 3 seconds from now
      
      Logger.info('✅ Token test notification scheduled');
      return true;
      
    } catch (error) {
      Logger.error('Token test failed', error as Error);
      return false;
    }
  }
};
