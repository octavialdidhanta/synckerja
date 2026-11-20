-- Voice generation is limited to the brief PIC, and older ledger rows did not store that user.
UPDATE public.content_ai_usage AS usage
SET actor_user_id = employee.user_id
FROM public.social_media_plans AS plan
JOIN public.employees AS employee ON employee.id = plan.pic_id
WHERE usage.social_media_plan_id = plan.id
  AND usage.service = 'voice'
  AND usage.actor_user_id IS NULL
  AND employee.user_id IS NOT NULL;
