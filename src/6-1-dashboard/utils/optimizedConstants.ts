// Optimized application constants with performance considerations
export const APP_CONSTANTS = {
  // Cache durations (in milliseconds)
  CACHE: {
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

  // Query optimization
  QUERY: {
    STALE_TIME: 2 * 60 * 1000,    // 2 minutes
    GC_TIME: 10 * 60 * 1000,      // 10 minutes
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY: 1000,            // 1 second
    NETWORK_MODE: 'online' as const,
  },

  // Development settings
  DEV: {
    ENABLE_PERFORMANCE_MONITOR: true,
    ENABLE_QUERY_DEVTOOLS: true,
    LOG_LEVEL: 'DEBUG' as const,
    PERFORMANCE_BUDGET: {
      FCP: 1800,  // First Contentful Paint
      LCP: 2500,  // Largest Contentful Paint
      FID: 100,   // First Input Delay
      CLS: 0.1,   // Cumulative Layout Shift
    }
  },

  // Production settings
  PROD: {
    ENABLE_PERFORMANCE_MONITOR: false,
    ENABLE_QUERY_DEVTOOLS: false,
    LOG_LEVEL: 'ERROR' as const,
    ERROR_REPORTING: true,
  },

  // Memory management
  MEMORY: {
    MAX_LOG_QUEUE_SIZE: 50,
    MAX_METRIC_HISTORY: 100,
    CLEANUP_INTERVAL: 10 * 60 * 1000, // 10 minutes
    GC_THRESHOLD: 0.8, // 80% memory usage
  },

  // Request optimization
  REQUEST: {
    MAX_CONCURRENT: 6,
    TIMEOUT: 30000, // 30 seconds
    MAX_RETRIES: 2,
    BATCH_SIZE: 10,
    CONSOLIDATION_DELAY: 50, // 50ms
  },

  // File upload optimization
  UPLOAD: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    CHUNK_SIZE: 1024 * 1024,         // 1MB chunks
    MAX_CONCURRENT_UPLOADS: 3,
    SUPPORTED_FORMATS: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'] as const,
  },

  // UI Performance
  UI: {
    VIRTUAL_LIST_THRESHOLD: 100,    // Items before virtualization
    PAGINATION_SIZE: 20,
    INFINITE_SCROLL_THRESHOLD: 200, // pixels from bottom
    ANIMATION_DURATION: 200,        // ms
    SKELETON_COUNT: 5,
  },

  // Backward compatibility - add these to main object
  CACHE_TIMES: {
    SHORT: 2 * 60 * 1000,      // 2 minutes
    MEDIUM: 5 * 60 * 1000,     // 5 minutes  
    LONG: 15 * 60 * 1000,      // 15 minutes
    VERY_LONG: 60 * 60 * 1000, // 1 hour
  },

  RETRY_CONFIG: {
    ATTEMPTS: 2,
    attempts: 2,            // lowercase for compatibility
    DELAY: 1000,            // 1 second
    delay: 1000,            // lowercase for compatibility
    MAX_RETRIES: 2,
    backoff: 2,             // exponential backoff multiplier
  },

  REFETCH_INTERVALS: {
    SHORT: 2 * 60 * 1000,      // 2 minutes
    MEDIUM: 5 * 60 * 1000,     // 5 minutes  
    LONG: 15 * 60 * 1000,      // 15 minutes
    VERY_LONG: 60 * 60 * 1000, // 1 hour
    FAST: 30 * 1000,           // 30 seconds
  },
} as const;

// Environment-specific constants
export const getEnvironmentConstants = () => {
  const isDev = process.env.NODE_ENV === 'development';
  
  return {
    ...APP_CONSTANTS,
    CURRENT_ENV: isDev ? APP_CONSTANTS.DEV : APP_CONSTANTS.PROD,
    IS_DEVELOPMENT: isDev,
    IS_PRODUCTION: !isDev,
  };
};

// Performance budget configuration
export const PERFORMANCE_BUDGET = {
  // Core Web Vitals
  LCP: { good: 2500, poor: 4000 },      // Largest Contentful Paint (ms)
  FID: { good: 100, poor: 300 },        // First Input Delay (ms) 
  CLS: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 },      // First Contentful Paint (ms)
  TTFB: { good: 800, poor: 1800 },      // Time to First Byte (ms)

  // Application metrics
  BUNDLE_SIZE: { good: 500, poor: 1000 },    // KB
  MEMORY_USAGE: { good: 30, poor: 50 },      // MB
  RENDER_TIME: { good: 16, poor: 50 },       // ms
  DOM_NODES: { good: 1000, poor: 1500 },     // count
  
  // Network metrics
  API_RESPONSE: { good: 500, poor: 2000 },   // ms
  IMAGE_LOAD: { good: 1000, poor: 3000 },    // ms
} as const;

// Backward compatibility exports for existing files
export const CACHE_TIMES = APP_CONSTANTS.CACHE_TIMES;
export const RETRY_CONFIG = APP_CONSTANTS.RETRY_CONFIG;
export const REFETCH_INTERVALS = APP_CONSTANTS.REFETCH_INTERVALS;

export const QUERY_KEYS = {
  // Backward compatibility with uppercase keys
  EMPLOYEES: ['employees-optimized'] as const,
  CAMPAIGN_PERFORMANCE: ['campaign-performance-optimized'] as const,
  KOL_PERFORMANCE: ['kol-performance-optimized'] as const,
  
  // New structure
  employees: {
    all: ['employees-optimized'] as const,
    detail: (id: string) => ['employee-detail-optimized', id] as const,
    list: (filters?: Record<string, any>) => ['employees-list-optimized', filters] as const,
  },
  recruitment: {
    all: ['recruitment-optimized'] as const,
    jobs: ['recruitment-jobs-optimized'] as const,
    candidates: ['recruitment-candidates-optimized'] as const,
    applications: (jobId?: string) => 
      jobId ? ['recruitment-applications-optimized', jobId] as const 
             : ['recruitment-applications-optimized'] as const,
  },
  campaigns: {
    all: ['campaigns-optimized'] as const,
    performance: (id?: string) => ['campaign-performance-optimized', id] as const,
    kol: ['kol-performance-optimized'] as const,
  },
  subscription: {
    status: (orgId?: string) => ['subscription-status-optimized', orgId] as const,
    plans: ['subscription-plans-optimized'] as const,
    notifications: (orgId?: string) => ['subscription-notifications-optimized', orgId] as const,
  },
  attendance: {
    records: (employeeId?: string) => ['attendance-records-optimized', employeeId] as const,
    stats: (orgId?: string) => ['attendance-stats-optimized', orgId] as const,
  },
} as const;

export const ERROR_BOUNDARIES = {
  FALLBACK_COMPONENT: 'ErrorFallback',
  RETRY_ATTEMPTS: 3,
  AUTO_RECOVERY: true,
  LOG_ERRORS: true,
  DEVELOPMENT_MODE: process.env.NODE_ENV === 'development',
  PRODUCTION_REPORTING: process.env.NODE_ENV === 'production',
  API_CALLS: 'api-calls',
  THIRD_PARTY_SCRIPTS: 'third-party-scripts', 
  REDDIT_PIXEL: 'reddit-pixel',
} as const;

// Feature flags for performance optimizations
export const PERFORMANCE_FLAGS = {
  ENABLE_REQUEST_CONSOLIDATION: true,
  ENABLE_AGGRESSIVE_CACHING: true,
  ENABLE_MEMORY_MONITORING: true,
  ENABLE_BUNDLE_ANALYSIS: true,
  ENABLE_QUERY_OPTIMIZATION: true,
  ENABLE_COMPONENT_PROFILING: false,  // CPU intensive
  ENABLE_NETWORK_MONITORING: true,
} as const;