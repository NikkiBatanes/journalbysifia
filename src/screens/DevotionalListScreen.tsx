import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useDevotional } from '../context/DevotionalContext';
import { Devotional } from '../interfaces/devotional';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme';
import ProgressBar from '../components/ProgressBar';

type DevotionalListNavigationProp = StackNavigationProp<RootStackParamList, 'DevotionalList'>;

export default function DevotionalListScreen() {
  const navigation = useNavigation<DevotionalListNavigationProp>();
  const { devotionals, refreshDevotionals, deleteDevotional } = useDevotional();
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDevotionals = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshDevotionals();
    } catch (error) {
      console.error('Error loading devotionals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshDevotionals]);

  useEffect(() => {
    loadDevotionals();
  }, [loadDevotionals]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshDevotionals();
    } catch (error) {
      console.error('Error refreshing devotionals:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshDevotionals]);

  const handleDevotionalPress = (devotional: Devotional) => {
    navigation.navigate('DevotionalDetail', { devotionalId: devotional.id });
  };

  const handleDeleteDevotional = async (devotionalId: string) => {
    try {
      await deleteDevotional(devotionalId);
    } catch (error) {
      console.error('Error deleting devotional:', error);
    }
  };

  const renderDevotionalItem = ({ item }: { item: Devotional }) => {
    // Progress is stored as a percentage (0-100)
    const progress = item.progress / 100; // Convert to 0-1 range for ProgressBar
    const completedDays = Math.floor((item.progress / 100) * item.totalDays);
    const daysLeft = item.totalDays - completedDays;

    return (
      <TouchableOpacity
        style={styles.devotionalCard}
        onPress={() => handleDevotionalPress(item)}
      >
        <View style={styles.devotionalHeader}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteDevotional(item.id)}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.textGray} />
          </TouchableOpacity>
        </View>

        <Text style={styles.devotionalTitle}>{item.title}</Text>

        <View style={styles.progressSection}>
          <ProgressBar
            progress={progress}
            width={null}
            color={Colors.faithGold}
          />
          <View style={styles.progressTextContainer}>
            <Text style={styles.progressText}>
              {completedDays} of {item.totalDays} days completed
            </Text>
            {daysLeft > 0 && (
              <Text style={styles.daysLeftText}>
                {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
              </Text>
            )}
          </View>
        </View>

        <View style={styles.devotionalFooter}>
          <Text style={styles.dateText}>
            Created: {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color={Colors.anchorBlue} />
          <Text style={styles.emptyStateText}>Loading devotionals...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="book-outline" size={64} color={Colors.anchorBlue} />
          <Ionicons name="heart-outline" size={32} color={Colors.faithGold} style={styles.overlayIcon} />
        </View>
        <Text style={styles.emptyStateTitle}>No Devotionals Yet</Text>
        <Text style={styles.emptyStateText}>
          Create a devotional from a playbook to start your spiritual journey.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Devotionals</Text>
      </View>

      <FlatList
        data={devotionals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
        renderItem={renderDevotionalItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.anchorBlue,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  devotionalCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  devotionalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
  },
  devotionalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 16,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressText: {
    fontSize: 14,
    color: Colors.textGray,
  },
  daysLeftText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.faithGold,
  },
  devotionalFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    paddingTop: 12,
  },
  dateText: {
    fontSize: 12,
    color: Colors.textGray,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyIconContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  overlayIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textDark,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 22,
  },
});
