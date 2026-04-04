-- Content Post payment milestones + RLS hardening

create table if not exists public.payment_milestones (
  id uuid not null default gen_random_uuid(),
  payment_terms_id uuid not null,
  milestone_name text not null,
  milestone_order integer not null default 1,
  amount numeric(15, 2) not null default 0,
  percentage numeric(6, 2) not null default 0,
  due_date date null,
  status text not null default 'pending',
  trigger_condition text null default 'manual',
  trigger_details jsonb null default '{}'::jsonb,
  milestone_description text null,
  invoice_uploaded boolean null default false,
  invoice_file_path text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint payment_milestones_pkey primary key (id),
  constraint payment_milestones_payment_terms_id_fkey foreign key (payment_terms_id)
    references public.kol_payment_terms(id) on delete cascade
);

create index if not exists idx_payment_milestones_payment_terms_id
  on public.payment_milestones(payment_terms_id);

create index if not exists idx_payment_milestones_status
  on public.payment_milestones(status);

create index if not exists idx_payment_milestones_due_date
  on public.payment_milestones(due_date);

drop trigger if exists payment_milestones_updated_at on public.payment_milestones;
create trigger payment_milestones_updated_at
before update on public.payment_milestones
for each row execute function handle_updated_at();

alter table public.kol_content_posts enable row level security;
alter table public.kol_payment_terms enable row level security;
alter table public.kol_performance_metrics enable row level security;
alter table public.kol_conversions enable row level security;
alter table public.payment_milestones enable row level security;

drop policy if exists "kol_content_posts_select_org" on public.kol_content_posts;
drop policy if exists "kol_content_posts_insert_org" on public.kol_content_posts;
drop policy if exists "kol_content_posts_update_org" on public.kol_content_posts;
drop policy if exists "kol_content_posts_delete_org" on public.kol_content_posts;

create policy "kol_content_posts_select_org"
on public.kol_content_posts for select
using (
  organization_id in (select user_organization_ids())
);

create policy "kol_content_posts_insert_org"
on public.kol_content_posts for insert
with check (
  organization_id in (select user_organization_ids())
);

create policy "kol_content_posts_update_org"
on public.kol_content_posts for update
using (organization_id in (select user_organization_ids()))
with check (organization_id in (select user_organization_ids()));

create policy "kol_content_posts_delete_org"
on public.kol_content_posts for delete
using (organization_id in (select user_organization_ids()));

drop policy if exists "kol_payment_terms_select_org" on public.kol_payment_terms;
drop policy if exists "kol_payment_terms_insert_org" on public.kol_payment_terms;
drop policy if exists "kol_payment_terms_update_org" on public.kol_payment_terms;
drop policy if exists "kol_payment_terms_delete_org" on public.kol_payment_terms;

create policy "kol_payment_terms_select_org"
on public.kol_payment_terms for select
using (organization_id in (select user_organization_ids()));

create policy "kol_payment_terms_insert_org"
on public.kol_payment_terms for insert
with check (organization_id in (select user_organization_ids()));

create policy "kol_payment_terms_update_org"
on public.kol_payment_terms for update
using (organization_id in (select user_organization_ids()))
with check (organization_id in (select user_organization_ids()));

create policy "kol_payment_terms_delete_org"
on public.kol_payment_terms for delete
using (organization_id in (select user_organization_ids()));

drop policy if exists "kol_performance_metrics_select_org" on public.kol_performance_metrics;
drop policy if exists "kol_performance_metrics_insert_org" on public.kol_performance_metrics;
drop policy if exists "kol_performance_metrics_update_org" on public.kol_performance_metrics;
drop policy if exists "kol_performance_metrics_delete_org" on public.kol_performance_metrics;

create policy "kol_performance_metrics_select_org"
on public.kol_performance_metrics for select
using (organization_id in (select user_organization_ids()));

create policy "kol_performance_metrics_insert_org"
on public.kol_performance_metrics for insert
with check (organization_id in (select user_organization_ids()));

create policy "kol_performance_metrics_update_org"
on public.kol_performance_metrics for update
using (organization_id in (select user_organization_ids()))
with check (organization_id in (select user_organization_ids()));

create policy "kol_performance_metrics_delete_org"
on public.kol_performance_metrics for delete
using (organization_id in (select user_organization_ids()));

drop policy if exists "kol_conversions_select_org" on public.kol_conversions;
drop policy if exists "kol_conversions_insert_org" on public.kol_conversions;
drop policy if exists "kol_conversions_update_org" on public.kol_conversions;
drop policy if exists "kol_conversions_delete_org" on public.kol_conversions;

create policy "kol_conversions_select_org"
on public.kol_conversions for select
using (organization_id in (select user_organization_ids()));

create policy "kol_conversions_insert_org"
on public.kol_conversions for insert
with check (organization_id in (select user_organization_ids()));

create policy "kol_conversions_update_org"
on public.kol_conversions for update
using (organization_id in (select user_organization_ids()))
with check (organization_id in (select user_organization_ids()));

create policy "kol_conversions_delete_org"
on public.kol_conversions for delete
using (organization_id in (select user_organization_ids()));

drop policy if exists "payment_milestones_select_org" on public.payment_milestones;
drop policy if exists "payment_milestones_insert_org" on public.payment_milestones;
drop policy if exists "payment_milestones_update_org" on public.payment_milestones;
drop policy if exists "payment_milestones_delete_org" on public.payment_milestones;

create policy "payment_milestones_select_org"
on public.payment_milestones for select
using (
  exists (
    select 1 from public.kol_payment_terms kpt
    where kpt.id = payment_milestones.payment_terms_id
      and kpt.organization_id in (select user_organization_ids())
  )
);

create policy "payment_milestones_insert_org"
on public.payment_milestones for insert
with check (
  exists (
    select 1 from public.kol_payment_terms kpt
    where kpt.id = payment_milestones.payment_terms_id
      and kpt.organization_id in (select user_organization_ids())
  )
);

create policy "payment_milestones_update_org"
on public.payment_milestones for update
using (
  exists (
    select 1 from public.kol_payment_terms kpt
    where kpt.id = payment_milestones.payment_terms_id
      and kpt.organization_id in (select user_organization_ids())
  )
)
with check (
  exists (
    select 1 from public.kol_payment_terms kpt
    where kpt.id = payment_milestones.payment_terms_id
      and kpt.organization_id in (select user_organization_ids())
  )
);

create policy "payment_milestones_delete_org"
on public.payment_milestones for delete
using (
  exists (
    select 1 from public.kol_payment_terms kpt
    where kpt.id = payment_milestones.payment_terms_id
      and kpt.organization_id in (select user_organization_ids())
  )
);
