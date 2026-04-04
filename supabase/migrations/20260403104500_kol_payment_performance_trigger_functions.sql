-- Functions referenced by 20260430518203_kol_payment_performance_and_budget.sql
-- (many were missing from the repo). Runs before 18203 by timestamp.

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Aliases kept for compatibility if triggers still reference these names
create or replace function public.update_kol_performance_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.update_kol_payment_terms_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.update_kol_performance_thresholds_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.check_threshold_achievement()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.current_value is not null
     and new.target_value is not null
     and new.target_value > 0
     and new.current_value >= new.target_value
  then
    if coalesce(new.is_achieved, false) is distinct from true then
      new.is_achieved := true;
      new.achieved_at := coalesce(new.achieved_at, timezone('utc'::text, now()));
    end if;
  end if;
  return new;
end;
$$;

-- Stubs: extend later if budget auto-provisioning / rollups are required
create or replace function public.auto_create_payment_terms()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  return new;
end;
$$;

create or replace function public.update_campaign_budget_totals()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'delete' then
    return old;
  end if;
  return new;
end;
$$;
