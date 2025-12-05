/**
 * Bible Verse Service - Unified interface for fetching exact Bible verses
 * Routes requests to appropriate provider (BibleGateway scraper, API.Bible, or OpenAI fallback)
 */

import { bibleGatewayScraper } from './bibleGatewayScraper.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================================================
// TYPES
// ============================================================================

export interface BibleVerse {
  text: string;
  reference: string;
  version: string;
  source: 'cache' | 'scraper' | 'openai' | 'database';
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Translations that require BibleGateway scraping
const SCRAPE_TRANSLATIONS = ['AMP', 'MSG', 'TPT'];

// Translations that can use OpenAI as fallback
const OPENAI_FALLBACK_TRANSLATIONS = ['NIV', 'ESV', 'NASB', 'NLT', 'KJV', 'NKJV', 'CSB'];

// ============================================================================
// DATABASE CACHE
// ============================================================================

class DatabaseCache {
  private supabase;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async get(reference: string, version: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_cached_bible_verse', {
          p_reference: reference,
          p_version: version,
        });

      if (error) {
        console.error('[DatabaseCache] Error fetching:', error);
        return null;
      }

      if (data && data.length > 0 && data[0].verse_text) {
        console.log(`[DatabaseCache] HIT for ${version} ${reference}`);
        return data[0].verse_text;
      }

      console.log(`[DatabaseCache] MISS for ${version} ${reference}`);
      return null;
    } catch (error) {
      console.error('[DatabaseCache] Exception:', error);
      return null;
    }
  }

  async set(reference: string, version: string, text: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .rpc('cache_bible_verse', {
          p_reference: reference,
          p_version: version,
          p_verse_text: text,
        });

      if (error) {
        console.error('[DatabaseCache] Error caching:', error);
      } else {
        console.log(`[DatabaseCache] SET for ${version} ${reference}`);
      }
    } catch (error) {
      console.error('[DatabaseCache] Exception:', error);
    }
  }
}

// ============================================================================
// OPENAI FALLBACK
// ============================================================================

async function fetchVerseFromOpenAI(reference: string, version: string): Promise<string | null> {
  try {
    console.log(`[OpenAI Fallback] Fetching ${version} ${reference}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a Bible verse retrieval system. Your ONLY job is to return the EXACT, WORD-FOR-WORD text of the requested Bible verse from the ${version} translation. Do NOT add any commentary, explanation, or extra text. Return ONLY the verse text itself.`,
          },
          {
            role: 'user',
            content: `Return the exact text of ${reference} from the ${version} translation. Include ALL punctuation, brackets, and formatting exactly as it appears in the official ${version} Bible.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error('Empty response from OpenAI');
    }

    console.log(`[OpenAI Fallback] SUCCESS for ${version} ${reference}`);
    return text;
  } catch (error) {
    console.error(`[OpenAI Fallback] FAILED for ${version} ${reference}:`, error);
    return null;
  }
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class BibleVerseService {
  private dbCache = new DatabaseCache();

  /**
   * Fetch exact Bible verse using the most appropriate method
   */
  async fetchVerse(reference: string, version: string): Promise<BibleVerse> {
    console.log(`[BibleVerseService] Fetching ${version} ${reference}`);

    // Step 1: Check database cache
    const cachedText = await this.dbCache.get(reference, version);
    if (cachedText) {
      return {
        text: cachedText,
        reference,
        version,
        source: 'database',
      };
    }

    // Step 2: Determine which provider to use
    const needsScraping = SCRAPE_TRANSLATIONS.includes(version.toUpperCase());

    if (needsScraping) {
      // Use BibleGateway scraper for problematic translations
      try {
        const scraped = await bibleGatewayScraper.scrapeVerse(reference, version);
        
        // Cache in database
        await this.dbCache.set(reference, version, scraped.text);

        return {
          text: scraped.text,
          reference,
          version,
          source: 'scraper',
        };
      } catch (error) {
        console.error(`[BibleVerseService] Scraper failed for ${version} ${reference}:`, error);
        
        // Fall through to OpenAI fallback
      }
    }

    // Step 3: Try OpenAI fallback
    if (OPENAI_FALLBACK_TRANSLATIONS.includes(version.toUpperCase())) {
      const openaiText = await fetchVerseFromOpenAI(reference, version);
      
      if (openaiText) {
        // Cache in database
        await this.dbCache.set(reference, version, openaiText);

        return {
          text: openaiText,
          reference,
          version,
          source: 'openai',
        };
      }
    }

    // Step 4: Last resort - return error message
    console.error(`[BibleVerseService] All methods failed for ${version} ${reference}`);
    throw new Error(`Unable to fetch ${version} ${reference} from any source`);
  }

  /**
   * Batch fetch multiple verses
   */
  async fetchVerses(references: string[], version: string): Promise<BibleVerse[]> {
    const results: BibleVerse[] = [];

    for (const reference of references) {
      try {
        const verse = await this.fetchVerse(reference, version);
        results.push(verse);
      } catch (error) {
        console.error(`[BibleVerseService] Failed to fetch ${reference}:`, error);
        // Continue with other verses
      }
    }

    return results;
  }

  /**
   * Check if a version requires scraping
   */
  static requiresScraping(version: string): boolean {
    return SCRAPE_TRANSLATIONS.includes(version.toUpperCase());
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const bibleVerseService = new BibleVerseService();
