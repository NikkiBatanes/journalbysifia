import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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
export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  fallback,
}) => {
  const { isAuthenticated, loading, user } = useAuth();

  // Debug auth state changes
  console.log('🛡️ AuthGuard render:', {
    isAuthenticated,
    loading,
    hasUser: !!user,
    userId: user?.id,
  });

  // Show loading spinner while checking auth state
  if (loading) {
    console.log('⏳ AuthGuard: Showing loading state');
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
    console.log('🔒 AuthGuard: User not authenticated, showing auth screens');
    return fallback || <AuthStackNavigator onLogin={async () => {}} />;
  }

  // Render protected content if authenticated
  console.log('✅ AuthGuard: User authenticated, showing main app');
  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default AuthGuard;
