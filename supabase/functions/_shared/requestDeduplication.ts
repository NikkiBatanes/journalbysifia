/**
 * Request Deduplication
 * Prevents duplicate requests from being processed simultaneously
 * Useful when users accidentally click "Generate" multiple times
 */

export interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
  requestCount: number;
}

/**
 * Store of pending requests
 * Maps request fingerprint to pending promise
 */
const pendingRequests = new Map<string, PendingRequest>();

/**
 * Generate request fingerprint for deduplication
 * Uses user ID + request parameters
 */
export function generateRequestFingerprint(
  userId: string,
  type: string,
  params: Record<string, any>
): string {
  const sortedKeys = Object.keys(params).sort();
  const normalized = sortedKeys
    .map(key => `${key}:${JSON.stringify(params[key])}`)
    .join('|');
  
  return `${userId}:${type}:${normalized}`;
}

/**
 * Request Deduplicator
 * Ensures only one request per unique fingerprint is processed at a time
 */
export class RequestDeduplicator {
  /**
   * Execute function with deduplication
   * If same request is already in progress, return the existing promise
   */
  static async deduplicate<T>(
    fingerprint: string,
    fn: () => Promise<T>,
    timeoutMs: number = 60000 // 60 seconds default
  ): Promise<{ data: T; deduplicated: boolean }> {
    // Check if request is already pending
    const existing = pendingRequests.get(fingerprint);
    
    if (existing) {
      console.log(`[Dedup] Request already in progress: ${fingerprint} (count: ${existing.requestCount + 1})`);
      existing.requestCount++;
      
      try {
        const data = await existing.promise;
        return { data, deduplicated: true };
      } catch (error) {
        // If the original request failed, remove it and let this one try
        pendingRequests.delete(fingerprint);
        throw error;
      }
    }

    // Create new request
    console.log(`[Dedup] New request: ${fingerprint}`);
    
    const promise = this.executeWithTimeout(fn, timeoutMs);
    
    pendingRequests.set(fingerprint, {
      promise,
      timestamp: Date.now(),
      requestCount: 1,
    });

    try {
      const data = await promise;
      return { data, deduplicated: false };
    } finally {
      // Clean up after completion
      pendingRequests.delete(fingerprint);
      console.log(`[Dedup] Request completed: ${fingerprint}`);
    }
  }

  /**
   * Execute function with timeout
   * Prevents requests from hanging indefinitely
   */
  private static async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Request timed out after ${timeoutMs}ms. Please try again.`)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Get pending request count (for monitoring)
   */
  static getPendingCount(): number {
    return pendingRequests.size;
  }

  /**
   * Get all pending requests (for monitoring)
   */
  static getPendingRequests(): Array<{
    fingerprint: string;
    age: number;
    requestCount: number;
  }> {
    const now = Date.now();
    return Array.from(pendingRequests.entries()).map(([fingerprint, req]) => ({
      fingerprint,
      age: now - req.timestamp,
      requestCount: req.requestCount,
    }));
  }

  /**
   * Clean up stale requests (older than 5 minutes)
   */
  static cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    let cleaned = 0;

    for (const [fingerprint, req] of pendingRequests.entries()) {
      if (now - req.timestamp > maxAge) {
        pendingRequests.delete(fingerprint);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Dedup] Cleaned up ${cleaned} stale requests`);
    }
  }

  /**
   * Cancel specific request
   */
  static cancel(fingerprint: string): boolean {
    const deleted = pendingRequests.delete(fingerprint);
    if (deleted) {
      console.log(`[Dedup] Cancelled request: ${fingerprint}`);
    }
    return deleted;
  }

  /**
   * Clear all pending requests
   */
  static clear(): void {
    const size = pendingRequests.size;
    pendingRequests.clear();
    console.log(`[Dedup] Cleared ${size} pending requests`);
  }
}

/**
 * Periodic cleanup task
 * Run every 2 minutes to remove stale requests
 */
let cleanupInterval: number | null = null;

export function startDedupCleanup(): void {
  if (cleanupInterval !== null) {
    return; // Already running
  }

  cleanupInterval = setInterval(() => {
    RequestDeduplicator.cleanup();
  }, 2 * 60 * 1000) as unknown as number; // 2 minutes

  console.log('[Dedup] Cleanup task started (every 2 minutes)');
}

export function stopDedupCleanup(): void {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[Dedup] Cleanup task stopped');
  }
}

// Start cleanup on module load
startDedupCleanup();
