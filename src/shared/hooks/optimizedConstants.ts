
// Optimized application constants with performance considerations
export const APP_CONSTANTS = {
  // Cache durations (in milliseconds)
  CACHE_TIMES: {
    SHORT: 2 * 60 * 1000,      // 2 minutes
    MEDIUM: 5 * 60 * 1000,     // 5 minutes  
    LONG: 15 * 60 * 1000,      // 15 minutes
    VERY_LONG: 60 * 60 * 1000, // 1 hour
  },

  // Performance thresholds
  PERFORMANCE: {
    SLOW_RENDER_THRESHOLD: 16,     // 16ms (60fps)
    CRITICAL_RENDER_THRESHOLD: 50, // 50ms
    MEMORY_WARNING_THRESHOLD: 50 * 1024 * 1024, // 50MB
    BUNDLE_SIZE_WARNING: 1000,     // 1MB
    MAX_CACHE_ENTRIES: 100,
    DEBOUNCE_DELAY: 300,          // 300ms
    THROTTLE_DELAY: 1000,         // 1s
  },
} as const;
























