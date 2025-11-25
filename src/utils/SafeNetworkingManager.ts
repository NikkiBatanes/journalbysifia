import { Platform } from 'react-native';

/**
 * Safe networking manager to handle blob responses that may crash
 * due to CoreServices UTI issues
 */
export class SafeNetworkingManager {
  private static instance: SafeNetworkingManager;

  static getInstance(): SafeNetworkingManager {
    if (!SafeNetworkingManager.instance) {
      SafeNetworkingManager.instance = new SafeNetworkingManager();
    }
    return SafeNetworkingManager.instance;
  }

  /**
   * Safely get filename from response, avoiding crashes in CoreServices
   */
  static safeGetFilename(response: any): string | null {
    try {
      // On iOS, the suggestedFilename can cause crashes due to UTI issues
      if (Platform.OS === 'ios') {
        // Try to get MIME type first
        const mimeType = response.MIMEType || response.type;

        // If we have a MIME type, generate a safe filename
        if (mimeType) {
          const extension = this.getExtensionFromMimeType(mimeType);
          const timestamp = Date.now();
          return `response_${timestamp}${extension}`;
        }

        // If no MIME type, return a generic filename
        const timestamp = Date.now();
        return `response_${timestamp}.bin`;
      }

      // On other platforms, use the original method
      return response.suggestedFilename || null;
    } catch (error) {
      console.warn('SafeNetworkingManager: Error getting filename:', error);
      // Fallback to generic filename
      const timestamp = Date.now();
      return `response_${timestamp}.bin`;
    }
  }

  /**
   * Map MIME types to file extensions
   */
  private static getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: { [key: string]: string } = {
      'text/plain': '.txt',
      'text/html': '.html',
      'text/css': '.css',
      'text/javascript': '.js',
      'text/xml': '.xml',
      'application/json': '.json',
      'application/xml': '.xml',
      'application/pdf': '.pdf',
      'application/zip': '.zip',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'image/webp': '.webp',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
    };

    return mimeMap[mimeType.toLowerCase()] || '.bin';
  }
}

// Export a singleton instance
export default SafeNetworkingManager.getInstance();
