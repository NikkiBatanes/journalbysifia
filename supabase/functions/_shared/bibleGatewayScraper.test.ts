/**
 * Test file for BibleGateway scraper
 * Run with: deno test --allow-net --allow-env bibleGatewayScraper.test.ts
 */

import { bibleGatewayScraper } from './bibleGatewayScraper.ts';
import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

Deno.test('BibleGateway Scraper - AMP Translation', async () => {
  const result = await bibleGatewayScraper.scrapeVerse('Ephesians 2:10', 'AMP');
  
  assertExists(result.text);
  assertEquals(result.reference, 'Ephesians 2:10');
  assertEquals(result.version, 'AMP');
  
  // AMP should contain brackets
  assertEquals(result.text.includes('['), true, 'AMP verse should contain brackets');
  
  console.log('✅ AMP Test Result:', result.text.substring(0, 100) + '...');
});

Deno.test('BibleGateway Scraper - MSG Translation', async () => {
  const result = await bibleGatewayScraper.scrapeVerse('John 3:16', 'MSG');
  
  assertExists(result.text);
  assertEquals(result.reference, 'John 3:16');
  assertEquals(result.version, 'MSG');
  
  console.log('✅ MSG Test Result:', result.text);
});

Deno.test('BibleGateway Scraper - Cache Test', async () => {
  // Clear cache first
  bibleGatewayScraper.clearCache();
  
  // First fetch (should scrape)
  const result1 = await bibleGatewayScraper.scrapeVerse('Psalm 23:1', 'AMP');
  
  // Second fetch (should use cache)
  const result2 = await bibleGatewayScraper.scrapeVerse('Psalm 23:1', 'AMP');
  
  assertEquals(result1.text, result2.text);
  
  console.log('✅ Cache Test Passed');
});

Deno.test('BibleGateway Scraper - Verse Range', async () => {
  const result = await bibleGatewayScraper.scrapeVerse('Matthew 5:1-3', 'AMP');
  
  assertExists(result.text);
  assertEquals(result.reference, 'Matthew 5:1-3');
  
  console.log('✅ Verse Range Test Result:', result.text.substring(0, 100) + '...');
});
