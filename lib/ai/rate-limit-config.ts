/**
 * Configuration to reduce API calls and prevent rate limiting
 */

// Reduce memory system frequency to save API quota
export const MEMORY_CONFIG = {
  // Only update memory every N messages instead of every message
  UPDATE_FREQUENCY: 3,

  // Skip memory for short messages
  MIN_MESSAGE_LENGTH: 10,

  // Cache memory results to avoid repeated calls
  CACHE_DURATION_MS: 5 * 60 * 1000, // 5 minutes
};

// Track last memory update to implement frequency control
const lastMemoryUpdate = new Map<string, number>();

export function shouldUpdateMemory(
  userId: string,
  messageLength: number,
): boolean {
  // Skip if message too short
  if (messageLength < MEMORY_CONFIG.MIN_MESSAGE_LENGTH) {
    return false;
  }

  const lastUpdate = lastMemoryUpdate.get(userId) || 0;
  const now = Date.now();

  // Only update if enough time has passed
  if (now - lastUpdate < MEMORY_CONFIG.CACHE_DURATION_MS) {
    return false;
  }

  lastMemoryUpdate.set(userId, now);
  return true;
}

export function resetMemoryTracking(userId: string) {
  lastMemoryUpdate.delete(userId);
}
