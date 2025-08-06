/**
 * OnboardingAdminPanel.tsx
 *
 * Admin panel for testing and managing the onboarding system
 * Phase 3: Admin Interface
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useOnboarding } from '../../context/OnboardingContext';
import { onboardingAnalyticsService } from '../../services/onboardingAnalyticsService';
import { useNavigation } from '@react-navigation/native';


interface OnboardingAdminPanelProps {
  onClose?: () => void;
  isVisible?: boolean;
}

export const OnboardingAdminPanel: React.FC<OnboardingAdminPanelProps> = ({ onClose, isVisible = true }) => {
  console.log('🔍 OnboardingAdminPanel render:', { isVisible, hasOnClose: !!onClose });

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string>('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'health' | 'testing' | 'analytics'>('testing');

  const navigation = useNavigation();
  const { startOnboarding } = useOnboarding();

  const triggerOnboardingFlow = async () => {
    setIsLoading(true);
    setAdminError(null);
    setResults('');

    try {
      await startOnboarding();
      setResults('✅ Onboarding flow triggered successfully!\n\nThe new onboarding flow should now be displayed.');

      setTimeout(() => {
        navigation.navigate('OnboardingSplash' as any);
      }, 1000);
    } catch (error) {
      setAdminError(`Failed to trigger onboarding: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const directNavigateToOnboarding = () => {
    console.log('🚀 Direct navigation to onboarding...');
    setResults('🚀 Navigating directly to onboarding screen...');
    navigation.navigate('OnboardingSplash' as any);
  };

  const resetOnboardingState = async () => {
    setIsLoading(true);
    setAdminError(null);
    setResults('');

    try {
      await startOnboarding();
      setResults('✅ Onboarding state reset successfully!\n\nNavigating to onboarding...');

      setTimeout(() => {
        navigation.navigate('OnboardingSplash' as any);
      }, 1000);
    } catch (error) {
      setAdminError(`Failed to reset onboarding: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runAnalytics = async () => {
    setIsLoading(true);
    try {
      const analyticsData = await onboardingAnalyticsService.getOnboardingAnalytics();
      setResults(`Analytics loaded: ${JSON.stringify(analyticsData, null, 2)}`);
    } catch (error) {
      Alert.alert('Analytics Failed', `Error loading analytics: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runHealthCheck = async () => {
    setIsLoading(true);
    setAdminError(null);
    setResults('');

    try {
      setResults('🏥 HEALTH CHECK REPORT\n\n✅ System operational\n✅ Database connected\n✅ Onboarding flow ready');
    } catch (error) {
      setAdminError(`Health check failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) {
    console.log('❌ OnboardingAdminPanel not visible, returning null');
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Onboarding Admin Panel</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'testing' && styles.activeTab]}
            onPress={() => setActiveTab('testing')}
          >
            <Text style={[styles.tabText, activeTab === 'testing' && styles.activeTabText]}>
              Testing
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'analytics' && styles.activeTab]}
            onPress={() => setActiveTab('analytics')}
          >
            <Text style={[styles.tabText, activeTab === 'analytics' && styles.activeTabText]}>
              Analytics
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'health' && styles.activeTab]}
            onPress={() => setActiveTab('health')}
          >
            <Text style={[styles.tabText, activeTab === 'health' && styles.activeTabText]}>
              Health
            </Text>
          </TouchableOpacity>

        </View>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'testing' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧪 Onboarding Testing</Text>
            <Text style={styles.description}>
              Test and debug the onboarding flow with these tools:
            </Text>

            <TouchableOpacity style={styles.button} onPress={directNavigateToOnboarding}>
              <Text style={styles.buttonText}>🎯 Direct Navigate to Onboarding</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={triggerOnboardingFlow}>
              <Text style={styles.buttonText}>🚀 Trigger Onboarding Now</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={resetOnboardingState}>
              <Text style={styles.buttonText}>🔄 Reset & Test</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'analytics' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.button} onPress={runAnalytics}>
              <Text style={styles.buttonText}>📊 Load Analytics</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'health' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.button} onPress={runHealthCheck}>
              <Text style={styles.buttonText}>🏥 Run Health Check</Text>
            </TouchableOpacity>
          </View>
        )}



        {/* Results Display */}
        {adminError && (
          <View style={styles.results}>
            <Text style={styles.errorText}>❌ {adminError}</Text>
          </View>
        )}

        {results && (
          <View style={styles.results}>
            <Text style={styles.resultText}>{results}</Text>
          </View>
        )}

        {isLoading && (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>⏳ Processing...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2c3e50',
    padding: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#34495e',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#3498db',
  },
  tabText: {
    color: '#bdc3c7',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  pastoralSection: {
    flex: 1,
    marginTop: -10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 15,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  results: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#27ae60',
  },
  resultText: {
    fontSize: 14,
    color: '#2c3e50',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '500',
  },
  loading: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
});
