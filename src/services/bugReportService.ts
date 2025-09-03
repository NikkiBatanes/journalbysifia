import { supabase } from './supabaseClient';

export type BugReportPayload = {
  user_id: string | null;
  message: string;
  platform: string;
  os_version: string;
  screen: string;
  app_version?: string | null;
  extra?: any;
};

export async function reportBug(payload: BugReportPayload) {
  // Insert into 'bug_reports' table. Ensure this table exists in your Supabase project.
  const { data, error } = await supabase
    .from('bug_reports')
    .insert({
      user_id: payload.user_id,
      message: payload.message,
      platform: payload.platform,
      os_version: payload.os_version,
      screen: payload.screen,
      app_version: payload.app_version ?? null,
      extra: payload.extra ?? null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}
