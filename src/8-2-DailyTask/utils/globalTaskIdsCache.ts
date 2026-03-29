import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

/**
 * 🌐 GLOBAL TASK IDS CACHE - Singleton Pattern
 * 
 * Provides global deduplication and caching for task IDs across
 * ALL DailyTaskProvider instances and components.
 * 
 * Features:
 * - ✅ Global singleton (works across all provider instances)
 * - ✅ Request deduplication (concurrent calls share same promise)
 * - ✅ Caching with TTL (30 seconds)
 * - ✅ Automatic cleanup
 * - ✅ Thread-safe
 */

interface TaskIdsData {
  stepIds: string[];
  subStepIds: string[];
  timestamp: number;
}

interface PendingRequest {
  promise: Promise<TaskIdsData>;
  timestamp: number;
}

class GlobalTaskIdsCache {
  private cache: Map<string, TaskIdsData> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private readonly CACHE_TTL = 30 * 1000; // 30 seconds
  private readonly PENDING_TIMEOUT = 10 * 1000; // 10 seconds
  private requestCount: Map<string, number> = new Map();

  /**
   * Get task IDs for an employee with automatic deduplication
   */
  async getTaskIds(employeeId: string): Promise<TaskIdsData> {
    const isDev = import.meta.env?.DEV;
    const now = Date.now();

    // Check cache first
    const cached = this.cache.get(employeeId);
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      if (isDev) {
        logger.rateLimited(`global-cache-hit-${employeeId}`, 2000, () => {
          console.log(`🌐 Global Cache HIT for employee ${employeeId.slice(0, 8)}... (age: ${Math.floor((now - cached.timestamp) / 1000)}s)`);
        });
      }
      return cached;
    }

    // Check if there's a pending request
    const pending = this.pendingRequests.get(employeeId);
    if (pending && (now - pending.timestamp) < this.PENDING_TIMEOUT) {
      const requestNum = (this.requestCount.get(employeeId) || 0) + 1;
      this.requestCount.set(employeeId, requestNum);
      
      if (isDev) {
        logger.rateLimited(`global-dedup-${employeeId}`, 1000, () => {
          console.log(`🌐 Global Deduplication: Request #${requestNum} waiting for pending fetch`);
        });
      }
      return pending.promise;
    }

    // Start new fetch
    const fetchPromise = this.fetchTaskIds(employeeId);
    
    // Store as pending
    this.pendingRequests.set(employeeId, {
      promise: fetchPromise,
      timestamp: now
    });

    // Reset request counter
    this.requestCount.set(employeeId, 1);

    try {
      const result = await fetchPromise;
      
      // Cache the result
      this.cache.set(employeeId, result);
      
      // Log deduplication stats
      if (isDev) {
        const dedupedCount = this.requestCount.get(employeeId) || 1;
        if (dedupedCount > 1) {
          console.log(`🌐 Global Deduplication: Served ${dedupedCount} concurrent requests with 1 fetch (${Math.floor((dedupedCount - 1) / dedupedCount * 100)}% reduction)`);
        }
      }
      
      return result;
    } finally {
      // Cleanup pending request
      this.pendingRequests.delete(employeeId);
      this.requestCount.delete(employeeId);
    }
  }

  /**
   * Actual fetch from database
   */
  private async fetchTaskIds(employeeId: string): Promise<TaskIdsData> {
    const isDev = import.meta.env?.DEV;
    const timerId = `global-fetch-${Date.now()}`;
    
    if (isDev) {
      console.time(timerId);
      logger.rateLimited(`global-fetch-start-${employeeId}`, 2000, () => {
        console.log(`🌐 Global Fetch: Starting RPC call for employee ${employeeId.slice(0, 8)}...`);
      });
    }

    const startTime = performance.now();
    const { data: taskAssignments, error: rpcError } = await supabase
      .rpc('get_employee_task_ids', {
        p_employee_id: employeeId
      });
    const duration = performance.now() - startTime;

    if (isDev) {
      console.timeEnd(timerId);
    }

    // Performance monitoring - threshold relaxed so normal RPC latency doesn't warn
    logger.performance(`Global Task IDs Fetch (${employeeId.slice(0, 8)}...)`, duration, 4000);

    if (rpcError) {
      if (isDev) {
        console.error('❌ Global Fetch: RPC error:', rpcError);
      }
      throw rpcError;
    }

    if (!taskAssignments) {
      return {
        stepIds: [],
        subStepIds: [],
        timestamp: Date.now()
      };
    }

    // Group by assignment level
    const stepIds = taskAssignments
      .filter((item: any) => item.assignment_level === 'step')
      .map((item: any) => item.task_id);
    
    const subStepIds = taskAssignments
      .filter((item: any) => item.assignment_level === 'substep')
      .map((item: any) => item.task_id);

    if (isDev) {
      logger.rateLimited(`global-fetch-success-${employeeId}`, 2000, () => {
        console.log('✅ Global Fetch: Success');
        console.log(`  📊 Step-level: ${stepIds.length} items`);
        console.log(`  📊 Sub-step-level: ${subStepIds.length} items`);
      });
    }

    return {
      stepIds,
      subStepIds,
      timestamp: Date.now()
    };
  }

  /**
   * Clear cache for a specific employee or all
   */
  clearCache(employeeId?: string): void {
    if (employeeId) {
      this.cache.delete(employeeId);
      this.pendingRequests.delete(employeeId);
    } else {
      this.cache.clear();
      this.pendingRequests.clear();
    }
  }

  /**
   * Get cache stats (for debugging)
   */
  getStats(): { cacheSize: number; pendingCount: number } {
    return {
      cacheSize: this.cache.size,
      pendingCount: this.pendingRequests.size
    };
  }
}

// Export singleton instance
export const globalTaskIdsCache = new GlobalTaskIdsCache();

// Expose to window for debugging
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  (window as any).globalTaskIdsCache = globalTaskIdsCache;
}
