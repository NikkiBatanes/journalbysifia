import { Logger } from '../utils/ProductionLogger';
import type { User } from '@supabase/supabase-js';

export type LocalImage = { uri: string; name: string; type: string };
export type LocalImageSource = 'camera' | 'library';

const loadImagePickerLaunch = (method: 'launchImageLibrary' | 'launchCamera') => {
  // Dynamically require to avoid bundling if not installed yet
  let launch: any;
  try {

    const mod = require('react-native-image-picker');
    launch = (mod && mod[method]) || (mod?.default && mod.default[method]);
  } catch (_) {
    throw new Error('react-native-image-picker is not installed');
  }

  if (typeof launch !== 'function') {
    throw new Error(`react-native-image-picker loaded but ${method} is not a function`);
  }
  return launch;
};

const toLocalImage = (response: any, fallbackPrefix: string): LocalImage | null => {
  if (response?.didCancel) {return null;}
  if (response?.errorCode) {
    const error = new Error(response.errorMessage || 'Image picker error') as Error & {code?: string};
    error.code = response.errorCode;
    throw error;
  }
  const asset = response?.assets?.[0];
  if (!asset?.uri) {throw new Error('No image selected');}

  // Validate URI format to prevent crashes
  const uri = asset.uri;
  if (!uri.startsWith('file://') && !uri.startsWith('content://') && !uri.startsWith('ph://')) {
    throw new Error('Invalid image URI format');
  }

  const fileName = asset.fileName || `${fallbackPrefix}_${Date.now()}.jpg`;
  const type = asset.type || 'image/jpeg';
  return { uri, name: fileName, type };
};

// Bare React Native: use react-native-image-picker only
export async function pickImageLocal(): Promise<LocalImage | null> {
  const launch = loadImagePickerLaunch('launchImageLibrary');

  // Prefer promise-based API (RN Image Picker v3+)
  const options = {
    mediaType: 'photo',
    quality: 0.9,
    selectionLimit: 1,
    includeBase64: false,
  } as any;

  return toLocalImage(await launch(options), 'avatar');
}

export async function captureImageWithCamera(): Promise<LocalImage | null> {
  const launch = loadImagePickerLaunch('launchCamera');

  const options = {
    mediaType: 'photo',
    quality: 0.9,
    includeBase64: false,
  } as any;

  return toLocalImage(await launch(options), 'capture');
}

export async function pickImageFromSource(source: LocalImageSource): Promise<LocalImage | null> {
  if (source === 'camera') {
    try {
      return await captureImageWithCamera();
    } catch (error) {
      // Camera is unavailable on simulators; fall back to the library.
      if ((error as {code?: string})?.code === 'camera_unavailable') {
        return pickImageLocal();
      }
      throw error;
    }
  }
  if (source === 'library') {
    return pickImageLocal();
  }
  return null;
}

export async function uploadAvatar(user: User, file: { uri: string; name: string; type: string }): Promise<string> {
  // Add validation and error handling to prevent crashes
  if (!file.uri || typeof file.uri !== 'string') {
    throw new Error('Invalid file URI provided');
  }


  try {
    // For React Native, just return the file URI directly
    // React Native Image component handles local file URIs efficiently
    if (!file.uri.startsWith('file://')) {
      throw new Error('Only local file URIs are allowed for avatars');
    }

        return file.uri;

  } catch (catchError) {
        Logger.error('Error processing avatar file', catchError as Error, {
      component: 'avatarService',
    });
    throw new Error(`Failed to process avatar: ${catchError instanceof Error ? catchError.message : 'Unknown error'}`);
  }
}
