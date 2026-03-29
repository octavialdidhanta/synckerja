/**
 * Development Logger Utility
 * Only logs in development mode to improve production performance
 */

const isDevelopment = import.meta.env.DEV;

export const devLog = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors, even in production
    console.error(...args);
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  table: (...args: any[]) => {
    if (isDevelopment) {
      console.table(...args);
    }
  }
};

export default devLog;




