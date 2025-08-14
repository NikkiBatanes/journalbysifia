import { Platform } from 'react-native';
import { supabase } from './supabaseClient';
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
  const fileName = asset.fileName || `avatar_${Date.now()}.jpg`;
  const type = asset.type || 'image/jpeg';
  return { uri: asset.uri, name: fileName, type };
}

export async function uploadAvatar(user: User, file: { uri: string; name: string; type: string }): Promise<string> {
  // Convert uri to file blob/arraybuffer depending on platform
  // For React Native, supabase-js supports uploading via fetch(uri).then(res=>res.blob())
  const res = await fetch(file.uri);
  const blob = await res.blob();

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
