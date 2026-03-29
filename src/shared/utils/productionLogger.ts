// Production-safe logger that completely eliminates console calls in production
interface LogLevel {
  DEBUG: 0;
  INFO: 1;
  WARN: 2;
  ERROR: 3;
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class ProductionLogger {
  private static instance: ProductionLogger;
  private isDevelopment = process.env.NODE_ENV === 'development';
  private currentLevel: 0 | 3 = this.isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;
  private logQueue: Array<{ level: string; message: any; args: any[]; timestamp: number }> = [];
  private maxQueueSize = 100;

  static getInstance(): ProductionLogger {
    if (!ProductionLogger.instance) {
      ProductionLogger.instance = new ProductionLogger();
    }
    return ProductionLogger.instance;
  }

  private shouldLog(level: number): boolean {
    return this.isDevelopment && level >= this.currentLevel;
  }

  private queueLog(level: string, message: any, args: any[]): void {
    // Only queue critical errors in production
    if (!this.isDevelopment && level !== 'ERROR') return;
    
    this.logQueue.push({
      level,
      message,
      args,
      timestamp: Date.now()
    });

    // Maintain queue size
    if (this.logQueue.length > this.maxQueueSize) {
      this.logQueue.shift();
    }
  }

  private formatMessage(level: string, message: any, ...args: any[]): void {
    this.queueLog(level, message, args);
    
    if (!this.shouldLog(LOG_LEVELS[level as keyof LogLevel])) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${level}:`;
    
    // Performance-optimized logging
    switch (level) {
      case 'DEBUG':
        console.debug(prefix, message, ...args);
        break;
      case 'INFO':
        console.info(prefix, message, ...args);
        break;
      case 'WARN':
        console.warn(prefix, message, ...args);
        break;
      case 'ERROR':
        console.error(prefix, message, ...args);
        // In production, only errors are sent to external logging
        if (!this.isDevelopment) {
          this.sendToExternalLogging({ level, message, args, timestamp: Date.now() });
        }
        break;
    }
  }

  private sendToExternalLogging(logEntry: { level: string; message: any; args: any[]; timestamp: number }): void {
    // Send to external error tracking (Sentry, LogRocket, etc.)
    // Only in production and only for errors
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'error', {
        event_category: 'Application Error',
        event_label: String(logEntry.message),
        value: 1
      });
    }
  }

  debug(message: any, ...args: any[]): void {
    this.formatMessage('DEBUG', message, ...args);
  }

  info(message: any, ...args: any[]): void {
    this.formatMessage('INFO', message, ...args);
  }

  warn(message: any, ...args: any[]): void {
    this.formatMessage('WARN', message, ...args);
  }

  error(message: any, ...args: any[]): void {
    this.formatMessage('ERROR', message, ...args);
  }

  // Performance timing with production safety
  time(label: string): void {
    if (this.isDevelopment) {
      performance.mark(`${label}-start`);
    }
  }

  timeEnd(label: string): void {
    if (this.isDevelopment) {
      try {
        performance.mark(`${label}-end`);
        performance.measure(label, `${label}-start`, `${label}-end`);
        const measure = performance.getEntriesByName(label)[0];
        this.debug(`⏱️ ${label}: ${measure.duration.toFixed(2)}ms`);
      } catch (error) {
        this.warn(`Performance measurement failed for ${label}`);
      }
    }
  }

  // Get queued logs for debugging
  getQueuedLogs(): Array<{ level: string; message: any; args: any[]; timestamp: number }> {
    return [...this.logQueue];
  }

  // Clear queue
  clearQueue(): void {
    this.logQueue = [];
  }

  // Set log level dynamically
  setLogLevel(level: 'DEBUG' | 'ERROR'): void {
    if (this.isDevelopment) {
      this.currentLevel = level === 'DEBUG' ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;
    } else {
      this.currentLevel = LOG_LEVELS.ERROR;
    }
  }
}

// Export singleton instance
export const logger = ProductionLogger.getInstance();

// Convenience exports with no-op in production
export const debug = (message: any, ...args: any[]) => logger.debug(message, ...args);
export const info = (message: any, ...args: any[]) => logger.info(message, ...args);
export const warn = (message: any, ...args: any[]) => logger.warn(message, ...args);
export const error = (message: any, ...args: any[]) => logger.error(message, ...args);
export const time = (label: string) => logger.time(label);
export const timeEnd = (label: string) => logger.timeEnd(label);
























