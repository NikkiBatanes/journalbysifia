// src/navigation/RootStackNavigator.tsx
import React from 'react';
import { Platform } from 'react-native';
import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
// Removed CommonActions import as we navigate directly to UserProfile
import { Colors } from '../theme/colors';

import BottomTabNavigator from './BottomTabNavigator';
import MorningFlowStackNavigator from './MorningFlowStackNavigator';
import EveningFlowStackNavigator from './EveningFlowStackNavigator';
import PlaybookDetailScreen from '../screens/PlaybookDetailGuided';
import PlaybookWalkthroughScreen from '../screens/PlaybookWalkthroughScreen';
import GeneratingPlaybookScreen from '../screens/GeneratingPlaybookScreen';
import JournalScreen from '../screens/JournalScreen';
import UserInputScreen from '../screens/UserInputScreen';
import TodaysFocusWalkthroughScreen from '../screens/TodaysFocusWalkthroughScreen';
import TomorrowInHisHandsWalkthroughScreen from '../screens/TomorrowInHisHandsWalkthroughScreen';
import TodosWalkthroughScreen from '../screens/TodosWalkthroughScreen';
import TodaysWinWalkthroughScreen from '../screens/TodaysWinWalkthroughScreen';
import PrayerJournalWalkthroughScreen from '../screens/PrayerJournalWalkthroughScreen';
import PrayersForPeopleWalkthroughScreen from '../screens/PrayersForPeopleWalkthroughScreen';
import PrayerEditorScreen from '../screens/PrayerEditorScreen';
import UnifiedPrayerSelectionScreen from '../screens/UnifiedPrayerSelectionScreen';
import StreakPlanScreen from '../screens/StreakPlanScreen';
import StreakPlanTestDashboard from '../screens/StreakPlanTestDashboard';
import ActionStepsProviderWrapper from '../context/ActionStepsProviderWrapper';
// import { useAuth } from '../context/IndustryStandardAuthContext'; // Unused after removing ProfileImage
import UserProfileScreen from '../screens/UserProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
// NotificationDebugScreen removed in Phase 1 cleanup

// New Onboarding screens
import OnboardingSplashScreen from '../screens/onboarding/OnboardingSplashScreen';
import OnboardingWelcomeScreen from '../screens/onboarding/OnboardingWelcomeScreen';
import OnboardingPlaybookGenerationScreen from '../screens/onboarding/OnboardingPlaybookGenerationScreen';
import OnboardingTransformYourLifeScreen from '../screens/onboarding/OnboardingTransformYourLifeScreen';
import OnboardingWhenToOpenSiFiaScreen from '../screens/onboarding/OnboardingWhenToOpenSiFiaScreen';
import OnboardingPostureScreen from '../screens/onboarding/OnboardingPostureScreen';
import OnboardingAccountCreationScreen from '../screens/onboarding/OnboardingAccountCreationScreen';

import OnboardingPersonalizationScreen from '../screens/onboarding/OnboardingPersonalizationScreen';

// New Simplified Onboarding Flow Screens
import OnboardingPlaybookReadyScreen from '../screens/onboarding/OnboardingPlaybookReadyScreenNew';
import OnboardingSalesOfferScreen from '../screens/onboarding/OnboardingSalesOfferScreen';
import TimeBlockEditorScreen from '../screens/TimeBlockEditorScreen';
// RE-ENABLED: Trial Offer screen for trial flow navigation
import OnboardingTrialOfferScreen from '../screens/onboarding/OnboardingTrialOfferScreen';
import OnboardingNotificationSetupScreen from '../screens/onboarding/OnboardingNotificationSetupScreen';

import { OnboardingAnimations, splashToFirstScreenAnimation } from './onboardingAnimations';

// Header Components (commented out - unused)
// interface BackButtonProps {
//   onPress: () => void;
//   color?: string;
// }

// Unused - kept for potential future use
// const BackButton = React.memo<BackButtonProps>(({ onPress, color = Colors.sage }) => (
//   <TouchableOpacity
//     onPress={() => {
//       triggerLightHaptic();
//       onPress();
//     }}
//     style={styles.backButton}
//   >
//     <Ionicons name="chevron-back" size={24} color={color} />
//   </TouchableOpacity>
// ));

// interface ProfileImageProps {
//   containerStyle?: object;
//   navigation?: any;
// }

// Unused - kept for potential future use
// const ProfileImage = React.memo<ProfileImageProps>(({ containerStyle, navigation }) => {
//   const { user } = useAuth();
//   const meta: any = (user as any)?.user_metadata || {};
//   const displayName =
//     (user as any)?.displayName ||
//     meta.full_name ||
//     [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() ||
//     (user as any)?.email ||
//     'User';
//   const initialLetter = (displayName || 'U').trim().charAt(0).toUpperCase();

//   return (
//     <TouchableOpacity
//       onPress={() => {
//         if (navigation) {
//           try {
//             navigation.navigate('UserProfileModal');
//           } catch (error) {

//           }
//         }
//       }}
//       style={[styles.profileImageContainer, containerStyle]}
//       activeOpacity={0.7}
//     >
//       {(user as any)?.user_metadata?.avatar_url ? (
//         <Image
//           source={{ uri: (user as any).user_metadata.avatar_url }}
//           style={styles.profileImage}
//           resizeMode="cover"
//         />
//       ) : (
//         <View style={[styles.profileImage, styles.initialAvatar]}>
//           <Text style={styles.initialLetter}>{initialLetter}</Text>
//         </View>
//       )}
//     </TouchableOpacity>
//   );
// });

// Memoized header components (kept for potential future use)
// const HeaderLeft = React.memo(({ color = Colors.sage, onPress }: { color?: string, onPress: () => void }) => {
//   return <BackButton onPress={onPress} color={color} />;
// });

// Header right components as functions
// const renderDefaultProfileImage = ({ navigation }: any) => <ProfileImage navigation={navigation} />;

// Unused component - commenting out to fix linting
// const DetailHeaderLeft = ({ navigation }: { navigation: any }) => (
//   <HeaderLeft
//     color={Colors.sage}
//     onPress={() => {
//       try {
//         navigation.goBack();
//       } catch (error) {
//         Logger.debug('Navigation error in DetailHeaderLeft', { component: 'RootStackNavigator', data: error });
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

// Wrap PlaybookDetailScreen with ActionStepsProvider to fix context error
const PlaybookDetailScreenWithProvider: React.FC<any> = (props) => {
  const playbook = props.route?.params?.playbook;
  const playbookId = props.route?.params?.playbookId || playbook?.id;

  return (
    <ActionStepsProviderWrapper
      initialSteps={playbook?.actionSteps || []}
      playbookId={playbookId}
    >
      <PlaybookDetailScreen {...props} />
    </ActionStepsProviderWrapper>
  );
};

// Screen options functions

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
  // Start directly with TransformJourney - navigation logic moved there
  // including post_auth_redirect, completion checks, and authentication state

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.sage },
      }}
      initialRouteName="MainTabs"
    >
      {/* Splash Screen */}
      <Stack.Screen
        name="OnboardingSplash"
        component={OnboardingSplashScreen as React.ComponentType}
        options={{ headerShown: false }}
      />

      {/* PHASE 1: First Impression & Value Proposition (15%) */}
      <Stack.Screen
        name="TransformJourney"
        component={OnboardingTransformYourLifeScreen as React.ComponentType}
        options={splashToFirstScreenAnimation}
      />
      <Stack.Screen
        name="OnboardingWhenToOpenSiFia"
        component={OnboardingWhenToOpenSiFiaScreen as React.ComponentType}
        options={OnboardingAnimations.slideFromRight}
      />
      <Stack.Screen
        name="OnboardingPosture"
        component={OnboardingPostureScreen as React.ComponentType}
        options={OnboardingAnimations.crossDissolve}
      />
      <Stack.Screen
        name="OnboardingAccountCreation"
        component={OnboardingAccountCreationScreen as React.ComponentType}
        options={OnboardingAnimations.slideFromRight}
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
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              animationDuration: 350,
              gestureEnabled: true,
              gestureDirection: 'vertical',
              contentStyle: { backgroundColor: Colors.sage },
            }}
          />
          {/* RE-ENABLED: Trial Offer screen for trial flow navigation */}
          <Stack.Screen
            name="TimeBlockEditorModal"
            component={TimeBlockEditorScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              animationDuration: 350,
              gestureEnabled: true,
              gestureDirection: 'vertical',
            }}
          />
          <Stack.Screen
            name="OnboardingTrialOffer"
            component={OnboardingTrialOfferScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: Platform.OS === 'android' ? 'transparentModal' : 'modal',
              animation: 'slide_from_bottom',
              animationDuration: 350,
              gestureEnabled: true,
              gestureDirection: 'vertical',
              contentStyle: {
                backgroundColor: Platform.OS === 'android' ? 'transparent' : Colors.sage,
              },
            }}
          />
          <Stack.Screen
            name="OnboardingNotificationSetup"
            component={OnboardingNotificationSetupScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              animationDuration: 300,
              gestureEnabled: true,
              gestureDirection: 'vertical',
            }}
          />

          {/* OLD SCREENS - KEEPING FOR NOW, WILL REMOVE LATER */}

          {/* UserProfile is now nested under Dashboard (HomeStackNavigator) */}
          {/* Root-level modal alias for UserProfile to guarantee modal presentation from detail screens */}
          <Stack.Screen
            name="UserProfileModal"
            component={UserProfileScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: Platform.OS === 'android' ? 'transparentModal' : 'modal',
              animation: Platform.OS === 'android' ? 'none' : 'slide_from_bottom',
              gestureEnabled: Platform.OS === 'android' ? false : true,
              contentStyle: Platform.OS === 'android' ? { backgroundColor: 'transparent' } : undefined,
            }}
          />

          {/* Notifications Screen */}
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: Platform.OS === 'android' ? 'transparentModal' : 'modal',
              animation: Platform.OS === 'android' ? 'none' : 'slide_from_bottom',
              gestureEnabled: true,
              contentStyle: Platform.OS === 'android' ? { backgroundColor: 'transparent' } : undefined,
            }}
          />

          {/* Admin Dashboard */}
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
            }}
          />

          {/* Main App Detail Screens */}
          <Stack.Screen
            name="PlaybookWalkthrough"
            component={PlaybookWalkthroughScreen as React.ComponentType}
            options={{
              headerShown: false,
              animation: 'fade',
              gestureEnabled: false,
              contentStyle: { backgroundColor: Colors.sage },
            }}
          />
          <Stack.Screen
            name="PlaybookDetail"
            component={PlaybookDetailScreenWithProvider as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              gestureEnabled: false,
            }}
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
            name="Journal"
            component={JournalScreen as React.ComponentType}
            options={{ headerShown: false }}
          />

          {/* Today's Focus Walkthrough */}
          <Stack.Screen
            name="TodaysFocusWalkthrough"
            component={TodaysFocusWalkthroughScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'none',
            }}
          />

          {/* Tomorrow in His Hands Walkthrough */}
          <Stack.Screen
            name="TomorrowInHisHandsWalkthrough"
            component={TomorrowInHisHandsWalkthroughScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'none',
            }}
          />

          {/* Today's Win Walkthrough */}
          <Stack.Screen
            name="TodaysWinWalkthrough"
            component={TodaysWinWalkthroughScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'none',
            }}
          />
          <Stack.Screen
            name="PrayerJournalWalkthrough"
            component={PrayerJournalWalkthroughScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'none',
            }}
          />

          {/* Unified Prayer Selection Screen */}
          <Stack.Screen
            name="UnifiedPrayerSelection"
            component={UnifiedPrayerSelectionScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'none',
            }}
          />

          {/* Prayers for People Walkthrough */}
          <Stack.Screen
            name="PrayersForPeopleWalkthrough"
            component={PrayersForPeopleWalkthroughScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'none',
            }}
          />

          {/* Prayer Editor Screen */}
          <Stack.Screen
            name="PrayerEditor"
            component={PrayerEditorScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
            }}
          />

          {/* Todos Walkthrough */}
          <Stack.Screen
            name="TodosWalkthrough"
            component={TodosWalkthroughScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'none',
            }}
          />

          {/* siFia AI Input Screen */}
          <Stack.Screen
            name="UserInput"
            component={UserInputScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'fade',
              contentStyle: { backgroundColor: Colors.sage },
            }}
          />

          {/* Morning Flow - multi-page morning check-in modal */}
          <Stack.Screen
            name="MorningFlow"
            component={MorningFlowStackNavigator as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              gestureEnabled: false,
              contentStyle: { backgroundColor: Colors.sage },
            }}
          />

          {/* Evening Flow - multi-page evening reflection modal */}
          <Stack.Screen
            name="EveningFlow"
            component={EveningFlowStackNavigator as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              gestureEnabled: false,
              contentStyle: { backgroundColor: Colors.sage },
            }}
          />

          {/* Streak Plan Screen - shown after completing playbook walkthrough */}
          <Stack.Screen
            name="StreakPlan"
            component={StreakPlanScreen as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
              gestureEnabled: false,
              contentStyle: { backgroundColor: Colors.sage },
            }}
          />

          {/* Streak Plan Test Dashboard - for testing all variations */}
          <Stack.Screen
            name="StreakPlanTestDashboard"
            component={StreakPlanTestDashboard as React.ComponentType}
            options={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.sage },
            }}
          />

          {/* POST-LAUNCH: Family Subscription Screens */}
          {/*
          <Stack.Screen
            name="FamilyAdminDashboard"
            component={require('../screens/FamilyAdminDashboardScreen').default as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              gestureDirection: 'vertical',
            }}
          />
          <Stack.Screen
            name="FamilyInvitation"
            component={require('../screens/FamilyInvitationScreen').default as React.ComponentType}
            options={{
              headerShown: false,
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              gestureDirection: 'vertical',
            }}
          />
          */}
        </>
      )}
    </Stack.Navigator>
  );
}

// Styles commented out - unused after removing header components
// const styles = StyleSheet.create({
//   backButton: {
//     marginLeft: 0,
//     padding: 8,
//     paddingLeft: 0,
//   },
//   profileImageContainer: {
//     marginRight: 16,
//     overflow: 'hidden',
//     borderRadius: 16,
//   },
//   whiteProfileImageContainer: {
//     marginRight: 16,
//     overflow: 'hidden',
//     borderRadius: 16,
//     borderWidth: 1,
//     borderColor: 'rgba(255,255,255,0.3)',
//   },
//   profileImage: {
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//   },
//   initialAvatar: {
//     backgroundColor: Colors.alertCoral,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   initialLetter: {
//     color: Colors.hopeWhite,
//     fontSize: 14,
//     fontWeight: '700',
//   },
//   headerTitle: {
//     fontSize: 18,
//     fontWeight: '800',
//     color: Colors.sage,
//     textAlign: 'center',
//     marginTop: 2,
//     maxWidth: '70%',
//   },
//   headerStyle: {
//     backgroundColor: '#FFFEFA',
//   },
//   headerTitleContainer: {
//     width: '100%',
//     paddingHorizontal: 16,
//   },
//   darkHeaderStyle: {
//     backgroundColor: Colors.sage,
//   },
// });
