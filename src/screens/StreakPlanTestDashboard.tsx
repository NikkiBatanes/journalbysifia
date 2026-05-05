/**
 * StreakPlanTestDashboard.tsx
 * Dashboard to test all StreakPlanScreen variations
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';

const StreakPlanTestDashboard: React.FC = () => {
  const navigation = useNavigation();

  const testCases = [
    {
      title: 'Playbook Streak Source',
      description: 'Primary: Done | Secondary: Process Another Moment',
      params: { source: 'playbook' },
    },
    {
      title: 'Onboarding Flow',
      description: 'Primary: Continue My Journey | Secondary: None',
      params: { onboarding: true },
    },
    {
      title: 'Everything Else',
      description: 'Primary: Done | Secondary: None',
      params: {},
    },
  ];

  const navigateToStreakPlan = (params: any) => {
    (navigation as any).navigate('StreakPlan', params);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>StreakPlan Test Dashboard</Text>
        <Text style={styles.headerSubtitle}>Test all button variations</Text>
      </View>

      <ScrollView style={styles.scrollContent}>
        {testCases.map((testCase, index) => (
          <TouchableOpacity
            key={index}
            style={styles.testCaseCard}
            onPress={() => navigateToStreakPlan(testCase.params)}
            activeOpacity={0.7}
          >
            <Text style={styles.testCaseTitle}>{testCase.title}</Text>
            <Text style={styles.testCaseDescription}>{testCase.description}</Text>
            <View style={styles.paramsContainer}>
              <Text style={styles.paramsLabel}>Params:</Text>
              <Text style={styles.paramsText}>{JSON.stringify(testCase.params, null, 2)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  testCaseCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  testCaseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  testCaseDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
    lineHeight: 20,
  },
  paramsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
  },
  paramsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.alertCoral,
    marginBottom: 4,
  },
  paramsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'monospace',
  },
});

export default StreakPlanTestDashboard;
