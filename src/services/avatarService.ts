import { supabase } from './supabaseClient';
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
  // Convert uri to file blob/arraybuffer depending on platform
  // For React Native, supabase-js supports uploading via fetch(uri).then(res=>res.blob())

  // Add validation and error handling to prevent crashes
  if (!file.uri || typeof file.uri !== 'string') {
    throw new Error('Invalid file URI provided');
  }

  let res: Response;
  let blob: Blob;

  try {
    res = await fetch(file.uri);

    if (!res.ok) {
      throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
    }

    // Check if response has valid content
    const contentLength = res.headers.get('content-length');
    if (contentLength === '0') {
      throw new Error('File is empty or corrupted');
    }

    blob = await res.blob();

    // Validate blob
    if (!blob || blob.size === 0) {
      throw new Error('Failed to create blob from file or file is empty');
    }

  } catch (catchError) {
    Logger.error('Error processing file for upload', catchError as Error, {
  component: 'avatarService',
});
    throw new Error(`Failed to process file: ${catchError instanceof Error ? catchError.message : 'Unknown error'}`);
  }

  const path = `${user.id}/${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage.from('avatars').upload(path, blob, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    throw new Error(error.message || 'Failed to upload avatar');
  }

  // Get public URL (ensure bucket is public or use signed URL alternative)
  const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(data.path);
  if (!publicData?.publicUrl) {
    throw new Error('Failed to resolve public URL for avatar');
  }
  return publicData.publicUrl;
}
