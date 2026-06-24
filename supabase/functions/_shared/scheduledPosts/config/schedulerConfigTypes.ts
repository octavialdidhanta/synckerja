export type SchedulerConfig = {
  batch_size: number;
  per_org_per_tick: number;
  resume_batch_size: number;
  tick_concurrency: number;
  tick_time_budget_ms: number;
  tiktok_global_in_flight: number;
  youtube_global_in_flight: number;
  instagram_global_in_flight: number;
  linkedin_global_in_flight: number;
};

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  batch_size: 20,
  per_org_per_tick: 3,
  resume_batch_size: 10,
  tick_concurrency: 4,
  tick_time_budget_ms: 25000,
  tiktok_global_in_flight: 12,
  youtube_global_in_flight: 6,
  instagram_global_in_flight: 4,
  linkedin_global_in_flight: 4,
};
