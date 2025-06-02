import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Colors } from '../theme';
import ProgressBar from '../components/ProgressBar'; // adjust import path as necessary
import ToggleIcons from '../components/ToggleIcons'; // adjust import path as necessary

// Define the expected params for this screen
// Adjust type as needed based on your navigation setup
// Example:
type CardDetailScreenRouteProp = RouteProp<
  { params: { card: { truth: string; summary: string; username?: string; index: number; total: number } } },
  'params'
>;

export default function CardDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<CardDetailScreenRouteProp>();
  const { card } = route.params;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Truth in Love</Text>
      </View>

      {/* Progress bar and toggle icons */}
      <View style={styles.topBar}>
        <ProgressBar progress={(card.index + 1) / card.total} />
        <ToggleIcons />
      </View>

      {/* Card full content */}
      <View style={styles.cardContainer}>
        <Text style={styles.username}>{card.username || 'Nikki'}</Text>
        <Text style={styles.summary}>{card.summary}</Text>
        <Text style={styles.truth}>{card.truth}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  cardContainer: {
    backgroundColor: Colors.faithGold,
    borderRadius: 16,
    padding: 24,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  username: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  summary: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: Colors.hopeWhite,
    marginBottom: 12,
  },
  truth: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: Colors.hopeWhite,
    lineHeight: 24,
  },
});
