// src/components/InfiniteQueryDemo.tsx

/**
 * Demo component showcasing the new infinite query capabilities
 * This demonstrates Phase 2 industry-standard data management features
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  useSimpleInfiniteQuery,
  useInfiniteScrollUtils,
  useInfiniteScrollHandler,
  useSearchFilter,
} from '../services/hooks/useSimpleInfiniteQueries';

// Mock data generator for demonstration
const generateMockData = (count: number = 100) => {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `Item ${index + 1}`,
    description: `This is a description for item ${index + 1}. It contains sample text for testing search functionality.`,
    type: ['journal', 'prayer', 'reflection'][index % 3],
    created_at: new Date(Date.now() - index * 86400000).toISOString(),
  }));
};

interface InfiniteQueryDemoProps {
  title?: string;
}

export const InfiniteQueryDemo: React.FC<InfiniteQueryDemoProps> = ({
  title = 'Infinite Query Demo',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { searchInData } = useSearchFilter();
  const { flattenInfiniteData, getTotalCount } = useInfiniteScrollUtils();

  // Mock API call that returns our generated data
  const fetchMockData = async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateMockData(100);
  };

  // Use the simplified infinite query hook
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useSimpleInfiniteQuery(
    ['demo-data', searchTerm],
    fetchMockData,
    {
      pageSize: 10,
      enabled: true,
    }
  );

  // Get flattened data and apply search filter
  const allData = flattenInfiniteData(data);
  const filteredData = searchInData(allData, searchTerm, ['title', 'description']);
  const totalCount = getTotalCount(data);

  // Infinite scroll handler
  const scrollHandler = useInfiniteScrollHandler(
    fetchNextPage,
    hasNextPage || false,
    isFetchingNextPage
  );

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) }]}>
          <Text style={styles.typeText}>{item.type}</Text>
        </View>
      </View>
      <Text style={styles.itemDescription}>{item.description}</Text>
      <Text style={styles.itemDate}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </View>
  );

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'journal': return Colors.anchorBlue;
      case 'prayer': return Colors.faithGold;
      case 'reflection': return Colors.growthGreen;
      default: return Colors.textGray;
    }
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) {return null;}
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.anchorBlue} />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        Showing {filteredData.length} of {totalCount} items
        {searchTerm ? ` (filtered by "${searchTerm}")` : ''}
      </Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search items..."
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholderTextColor={Colors.textGray}
      />

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => refetch()}
          disabled={isRefetching}
        >
          <Text style={styles.actionButtonText}>
            {isRefetching ? 'Refreshing...' : 'Refresh'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => setSearchTerm('')}
        >
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
            Clear Search
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.anchorBlue} />
        <Text style={styles.loadingText}>Loading data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading data</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={(item: any) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        onEndReached={scrollHandler.onEndReached}
        onEndReachedThreshold={scrollHandler.onEndReachedThreshold}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={[Colors.anchorBlue]}
            tintColor={Colors.anchorBlue}
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  listContainer: {
    paddingBottom: 20,
  },
  header: {
    padding: 16,
    backgroundColor: Colors.hopeWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textGray,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: Colors.lightGray,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.anchorBlue,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: Colors.anchorBlue,
  },
  itemContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkGray,
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  typeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  itemDescription: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
    marginBottom: 8,
  },
  itemDate: {
    fontSize: 12,
    color: Colors.textGray,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  footerText: {
    color: Colors.textGray,
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textGray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.hopeWhite,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.alertCoral,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
