/**
 * socialShareService.test.ts
 * Test suite for social share utility
 */

import { socialShareService } from '../socialShareService';
import { Share } from 'react-native-share';

// Mock react-native-share
jest.mock('react-native-share', () => ({
  Share: {
    open: jest.fn(() => Promise.resolve({ success: true })),
    shareSingle: jest.fn(() => Promise.resolve({ success: true })),
    Social: {
      INSTAGRAM_STORIES: 'instagram_stories',
      FACEBOOK: 'facebook',
      TWITTER: 'twitter',
      WHATSAPP: 'whatsapp',
    },
  },
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((ios, android) => ios || android),
  },
}));

describe('socialShareService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('share to Instagram Stories', () => {
    it('should share image to Instagram Stories successfully', async () => {
      const imageUri = 'file:///path/to/image.jpg';
      const backgroundAsset = 'file:///path/to/background.jpg';
      const stickerAsset = 'file:///path/to/sticker.png';

      await expect(
        socialShareService.shareToInstagramStories({
          imageUri,
          backgroundAsset,
          stickerAsset,
        })
      ).resolves.not.toThrow();

      expect(Share.shareSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          social: 'instagram_stories',
          url: expect.stringContaining(imageUri),
        })
      );
    });

    it('should handle missing image URI gracefully', async () => {
      await expect(
        socialShareService.shareToInstagramStories({})
      ).resolves.not.toThrow();
    });

    it('should handle share errors gracefully', async () => {
      const mockError = new Error('Share failed');
      (Share.shareSingle as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(
        socialShareService.shareToInstagramStories({
          imageUri: 'file:///path/to/image.jpg',
        })
      ).resolves.not.toThrow();
    });

    it('should format URI correctly for iOS', async () => {
      const imageUri = '/path/to/image.jpg';
      const Platform = require('react-native').Platform;
      Platform.OS = 'ios';

      await socialShareService.shareToInstagramStories({
        imageUri,
      });

      expect(Share.shareSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          url: imageUri,
        })
      );
    });

    it('should format URI correctly for Android', async () => {
      const imageUri = '/path/to/image.jpg';
      const Platform = require('react-native').Platform;
      Platform.OS = 'android';

      await socialShareService.shareToInstagramStories({
        imageUri,
      });

      expect(Share.shareSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `file://${imageUri}`,
        })
      );
    });
  });

  describe('share to Facebook', () => {
    it('should share image to Facebook successfully', async () => {
      const imageUri = 'file:///path/to/image.jpg';
      const caption = 'Check this out!';

      await expect(
        socialShareService.shareToFacebook({
          imageUri,
          caption,
        })
      ).resolves.not.toThrow();

      expect(Share.shareSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          social: 'facebook',
          url: expect.stringContaining(imageUri),
        })
      );
    });

    it('should handle missing caption gracefully', async () => {
      await expect(
        socialShareService.shareToFacebook({
          imageUri: 'file:///path/to/image.jpg',
        })
      ).resolves.not.toThrow();
    });

    it('should handle Facebook share errors gracefully', async () => {
      const mockError = new Error('Facebook share failed');
      (Share.shareSingle as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(
        socialShareService.shareToFacebook({
          imageUri: 'file:///path/to/image.jpg',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('general share', () => {
    it('should share content using general share', async () => {
      const options = {
        title: 'Check this out!',
        message: 'Amazing content from siFia',
        url: 'https://sifia.app',
      };

      await expect(socialShareService.share(options)).resolves.not.toThrow();

      expect(Share.open).toHaveBeenCalledWith(options);
    });

    it('should handle general share errors gracefully', async () => {
      const mockError = new Error('General share failed');
      (Share.open as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(
        socialShareService.share({
          title: 'Test',
        })
      ).resolves.not.toThrow();
    });

    it('should handle empty options gracefully', async () => {
      await expect(socialShareService.share({})).resolves.not.toThrow();
    });
  });

  describe('share to Twitter', () => {
    it('should share to Twitter successfully', async () => {
      const text = 'Check out this amazing content! #siFia';
      const url = 'https://sifia.app';

      await expect(
        socialShareService.shareToTwitter({
          text,
          url,
        })
      ).resolves.not.toThrow();

      expect(Share.shareSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          social: 'twitter',
          url: expect.stringContaining(url),
        })
      );
    });

    it('should handle Twitter character limits', async () => {
      const longText = 'A'.repeat(300); // Exceeds Twitter limit
      const url = 'https://sifia.app';

      await expect(
        socialShareService.shareToTwitter({
          text: longText,
          url,
        })
      ).resolves.not.toThrow();
    });

    it('should handle missing URL gracefully', async () => {
      await expect(
        socialShareService.shareToTwitter({
          text: 'Check this out!',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('share to WhatsApp', () => {
    it('should share to WhatsApp successfully', async () => {
      const message = 'Check out this content from siFia!';
      const url = 'https://sifia.app';

      await expect(
        socialShareService.shareToWhatsApp({
          message,
          url,
        })
      ).resolves.not.toThrow();

      expect(Share.shareSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          social: 'whatsapp',
          url: expect.stringContaining(url),
        })
      );
    });

    it('should handle WhatsApp message formatting', async () => {
      const message = 'Check this out!';
      const url = 'https://sifia.app';

      await socialShareService.shareToWhatsApp({
        message,
        url,
      });

      expect(Share.shareSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          social: 'whatsapp',
        })
      );
    });
  });

  describe('share playbook content', () => {
    it('should share playbook achievement', async () => {
      const playbookData = {
        title: 'Morning Prayer Routine',
        description: 'A powerful morning prayer routine',
        achievement: 'Completed 7-day streak!',
        imageUrl: 'file:///path/to/playbook-image.jpg',
      };

      await expect(
        socialShareService.sharePlaybookAchievement(playbookData)
      ).resolves.not.toThrow();

      expect(Share.open).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining(playbookData.title),
          message: expect.stringContaining(playbookData.achievement),
        })
      );
    });

    it('should handle missing playbook data gracefully', async () => {
      await expect(
        socialShareService.sharePlaybookAchievement({})
      ).resolves.not.toThrow();
    });

    it('should format playbook share message correctly', async () => {
      const playbookData = {
        title: 'Daily Devotional',
        description: 'Scripture and reflection',
        achievement: 'Completed 30 days',
      };

      await socialShareService.sharePlaybookAchievement(playbookData);

      expect(Share.open).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Daily Devotional'),
          message: expect.stringContaining('30 days'),
        })
      );
    });
  });

  describe('share devotional content', () => {
    it('should share devotional insight', async () => {
      const devotionalData = {
        title: 'Finding Peace',
        scripture: 'Philippians 4:7',
        insight: 'God\'s peace transcends all understanding',
        imageUrl: 'file:///path/to/devotional-image.jpg',
      };

      await expect(
        socialShareService.shareDevotionalInsight(devotionalData)
      ).resolves.not.toThrow();

      expect(Share.open).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining(devotionalData.title),
          message: expect.stringContaining(devotionalData.scripture),
        })
      );
    });

    it('should handle missing devotional data gracefully', async () => {
      await expect(
        socialShareService.shareDevotionalInsight({})
      ).resolves.not.toThrow();
    });

    it('should format devotional share message correctly', async () => {
      const devotionalData = {
        title: 'Faith and Trust',
        scripture: 'Proverbs 3:5-6',
        insight: 'Trust in the Lord with all your heart',
      };

      await socialShareService.shareDevotionalInsight(devotionalData);

      expect(Share.open).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Faith and Trust'),
          message: expect.stringContaining('Proverbs 3:5-6'),
        })
      );
    });
  });

  describe('share prayer request', () => {
    it('should share prayer request', async () => {
      const prayerData = {
        title: 'Prayer for Healing',
        description: 'Please pray for my friend\'s recovery',
        isAnonymous: true,
      };

      await expect(
        socialShareService.sharePrayerRequest(prayerData)
      ).resolves.not.toThrow();

      expect(Share.open).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Prayer Request'),
          message: expect.stringContaining('prayer'),
        })
      );
    });

    it('should respect anonymity settings', async () => {
      const prayerData = {
        title: 'Personal Prayer',
        description: 'Need prayer for guidance',
        isAnonymous: true,
      };

      await socialShareService.sharePrayerRequest(prayerData);

      expect(Share.open).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.not.stringContaining('personal'),
        })
      );
    });

    it('should handle missing prayer data gracefully', async () => {
      await expect(
        socialShareService.sharePrayerRequest({})
      ).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network unavailable');
      (Share.open as jest.Mock).mockRejectedValueOnce(networkError);

      await expect(
        socialShareService.share({
          title: 'Test',
        })
      ).resolves.not.toThrow();
    });

    it('should handle permission denied errors', async () => {
      const permissionError = new Error('Permission denied');
      (Share.open as jest.Mock).mockRejectedValueOnce(permissionError);

      await expect(
        socialShareService.share({
          title: 'Test',
        })
      ).resolves.not.toThrow();
    });

    it('should handle invalid URIs gracefully', async () => {
      await expect(
        socialShareService.shareToInstagramStories({
          imageUri: 'invalid-uri',
        })
      ).resolves.not.toThrow();
    });

    it('should handle very long messages gracefully', async () => {
      const longMessage = 'A'.repeat(10000);

      await expect(
        socialShareService.share({
          message: longMessage,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('platform-specific behavior', () => {
    it('should handle iOS specific features', async () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'ios';

      await expect(
        socialShareService.shareToInstagramStories({
          imageUri: '/path/to/image.jpg',
        })
      ).resolves.not.toThrow();
    });

    it('should handle Android specific features', async () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'android';

      await expect(
        socialShareService.shareToInstagramStories({
          imageUri: '/path/to/image.jpg',
        })
      ).resolves.not.toThrow();
    });

    it('should handle unknown platform gracefully', async () => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'unknown';

      await expect(
        socialShareService.shareToInstagramStories({
          imageUri: '/path/to/image.jpg',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('share options validation', () => {
    it('should validate required fields', async () => {
      await expect(
        socialShareService.share({
          // Missing required fields
        })
      ).resolves.not.toThrow();
    });

    it('should handle empty strings gracefully', async () => {
      await expect(
        socialShareService.share({
          title: '',
          message: '',
          url: '',
        })
      ).resolves.not.toThrow();
    });

    it('should handle special characters in messages', async () => {
      const specialMessage = 'Check this out! 🙏✨ #blessed #faith';

      await expect(
        socialShareService.share({
          message: specialMessage,
        })
      ).resolves.not.toThrow();
    });
  });
});
