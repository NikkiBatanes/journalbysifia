import React, { useState, useEffect } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../theme/colors';
import { withErrorBoundary } from '../../components/ErrorBoundary/withErrorBoundary';
import { OnboardingStyles, OnboardingSpacing } from '../../theme/onboardingStyles';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { triggerLightHaptic } from '../../utils/haptics';
import { supabase } from '../../services/supabaseClient';
import ThemedText from '../../components/common/ThemedText';
import OnboardingErrorBoundary from '../../components/OnboardingErrorBoundary';

// Helper function to extract first name from email username
const extractNameFromEmail = (emailUsername: string): string => {
  if (!emailUsername) {
    return '';
  }

  let cleanUsername = emailUsername.toLowerCase();

  // Remove common prefixes
  cleanUsername = cleanUsername.replace(/^(by|the|my|user|admin|contact)/, '');

  // If username looks like it contains a first name (4-12 chars, mostly letters)
  if (cleanUsername.length >= 4 && cleanUsername.length <= 12 && /^[a-z]+$/.test(cleanUsername)) {
    return cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);
  }

  return emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
};

const OnboardingAccountCreationScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const win = Dimensions.get('window');
  const [screenSize, setScreenSize] = useState({ width: win.width, height: win.height });
  const isLandscape = screenSize.width > screenSize.height;
  const isTablet = screenSize.width >= 768;
  const isVerySmallPhone = !isTablet && screenSize.height <= 700;
  const contentWidth = Math.min(isLandscape ? screenSize.width * 0.68 : screenSize.width * 0.92, 720);
  const logoSize = isVerySmallPhone ? 100 : (isTablet ? 120 : 100);

  const { isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setScreenSize({ width: window.width, height: window.height });
    });
    return () => sub?.remove();
  }, []);

  // Honor post_auth_redirect if present (mirrors WelcomeScreen behavior)
  useEffect(() => {
    let isActive = true;

    const unsubscribe = (navigation as any).addListener?.('focus', async () => {
      try {
        if (!isAuthenticated) {
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        const redirectRaw = await AsyncStorage.getItem('post_auth_redirect');
        if (redirectRaw) {
          const redirect = JSON.parse(redirectRaw);
          const target = redirect?.target as string | undefined;
          const params = redirect?.params || {};

          if (user && target === 'OnboardingPersonalization') {
            try {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('onboarding_completed')
                .eq('id', user.id)
                .single();

              if (profile?.onboarding_completed) {
                Logger.info('AccountCreationScreen: User completed onboarding - ignoring personalization redirect, navigating to UserInput');
                try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
                (navigation as any).reset?.({ index: 0, routes: [{ name: 'UserInput', params: {} }] });
                return;
              }
            } catch (error) {
              Logger.warn('AccountCreationScreen: Error checking onboarding status', { errorMessage: String(error) });
            }
          }

          if (!isActive || !target) {
            return;
          }

          try {
            (navigation as any).reset?.({ index: 0, routes: [{ name: target, params }] });
          } catch {
            (navigation as any).navigate(target as any, params);
          }
          try { await AsyncStorage.removeItem('post_auth_redirect'); } catch {}
          return;
        }

        // No redirect; if authenticated, forward to personalization
        const provider = user?.app_metadata?.provider || (user as any)?.identities?.[0]?.provider;
        const isOAuth = provider === 'apple' || provider === 'google';

        let displayName = '';
        if (provider === 'apple') {
          displayName = '';
        } else if (provider === 'google') {
          const fullName = user?.user_metadata?.full_name || user?.user_metadata?.first_name || '';
          displayName = fullName.split(' ')[0] || fullName;
        } else {
          displayName = user?.user_metadata?.first_name || extractNameFromEmail(user?.email?.split('@')[0] || '') || '';
        }

        const registrationMethod = isOAuth ? 'oauth' : 'email';

        try {
          (navigation as any).reset?.({ index: 0, routes: [{ name: 'OnboardingPersonalization', params: { name: displayName, registrationMethod } }] });
        } catch {
          (navigation as any).navigate('OnboardingPersonalization' as any, { name: displayName, registrationMethod });
        }
      } catch {
        // Non-fatal
      }
    });

    return () => {
      isActive = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, navigation]);

  const handleCreateAccount = async () => {
    triggerLightHaptic();
    setIsLoading(true);

    setTimeout(() => {
      try {
        if (isAuthenticated) {
          const provider = user?.app_metadata?.provider || (user as any)?.identities?.[0]?.provider;
          const isOAuth = provider === 'apple' || provider === 'google';

          let displayName = '';
          if (provider === 'apple') {
            displayName = '';
          } else if (provider === 'google') {
            const fullName = user?.user_metadata?.full_name || user?.user_metadata?.first_name || '';
            displayName = fullName.split(' ')[0] || fullName;
          } else {
            displayName = user?.user_metadata?.first_name || extractNameFromEmail(user?.email?.split('@')[0] || '') || '';
          }

          const registrationMethod = isOAuth ? 'oauth' : 'email';

          navigation.navigate('OnboardingPersonalization' as any, {
            name: displayName,
            registrationMethod,
          });
        } else {
          navigation.navigate('Auth', { screen: 'Register' });
        }
      } catch (e) {
        Logger.warn('AccountCreationScreen: Error navigating from create account', { errorMessage: String(e) });
      } finally {
        setIsLoading(false);
      }
    }, 100);
  };

  const handleLogin = async () => {
    triggerLightHaptic();
    setIsLoading(true);

    setTimeout(() => {
      try {
        if (isAuthenticated) {
          const provider = user?.app_metadata?.provider || (user as any)?.identities?.[0]?.provider;
          const isOAuth = provider === 'apple' || provider === 'google';

          let displayName = '';
          if (provider === 'apple') {
            displayName = '';
          } else if (provider === 'google') {
            const fullName = user?.user_metadata?.full_name || user?.user_metadata?.first_name || '';
            displayName = fullName.split(' ')[0] || fullName;
          } else {
            displayName = user?.user_metadata?.first_name || extractNameFromEmail(user?.email?.split('@')[0] || '') || '';
          }

          const registrationMethod = isOAuth ? 'oauth' : 'email';

          navigation.navigate('OnboardingPersonalization' as any, {
            name: displayName,
            registrationMethod,
          });
        } else {
          navigation.navigate('Auth', { screen: 'Login' });
        }
      } catch (e) {
        Logger.warn('AccountCreationScreen: Error navigating from login', { errorMessage: String(e) });
      } finally {
        setIsLoading(false);
      }
    }, 100);
  };

  return (
    <OnboardingErrorBoundary>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

        <View style={OnboardingStyles.innerContainer}>
          <View style={[styles.logoSection, { width: contentWidth }]}>
            <Image
              source={require('../../../assets/icons/siFia-logo-white.png')}
              style={[styles.logoImage, { width: logoSize, height: logoSize }]}
              resizeMode="contain"
            />
          </View>

          <View style={[styles.contentSection, { width: contentWidth }]}>
            <ThemedText weight="bold" style={styles.title}>
              Create a space for this moment
            </ThemedText>

            <ThemedText style={styles.subtitle}>
              {'We’ll save what you share so you can return to it later.\n\nThis space is private and only for you.'}
            </ThemedText>

            <View style={styles.buttonSection}>
              <TouchableOpacity
                style={[styles.primaryButton, styles.finishButton, isLoading && OnboardingStyles.buttonDisabled]}
                onPress={handleCreateAccount}
                disabled={isLoading}
              >
                <ThemedText weight="semiBold" style={styles.primaryButtonText}>
                  {isAuthenticated ? 'Continue Setup' : 'Create an Account'}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, isLoading && OnboardingStyles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <ThemedText weight="semiBold" style={styles.secondaryButtonText}>
                  {isAuthenticated ? 'Get Started' : 'Login'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.termsContainer}>
              <ThemedText style={styles.footerText}>
                {'No payment required.\nYou’re just saving your reflection.'}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    </OnboardingErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    ...OnboardingStyles.container,
    paddingHorizontal: 0,
  },
  logoSection: {
    ...OnboardingStyles.logoSection,
    alignSelf: 'center',
    paddingHorizontal: 24,
    marginTop: 220,
    marginBottom: 0,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  contentSection: {
    flex: 1,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: OnboardingSpacing.xl,
  },
  title: {
    ...OnboardingStyles.mainTitle,
    textAlign: 'left',
    marginBottom: 12,
  },
  subtitle: {
    ...OnboardingStyles.subtitle,
    textAlign: 'left',
    marginBottom: 24,
  },
  buttonSection: {
    width: '100%',
    marginBottom: 20,
  },
  createButton: {
    ...OnboardingStyles.primaryButton,
    alignSelf: 'center',
    width: '100%',
  },
  createButtonText: OnboardingStyles.primaryButtonText,
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.alertCoral,
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 'auto',
  },
  finishButton: {
    marginTop: 32,
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 28,
    gap: 8,
    marginTop: 12,
    alignSelf: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  termsContainer: {
    paddingHorizontal: 0,
    marginBottom: 10,
  },
  footerText: {
    ...OnboardingStyles.termsText,
    textAlign: 'center',
    alignSelf: 'center',
  },
});

export default withErrorBoundary(OnboardingAccountCreationScreen, 'OnboardingAccountCreationScreen');
