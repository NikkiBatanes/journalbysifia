import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme';
import { Typography } from '../theme/typography';
import { insightBookmarkService, BookmarkedInsight } from '../services/insightBookmarkService';
import { useAuth } from '../contexts/AuthContext';

interface BookmarkedInsightsScreenProps {
  navigation: any;
}

export const BookmarkedInsightsScreen: React.FC<BookmarkedInsightsScreenProps> = ({
  navigation,
}) => {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkedInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    if (!user?.id) {return;}

    try {
      setLoading(true);
      const filterType = selectedFilter === 'all' ? undefined : selectedFilter;
      const data = await insightBookmarkService.getUserBookmarks(user.id, filterType);
      setBookmarks(data);
    } catch (error) {
      console.error('[BookmarkedInsightsScreen] Error loading bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBookmarks();
    setRefreshing(false);
  };

  const handleRemoveBookmark = (bookmarkId: string, playbookTitle: string) => {
    Alert.alert(
      'Remove Bookmark',
      `Remove this saved insight from "${playbookTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await insightBookmarkService.removeBookmark(bookmarkId);
              setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
            } catch (error) {
              console.error('[BookmarkedInsightsScreen] Error removing bookmark:', error);
              Alert.alert('Error', 'Failed to remove bookmark. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getCardTypeIcon = (cardType: string): string => {
    switch (cardType) {
      case 'truth': return 'bulb-outline';
      case 'action': return 'checkmark-circle-outline';
      case 'affirmation': return 'heart-outline';
      case 'bible': return 'book-outline';
      case 'challenge': return 'arrow-up-circle-outline';
      default: return 'information-circle-outline';
    }
  };

  const getCardTypeColor = (cardType: string): string => {
    switch (cardType) {
      case 'truth': return Colors.faithGold;
      case 'action': return '#4CAF50';
      case 'affirmation': return '#E91E63';
      case 'bible': return '#9C27B0';
      case 'challenge': return '#FF5722';
      default: return Colors.faithGold;
    }
  };

  const filterOptions = [
    { key: 'all', label: 'All Insights' },
    { key: 'truth', label: 'Truth' },
    { key: 'action', label: 'Action' },
    { key: 'affirmation', label: 'Affirmation' },
    { key: 'bible', label: 'Bible' },
    { key: 'challenge', label: 'Challenge' },
  ];

  const filteredBookmarks = selectedFilter === 'all'
    ? bookmarks
    : bookmarks.filter(b => b.cardType === selectedFilter);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.faithGold} />
          <Text style={styles.loadingText}>Loading your saved insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Insights</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {filterOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.filterTab,
              selectedFilter === option.key && styles.filterTabActive,
            ]}
            onPress={() => {
              setSelectedFilter(option.key);
              loadBookmarks();
            }}
          >
            <Text style={[
              styles.filterTabText,
              selectedFilter === option.key && styles.filterTabTextActive,
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bookmarks List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.faithGold}
          />
        }
      >
        {filteredBookmarks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="bookmark-outline" size={48} color="rgba(255, 255, 255, 0.3)" />
            <Text style={styles.emptyTitle}>No Saved Insights</Text>
            <Text style={styles.emptySubtitle}>
              {selectedFilter === 'all'
                ? 'Start exploring your playbooks and save meaningful insights!'
                : `No saved ${selectedFilter} insights yet.`
              }
            </Text>
          </View>
        ) : (
          filteredBookmarks.map((bookmark) => (
            <View key={bookmark.id} style={styles.bookmarkCard}>
              {/* Card Header */}
              <View style={styles.bookmarkHeader}>
                <View style={styles.cardTypeContainer}>
                  <Icon
                    name={getCardTypeIcon(bookmark.cardType)}
                    size={16}
                    color={getCardTypeColor(bookmark.cardType)}
                  />
                  <Text style={[styles.cardTypeText, { color: getCardTypeColor(bookmark.cardType) }]}>
                    {bookmark.cardType.toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveBookmark(bookmark.id, bookmark.playbookTitle)}
                >
                  <Icon name="trash-outline" size={16} color="rgba(255, 255, 255, 0.5)" />
                </TouchableOpacity>
              </View>

              {/* Playbook Context */}
              <Text style={styles.playbookTitle}>From: {bookmark.playbookTitle}</Text>

              {/* Original Card Content */}
              <View style={styles.originalContentContainer}>
                <Text style={styles.originalContentLabel}>Original Content:</Text>
                <Text style={styles.originalContentText}>{bookmark.cardContent}</Text>
              </View>

              {/* AI Insight */}
              <View style={styles.insightContainer}>
                <Text style={styles.insightLabel}>Saved Insight:</Text>
                <Text style={styles.insightText}>{bookmark.aiInsight}</Text>
              </View>

              {/* Metadata */}
              <View style={styles.metadataContainer}>
                <Text style={styles.timestampText}>
                  Saved {new Date(bookmark.bookmarkedAt).toLocaleDateString()}
                </Text>
                {bookmark.tags && bookmark.tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {bookmark.tags.slice(0, 3).map((tag, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: Colors.darkBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.interRegular,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    ...Typography.interSemiBold,
    fontSize: 18,
    color: Colors.hopeWhite,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  filterContainer: {
    maxHeight: 50,
  },
  filterContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterTabActive: {
    backgroundColor: Colors.faithGold,
  },
  filterTabText: {
    ...Typography.interRegular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  filterTabTextActive: {
    color: Colors.darkBackground,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    ...Typography.interSemiBold,
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  bookmarkCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bookmarkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTypeText: {
    ...Typography.interSemiBold,
    fontSize: 12,
    marginLeft: 6,
  },
  removeButton: {
    padding: 8,
  },
  playbookTitle: {
    ...Typography.interMedium,
    fontSize: 14,
    color: Colors.faithGold,
    marginBottom: 12,
  },
  originalContentContainer: {
    marginBottom: 16,
  },
  originalContentLabel: {
    ...Typography.interSemiBold,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 6,
  },
  originalContentText: {
    ...Typography.interRegular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  insightContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  insightLabel: {
    ...Typography.interSemiBold,
    fontSize: 12,
    color: Colors.faithGold,
    marginBottom: 8,
  },
  insightText: {
    ...Typography.interRegular,
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
  },
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  timestampText: {
    ...Typography.interRegular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  tagsContainer: {
    flexDirection: 'row',
  },
  tag: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  tagText: {
    ...Typography.interRegular,
    fontSize: 10,
    color: Colors.faithGold,
  },
};
