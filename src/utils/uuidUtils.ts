/**
 * UUID utility functions for React Native compatibility
 */

/**
 * Generate a UUID v4 compatible with React Native
 * Uses Math.random() instead of crypto.randomUUID() which is not available in React Native
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate if a string is a proper UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Utility function to validate and ensure proper UUID format
 * If the provided ID is invalid, generates a new UUID
 */
export function ensureValidUUID(id: any, context: string = 'unknown'): string {
  if (!id || typeof id !== 'string' || !isValidUUID(id)) {
    const newUUID = generateUUID();
    console.warn(`⚠️ Invalid ID format in ${context}:`, id, '→ Generated new UUID:', newUUID);
    return newUUID;
  }
  
  return id;
}

/**
 * Generate a short UUID (8 characters) for display purposes
 */
export function generateShortUUID(): string {
  return generateUUID().substring(0, 8);
}
