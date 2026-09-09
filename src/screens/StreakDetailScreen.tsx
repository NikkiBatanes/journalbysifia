// src/screens/StreakDetailScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

// Route params type (kept loose to avoid tight coupling with nav types)
interface StreakDetailParams {
  type?: 'prayer' | 'journal' | 'playbook' | string;
}

const getIcon = (type?: string) => {
  switch (type) {
    case 'prayer':
      return 'hands-pray';
    case 'journal':
      return 'notebook-edit';
    case 'playbook':
      return 'clipboard-text-play';
    default:
      return 'fire';
  }
};

const getLabel = (type?: string) => {
  switch (type) {
    case 'prayer':
      return 'Prayer Streak';
    case 'journal':
      return 'Journaling Streak';
    case 'playbook':
      return 'Playbook Streak';
    default:
      return 'Streak Details';
  }
};

const StreakDetailScreen: React.FC = () => {
  const theme = useTheme();
  const Colors = theme.colors;
  const navigation = useNavigation();
  const route = useRoute<RouteProp<Record<string, StreakDetailParams>, string>>();
  const type = route.params?.type;

  return (
    <View style={[styles.container, { backgroundColor: Colors.hopeWhite }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.anchorBlue} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: Colors.anchorBlue }]}>{getLabel(type)}</Text>
        <View style={styles.spacer} />
      </View>

      <View style={[styles.hero, { backgroundColor: Colors.anchorBlue }]}>
        <MaterialCommunityIcons name={getIcon(type)} size={40} color={Colors.hopeWhite} />
        <Text style={[styles.heroTitle, { color: Colors.hopeWhite }]}>{getLabel(type)}</Text>
        <Text style={[styles.heroSubtitle, { color: Colors.hopeWhite }]}>Detailed streak insights coming soon</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Overview</Text>
        <Text style={[styles.body, { color: Colors.anchorBlueLight }]}>This page will show your current streak, best streak, last activity date, and recent activity timeline for the selected category.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  hero: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  spacer: {
    width: 40,
  },
});

export default withErrorBoundary(StreakDetailScreen, 'StreakDetailScreen');
