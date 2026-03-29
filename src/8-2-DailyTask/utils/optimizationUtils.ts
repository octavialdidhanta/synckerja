/**
 * Optimization utilities for reducing database queries and improving performance
 */

import { logger } from '@/shared/lib/logger';

// Define isDev once at module level for performance
const isDev = import.meta.env.DEV;

// Cache management
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

/**
 * Debounce function - delays execution until after wait time has passed
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - ensures function is called at most once per wait period
 * @param func Function to throttle
 * @param wait Wait time in milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, wait);
    }
  };
}

/**
 * Get cached data if available and not expired
 * @param key Cache key
 * @param maxAge Maximum age in milliseconds (default: 30 seconds)
 */
export function getCached<T>(key: string, maxAge: number = 30000): T | null {
  const entry = cache.get(key);
  
  if (!entry) {
    return null;
  }
  
  const age = Date.now() - entry.timestamp;
  if (age > maxAge) {
    cache.delete(key);
    return null;
  }
  
  if (isDev) {
    console.log(`📦 Cache hit for: ${key} (age: ${Math.round(age / 1000)}s)`);
  }
  return entry.data as T;
}

/**
 * Set data in cache
 * @param key Cache key
 * @param data Data to cache
 */
export function setCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  if (isDev) {
    logger.debug(`💾 Cached: ${key}`);
  }
}

/**
 * Clear specific cache entry or all cache
 * @param key Optional cache key to clear. If not provided, clears all cache
 *            Supports wildcard '*' to clear multiple matching keys
 */
export function clearCache(key?: string): void {
  if (key) {
    // Support wildcard pattern matching
    if (key.includes('*')) {
      const pattern = key.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      let cleared = 0;
      
      for (const cacheKey of cache.keys()) {
        if (regex.test(cacheKey)) {
          cache.delete(cacheKey);
          cleared++;
        }
      }
      
      if (isDev) {
        console.log(`🗑️ Cleared ${cleared} cache entries matching: ${key}`);
      }
    } else {
      cache.delete(key);
      if (isDev) {
        console.log(`🗑️ Cleared cache: ${key}`);
      }
    }
  } else {
    cache.clear();
    if (isDev) {
      console.log(`🗑️ Cleared all cache`);
    }
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const stats = {
    size: cache.size,
    keys: Array.from(cache.keys()),
    entries: Array.from(cache.entries()).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp,
      ageSeconds: Math.round((Date.now() - entry.timestamp) / 1000)
    }))
  };
  
  console.table(stats.entries);
  return stats;
}

// Make cache stats available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).cacheStats = getCacheStats;
  (window as any).clearCache = clearCache;
}

/**
 * Query counter for monitoring
 */
let queryCounter = 0;

export function trackQuery(name: string) {
  queryCounter++;
  if (isDev) {
    logger.query(`📊 Query #${queryCounter}: ${name}`);
  }
}

export function resetQueryCounter() {
  const count = queryCounter;
  queryCounter = 0;
  if (isDev) {
    console.log(`🔄 Query counter reset. Total queries: ${count}`);
  }
  return count;
}

export function getQueryCount() {
  return queryCounter;
}

// Log query count periodically (development mode only)
if (typeof window !== 'undefined' && isDev) {
  setInterval(() => {
    if (queryCounter > 0) {
      console.log(`📊 Total queries in last minute: ${queryCounter}`);
      resetQueryCounter();
    }
  }, 60000); // Every minute
}


