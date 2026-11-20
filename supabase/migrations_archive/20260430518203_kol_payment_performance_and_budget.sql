create table if not exists public.kol_payment_terms (
  id uuid not null default gen_random_uuid (),
  campaign_id uuid null,
  kol_profile_id uuid null,
  organization_id uuid not null,
  payment_model text not null default 'fixed'::text,
  base_amount numeric(15, 2) null default 0,
  bonus_amount numeric(15, 2) null default 0,
  bonus_conditions jsonb null default '{}'::jsonb,
  performance_thresholds jsonb null default '{}'::jsonb,
  barter_value numeric(15, 2) null default 0,
  currency text null default 'IDR'::text,
  payment_schedule text null default 'milestone_based'::text,
  terms_and_conditions text null,
  status text null default 'draft'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  created_by uuid null,
  type text not null,
  effective_start_date date null,
  effective_end_date date null,
  terms_version integer not null default 1,
  milestones jsonb null default '[]'::jsonb,
  is_active boolean not null default true,
  template_name text null,
  kol_content_post_id uuid null,
  down_payment_amount numeric null default 0,
  down_payment_date date null,
  remaining_amount numeric null default 0,
  final_payment_date date null,
  deduction_amount numeric null default 0,
  deduction_reason text null,
  constraint kol_payment_terms_pkey primary key (id),
  constraint kol_payment_terms_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint kol_payment_terms_kol_content_post_id_fkey foreign KEY (kol_content_post_id) references kol_content_posts (id) on delete set null,
  constraint kol_payment_terms_kol_profile_id_fkey foreign KEY (kol_profile_id) references kol_profiles (id) on delete CASCADE,
  constraint kol_payment_terms_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint kol_payment_terms_campaign_id_fkey foreign KEY (campaign_id) references kol_campaigns (id) on delete CASCADE,
  constraint check_template_fields check (
    (
      (
        (type = 'template'::text)
        and (campaign_id is null)
        and (kol_profile_id is null)
        and (template_name is not null)
      )
      or (type = 'agreement'::text)
    )
  ),
  constraint check_payment_terms_type check (
    (
      type = any (array['template'::text, 'agreement'::text])
    )
  ),
  constraint check_effective_dates check (
    (
      (effective_start_date is null)
      or (effective_end_date is null)
      or (effective_start_date <= effective_end_date)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_kol_payment_terms_active on public.kol_payment_terms using btree (is_active) TABLESPACE pg_default
where
  (is_active = true);

create index IF not exists idx_kol_payment_terms_campaign on public.kol_payment_terms using btree (campaign_id) TABLESPACE pg_default
where
  (campaign_id is not null);

create index IF not exists idx_kol_payment_terms_campaign_id on public.kol_payment_terms using btree (campaign_id) TABLESPACE pg_default;

create index IF not exists idx_kol_payment_terms_kol_profile_id on public.kol_payment_terms using btree (kol_profile_id) TABLESPACE pg_default;

create index IF not exists idx_kol_payment_terms_kol on public.kol_payment_terms using btree (kol_profile_id) TABLESPACE pg_default
where
  (kol_profile_id is not null);

create unique INDEX IF not exists idx_unique_active_template_name on public.kol_payment_terms using btree (organization_id, template_name) TABLESPACE pg_default
where
  (
    (type = 'template'::text)
    and (is_active = true)
  );

create index IF not exists idx_kol_payment_terms_content_post_id on public.kol_payment_terms using btree (kol_content_post_id) TABLESPACE pg_default;

create index IF not exists idx_kol_payment_terms_type on public.kol_payment_terms using btree (type) TABLESPACE pg_default;

drop trigger if exists kol_payment_terms_updated_at on public.kol_payment_terms;
create trigger kol_payment_terms_updated_at BEFORE
update on kol_payment_terms for EACH row
execute FUNCTION handle_updated_at ();

drop trigger if exists sync_payment_milestones_trigger on public.kol_payment_terms;
create trigger sync_payment_milestones_trigger
after INSERT
or
update on kol_payment_terms for EACH row
execute FUNCTION sync_payment_milestones ();

-- Single updated_at trigger (avoids duplicate handle_updated_at on same table)
drop trigger if exists update_kol_payment_terms_updated_at on public.kol_payment_terms;

create table if not exists public.kol_performance_metrics (
  id uuid not null default gen_random_uuid (),
  content_post_id uuid not null,
  views integer null default 0,
  likes integer null default 0,
  comments integer null default 0,
  shares integer null default 0,
  saves integer null default 0,
  clicks integer null default 0,
  reach integer null default 0,
  impressions integer null default 0,
  engagement_rate numeric(5, 2) null default 0.00,
  recorded_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  kol_profile_id uuid not null,
  organization_id uuid null,
  conversion_rate numeric null default 0,
  updated_at timestamp with time zone null default now(),
  constraint kol_performance_metrics_pkey primary key (id),
  constraint kol_performance_metrics_content_post_id_fkey foreign KEY (content_post_id) references kol_content_posts (id) on delete CASCADE,
  constraint kol_performance_metrics_kol_profile_id_fkey foreign KEY (kol_profile_id) references kol_profiles (id),
  constraint kol_performance_metrics_organization_id_fkey foreign KEY (organization_id) references organizations (id)
) TABLESPACE pg_default;

create index IF not exists idx_kol_performance_metrics_content_post_id on public.kol_performance_metrics using btree (content_post_id) TABLESPACE pg_default;

drop trigger if exists update_kol_performance_updated_at_trigger on public.kol_performance_metrics;
create trigger update_kol_performance_updated_at_trigger BEFORE
update on kol_performance_metrics for EACH row
execute FUNCTION handle_updated_at ();

create table if not exists public.kol_performance_thresholds (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  kol_content_post_id uuid null,
  kol_profile_id uuid null,
  campaign_id uuid null,
  payment_terms_id uuid null,
  metric_type text not null,
  target_value numeric not null,
  bonus_percentage numeric null default 0,
  current_value numeric null default 0,
  is_achieved boolean null default false,
  achieved_at timestamp with time zone null,
  description text null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint kol_performance_thresholds_pkey primary key (id),
  constraint kol_performance_thresholds_bonus_percentage_check check (
    (
      (bonus_percentage >= (0)::numeric)
      and (bonus_percentage <= (100)::numeric)
    )
  ),
  constraint kol_performance_thresholds_metric_type_check check (
    (
      metric_type = any (
        array[
          'reach'::text,
          'engagement'::text,
          'conversion'::text,
          'views'::text,
          'clicks'::text,
          'saves'::text,
          'shares'::text,
          'comments'::text,
          'likes'::text
        ]
      )
    )
  ),
  constraint kol_performance_thresholds_target_value_check check ((target_value > (0)::numeric))
) TABLESPACE pg_default;

create index IF not exists idx_kol_performance_thresholds_content_post on public.kol_performance_thresholds using btree (kol_content_post_id) TABLESPACE pg_default;

create index IF not exists idx_kol_performance_thresholds_kol_profile on public.kol_performance_thresholds using btree (kol_profile_id) TABLESPACE pg_default;

create index IF not exists idx_kol_performance_thresholds_campaign on public.kol_performance_thresholds using btree (campaign_id) TABLESPACE pg_default;

create index IF not exists idx_kol_performance_thresholds_payment_terms on public.kol_performance_thresholds using btree (payment_terms_id) TABLESPACE pg_default;

create index IF not exists idx_kol_performance_thresholds_metric_type on public.kol_performance_thresholds using btree (metric_type) TABLESPACE pg_default;

create index IF not exists idx_kol_performance_thresholds_org_id on public.kol_performance_thresholds using btree (organization_id) TABLESPACE pg_default;

drop trigger if exists check_threshold_achievement_trigger on public.kol_performance_thresholds;
create trigger check_threshold_achievement_trigger BEFORE
update on kol_performance_thresholds for EACH row
execute FUNCTION check_threshold_achievement ();

drop trigger if exists update_kol_performance_thresholds_updated_at on public.kol_performance_thresholds;
create trigger update_kol_performance_thresholds_updated_at BEFORE
update on kol_performance_thresholds for EACH row
execute FUNCTION handle_updated_at ();

create table if not exists public.kol_campaign_budget_allocations (
  id uuid not null default gen_random_uuid (),
  campaign_id uuid not null,
  kol_profile_id uuid not null,
  allocated_budget numeric(12, 2) not null default 0,
  budget_type text null default 'fixed'::text,
  notes text null,
  organization_id uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  payment_model text null default 'fixed'::text,
  base_budget numeric(15, 2) null default 0,
  bonus_budget numeric(15, 2) null default 0,
  performance_multiplier numeric(3, 2) null default 1.0,
  payment_terms_id uuid null,
  milestone_completion_rate numeric(5, 2) null default 0,
  actual_payout numeric(15, 2) null default 0,
  budget_utilization_percentage numeric GENERATED ALWAYS as (
    case
      when (
        (allocated_budget > (0)::numeric)
        and (actual_payout is not null)
      ) then (
        (actual_payout / allocated_budget) * (100)::numeric
      )
      else (0)::numeric
    end
  ) STORED null,
  constraint kol_campaign_budget_allocations_pkey primary key (id),
  constraint kol_campaign_budget_allocations_campaign_id_kol_profile_id_key unique (campaign_id, kol_profile_id),
  constraint kol_campaign_budget_allocations_kol_profile_id_fkey foreign KEY (kol_profile_id) references kol_profiles (id) on delete CASCADE,
  constraint kol_campaign_budget_allocations_organization_id_fkey foreign KEY (organization_id) references organizations (id),
  constraint kol_campaign_budget_allocations_campaign_id_fkey foreign KEY (campaign_id) references kol_campaigns (id) on delete CASCADE,
  constraint kol_campaign_budget_allocations_payment_terms_id_fkey foreign KEY (payment_terms_id) references kol_payment_terms (id),
  constraint kol_campaign_budget_allocations_budget_type_check check (
    (
      budget_type = any (
        array[
          'fixed'::text,
          'performance'::text,
          'hybrid'::text
        ]
      )
    )
  ),
  constraint kol_campaign_budget_allocations_payment_model_check check (
    (
      payment_model = any (
        array[
          'fixed'::text,
          'fixed_plus_bonus'::text,
          'performance_based'::text,
          'tiered'::text,
          'barter_plus_fee'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_kol_campaign_budget_allocations_campaign_id on public.kol_campaign_budget_allocations using btree (campaign_id) TABLESPACE pg_default;

create index IF not exists idx_kol_campaign_budget_allocations_kol_profile_id on public.kol_campaign_budget_allocations using btree (kol_profile_id) TABLESPACE pg_default;

create index IF not exists idx_budget_allocation_campaign on public.kol_campaign_budget_allocations using btree (campaign_id) TABLESPACE pg_default;

create index IF not exists idx_budget_allocation_kol_org on public.kol_campaign_budget_allocations using btree (kol_profile_id, organization_id) TABLESPACE pg_default;

create index IF not exists idx_budget_allocation_budget_type on public.kol_campaign_budget_allocations using btree (budget_type) TABLESPACE pg_default;

drop trigger if exists handle_updated_at_kol_campaign_budget_allocations on public.kol_campaign_budget_allocations;
create trigger handle_updated_at_kol_campaign_budget_allocations BEFORE
update on kol_campaign_budget_allocations for EACH row
execute FUNCTION handle_updated_at ();

drop trigger if exists trigger_auto_create_payment_terms on public.kol_campaign_budget_allocations;
create trigger trigger_auto_create_payment_terms
after INSERT on kol_campaign_budget_allocations for EACH row
execute FUNCTION auto_create_payment_terms ();

drop trigger if exists trigger_update_campaign_budget_totals on public.kol_campaign_budget_allocations;
create trigger trigger_update_campaign_budget_totals
after INSERT
or DELETE
or
update on kol_campaign_budget_allocations for EACH row
execute FUNCTION update_campaign_budget_totals ();

