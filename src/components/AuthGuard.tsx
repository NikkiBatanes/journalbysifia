import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
// import { NavigationContainer } from '@react-navigation/native'; // Unused
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Colors } from '../theme/colors';
import AuthStackNavigator from '../navigation/AuthStackNavigator';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Industry-standard AuthGuard component
 * Protects routes and ensures only authenticated users can access protected content
 */
export const AuthGuard = ({
  children,
  fallback,
}: AuthGuardProps) => {
  const { isAuthenticated, loading } = useAuth();

  // Debug auth state changes

  // Show loading spinner while checking auth state
  if (loading) {

    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={Colors.anchorBlue}
          testID="auth-loading-indicator"
        />
      </View>
    );
  }

  // Show auth screens if not authenticated
  if (!isAuthenticated) {

    return fallback || <AuthStackNavigator onLogin={async () => {}} />;
  }

  // Render protected content if authenticated

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFEFA',
  },
});

export default AuthGuard;
