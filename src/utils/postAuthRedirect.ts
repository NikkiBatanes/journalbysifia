import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeJsonParse } from './safeJsonParse';

export interface PostAuthRedirect {
  target?: string;
  params?: Record<string, unknown>;
  is_login_flow?: boolean;
}

const POST_AUTH_REDIRECT_KEY = 'post_auth_redirect';
const FORCE_NAVIGATE_TO_MAIN_KEY = 'force_navigate_to_main';

export const getPostAuthRedirect = async (context: string): Promise<PostAuthRedirect | null> => {
  const redirectRaw = await AsyncStorage.getItem(POST_AUTH_REDIRECT_KEY);
  return safeJsonParse<PostAuthRedirect>(redirectRaw, {
    fallback: null,
    context,
  });
};

export const hasLoginFlowRedirect = async (context: string): Promise<boolean> => {
  const redirect = await getPostAuthRedirect(context);
  return redirect?.is_login_flow === true;
};

export const setUserInputLoginRedirect = async (): Promise<void> => {
  await AsyncStorage.removeItem(FORCE_NAVIGATE_TO_MAIN_KEY);
  await AsyncStorage.setItem(POST_AUTH_REDIRECT_KEY, JSON.stringify({
    target: 'UserInput',
    params: {},
    is_login_flow: true,
  }));
};

export const clearLoginFlowRedirect = async (context: string): Promise<void> => {
  const redirect = await getPostAuthRedirect(context);
  if (redirect?.is_login_flow === true) {
    await AsyncStorage.removeItem(POST_AUTH_REDIRECT_KEY);
  }
};
