import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface Bookmark {
  id: string;
  userId: string;
  type: 'action_step' | 'expounding_insight' | 'devotional' | 'playbook' | 'ai_response';
  title: string;
  content: string;
  sourceId: string; // ID of the original item (playbook, action step, etc.)
  sourceType: string;
  tags: string[];
  notes?: string; // User's personal notes
  createdAt: string;
  lastAccessedAt: string;
  isFavorite: boolean;
  metadata?: {
    playbookTitle?: string;
    actionStepNumber?: number;
    scriptureReference?: string;
    category?: string;
  };
}

export interface BookmarkCollection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  bookmarkIds: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkSearchFilters {
  type?: Bookmark['type'];
  tags?: string[];
  isFavorite?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  searchText?: string;
}

class BookmarkingService {
  private readonly STORAGE_KEYS = {
    BOOKMARKS: 'user_bookmarks',
    COLLECTIONS: 'bookmark_collections',
  };

  /**
   * Add a bookmark
   */
  async addBookmark(
    userId: string,
    type: Bookmark['type'],
    title: string,
    content: string,
    sourceId: string,
    sourceType: string,
    metadata?: Bookmark['metadata']
  ): Promise<Bookmark> {
    try {
      const bookmark: Bookmark = {
        id: `bookmark_${Date.now()}_${userId.slice(-6)}`,
        userId,
        type,
        title: title.substring(0, 100), // Limit title length
        content,
        sourceId,
        sourceType,
        tags: this.generateAutoTags(type, content, metadata),
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        isFavorite: false,
        metadata,
      };

      // Save locally
      await this.saveBookmarkLocally(bookmark);

      // Save to Supabase
      await this.saveBookmarkToSupabase(bookmark);

      console.log('[BookmarkingService] Bookmark added:', bookmark.title);
      return bookmark;
    } catch (error) {
      console.error('[BookmarkingService] Error adding bookmark:', error);
      throw error;
    }
  }

  /**
   * Get user's bookmarks with optional filters
   */
  async getUserBookmarks(
    userId: string,
    filters?: BookmarkSearchFilters
  ): Promise<Bookmark[]> {
    try {
      // Get from local storage first
      const stored = await AsyncStorage.getItem(`${this.STORAGE_KEYS.BOOKMARKS}_${userId}`);
      let bookmarks: Bookmark[] = stored ? JSON.parse(stored) : [];

      // If no local bookmarks, fetch from Supabase
      if (bookmarks.length === 0) {
        bookmarks = await this.fetchBookmarksFromSupabase(userId);
        if (bookmarks.length > 0) {
          await this.saveBookmarksLocally(userId, bookmarks);
        }
      }

      // Apply filters
      if (filters) {
        bookmarks = this.applyFilters(bookmarks, filters);
      }

      // Sort by last accessed, then by created date
      return bookmarks.sort((a, b) => {
        const aAccessed = new Date(a.lastAccessedAt).getTime();
        const bAccessed = new Date(b.lastAccessedAt).getTime();
        if (aAccessed !== bAccessed) {
          return bAccessed - aAccessed; // Most recently accessed first
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } catch (error) {
      console.error('[BookmarkingService] Error getting bookmarks:', error);
      return [];
    }
  }

  /**
   * Update bookmark (add notes, toggle favorite, etc.)
   */
  async updateBookmark(
    userId: string,
    bookmarkId: string,
    updates: Partial<Pick<Bookmark, 'notes' | 'isFavorite' | 'tags'>>
  ): Promise<Bookmark | null> {
    try {
      const bookmarks = await this.getUserBookmarks(userId);
      const bookmarkIndex = bookmarks.findIndex(b => b.id === bookmarkId);

      if (bookmarkIndex === -1) {
        throw new Error('Bookmark not found');
      }

      const updatedBookmark = {
        ...bookmarks[bookmarkIndex],
        ...updates,
        lastAccessedAt: new Date().toISOString(),
      };

      bookmarks[bookmarkIndex] = updatedBookmark;

      // Save updated bookmarks
      await this.saveBookmarksLocally(userId, bookmarks);
      await this.saveBookmarkToSupabase(updatedBookmark);

      return updatedBookmark;
    } catch (error) {
      console.error('[BookmarkingService] Error updating bookmark:', error);
      return null;
    }
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(userId: string, bookmarkId: string): Promise<boolean> {
    try {
      const bookmarks = await this.getUserBookmarks(userId);
      const filteredBookmarks = bookmarks.filter(b => b.id !== bookmarkId);

      if (filteredBookmarks.length === bookmarks.length) {
        throw new Error('Bookmark not found');
      }

      // Save updated bookmarks locally
      await this.saveBookmarksLocally(userId, filteredBookmarks);

      // Delete from Supabase
      const { error } = await supabase
        .from('user_bookmarks')
        .delete()
        .eq('id', bookmarkId)
        .eq('user_id', userId);

      if (error) {
        console.error('[BookmarkingService] Error deleting from Supabase:', error);
      }

      return true;
    } catch (error) {
      console.error('[BookmarkingService] Error deleting bookmark:', error);
      return false;
    }
  }

  /**
   * Check if an item is bookmarked
   */
  async isBookmarked(userId: string, sourceId: string): Promise<boolean> {
    try {
      const bookmarks = await this.getUserBookmarks(userId);
      return bookmarks.some(b => b.sourceId === sourceId);
    } catch (error) {
      console.error('[BookmarkingService] Error checking bookmark status:', error);
      return false;
    }
  }

  /**
   * Get bookmark by source ID
   */
  async getBookmarkBySourceId(userId: string, sourceId: string): Promise<Bookmark | null> {
    try {
      const bookmarks = await this.getUserBookmarks(userId);
      return bookmarks.find(b => b.sourceId === sourceId) || null;
    } catch (error) {
      console.error('[BookmarkingService] Error getting bookmark by source:', error);
      return null;
    }
  }

  /**
   * Search bookmarks
   */
  async searchBookmarks(userId: string, query: string): Promise<Bookmark[]> {
    try {
      const bookmarks = await this.getUserBookmarks(userId);
      const lowercaseQuery = query.toLowerCase();

      return bookmarks.filter(bookmark =>
        bookmark.title.toLowerCase().includes(lowercaseQuery) ||
        bookmark.content.toLowerCase().includes(lowercaseQuery) ||
        bookmark.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
        (bookmark.notes && bookmark.notes.toLowerCase().includes(lowercaseQuery))
      );
    } catch (error) {
      console.error('[BookmarkingService] Error searching bookmarks:', error);
      return [];
    }
  }

  /**
   * Get popular tags for user's bookmarks
   */
  async getPopularTags(userId: string): Promise<{ tag: string; count: number }[]> {
    try {
      const bookmarks = await this.getUserBookmarks(userId);
      const tagCounts: { [key: string]: number } = {};

      bookmarks.forEach(bookmark => {
        bookmark.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      return Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20); // Top 20 tags
    } catch (error) {
      console.error('[BookmarkingService] Error getting popular tags:', error);
      return [];
    }
  }

  /**
   * Create a bookmark collection
   */
  async createCollection(
    userId: string,
    name: string,
    description?: string
  ): Promise<BookmarkCollection> {
    try {
      const collection: BookmarkCollection = {
        id: `collection_${Date.now()}_${userId.slice(-6)}`,
        userId,
        name,
        description,
        bookmarkIds: [],
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.saveCollectionLocally(collection);
      await this.saveCollectionToSupabase(collection);

      return collection;
    } catch (error) {
      console.error('[BookmarkingService] Error creating collection:', error);
      throw error;
    }
  }

  /**
   * Add bookmark to collection
   */
  async addToCollection(
    userId: string,
    collectionId: string,
    bookmarkId: string
  ): Promise<boolean> {
    try {
      const collections = await this.getUserCollections(userId);
      const collection = collections.find(c => c.id === collectionId);

      if (!collection) {
        throw new Error('Collection not found');
      }

      if (!collection.bookmarkIds.includes(bookmarkId)) {
        collection.bookmarkIds.push(bookmarkId);
        collection.updatedAt = new Date().toISOString();

        await this.saveCollectionLocally(collection);
        await this.saveCollectionToSupabase(collection);
      }

      return true;
    } catch (error) {
      console.error('[BookmarkingService] Error adding to collection:', error);
      return false;
    }
  }

  /**
   * Get user's bookmark collections
   */
  async getUserCollections(userId: string): Promise<BookmarkCollection[]> {
    try {
      const stored = await AsyncStorage.getItem(`${this.STORAGE_KEYS.COLLECTIONS}_${userId}`);
      let collections: BookmarkCollection[] = stored ? JSON.parse(stored) : [];

      // If no local collections, fetch from Supabase
      if (collections.length === 0) {
        collections = await this.fetchCollectionsFromSupabase(userId);
        if (collections.length > 0) {
          await this.saveCollectionsLocally(userId, collections);
        }
      }

      return collections.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (error) {
      console.error('[BookmarkingService] Error getting collections:', error);
      return [];
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  private generateAutoTags(
    type: Bookmark['type'],
    content: string,
    metadata?: Bookmark['metadata']
  ): string[] {
    const tags: string[] = [type];

    // Add metadata-based tags
    if (metadata?.category) {
      tags.push(metadata.category.toLowerCase());
    }

    if (metadata?.scriptureReference) {
      tags.push('scripture');
    }

    // Add content-based tags
    const contentLower = content.toLowerCase();
    const commonSpiritualTerms = [
      'prayer', 'faith', 'love', 'hope', 'peace', 'joy', 'grace', 'mercy',
      'forgiveness', 'worship', 'service', 'fellowship', 'discipleship',
      'scripture', 'bible', 'jesus', 'god', 'holy spirit', 'salvation',
    ];

    commonSpiritualTerms.forEach(term => {
      if (contentLower.includes(term)) {
        tags.push(term);
      }
    });

    // Remove duplicates and limit to 10 tags
    return [...new Set(tags)].slice(0, 10);
  }

  private applyFilters(bookmarks: Bookmark[], filters: BookmarkSearchFilters): Bookmark[] {
    let filtered = bookmarks;

    if (filters.type) {
      filtered = filtered.filter(b => b.type === filters.type);
    }

    if (filters.isFavorite !== undefined) {
      filtered = filtered.filter(b => b.isFavorite === filters.isFavorite);
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(b =>
        filters.tags!.some(tag => b.tags.includes(tag))
      );
    }

    if (filters.dateRange) {
      const start = new Date(filters.dateRange.start);
      const end = new Date(filters.dateRange.end);
      filtered = filtered.filter(b => {
        const created = new Date(b.createdAt);
        return created >= start && created <= end;
      });
    }

    if (filters.searchText) {
      const query = filters.searchText.toLowerCase();
      filtered = filtered.filter(b =>
        b.title.toLowerCase().includes(query) ||
        b.content.toLowerCase().includes(query) ||
        (b.notes && b.notes.toLowerCase().includes(query))
      );
    }

    return filtered;
  }

  private async saveBookmarkLocally(bookmark: Bookmark): Promise<void> {
    try {
      const existing = await this.getUserBookmarks(bookmark.userId);
      const updated = existing.filter(b => b.id !== bookmark.id);
      updated.push(bookmark);

      await AsyncStorage.setItem(
        `${this.STORAGE_KEYS.BOOKMARKS}_${bookmark.userId}`,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('[BookmarkingService] Error saving bookmark locally:', error);
    }
  }

  private async saveBookmarksLocally(userId: string, bookmarks: Bookmark[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${this.STORAGE_KEYS.BOOKMARKS}_${userId}`,
        JSON.stringify(bookmarks)
      );
    } catch (error) {
      console.error('[BookmarkingService] Error saving bookmarks locally:', error);
    }
  }

  private async saveBookmarkToSupabase(bookmark: Bookmark): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_bookmarks')
        .upsert({
          id: bookmark.id,
          user_id: bookmark.userId,
          type: bookmark.type,
          title: bookmark.title,
          content: bookmark.content,
          source_id: bookmark.sourceId,
          source_type: bookmark.sourceType,
          tags: bookmark.tags,
          notes: bookmark.notes,
          created_at: bookmark.createdAt,
          last_accessed_at: bookmark.lastAccessedAt,
          is_favorite: bookmark.isFavorite,
          metadata: bookmark.metadata,
        });

      if (error) {
        console.error('[BookmarkingService] Error saving to Supabase:', error);
      }
    } catch (error) {
      console.error('[BookmarkingService] Error saving to Supabase:', error);
    }
  }

  private async fetchBookmarksFromSupabase(userId: string): Promise<Bookmark[]> {
    try {
      const { data, error } = await supabase
        .from('user_bookmarks')
        .select('*')
        .eq('user_id', userId)
        .order('last_accessed_at', { ascending: false });

      if (error) {
        console.error('[BookmarkingService] Error fetching from Supabase:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        userId: item.user_id,
        type: item.type,
        title: item.title,
        content: item.content,
        sourceId: item.source_id,
        sourceType: item.source_type,
        tags: item.tags || [],
        notes: item.notes,
        createdAt: item.created_at,
        lastAccessedAt: item.last_accessed_at,
        isFavorite: item.is_favorite || false,
        metadata: item.metadata,
      }));
    } catch (error) {
      console.error('[BookmarkingService] Error fetching from Supabase:', error);
      return [];
    }
  }

  private async saveCollectionLocally(collection: BookmarkCollection): Promise<void> {
    try {
      const existing = await this.getUserCollections(collection.userId);
      const updated = existing.filter(c => c.id !== collection.id);
      updated.push(collection);

      await AsyncStorage.setItem(
        `${this.STORAGE_KEYS.COLLECTIONS}_${collection.userId}`,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('[BookmarkingService] Error saving collection locally:', error);
    }
  }

  private async saveCollectionsLocally(userId: string, collections: BookmarkCollection[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${this.STORAGE_KEYS.COLLECTIONS}_${userId}`,
        JSON.stringify(collections)
      );
    } catch (error) {
      console.error('[BookmarkingService] Error saving collections locally:', error);
    }
  }

  private async saveCollectionToSupabase(collection: BookmarkCollection): Promise<void> {
    try {
      const { error } = await supabase
        .from('bookmark_collections')
        .upsert({
          id: collection.id,
          user_id: collection.userId,
          name: collection.name,
          description: collection.description,
          bookmark_ids: collection.bookmarkIds,
          is_default: collection.isDefault,
          created_at: collection.createdAt,
          updated_at: collection.updatedAt,
        });

      if (error) {
        console.error('[BookmarkingService] Error saving collection to Supabase:', error);
      }
    } catch (error) {
      console.error('[BookmarkingService] Error saving collection to Supabase:', error);
    }
  }

  private async fetchCollectionsFromSupabase(userId: string): Promise<BookmarkCollection[]> {
    try {
      const { data, error } = await supabase
        .from('bookmark_collections')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[BookmarkingService] Error fetching collections from Supabase:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        userId: item.user_id,
        name: item.name,
        description: item.description,
        bookmarkIds: item.bookmark_ids || [],
        isDefault: item.is_default || false,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
    } catch (error) {
      console.error('[BookmarkingService] Error fetching collections from Supabase:', error);
      return [];
    }
  }
}

export const bookmarkingService = new BookmarkingService();
