import { supabase } from './supabaseClient';

export interface BookmarkedInsight {
  id: string;
  userId: string;
  cardType: 'truth' | 'action' | 'affirmation' | 'bible' | 'challenge';
  cardContent: string;
  aiInsight: string;
  playbookTitle: string;
  userOriginalInput?: string;
  bookmarkedAt: string;
  tags?: string[];
  personalNotes?: string;
}

class InsightBookmarkService {
  /**
   * Bookmark an AI-generated insight for later reference
   */
  async bookmarkInsight(
    userId: string,
    cardType: string,
    cardContent: string,
    aiInsight: string,
    playbookTitle: string,
    userOriginalInput?: string,
    personalNotes?: string
  ): Promise<BookmarkedInsight> {
    try {
      const bookmarkedInsight: Omit<BookmarkedInsight, 'id'> = {
        userId,
        cardType: cardType as any,
        cardContent,
        aiInsight,
        playbookTitle,
        userOriginalInput,
        bookmarkedAt: new Date().toISOString(),
        personalNotes,
        tags: this.generateSmartTags(cardType, cardContent, aiInsight),
      };

      const { data, error } = await supabase
        .from('bookmarked_insights')
        .insert(bookmarkedInsight)
        .select()
        .single();

      if (error) {
        console.error('[InsightBookmarkService] Error bookmarking insight:', error);
        throw error;
      }

      console.log('[InsightBookmarkService] Insight bookmarked successfully');
      return data;
    } catch (error) {
      console.error('[InsightBookmarkService] Error:', error);
      throw new Error('Failed to bookmark insight. Please try again.');
    }
  }

  /**
   * Get user's bookmarked insights with filtering
   */
  async getUserBookmarks(
    userId: string,
    cardType?: string,
    limit: number = 20
  ): Promise<BookmarkedInsight[]> {
    try {
      let query = supabase
        .from('bookmarked_insights')
        .select('*')
        .eq('userId', userId)
        .order('bookmarkedAt', { ascending: false })
        .limit(limit);

      if (cardType) {
        query = query.eq('cardType', cardType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[InsightBookmarkService] Error fetching bookmarks:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('[InsightBookmarkService] Error:', error);
      return [];
    }
  }

  /**
   * Remove bookmark
   */
  async removeBookmark(bookmarkId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('bookmarked_insights')
        .delete()
        .eq('id', bookmarkId);

      if (error) {
        console.error('[InsightBookmarkService] Error removing bookmark:', error);
        throw error;
      }

      console.log('[InsightBookmarkService] Bookmark removed successfully');
    } catch (error) {
      console.error('[InsightBookmarkService] Error:', error);
      throw new Error('Failed to remove bookmark. Please try again.');
    }
  }

  /**
   * Generate smart tags for better organization
   */
  private generateSmartTags(cardType: string, cardContent: string, aiInsight: string): string[] {
    const tags: string[] = [cardType];

    // Add content-based tags
    const content = (cardContent + ' ' + aiInsight).toLowerCase();

    if (content.includes('prayer') || content.includes('pray')) {tags.push('prayer');}
    if (content.includes('bible') || content.includes('scripture')) {tags.push('scripture');}
    if (content.includes('relationship') || content.includes('marriage')) {tags.push('relationships');}
    if (content.includes('work') || content.includes('career')) {tags.push('work');}
    if (content.includes('family') || content.includes('children')) {tags.push('family');}
    if (content.includes('fear') || content.includes('anxiety')) {tags.push('overcoming');}
    if (content.includes('faith') || content.includes('trust')) {tags.push('faith');}
    if (content.includes('love') || content.includes('forgiveness')) {tags.push('love');}

    return tags;
  }
}

export const insightBookmarkService = new InsightBookmarkService();
