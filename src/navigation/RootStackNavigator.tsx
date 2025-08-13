// src/navigation/RootStackNavigator.tsx
import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { TouchableOpacity, View, Image, StyleSheet } from 'react-native';
// Removed CommonActions import as we navigate directly to UserProfile


import { Colors } from '../theme';
import BottomTabNavigator from './BottomTabNavigator';
import PlaybookDetailScreen from '../screens/PlaybookDetailScreenNew';
import CardDetailScreen from '../screens/CardDetailScreen';
import GeneratingPlaybookScreen from '../screens/GeneratingPlaybookScreen';
import DevotionalDetailScreen from '../screens/DevotionalDetailScreen';
import JournalScreen from '../screens/JournalScreen';
import UserInputScreen from '../screens/UserInputScreen';
import { useAuth } from '../context/IndustryStandardAuthContext';



// New Onboarding screens
import OnboardingSplashScreen from '../screens/onboarding/OnboardingSplashScreen';
import OnboardingWelcomeScreen from '../screens/onboarding/OnboardingWelcomeScreen';
import OnboardingPlaybookGenerationScreen from '../screens/onboarding/OnboardingPlaybookGenerationScreen';
import OnboardingTransformYourLifeScreen from '../screens/onboarding/OnboardingTransformYourLifeScreen';
import OnboardingPlaybookNavigationScreen from '../screens/onboarding/OnboardingPlaybookNavigationScreen';


import OnboardingPersonalizationScreen from '../screens/onboarding/OnboardingPersonalizationScreen';
import OnboardingPricingShowcaseScreen from '../screens/onboarding/OnboardingPricingShowcaseScreen';


import OnboardingCompleteScreen from '../screens/onboarding/OnboardingCompleteScreen';

// New Simplified Onboarding Flow Screens
import OnboardingPlaybookReadyScreen from '../screens/onboarding/OnboardingPlaybookReadyScreenNew';
import OnboardingSalesOfferScreen from '../screens/onboarding/OnboardingSalesOfferScreen';
import OnboardingTrialOfferScreen from '../screens/onboarding/OnboardingTrialOfferScreen';
import OnboardingPaymentProcessingScreen from '../screens/onboarding/OnboardingPaymentProcessingScreen';
import OnboardingPaymentConfirmationScreen from '../screens/onboarding/OnboardingPaymentConfirmationScreen';
import OnboardingNotificationSetupScreen from '../screens/onboarding/OnboardingNotificationSetupScreen';

import { OnboardingAnimations, splashToFirstScreenAnimation } from './onboardingAnimations';


// Header Components
interface BackButtonProps {
  onPress: () => void;
  color?: string;
}

const BackButton = React.memo<BackButtonProps>(({ onPress, color = Colors.anchorBlue }) => (
  <TouchableOpacity onPress={onPress} style={styles.backButton}>
    <Ionicons name="chevron-back" size={24} color={color} />
  </TouchableOpacity>
));

interface ProfileImageProps {
  containerStyle?: object;
  navigation?: any;
}

const ProfileImage = React.memo<ProfileImageProps>(({ containerStyle, navigation }) => {
  const { user } = useAuth();

  return (
    <TouchableOpacity
      onPress={() => {
        if (navigation) {
          try {
            navigation.navigate('MainTabs', {
              screen: 'Dashboard',
              params: {
                screen: 'UserProfile',
              },
            });
          } catch (error) {
            console.log('Navigation to nested UserProfile failed:', error);
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
        <View style={[styles.profileImage, styles.defaultProfileImage]}>
          <Ionicons name="person" size={16} color="#fff" />
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

const renderWhiteProfileImage = ({ navigation }: any) => (
  <ProfileImage containerStyle={styles.whiteProfileImageContainer} navigation={navigation} />
);

// Header left components for different screens
const PlaybookHeaderLeft = React.memo(({ navigation }: { navigation: any }) => (
  <HeaderLeft
    color={Colors.anchorBlue}
    onPress={() => {
      try {
        navigation.goBack();
      } catch (error) {
        console.log('Navigation error in PlaybookHeaderLeft:', error);
      }
    }}
  />
));

const CardHeaderLeft = React.memo(({ navigation }: { navigation: any }) => (
  <HeaderLeft
    color={Colors.hopeWhite}
    onPress={() => {
      try {
        navigation.goBack();
      } catch (error) {
        console.log('Navigation error in CardHeaderLeft:', error);
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
const getPlaybookDetailOptions = (): NativeStackNavigationOptions => ({
  headerShown: false, // Hide native header so screen controls z-order
  title: '',
  headerBackVisible: false,
  // Keep the rest in case we toggle header back in future
  headerLeft: ({ navigation }: any) => <PlaybookHeaderLeft navigation={navigation} />,
  headerRight: ({ navigation }: any) => renderDefaultProfileImage({ navigation }),
  headerStyle: styles.headerStyle,
  headerTitleAlign: 'center' as const,
  headerTitleStyle: styles.headerTitle,
  headerShadowVisible: false,
});

const getCardDetailOptions = (): NativeStackNavigationOptions => ({
  headerShown: true,
  title: '',
  headerBackVisible: false,
  headerLeft: ({ navigation }: any) => <CardHeaderLeft navigation={navigation} />,
  headerRight: ({ navigation }: any) => renderWhiteProfileImage({ navigation }),
  headerStyle: styles.darkHeaderStyle,
  headerTintColor: Colors.hopeWhite,
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
  // Always start with OnboardingSplash and let it handle all routing decisions
  // including post_auth_redirect, completion checks, and authentication state

  // Get screen options
  const playbookDetailOptions = getPlaybookDetailOptions();
  const cardDetailOptions = getCardDetailOptions();

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
          <Stack.Screen name="Auth">{() => <AuthStack onLogin={handleLogin} />}</Stack.Screen>
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
            options={OnboardingAnimations.pushFromBottom}
          />
          <Stack.Screen
            name="OnboardingTrialOffer"
            component={OnboardingTrialOfferScreen as React.ComponentType}
            options={OnboardingAnimations.pushFromBottom}
          />
          <Stack.Screen
            name="OnboardingPaymentProcessing"
            component={OnboardingPaymentProcessingScreen as React.ComponentType}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="OnboardingPaymentConfirmation"
            component={OnboardingPaymentConfirmationScreen as React.ComponentType}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="OnboardingNotificationSetup"
            component={OnboardingNotificationSetupScreen as React.ComponentType}
            options={{ headerShown: false }}
          />

          {/* OLD SCREENS - KEEPING FOR NOW, WILL REMOVE LATER */}
          <Stack.Screen
            name="OnboardingPlaybookNavigation"
            component={OnboardingPlaybookNavigationScreen as React.ComponentType}
            options={OnboardingAnimations.smoothSlide}
          />


          <Stack.Screen
            name="OnboardingPricingShowcase"
            component={OnboardingPricingShowcaseScreen as React.ComponentType}
            options={OnboardingAnimations.pushFromBottom}
          />
          <Stack.Screen
            name="OnboardingComplete"
            component={OnboardingCompleteScreen as React.ComponentType}
            options={OnboardingAnimations.crossDissolve}
          />

          {/* Main App */}
          <Stack.Screen
            name="MainTabs"
            component={MainTabsScreen as React.ComponentType}
            options={{ headerShown: false }}
          />

          {/* UserProfile is now nested under Dashboard (HomeStackNavigator) */}

          {/* Main App Detail Screens */}
          <Stack.Screen
            name="PlaybookDetail"
            component={PlaybookDetailScreen as React.ComponentType}
            options={playbookDetailOptions}
          />
          <Stack.Screen
            name="CardDetail"
            component={CardDetailScreen as React.ComponentType}
            options={cardDetailOptions}
          />
          <Stack.Screen
            name="GeneratingPlaybook"
            component={GeneratingPlaybookScreen as React.ComponentType}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="DevotionalDetail"
            component={DevotionalDetailScreen as React.ComponentType}
            options={{ headerShown: true }}
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
  defaultProfileImage: {
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
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
