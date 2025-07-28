// src/navigation/RootStackNavigator.tsx
import React from 'react';
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { TouchableOpacity, View, Image, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { CommonActions } from '@react-navigation/native';
import { Colors } from '../theme';
import BottomTabNavigator from './BottomTabNavigator';
import PlaybookDetailScreen from '../screens/PlaybookDetailScreenNew';
import CardDetailScreen from '../screens/CardDetailScreen';
import GeneratingPlaybookScreen from '../screens/GeneratingPlaybookScreen';
import DevotionalDetailScreen from '../screens/DevotionalDetailScreen';
import { useAuth } from '../context/IndustryStandardAuthContext';


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
        console.log('Profile image pressed');
        if (navigation) {
          console.log('Navigation object exists');
          try {
            // Use CommonActions to reset navigation stack and go to Profile tab
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: 'MainTabs',
                    state: {
                      routes: [
                        { name: 'Home' },
                        { name: 'Playbooks' },
                        { name: 'Devotionals' },
                        { name: 'Profile' },
                      ],
                      index: 3, // Profile tab index
                    },
                  },
                ],
              })
            );
            console.log('Navigation dispatch successful');
          } catch (error) {
            console.log('Navigation error:', error);
            // Fallback: just navigate to MainTabs
            try {
              navigation.navigate('MainTabs');
              console.log('Fallback navigation successful');
            } catch (fallbackError) {
              console.log('Fallback navigation error:', fallbackError);
            }
          }
        } else {
          console.log('Navigation object is null/undefined');
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

const DevotionalHeaderLeft = React.memo(({ navigation }: { navigation: any }) => (
  <HeaderLeft
    color={Colors.anchorBlue}
    onPress={() => {
      try {
        navigation.goBack();
      } catch (error) {
        console.log('Navigation error in DevotionalHeaderLeft:', error);
      }
    }}
  />
));

import { useLogout } from '../context/LogoutContext';
const MainTabsScreen: React.FC = React.memo(() => {
  const onLogout = useLogout();
  return <BottomTabNavigator onLogout={onLogout} />;
});

const Stack = createNativeStackNavigator();

// Screen options functions
const getPlaybookDetailOptions = (): NativeStackNavigationOptions => ({
  headerShown: true,
  title: '',
  headerBackVisible: false,
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

const getDevotionalDetailOptions = ({ navigation }: any): NativeStackNavigationOptions => ({
  title: '',
  headerBackVisible: true,
  headerLeft: () => <DevotionalHeaderLeft navigation={navigation} />,
  animation: 'slide_from_bottom',
  animationDuration: 300,
  presentation: 'modal',
  gestureEnabled: true,
});

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
  // Get screen options
  const playbookDetailOptions = getPlaybookDetailOptions();
  const cardDetailOptions = getCardDetailOptions();



  // Removed unused devotionalListOptions

  // Note: renderMainTabs was removed since we're using component prop directly

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabsScreen}
          />
          <Stack.Screen
            name="GeneratingPlaybook"
            component={GeneratingPlaybookScreen as React.ComponentType}
          />
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
            name="DevotionalDetail"
            component={DevotionalDetailScreen as unknown as React.ComponentType}
            options={({ navigation }) => getDevotionalDetailOptions({ navigation })}
          />
        </>
      ) : (
        <Stack.Screen name="AuthStack">
          {() => <AuthStack onLogin={handleLogin} />}
        </Stack.Screen>
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
