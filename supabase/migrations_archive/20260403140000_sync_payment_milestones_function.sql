-- Defines sync_payment_milestones() referenced by kol_payment_terms.sync_payment_milestones_trigger

create or replace function public.sync_payment_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  elem jsonb;
  ord integer := 1;
begin
  if tg_op = 'update' and new.milestones is not distinct from old.milestones then
    return new;
  end if;

  delete from public.payment_milestones
  where payment_terms_id = new.id;

  if new.milestones is null or jsonb_typeof(new.milestones) <> 'array' then
    return new;
  end if;

  for elem in select value from jsonb_array_elements(new.milestones) as t(value)
  loop
    insert into public.payment_milestones (
      payment_terms_id,
      milestone_name,
      milestone_order,
      percentage,
      due_date,
      milestone_description,
      status
    )
    values (
      new.id,
      coalesce(nullif(trim(elem->>'name'), ''), nullif(trim(elem->>'milestone_name'), ''), 'Milestone'),
      ord,
      coalesce(nullif(elem->>'percentage', '')::numeric, 0),
      case
        when nullif(trim(elem->>'due_date'), '') is null then null
        else nullif(trim(elem->>'due_date'), '')::date
      end,
      nullif(trim(elem->>'description'), ''),
      'pending'
    );
    ord := ord + 1;
  end loop;

  return new;
end;
$$;
