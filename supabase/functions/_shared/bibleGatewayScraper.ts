/**
 * Enterprise-grade BibleGateway scraper for exact Bible verse retrieval
 * Implements caching, rate limiting, retry logic, and fallback mechanisms
 */

import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts';

// Import DOM types
import type { Element, Node } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BIBLE_GATEWAY_BASE_URL = 'https://www.biblegateway.com/passage/';

// Translations that require scraping (problematic with AI)
export const SCRAPE_REQUIRED_TRANSLATIONS = ['AMP', 'MSG', 'NLT', 'CSB'];

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequestsPerMinute: 30,
  delayBetweenRequests: 2000, // 2 seconds
};

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 5000,
  backoffMultiplier: 2,
};

// Cache TTL (24 hours)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// TYPES
// ============================================================================

interface ScrapedVerse {
  text: string;
  reference: string;
  version: string;
  timestamp: number;
}

interface CacheEntry {
  data: ScrapedVerse;
  expiresAt: number;
}

interface RateLimitState {
  requests: number[];
  lastRequestTime: number;
}

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

class VerseCache {
  private cache = new Map<string, CacheEntry>();

  private generateKey(reference: string, version: string): string {
    return `${version}:${reference.toLowerCase().replace(/\s+/g, '')}`;
  }

  get(reference: string, version: string): ScrapedVerse | null {
    const key = this.generateKey(reference, version);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    console.log(`[BibleGateway Cache] HIT for ${version} ${reference}`);
    return entry.data;
  }

  set(reference: string, version: string, data: ScrapedVerse): void {
    const key = this.generateKey(reference, version);
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    console.log(`[BibleGateway Cache] SET for ${version} ${reference}`);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  private state: RateLimitState = {
    requests: [],
    lastRequestTime: 0,
  };

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove requests older than 1 minute
    this.state.requests = this.state.requests.filter(time => time > oneMinuteAgo);

    // Check if we've hit the rate limit
    if (this.state.requests.length >= RATE_LIMIT.maxRequestsPerMinute) {
      const oldestRequest = this.state.requests[0];
      const waitTime = 60000 - (now - oldestRequest);
      console.log(`[BibleGateway RateLimit] Waiting ${waitTime}ms to respect rate limit`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForSlot();
    }

    // Enforce minimum delay between requests
    const timeSinceLastRequest = now - this.state.lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT.delayBetweenRequests) {
      const delay = RATE_LIMIT.delayBetweenRequests - timeSinceLastRequest;
      console.log(`[BibleGateway RateLimit] Delaying ${delay}ms between requests`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Record this request
    this.state.requests.push(Date.now());
    this.state.lastRequestTime = Date.now();
  }

  reset(): void {
    this.state = {
      requests: [],
      lastRequestTime: 0,
    };
  }
}

// ============================================================================
// SCRAPER
// ============================================================================

class BibleGatewayScraper {
  private cache = new VerseCache();
  private rateLimiter = new RateLimiter();

  /**
   * Normalize Bible reference to BibleGateway format
   * Examples: "Ephesians 2:10" -> "Ephesians+2:10"
   *           "Matt 5:1-3" -> "Matthew+5:1-3"
   */
  private normalizeReference(reference: string): string {
    let normalized = reference.trim();

    // Expand common abbreviations
    const expansions: Record<string, string> = {
      'Matt': 'Matthew',
      'Eph': 'Ephesians',
      'Phil': 'Philippians',
      'Col': 'Colossians',
      'Thess': 'Thessalonians',
      'Tim': 'Timothy',
      'Titus': 'Titus',
      'Philem': 'Philemon',
      'Heb': 'Hebrews',
      'Jas': 'James',
      'Pet': 'Peter',
      'Jn': 'John',
      'Rev': 'Revelation',
      'Gen': 'Genesis',
      'Ex': 'Exodus',
      'Lev': 'Leviticus',
      'Num': 'Numbers',
      'Deut': 'Deuteronomy',
      'Josh': 'Joshua',
      'Judg': 'Judges',
      'Sam': 'Samuel',
      'Kgs': 'Kings',
      'Chron': 'Chronicles',
      'Neh': 'Nehemiah',
      'Ps': 'Psalms',
      'Prov': 'Proverbs',
      'Eccles': 'Ecclesiastes',
      'Song': 'Song of Solomon',
      'Is': 'Isaiah',
      'Jer': 'Jeremiah',
      'Lam': 'Lamentations',
      'Ezek': 'Ezekiel',
      'Dan': 'Daniel',
      'Hos': 'Hosea',
      'Obad': 'Obadiah',
      'Mic': 'Micah',
      'Nah': 'Nahum',
      'Hab': 'Habakkuk',
      'Zeph': 'Zephaniah',
      'Hag': 'Haggai',
      'Zech': 'Zechariah',
      'Mal': 'Malachi',
    };

    for (const [abbr, full] of Object.entries(expansions)) {
      const regex = new RegExp(`^${abbr}\\b`, 'i');
      if (regex.test(normalized)) {
        normalized = normalized.replace(regex, full);
        break;
      }
    }

    // Replace spaces with +
    return normalized.replace(/\s+/g, '+');
  }

  /**
   * Fetch verse with retry logic
   */
  private async fetchWithRetry(url: string, attempt = 1): Promise<Response> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SiFiaApp/1.0)',
          'Accept': 'text/html',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt >= RETRY_CONFIG.maxAttempts) {
        throw new Error(`Failed after ${RETRY_CONFIG.maxAttempts} attempts: ${error}`);
      }

      const delay = Math.min(
        RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
        RETRY_CONFIG.maxDelay
      );

      console.log(`[BibleGateway] Retry attempt ${attempt + 1} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));

      return this.fetchWithRetry(url, attempt + 1);
    }
  }

  /**
   * Extract verse text from HTML
   */
  private extractVerseText(html: string): { text: string; startVerse?: number; endVerse?: number } {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }

    // Find the passage content div
    const passageDiv = doc.querySelector('.passage-content');
    if (!passageDiv) {
      throw new Error('Could not find passage content in HTML');
    }

    // Remove passage title first
    const passageTitle = passageDiv.querySelector('.passage-title');
    if (passageTitle) {
      passageTitle.remove();
    }

    // Remove any heading elements that might contain titles
    const headings = passageDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading: Node) => (heading as Element).remove());

    // Get all verse spans
    const verseSpans = passageDiv.querySelectorAll('.text');
    if (!verseSpans || verseSpans.length === 0) {
      throw new Error('Could not find verse text in HTML');
    }

    let verseText = '';
    let startVerse: number | undefined;
    let endVerse: number | undefined;

    // For MSG, verse filtering is complex and can fail - just get all text
    // BibleGateway's context is actually helpful for understanding
    for (const span of verseSpans) {
      const spanElement = span as Element;

      // Capture ALL verse numbers BEFORE removing them so we can detect full ranges
      const allVerseElements = spanElement.querySelectorAll('.versenum');
      
      if (allVerseElements.length > 0) {
        console.log(`[BibleGateway] Found ${allVerseElements.length} verse number elements in this span`);
      }
      
      allVerseElements.forEach((verseElement: Node) => {
        const verseText = (verseElement as Element).textContent?.trim() || '';
        
        // Handle range format like "5-6" or single numbers like "5"
        if (verseText.includes('-')) {
          // It's a range like "5-6"
          const parts = verseText.split('-');
          const rangeStart = parseInt(parts[0], 10);
          const rangeEnd = parseInt(parts[1], 10);
          
          console.log(`[BibleGateway] Verse element is RANGE: "${verseText}" (${rangeStart}-${rangeEnd})`);
          
          if (!isNaN(rangeStart)) {
            if (startVerse === undefined || rangeStart < startVerse) {
              startVerse = rangeStart;
              console.log(`[BibleGateway] Updated startVerse to ${startVerse}`);
            }
          }
          if (!isNaN(rangeEnd)) {
            if (endVerse === undefined || rangeEnd > endVerse) {
              endVerse = rangeEnd;
              console.log(`[BibleGateway] Updated endVerse to ${endVerse}`);
            }
          }
        } else {
          // It's a single number like "5"
          const verseNum = parseInt(verseText, 10);
          console.log(`[BibleGateway] Verse element is SINGLE: "${verseText}" (${verseNum})`);
          
          if (!isNaN(verseNum)) {
            if (startVerse === undefined || verseNum < startVerse) {
              startVerse = verseNum;
              console.log(`[BibleGateway] Updated startVerse to ${startVerse}`);
            }
            if (endVerse === undefined || verseNum > endVerse) {
              endVerse = verseNum;
              console.log(`[BibleGateway] Updated endVerse to ${endVerse}`);
            }
          }
        }
      });

      // Remove verse numbers after capturing them
      const verseNumbers = spanElement.querySelectorAll('.versenum, .chapternum');
      verseNumbers.forEach((num: Node) => (num as Element).remove());

      // Remove footnotes
      const footnotes = spanElement.querySelectorAll('.footnote, .crossreference');
      footnotes.forEach((note: Node) => (note as Element).remove());

      // Get text content
      const text = spanElement.textContent?.trim() || '';
      if (text) {
        verseText += (verseText ? ' ' : '') + text;
      }
    }

    // Clean up whitespace and MSG artifacts
    verseText = verseText
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/\*\*\*/g, '') // Remove *** markers from MSG
      .replace(/^[“"']+/, '') // Strip leading smart/straight quotes
      .replace(/[”"']+$/, '') // Strip trailing smart/straight quotes
      .trim();

    if (!verseText) {
      throw new Error('Extracted verse text is empty');
    }

    console.log(`[BibleGateway] Extracted verse - detected range: ${startVerse}-${endVerse || startVerse}`);
    return { text: verseText, startVerse, endVerse };
  }

  /**
   * Scrape a Bible verse from BibleGateway
   */
  async scrapeVerse(reference: string, version: string): Promise<ScrapedVerse> {
    // Check cache first
    const cached = this.cache.get(reference, version);
    if (cached) {
      return cached;
    }

    console.log(`[BibleGateway] Scraping ${version} ${reference}`);

    // Wait for rate limit slot
    await this.rateLimiter.waitForSlot();

    // Build URL
    const normalizedRef = this.normalizeReference(reference);
    const url = `${BIBLE_GATEWAY_BASE_URL}?search=${normalizedRef}&version=${version}`;

    console.log(`[BibleGateway] Fetching: ${url}`);

    // Fetch with retry
    const response = await this.fetchWithRetry(url);
    const html = await response.text();

    // Extract verse text
    const { text, startVerse, endVerse } = this.extractVerseText(html);

    let actualReference = reference;
    if (startVerse !== undefined) {
      const bookChapterMatch = reference.match(/^([1-3]?\s?[A-Za-z ]+\s\d+)/);
      const bookChapter = bookChapterMatch?.[1]?.trim();

      if (bookChapter) {
        const finalEndVerse = endVerse ?? startVerse;
        actualReference = `${bookChapter}:${startVerse}${finalEndVerse !== startVerse ? `-${finalEndVerse}` : ''}`;
        console.log(`[BibleGateway] Reference adjusted: ${reference} → ${actualReference} (detected verses ${startVerse}-${finalEndVerse})`);
      }
    } else {
      console.warn(`[BibleGateway] Could not detect verse numbers, keeping original reference: ${reference}`);
    }

    const result: ScrapedVerse = {
      text,
      reference: actualReference,
      version,
      timestamp: Date.now(),
    };

    // Cache the result
    this.cache.set(reference, version, result);

    return result;
  }

  /**
   * Check if a translation requires scraping
   */
  static requiresScraping(version: string): boolean {
    return SCRAPE_REQUIRED_TRANSLATIONS.includes(version.toUpperCase());
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size(),
      ttl: CACHE_TTL_MS,
    };
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const bibleGatewayScraper = new BibleGatewayScraper();
