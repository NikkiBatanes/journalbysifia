// =====================================================
// SIMPLE APP INTEGRATION EXAMPLE
// =====================================================
// Copy this pattern into your existing App.tsx

import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Your existing imports
// import { AuthProvider } from './context/AuthContext';
// import { YourMainNavigator } from './navigation/YourMainNavigator';

// New trial system imports
import { SimpleTrialBanner } from './components/SimpleTrialBanner';

// Create a query client for React Query (if you don't have one)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Mock auth hook - replace with your actual auth hook
const useAuth = () => ({
  user: { id: 'user123' }, // Replace with your actual user object
  isAuthenticated: true,
});

export default function App() {
  const { user, isAuthenticated } = useAuth(); // Your existing auth hook

  return (
    <QueryClientProvider client={queryClient}>
      {/* Your existing providers */}
      {/* <AuthProvider> */}
        <SafeAreaView style={styles.container}>
          
          {/* Add trial banner at the top */}
          {isAuthenticated && (
            <SimpleTrialBanner 
              userId={user?.id}
              onUpgradePress={() => {
                // Navigate to your subscription/pricing screen
                console.log('Navigate to subscription screen');
                // navigation.navigate('Subscription');
              }}
            />
          )}
          
          {/* Your existing app content */}
          <View style={styles.content}>
            {/* <YourMainNavigator /> */}
            
            {/* Placeholder for your existing app */}
            <View style={styles.placeholder}>
              {/* Your existing app components go here */}
            </View>
          </View>
          
        </SafeAreaView>
      {/* </AuthProvider> */}
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// =====================================================
// EXAMPLE SCREEN INTEGRATION
// =====================================================

import { useSimpleTrialAccess } from './hooks/useSimpleTrialAccess';
import { SimpleFeatureLock, UpgradeModal } from './components/SimpleFeatureLock';

export const ExampleJournalingScreen = () => {
  const { user } = useAuth(); // Your existing auth hook
  const { featureAccess, checkCanGenerate } = useSimpleTrialAccess(user?.id);
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);

  const handleSmartJournaling = async () => {
    if (!featureAccess.smartJournalingEnabled) {
      setShowUpgradeModal(true);
      return;
    }
    
    // Proceed with smart journaling
    console.log('Starting smart journaling...');
  };

  const handleGeneratePlaybook = async () => {
    const { canGenerate, reason } = await checkCanGenerate('playbook');
    
    if (!canGenerate) {
      setShowUpgradeModal(true);
      return;
    }
    
    // Proceed with playbook generation
    console.log('Generating playbook...');
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      
      {/* Free feature - always available */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Journaling</Text>
        <TouchableOpacity style={styles.button}>
          <Text>Start Free Journal Entry</Text>
        </TouchableOpacity>
      </View>

      {/* Premium feature - locked after trial */}
      <SimpleFeatureLock
        isLocked={!featureAccess.smartJournalingEnabled}
        feature="smartJournaling"
        onUpgradePress={() => setShowUpgradeModal(true)}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Smart Journaling (Premium)</Text>
          <TouchableOpacity 
            style={styles.premiumButton}
            onPress={handleSmartJournaling}
          >
            <Text>Start AI-Guided Journal</Text>
          </TouchableOpacity>
        </View>
      </SimpleFeatureLock>

      {/* Content generation with limits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Generate Playbook</Text>
        <Text style={styles.limitText}>
          Remaining: {featureAccess.playbooksRemaining}
        </Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={handleGeneratePlaybook}
        >
          <Text>Generate Spiritual Playbook</Text>
        </TouchableOpacity>
      </View>

      {/* Upgrade modal */}
      <UpgradeModal
        visible={showUpgradeModal}
        feature="smartJournaling"
        onClose={() => setShowUpgradeModal(false)}
        onUpgradePress={() => {
          setShowUpgradeModal(false);
          // Navigate to subscription screen
          console.log('Navigate to subscription');
        }}
      />
      
    </View>
  );
};

const screenStyles = StyleSheet.create({
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#6B46C1',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  premiumButton: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  limitText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
});
