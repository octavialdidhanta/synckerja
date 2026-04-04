create table public.kol_campaign_assignments (
  id uuid not null default gen_random_uuid (),
  campaign_id uuid not null,
  kol_profile_id uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint kol_campaign_assignments_pkey primary key (id),
  constraint kol_campaign_assignments_campaign_id_fkey foreign KEY (campaign_id) references kol_campaigns (id) on delete CASCADE,
  constraint kol_campaign_assignments_kol_profile_id_fkey foreign KEY (kol_profile_id) references kol_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_kol_campaign_assignments_campaign_id on public.kol_campaign_assignments using btree (campaign_id) TABLESPACE pg_default;

create trigger kol_campaign_assignments_updated_at BEFORE
update on kol_campaign_assignments for EACH row
execute FUNCTION update_kol_updated_at ();

create table public.kol_campaign_deliverables (
  id uuid not null default gen_random_uuid (),
  campaign_id uuid not null,
  content_type text not null,
  platform text not null,
  quantity integer not null default 1,
  description text null,
  due_date date null,
  status text null default 'pending'::text,
  organization_id uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  kol_profile_id uuid null,
  deliverable_type text null,
  price_per_deliverable numeric(15, 2) null default 0,
  total_price numeric(15, 2) null default 0,
  constraint kol_campaign_deliverables_pkey primary key (id),
  constraint kol_campaign_deliverables_campaign_id_fkey foreign KEY (campaign_id) references kol_campaigns (id) on delete CASCADE,
  constraint kol_campaign_deliverables_kol_profile_id_fkey foreign KEY (kol_profile_id) references kol_profiles (id),
  constraint kol_campaign_deliverables_organization_id_fkey foreign KEY (organization_id) references organizations (id)
) TABLESPACE pg_default;

create index IF not exists idx_kol_campaign_deliverables_campaign_id on public.kol_campaign_deliverables using btree (campaign_id) TABLESPACE pg_default;

create trigger handle_updated_at_kol_campaign_deliverables BEFORE
update on kol_campaign_deliverables for EACH row
execute FUNCTION handle_updated_at ();

create trigger update_kol_campaign_deliverables_updated_at BEFORE
update on kol_campaign_deliverables for EACH row
execute FUNCTION update_kol_campaign_deliverables_updated_at ();

create table public.kol_content_posts (
  id uuid not null default gen_random_uuid (),
  campaign_assignment_id uuid not null,
  platform text not null,
  content_type text null,
  post_url text null,
  post_date timestamp with time zone null,
  caption text null,
  hashtags text[] null,
  mentions text[] null,
  status text not null default 'draft'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  title text null,
  kol_profile_id uuid null,
  campaign_id uuid null,
  organization_id uuid null,
  content_text text null,
  post_type text null,
  scheduled_date timestamp with time zone null,
  campaign_deliverable_id uuid null,
  constraint kol_content_posts_pkey primary key (id),
  constraint kol_content_posts_campaign_assignment_id_fkey foreign KEY (campaign_assignment_id) references kol_campaign_assignments (id) on delete CASCADE,
  constraint kol_content_posts_campaign_deliverable_id_fkey foreign KEY (campaign_deliverable_id) references kol_campaign_deliverables (id) on delete set null,
  constraint kol_content_posts_campaign_id_fkey foreign KEY (campaign_id) references kol_campaigns (id),
  constraint kol_content_posts_kol_profile_id_fkey foreign KEY (kol_profile_id) references kol_profiles (id),
  constraint kol_content_posts_organization_id_fkey foreign KEY (organization_id) references organizations (id)
) TABLESPACE pg_default;

create index IF not exists idx_kol_content_posts_campaign_assignment_id on public.kol_content_posts using btree (campaign_assignment_id) TABLESPACE pg_default;

create index IF not exists idx_kol_content_posts_campaign_deliverable_id on public.kol_content_posts using btree (campaign_deliverable_id) TABLESPACE pg_default;

create trigger kol_content_posts_updated_at BEFORE
update on kol_content_posts for EACH row
execute FUNCTION update_kol_updated_at ();

create trigger trigger_auto_create_budget_allocation
after INSERT on kol_content_posts for EACH row
execute FUNCTION auto_create_budget_allocation ();

create table public.kol_contracts (
  id uuid not null default gen_random_uuid (),
  campaign_id uuid not null,
  kol_profile_id uuid not null,
  organization_id uuid not null,
  contract_number text not null,
  contract_template_id uuid null,
  contract_terms jsonb not null default '{}'::jsonb,
  kpi_metrics jsonb not null default '{}'::jsonb,
  content_requirements jsonb null default '{}'::jsonb,
  posting_schedule jsonb null default '{}'::jsonb,
  deliverables jsonb null default '{}'::jsonb,
  penalties jsonb null default '{}'::jsonb,
  status text null default 'draft'::text,
  company_signature_date timestamp with time zone null,
  kol_signature_date timestamp with time zone null,
  company_signed_by uuid null,
  contract_start_date date null,
  contract_end_date date null,
  digital_signature_hash text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  created_by uuid null,
  constraint kol_contracts_pkey primary key (id),
  constraint kol_contracts_contract_number_key unique (contract_number),
  constraint kol_contracts_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint kol_contracts_kol_profile_id_fkey foreign KEY (kol_profile_id) references kol_profiles (id) on delete CASCADE,
  constraint kol_contracts_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint kol_contracts_campaign_id_fkey foreign KEY (campaign_id) references kol_campaigns (id) on delete CASCADE,
  constraint kol_contracts_company_signed_by_fkey foreign KEY (company_signed_by) references auth.users (id),
  constraint kol_contracts_status_check check (
    (
      status = any (
        array[
          'draft'::text,
          'sent'::text,
          'reviewed'::text,
          'signed'::text,
          'active'::text,
          'completed'::text,
          'terminated'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_kol_contracts_campaign_id on public.kol_contracts using btree (campaign_id) TABLESPACE pg_default;

create trigger generate_contract_number_trigger BEFORE INSERT on kol_contracts for EACH row
execute FUNCTION generate_contract_number ();

create trigger kol_contracts_updated_at BEFORE
update on kol_contracts for EACH row
execute FUNCTION handle_updated_at ();

create table public.kol_conversions (
  id uuid not null default gen_random_uuid (),
  content_post_id uuid not null,
  conversion_type text not null,
  conversion_value numeric(12, 2) null default 0,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  utm_content text null,
  conversion_date timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  kol_profile_id uuid null,
  organization_id uuid not null,
  constraint kol_conversions_pkey primary key (id),
  constraint kol_conversions_content_post_id_fkey foreign KEY (content_post_id) references kol_content_posts (id) on delete CASCADE,
  constraint kol_conversions_kol_profile_id_fkey foreign KEY (kol_profile_id) references kol_profiles (id)
) TABLESPACE pg_default;

create index IF not exists idx_kol_conversions_content_post_id on public.kol_conversions using btree (content_post_id) TABLESPACE pg_default;

create index IF not exists idx_kol_conversions_kol_profile_id on public.kol_conversions using btree (kol_profile_id) TABLESPACE pg_default;

create index IF not exists idx_kol_conversions_conversion_date on public.kol_conversions using btree (conversion_date) TABLESPACE pg_default;

create index IF not exists idx_kol_conversions_conversion_type on public.kol_conversions using btree (conversion_type) TABLESPACE pg_default;

create index IF not exists idx_kol_conversions_post_date on public.kol_conversions using btree (content_post_id, conversion_date) TABLESPACE pg_default;

create index IF not exists idx_kol_conversions_kol_date on public.kol_conversions using btree (kol_profile_id, conversion_date) TABLESPACE pg_default;

create trigger refresh_aggregates_on_conversion_insert
after INSERT
or DELETE
or
update on kol_conversions for EACH row
execute FUNCTION trigger_refresh_conversion_aggregates ();

create materialized view public.kol_conversion_aggregates as
select
  content_post_id,
  kol_profile_id,
  count(*) as total_conversions,
  sum(conversion_value) as total_conversion_value,
  count(distinct conversion_type) as conversion_types_count,
  avg(conversion_value) as avg_conversion_value,
  date_trunc('day'::text, conversion_date) as conversion_day
from
  kol_conversions
group by
  content_post_id,
  kol_profile_id,
  (date_trunc('day'::text, conversion_date));

