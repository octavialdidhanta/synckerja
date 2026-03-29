import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';
import { filterValidCycleIds } from '@/shared/lib/uuidValidation';

/**
 * 🌐 GLOBAL DEPARTMENT OBJECTIVES CACHE
 * 
 * Provides global deduplication and caching for department objectives
 * across ALL components and hooks.
 * 
 * Features:
 * - ✅ Global singleton (works across all components)
 * - ✅ Request deduplication (concurrent calls share same promise)
 * - ✅ Caching with TTL (30 seconds)
 * - ✅ Automatic cleanup
 * - ✅ Thread-safe
 */

interface DepartmentObjectivesData {
  data: any[];
  timestamp: number;
}

interface PendingRequest {
  promise: Promise<any[]>;
  timestamp: number;
}

class GlobalDepartmentObjectivesCache {
  private cache: Map<string, DepartmentObjectivesData> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private readonly CACHE_TTL = 120 * 1000; // 120 seconds - increased to reduce refetch frequency
  private readonly PENDING_TIMEOUT = 20 * 1000; // 20 seconds - increased to handle slow queries
  private requestCount: Map<string, number> = new Map();

  /**
   * Generate cache key from parameters
   */
  private getCacheKey(organizationId: string, cycleIds?: string[], includeIndividualObjectives?: boolean): string {
    const cycleKey = cycleIds && cycleIds.length > 0 
      ? filterValidCycleIds(cycleIds).sort().join(',') 
      : 'all';
    const includeKey = includeIndividualObjectives ? 'with-individual' : 'no-individual';
    return `${organizationId}:${cycleKey}:${includeKey}`;
  }

  /**
   * Get department objectives with automatic deduplication
   */
  async getDepartmentObjectives(
    organizationId: string, 
    cycleIds?: string[], 
    includeIndividualObjectives: boolean = false
  ): Promise<any[]> {
    const isDev = import.meta.env?.DEV;
    const now = Date.now();
    const cacheKey = this.getCacheKey(organizationId, cycleIds, includeIndividualObjectives);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      if (isDev) {
        logger.rateLimited(`dept-cache-hit-${cacheKey}`, 2000, () => {
          console.log(`🌐 Department Objectives: Cache HIT (age: ${Math.floor((now - cached.timestamp) / 1000)}s)`);
        });
      }
      return cached.data;
    }

    // Check if there's a pending request
    const pending = this.pendingRequests.get(cacheKey);
    if (pending && (now - pending.timestamp) < this.PENDING_TIMEOUT) {
      const requestNum = (this.requestCount.get(cacheKey) || 0) + 1;
      this.requestCount.set(cacheKey, requestNum);
      
      if (isDev) {
        logger.rateLimited(`dept-dedup-${cacheKey}`, 1000, () => {
          console.log(`🌐 Department Objectives: Request #${requestNum} waiting for pending fetch`);
        });
      }
      return pending.promise;
    }

    // Start new fetch
    const fetchPromise = this.fetchDepartmentObjectives(organizationId, cycleIds, includeIndividualObjectives);
    
    // Store as pending
    this.pendingRequests.set(cacheKey, {
      promise: fetchPromise,
      timestamp: now
    });

    // Reset request counter
    this.requestCount.set(cacheKey, 1);

    try {
      const result = await fetchPromise;
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: now
      });
      
      // Log deduplication stats
      if (isDev) {
        const dedupedCount = this.requestCount.get(cacheKey) || 1;
        if (dedupedCount > 1) {
          console.log(`🌐 Department Objectives: Served ${dedupedCount} concurrent requests with 1 fetch (${Math.floor((dedupedCount - 1) / dedupedCount * 100)}% reduction)`);
        }
      }
      
      return result;
    } finally {
      // Cleanup pending request
      this.pendingRequests.delete(cacheKey);
      this.requestCount.delete(cacheKey);
    }
  }

  /**
   * Fetch via RPC (single round-trip). Used when includeIndividualObjectives is false.
   * Falls back to client queries on error or when RPC not available.
   */
  private async fetchDepartmentObjectivesViaRpc(
    organizationId: string,
    cycleIds?: string[]
  ): Promise<any[] | null> {
    const validCycleIds = filterValidCycleIds(cycleIds);
    const pCycleIds = validCycleIds.length > 0 ? validCycleIds : null;
    const startTime = performance.now();
    const { data, error } = await supabase.rpc('get_department_objectives_with_key_results', {
      p_organization_id: organizationId,
      p_cycle_ids: pCycleIds,
      p_include_individual: false,
    });
    const duration = performance.now() - startTime;
    logger.performance(`Department Objectives RPC (${organizationId})`, duration, 6000);
    if (error) {
      if (import.meta.env?.DEV) {
        logger.debug('Department Objectives RPC fallback (using client queries):', error.message);
      }
      return null;
    }
    if (data == null || !Array.isArray(data)) return data ?? [];
    return data as any[];
  }

  /**
   * Actual fetch from database (tries RPC first when not including individual objectives)
   */
  private async fetchDepartmentObjectives(
    organizationId: string,
    cycleIds?: string[],
    includeIndividualObjectives: boolean = false
  ): Promise<any[]> {
    const isDev = import.meta.env?.DEV;
    const timerId = `dept-fetch-${Date.now()}`;
    
    if (isDev) {
      console.time(timerId);
      logger.rateLimited(`dept-fetch-start`, 2000, () => {
        console.log('🌐 Department Objectives: Starting database fetch');
      });
    }

    logger.query('🔍 Fetching department objectives:', { organizationId, cycleIds, includeIndividualObjectives });

    // Prefer RPC (single round-trip) when not including individual objectives
    if (!includeIndividualObjectives) {
      const rpcResult = await this.fetchDepartmentObjectivesViaRpc(organizationId, cycleIds);
      if (rpcResult !== null) {
        if (isDev) console.timeEnd(timerId);
        if (isDev) logger.debug('✅ Department objectives fetched via RPC:', rpcResult.length);
        return rpcResult;
      }
    }

    // Fallback: client queries (2 round-trips)
    // Build base query
    let selectQuery = `
      *,
      departments!inner(name),
      company_objectives!inner(title),
      okr_cycles!inner(name, year, quarter)
    `;

    // Add individual objectives if requested
    if (includeIndividualObjectives) {
      selectQuery += `,
        individual_objectives(
          id,
          title,
          description,
          progress_percentage,
          status,
          employees!inner(full_name)
        )`;
    }

    let query = supabase
      .from('department_objectives')
      .select(selectQuery)
      .eq('organization_id', organizationId);

    // Filter by multiple cycle IDs if provided (only valid UUIDs)
    const validCycleIds = filterValidCycleIds(cycleIds);
    if (validCycleIds.length > 0) {
      query = query.in('cycle_id', validCycleIds);
    }

    const startTime = performance.now();
    const { data, error } = await query.order('created_at', { ascending: false });
    const duration = performance.now() - startTime;

    if (isDev) {
      console.timeEnd(timerId);
    }

    // Performance monitoring - threshold relaxed so normal slow fetches don't warn (query can be 4–5s+)
    logger.performance(`Department Objectives Fetch (${organizationId})`, duration, 6000);

    if (error) {
      console.error('❌ Error fetching department objectives:', error);
      throw error;
    }

    // Fetch key_results for all department objectives
    const deptIds = data?.map((obj: any) => obj.id) || [];
    let keyResultsData: any[] = [];
    if (deptIds.length > 0) {
      const { data: krData } = await supabase
        .from('key_results')
        .select('id, title, target_value, current_value, unit, metric_type, progress_percentage, weight, department_objective_id, company_objective_id')
        .in('department_objective_id', deptIds)
        .is('company_objective_id', null);
      keyResultsData = krData || [];
    }

    // Group key results by department_objective_id
    const keyResultsByDeptId = new Map<string, any[]>();
    keyResultsData.forEach(kr => {
      if (kr.department_objective_id) {
        const existing = keyResultsByDeptId.get(kr.department_objective_id) || [];
        existing.push(kr);
        keyResultsByDeptId.set(kr.department_objective_id, existing);
      }
    });

    // Add key_results to each department objective
    const dataWithKeyResults = (data || []).map((obj: any) => {
      const allKeyResults = keyResultsByDeptId.get(obj.id) || [];
      const actualKeyResults = allKeyResults.filter((kr: any) => {
        const titleMatches = kr.title?.toLowerCase().trim() === obj.title?.toLowerCase().trim();
        const hasCompanyObjectiveId = kr.company_objective_id !== null && kr.company_objective_id !== undefined;
        return !titleMatches && !hasCompanyObjectiveId;
      });
      return {
        ...obj,
        key_results: actualKeyResults
      };
    });

    if (isDev) {
      logger.debug('✅ Department objectives fetched:', dataWithKeyResults);
      
      // Only check for "te" objective if verbose logging is enabled (reduces unnecessary work)
      const isVerbose = import.meta.env.VITE_VERBOSE_LOGGING === 'true';
      if (isVerbose) {
        const teObjective = dataWithKeyResults?.find((obj: any) => obj.title === 'te');
        if (teObjective) {
          logger.debug('🚨 FOUND "te" OBJECTIVE in database query:', {
            id: teObjective.id,
            title: teObjective.title,
            status: teObjective.status,
            cycle_id: teObjective.cycle_id,
            organization_id: teObjective.organization_id,
            created_at: teObjective.created_at,
            updated_at: teObjective.updated_at,
            key_results_count: teObjective.key_results?.length || 0
          });
        }
      }
    }

    return dataWithKeyResults;
  }

  /**
   * Clear cache for specific key or all
   */
  clearCache(cacheKey?: string): void {
    if (cacheKey) {
      this.cache.delete(cacheKey);
      this.pendingRequests.delete(cacheKey);
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
export const globalDepartmentObjectivesCache = new GlobalDepartmentObjectivesCache();

// Expose to window for debugging
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  (window as any).globalDepartmentObjectivesCache = globalDepartmentObjectivesCache;
}
