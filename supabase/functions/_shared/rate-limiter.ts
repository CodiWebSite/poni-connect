/**
 * Simple in-memory rate limiter for edge functions.
 * Resets when the function cold-starts.
 */

interface RateEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now - entry.windowStart > windowMs * 2) {
      store.delete(key);
    }
  }
}

/**
 * Check if a request should be rate-limited.
 * @param key - Unique identifier (e.g., IP or user_id)
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Window size in milliseconds (default 60s)
 * @returns true if the request is allowed, false if rate-limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60_000
): boolean {
  cleanup(windowMs);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}
