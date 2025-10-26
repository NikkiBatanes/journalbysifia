// src/navigation/RootStackNavigator.tsx
import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { TouchableOpacity, View, Image, StyleSheet, Text } from 'react-native';
// Removed CommonActions import as we navigate directly to UserProfile

import { Colors } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { triggerLightHaptic } from '../utils/haptics';
import BottomTabNavigator from './BottomTabNavigator';
import PlaybookDetailScreen from '../screens/PlaybookDetailScreenNew';
import GeneratingPlaybookScreen from '../screens/GeneratingPlaybookScreen';
import DevotionalDetailScreen from '../screens/DevotionalDetailScreen';
import JournalScreen from '../screens/JournalScreen';
import UserInputScreen from '../screens/UserInputScreen';
import { useAuth } from '../context/IndustryStandardAuthContext';
import UserProfileScreen from '../screens/UserProfileScreen';

// New Onboarding screens
import OnboardingSplashScreen from '../screens/onboarding/OnboardingSplashScreen';
import OnboardingWelcomeScreen from '../screens/onboarding/OnboardingWelcomeScreen';
import OnboardingPlaybookGenerationScreen from '../screens/onboarding/OnboardingPlaybookGenerationScreen';
import OnboardingTransformYourLifeScreen from '../screens/onboarding/OnboardingTransformYourLifeScreen';

import OnboardingPersonalizationScreen from '../screens/onboarding/OnboardingPersonalizationScreen';

// New Simplified Onboarding Flow Screens
import OnboardingPlaybookReadyScreen from '../screens/onboarding/OnboardingPlaybookReadyScreenNew';
import OnboardingSalesOfferScreen from '../screens/onboarding/OnboardingSalesOfferScreen';
import OnboardingTrialOfferScreen from '../screens/onboarding/OnboardingTrialOfferScreen';
import OnboardingNotificationSetupScreen from '../screens/onboarding/OnboardingNotificationSetupScreen';

import { OnboardingAnimations, splashToFirstScreenAnimation } from './onboardingAnimations';

// Header Components
interface BackButtonProps {
  onPress: () => void;
  color?: string;
}

const BackButton = React.memo<BackButtonProps>(({ onPress, color = Colors.anchorBlue }) => (
  <TouchableOpacity
    onPress={() => {
      triggerLightHaptic();
      onPress();
    }}
    style={styles.backButton}
  >
    <Ionicons name="chevron-back" size={24} color={color} />
  </TouchableOpacity>
));

interface ProfileImageProps {
  containerStyle?: object;
  navigation?: any;
}

const ProfileImage = React.memo<ProfileImageProps>(({ containerStyle, navigation }) => {
  const { user } = useAuth();
  const meta: any = (user as any)?.user_metadata || {};
  const displayName =
    (user as any)?.displayName ||
    meta.full_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() ||
    (user as any)?.email ||
    'User';
  const initialLetter = (displayName || 'U').trim().charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      onPress={() => {
        if (navigation) {
          try {
            navigation.navigate('UserProfileModal');
          } catch (error) {

          }
        }
      }}
      style={[styles.profileImageContainer, containerStyle]}
      activeOpacity={0.7}
    >
      {(user as any)?.user_metadata?.avatar_url ? (
        <Image
          source={{ uri: (user as any).user_metadata.avatar_url }}
          style={styles.profileImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.profileImage, styles.initialAvatar]}>
          <Text style={styles.initialLetter}>{initialLetter}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// Memoized header components
const HeaderLeft = React.memo(({ color = Colors.anchorBlue, onPress }: { color?: string, onPress: () => void }) => {
  return <BackButton onPress={onPress} color={color} />;
});

// Header right components as functions
// These are used in navigation options below
const renderDefaultProfileImage = ({ navigation }: any) => <ProfileImage navigation={navigation} />;

// Header left components for different screens
const PlaybookHeaderLeft = React.memo(({ navigation }: { navigation: any }) => (
  <HeaderLeft
    color={Colors.anchorBlue}
    onPress={() => {
      try {
        navigation.goBack();
      } catch (error) {

      }
    }}
  />
));

// Unused component - commenting out to fix linting
// const DevotionalHeaderLeft = ({ navigation }: { navigation: any }) => (
//   <HeaderLeft
//     color={Colors.anchorBlue}
//     onPress={() => {
//       try {
//         navigation.goBack();
//       } catch (error) {
//         console.log('Navigation error in DevotionalHeaderLeft:', error);
//       }
//     }}
//   />
// );

import { useLogout } from '../context/LogoutContext';
const MainTabsScreen: React.FC = React.memo(() => {
  const onLogout = useLogout();
  return <BottomTabNavigator onLogout={onLogout} />;
});

const Stack = createNativeStackNavigator();

// Screen options functions
const getPlaybookDetailOptions = (theme: any): NativeStackNavigationOptions => ({
  headerShown: true,
  title: '',
  headerBackVisible: false,
  headerLeft: ({ navigation }: any) => <PlaybookHeaderLeft navigation={navigation} />,
  headerRight: ({ navigation }: any) => renderDefaultProfileImage({ navigation }),
  headerStyle: { backgroundColor: theme.colors.hopeWhite },
  headerTitleAlign: 'center' as const,
  headerTitleStyle: { color: theme.colors.anchorBlue },
  headerShadowVisible: false,
});

// Unused function - commenting out to fix linting
// const _getDevotionalDetailOptions = ({ navigation }: any): NativeStackNavigationOptions => ({
//   title: '',
//   headerBackVisible: true,
//   headerLeft: () => <DevotionalHeaderLeft navigation={navigation} />,
//   animation: 'slide_from_bottom',
//   animationDuration: 300,
//   presentation: 'modal',
//   gestureEnabled: true,
// });

interface RootStackNavigatorProps {
  isAuthenticated: boolean;
  handleLogin: () => void;
  handleLogout: () => Promise<void>;
  AuthStack: React.ComponentType<{ onLogin: () => void }>;
  onLogin: () => void;
}

export default function RootStackNavigator({
  isAuthenticated,
  handleLogin,
  handleLogout: _handleLogout, // Prefix with underscore to indicate intentionally unused
  AuthStack,
  onLogin: _onLogin, // Prefix with underscore to indicate intentionally unused
}: RootStackNavigatorProps) {
  const theme = useTheme();
  // Always start with OnboardingSplash and let it handle all routing decisions
  // including post_auth_redirect, completion checks, and authentication state

  // Get screen options with dynamic theme colors
  const playbookDetailOptions = getPlaybookDetailOptions(theme);

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="OnboardingSplash"
    >

      {/* PHASE 1: First Impression & Value Proposition (15%) */}
      <Stack.Screen
        name="OnboardingSplash"
        component={OnboardingSplashScreen as React.ComponentType}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TransformJourney"
        component={OnboardingTransformYourLifeScreen as React.ComponentType}
        options={splashToFirstScreenAnimation}
      />
      <Stack.Screen
        name="OnboardingWelcome"
        component={OnboardingWelcomeScreen as React.ComponentType}
        options={OnboardingAnimations.carousel}
      />

      {/* PHASE 2: Account Creation & Personalization (25%) - Available for both auth states */}
      <Stack.Screen
        name="OnboardingPersonalization"
        component={OnboardingPersonalizationScreen as React.ComponentType}
        options={OnboardingAnimations.pushFromBottom}
      />

      {/* Pre-auth screens */}
      {!isAuthenticated ? (
        <>
          <Stack.Screen
            name="Auth"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              animationDuration: 300,
              gestureEnabled: true,
            }}
          >
            {() => <AuthStack onLogin={handleLogin} />}
          </Stack.Screen>
        </>
      ) : (
        <>
          {/* PHASE 3: Challenge Selection & Playbook Generation (35%) */}

          <Stack.Screen
            name="OnboardingPlaybookGeneration"
            component={OnboardingPlaybookGenerationScreen as React.ComponentType}
            options={OnboardingAnimations.crossDissolve}
          />

          {/* NEW SIMPLIFIED ONBOARDING FLOW */}
          <Stack.Screen
            name="OnboardingPlaybookReady"
            component={OnboardingPlaybookReadyScreen as React.ComponentType}
            options={OnboardingAnimations.crossDissolve}
          />
          <Stack.Screen
            name="OnboardingSalesOffer"
            component={OnboardingSalesOfferScreen as React.ComponentType}
            options={{
              headerShown: false,
              animation: 'slide_from_bottom',
              animationDuration: 400,
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="OnboardingTrialOffer"
            component={OnboardingTrialOfferScreen as React.ComponentType}
            options={{
              headerShown: false,
              animation: 'slide_from_bottom',
              animationDuration: 400,
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="OnboardingNotificationSetup"
            component={OnboardingNotificationSetupScreen as React.ComponentType}
            options={{
              headerShown: false,
              animation: 'slide_from_bottom',
              animationDuration: 300,
            }}
          />

          {/* OLD SCREENS - KEEPING FOR NOW, WILL REMOVE LATER */}

          {/* Main App */}
          <Stack.Screen
            name="MainTabs"
            component={MainTabsScreen}
            options={{
              headerShown: false,
              animation: 'fade',
              gestureEnabled: false,
            }}
          />

          {/* UserProfile is now nested under Dashboard (HomeStackNavigator) */}
          {/* Root-level modal alias for UserProfile to guarantee modal presentation from detail screens */}
          <Stack.Screen
            name="UserProfileModal"
            component={UserProfileScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
            }}
          />

          {/* Main App Detail Screens */}
          <Stack.Screen
            name="PlaybookDetail"
            component={PlaybookDetailScreen as React.ComponentType}
            options={playbookDetailOptions}
          />
          <Stack.Screen
            name="GeneratingPlaybook"
            component={GeneratingPlaybookScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="DevotionalDetail"
            component={DevotionalDetailScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="Journal"
            component={JournalScreen as React.ComponentType}
            options={{ headerShown: true }}
          />

          {/* siFia AI Input Screen */}
          <Stack.Screen
            name="UserInput"
            component={UserInputScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />

          {/* Family Subscription Screens */}
          <Stack.Screen
            name="FamilyAdminDashboard"
            component={require('../screens/FamilyAdminDashboardScreen').default as React.ComponentType}
            options={{
              headerShown: true,
              title: 'Family Management',
              headerStyle: { backgroundColor: Colors.hopeWhite },
              headerTitleStyle: { color: Colors.anchorBlue },
              headerBackVisible: true,
            }}
          />
          <Stack.Screen
            name="FamilyInvitation"
            component={require('../screens/FamilyInvitationScreen').default as React.ComponentType}
            options={{
              headerShown: true,
              title: 'Join Family',
              headerStyle: { backgroundColor: Colors.hopeWhite },
              headerTitleStyle: { color: Colors.anchorBlue },
              headerBackVisible: true,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginLeft: 0,
    padding: 8,
    paddingLeft: 0,
  },
  profileImageContainer: {
    marginRight: 16,
    overflow: 'hidden',
    borderRadius: 16,
  },
  whiteProfileImageContainer: {
    marginRight: 16,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  initialAvatar: {
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialLetter: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.anchorBlue,
    textAlign: 'center',
    marginTop: 2,
    maxWidth: '70%',
  },
  headerStyle: {
    backgroundColor: '#f2f5f7',
  },
  headerTitleContainer: {
    width: '100%',
    paddingHorizontal: 16,
  },
  darkHeaderStyle: {
    backgroundColor: Colors.anchorBlue,
  },
});
