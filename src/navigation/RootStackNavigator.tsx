// src/navigation/RootStackNavigator.tsx
import React, { useMemo, useCallback } from 'react';
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { TouchableOpacity, View, Image, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme';
import BottomTabNavigator from './BottomTabNavigator';
import PlaybookDetailScreen from '../screens/PlaybookDetailScreen';
import CardDetailScreen from '../screens/CardDetailScreen';
import GeneratingPlaybookScreen from '../screens/GeneratingPlaybookScreen';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';

type RootStackParamList = {
  MainTabs: undefined;
  GeneratingPlaybook: undefined;
  PlaybookDetail: undefined;
  CardDetail: undefined;
  AuthStack: undefined;
};

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
}

const ProfileImage = React.memo<ProfileImageProps>(({ containerStyle }) => (
  <View style={[styles.profileImageContainer, containerStyle]}>
    <Image
      source={{ uri: 'https://randomuser.me/api/portraits/women/44.jpg' }}
      style={styles.profileImage}
      resizeMode="cover"
    />
  </View>
));

// Memoized header components
const HeaderLeft = React.memo(({ color = Colors.anchorBlue }: { color?: string }) => {
  const navigation = useNavigation();
  const handlePress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return <BackButton onPress={handlePress} color={color} />;
});

// Header left components as functions
const renderAnchorBlueHeaderLeft = () => (
  <HeaderLeft color={Colors.anchorBlue} />
);

const renderHopeWhiteHeaderLeft = () => (
  <HeaderLeft color={Colors.hopeWhite} />
);

// Header right components as functions
// These are used in navigation options below
const renderDefaultProfileImage = () => <ProfileImage />;

const renderWhiteProfileImage = () => (
  <ProfileImage containerStyle={styles.whiteProfileImageContainer} />
);

import { useLogout } from '../context/LogoutContext';
const MainTabsScreen: React.FC = React.memo(() => {
  const onLogout = useLogout();
  return <BottomTabNavigator onLogout={onLogout} />;
});

const Stack = createNativeStackNavigator();

interface RootStackNavigatorProps {
  isAuthenticated: boolean;
  handleLogout: () => void;
  handleLogin: () => void;
  AuthStack: React.ComponentType<{ onLogin: () => void }>;
}

export default function RootStackNavigator({
  isAuthenticated,
  handleLogout,
  handleLogin,
  AuthStack,
}: RootStackNavigatorProps) {
  // Memoize screen options
  const playbookDetailOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      headerShown: true,
      title: '',
      headerBackVisible: false,
      headerLeft: renderAnchorBlueHeaderLeft,
      headerRight: renderDefaultProfileImage,
      headerStyle: styles.headerStyle,
      headerTitleAlign: 'center',
      headerTitleStyle: styles.headerTitle,
      headerTitleContainerStyle: styles.headerTitleContainer,
      headerShadowVisible: false,
    }),
    []
  );

  const cardDetailOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      headerShown: true,
      title: '',
      headerBackVisible: false,
      headerLeft: renderHopeWhiteHeaderLeft,
      headerRight: renderWhiteProfileImage,
      headerStyle: styles.darkHeaderStyle,
      headerTintColor: Colors.hopeWhite,
      headerShadowVisible: false,
    }),
    []
  );

  // Remove unused renderMainTabs since we're using component prop directly

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
