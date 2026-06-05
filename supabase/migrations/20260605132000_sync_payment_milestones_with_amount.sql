-- Extend milestone sync to persist amount from JSON (content-post agreement flow)
CREATE OR REPLACE FUNCTION public.sync_payment_milestones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  elem jsonb;
  ord integer := 1;
begin
  if tg_op = 'update' and new.milestones is not distinct from old.milestones then
    return new;
  end if;

  if new.milestones is null
     or jsonb_typeof(new.milestones) <> 'array'
     or jsonb_array_length(new.milestones) = 0 then
    return new;
  end if;

  delete from public.payment_milestones
  where payment_terms_id = new.id;

  for elem in select value from jsonb_array_elements(new.milestones) as t(value)
  loop
    insert into public.payment_milestones (
      payment_terms_id,
      milestone_name,
      milestone_order,
      percentage,
      amount,
      due_date,
      milestone_description,
      status,
      trigger_condition
    )
    values (
      new.id,
      coalesce(nullif(trim(elem->>'name'), ''), nullif(trim(elem->>'milestone_name'), ''), 'Milestone'),
      coalesce(nullif(elem->>'milestone_order', '')::integer, ord),
      coalesce(nullif(elem->>'percentage', '')::numeric, 0),
      coalesce(nullif(elem->>'amount', '')::numeric, 0),
      case
        when nullif(trim(elem->>'due_date'), '') is null then null
        else nullif(trim(elem->>'due_date'), '')::date
      end,
      nullif(trim(elem->>'description'), ''),
      coalesce(nullif(trim(elem->>'status'), ''), 'pending'),
      coalesce(nullif(trim(elem->>'trigger_condition'), ''), 'manual')
    );
    ord := ord + 1;
  end loop;

  return new;
end;
$function$;
