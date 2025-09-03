import { supabase } from './supabaseClient';

export type FeatureRequestPayload = {
  user_id: string | null;
  message: string;
  category: string;
  platform: string;
  os_version: string;
  screen: string;
  app_version?: string | null;
  extra?: any;
};

export async function reportFeature(payload: FeatureRequestPayload) {
  const { data, error } = await supabase
    .from('feature_requests')
    .insert({
      user_id: payload.user_id,
      message: payload.message,
      category: payload.category,
      platform: payload.platform,
      os_version: payload.os_version,
      screen: payload.screen,
      app_version: payload.app_version ?? null,
      extra: payload.extra ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
