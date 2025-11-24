import { Logger } from '../utils/ProductionLogger';
import type { User } from '@supabase/supabase-js';

// Bare React Native: use react-native-image-picker only
export async function pickImageLocal(): Promise<{ uri: string; name: string; type: string } | null> {
  // Dynamically require to avoid bundling if not installed yet
  let launch: any;
  try {

    const mod = require('react-native-image-picker');
    launch = (mod && mod.launchImageLibrary) || (mod?.default && mod.default.launchImageLibrary);
  } catch (_) {
    throw new Error('react-native-image-picker is not installed');
  }

  if (typeof launch !== 'function') {
    throw new Error('react-native-image-picker loaded but launchImageLibrary is not a function');
  }

  // Prefer promise-based API (RN Image Picker v3+)
  const options = {
    mediaType: 'photo',
    quality: 0.9,
    selectionLimit: 1,
    includeBase64: false,
  } as any;

  const response = await launch(options);
  if (response?.didCancel) {return null;}
  if (response?.errorCode) {throw new Error(response.errorMessage || 'Image picker error');}
  const asset = response?.assets?.[0];
  if (!asset?.uri) {throw new Error('No image selected');}

  // Validate URI format to prevent crashes
  const uri = asset.uri;
  if (!uri.startsWith('file://') && !uri.startsWith('content://') && !uri.startsWith('ph://')) {
    throw new Error('Invalid image URI format');
  }

  const fileName = asset.fileName || `avatar_${Date.now()}.jpg`;
  const type = asset.type || 'image/jpeg';
  return { uri, name: fileName, type };
}

export async function uploadAvatar(user: User, file: { uri: string; name: string; type: string }): Promise<string> {
  // Add validation and error handling to prevent crashes
  if (!file.uri || typeof file.uri !== 'string') {
    throw new Error('Invalid file URI provided');
  }

  console.log('📸 Starting avatar upload:', { uri: file.uri, name: file.name, type: file.type });

  try {
    // For React Native, just return the file URI directly
    // React Native Image component handles local file URIs efficiently
    if (!file.uri.startsWith('file://')) {
      throw new Error('Only local file URIs are allowed for avatars');
    }

    console.log('📸 Using local file URI for fast loading');
    return file.uri;

  } catch (catchError) {
    console.error('📸 File URI processing failed:', catchError);
    Logger.error('Error processing avatar file', catchError as Error, {
      component: 'avatarService',
    });
    throw new Error(`Failed to process avatar: ${catchError instanceof Error ? catchError.message : 'Unknown error'}`);
  }
}
