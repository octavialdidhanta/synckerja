create table public.kol_campaigns (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  name text not null,
  description text null,
  budget numeric(15, 2) null,
  start_date date null,
  end_date date null,
  status text not null default 'draft'::text,
  objectives text null,
  target_reach integer null,
  target_engagement integer null,
  target_conversion integer null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid null,
  total_budget numeric(12, 2) null default 0,
  allocated_budget numeric(12, 2) null default 0,
  remaining_budget numeric(12, 2) null default 0,
  constraint kol_campaigns_pkey primary key (id),
  constraint kol_campaigns_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint kol_campaigns_organization_id_fkey foreign KEY (organization_id) references organizations (id)
) TABLESPACE pg_default;

create index IF not exists idx_kol_campaigns_organization_id on public.kol_campaigns using btree (organization_id) TABLESPACE pg_default;

create trigger kol_campaigns_updated_at BEFORE
update on kol_campaigns for EACH row
execute FUNCTION update_kol_updated_at ();

