import { supabase } from "@/shared/lib/supabaseClient";
import { logger } from "@/shared/lib/logger";

interface BatchQueryOptions {
  batchSize: number;
  timeout: number;
  delayBetweenBatches?: number;
  skipOnError?: boolean;
  onError?: (error: any, batch: string[]) => void;
}

interface QueryBuilder<T> {
  (batch: string[]): Promise<{ data: T[] | null; error: any }>;
}

export async function processBatchQuery<T>(ids: string[], queryBuilder: QueryBuilder<T>, options: BatchQueryOptions): Promise<T[]> {
  const { batchSize, timeout, delayBetweenBatches = 0, skipOnError = true, onError } = options;
  if (ids.length === 0) return [];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize));

  const allResults: T[] = [];
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    try {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Query timeout")), timeout));
      const result = await Promise.race([queryBuilder(batch), timeoutPromise]);
      if (result.data?.length) allResults.push(...result.data);
    } catch (err: any) {
      if (onError) onError(err, batch);
      if (!skipOnError) throw err;
    }
    if (delayBetweenBatches > 0 && i < batches.length - 1) await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
  }
  return allResults;
}

export async function fetchCompletionDates(stepIds: string[]): Promise<Record<string, string>> {
  logger.debug("Completion dates query disabled", stepIds.length);
  return {};
}

export async function fetchStepBlockers(stepIds: string[], isSubStep = false): Promise<any[]> {
  logger.debug("Step blockers query disabled", { count: stepIds.length, isSubStep });
  return [];
}
