/**
 * Social Media Share Service
 * Creates beautiful story-ready graphics for sharing scripture and affirmations
 */

import { Platform, Alert } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Logger } from './ProductionLogger';

export interface ShareContent {
  type: 'scripture' | 'affirmation';
  text: string;
  reference?: string; // For scripture
  date?: string;
}

class SocialShareService {
  /**
   * Share scripture or affirmation to social media
   * @param viewRef - Reference to the ViewShot component
   * @param content - Content to share
   */
  async shareToSocial(viewRef: any, content: ShareContent): Promise<void> {
    try {
      // Capture the view as an image
      const uri = await viewRef.capture();

      const shareOptions = {
        title: content.type === 'scripture' ? "Today's Scripture" : "Today's Affirmation",
        message: content.type === 'scripture'
          ? `"${content.text}"\n\n— ${content.reference}\n\nShared from siFia`
          : `${content.text}\n\nShared from siFia`,
        url: Platform.OS === 'ios' ? uri : `file://${uri}`,
        type: 'image/png',
        subject: content.type === 'scripture' ? "Today's Scripture" : "Today's Affirmation",
        social: Share.Social,
      };

      await Share.open(shareOptions);

      Logger.debug('[SocialShareService] Content shared successfully', {
        component: 'socialShareService',
        type: content.type,
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        Logger.error('[SocialShareService] Failed to share content', error as Error, {
          component: 'socialShareService',
        });
        Alert.alert('Share Failed', 'Unable to share content. Please try again.');
      }
    }
  }

  /**
   * Share to Instagram Stories specifically
   */
  async shareToInstagramStory(viewRef: any, content: ShareContent): Promise<void> {
    try {
      const uri = await viewRef.capture();

      const shareOptions = {
        url: Platform.OS === 'ios' ? uri : `file://${uri}`,
        type: 'image/png',
        social: Share.Social.INSTAGRAM_STORIES,
        appId: 'your-facebook-app-id', // Replace with actual Facebook App ID
      };

      await Share.shareSingle(shareOptions);

      Logger.debug('[SocialShareService] Shared to Instagram Stories', {
        component: 'socialShareService',
        type: content.type,
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        Logger.error('[SocialShareService] Failed to share to Instagram', error as Error, {
          component: 'socialShareService',
        });
        Alert.alert('Share Failed', 'Unable to share to Instagram. Make sure Instagram is installed.');
      }
    }
  }

  /**
   * Share to Facebook
   */
  async shareToFacebook(viewRef: any, content: ShareContent): Promise<void> {
    try {
      const uri = await viewRef.capture();

      const shareOptions = {
        url: Platform.OS === 'ios' ? uri : `file://${uri}`,
        type: 'image/png',
        social: Share.Social.FACEBOOK,
      };

      await Share.shareSingle(shareOptions);

      Logger.debug('[SocialShareService] Shared to Facebook', {
        component: 'socialShareService',
        type: content.type,
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        Logger.error('[SocialShareService] Failed to share to Facebook', error as Error, {
          component: 'socialShareService',
        });
        Alert.alert('Share Failed', 'Unable to share to Facebook. Make sure Facebook is installed.');
      }
    }
  }

  /**
   * Save image to camera roll
   */
  async saveToGallery(viewRef: any): Promise<void> {
    try {
      const uri = await viewRef.capture();

      // Use react-native-share to save to gallery
      await Share.open({
        url: Platform.OS === 'ios' ? uri : `file://${uri}`,
        type: 'image/png',
        saveToFiles: true,
      });

      Logger.debug('[SocialShareService] Saved to gallery', {
        component: 'socialShareService',
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        Logger.error('[SocialShareService] Failed to save to gallery', error as Error, {
          component: 'socialShareService',
        });
        Alert.alert('Save Failed', 'Unable to save image. Please try again.');
      }
    }
  }
}

export const socialShareService = new SocialShareService();
