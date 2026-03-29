
import { APP_CONSTANTS } from './optimizedConstants';

// Optimized debounce function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number = APP_CONSTANTS.CACHE_TIMES.SHORT
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Optimized throttle function
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number = APP_CONSTANTS.CACHE_TIMES.SHORT
): ((...args: Parameters<T>) => void) => {
  let lastCallTime = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCallTime >= delay) {
      lastCallTime = now;
      func(...args);
    }
  };
};

// Memory efficient array chunking
export const chunk = <T>(array: T[], size: number): T[][] => {
  if (size <= 0 || !Array.isArray(array)) return [];
  
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// Safe JSON parsing with fallback
export const safeJSONParse = <T>(str: string, fallback: T): T => {
  try {
    return JSON.parse(str) || fallback;
  } catch {
    return fallback;
  }
};

// Optimized deep clone for small objects
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  
  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
};

// Format currency with memoization
const currencyCache = new Map<string, string>();

export const formatCurrency = (
  amount: number, 
  currency: string = 'IDR',
  locale: string = 'id-ID'
): string => {
  const key = `${amount}-${currency}-${locale}`;
  
  if (currencyCache.has(key)) {
    return currencyCache.get(key)!;
  }
  
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  
  currencyCache.set(key, formatted);
  return formatted;
};

// Clear cache periodically to prevent memory leaks
setInterval(() => {
  if (currencyCache.size > 1000) {
    currencyCache.clear();
  }
}, APP_CONSTANTS.CACHE_TIMES.VERY_LONG);
