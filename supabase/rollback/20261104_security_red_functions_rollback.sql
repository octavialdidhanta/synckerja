-- Rollback 20261104100000_security_red_functions.sql.
-- Bukan migration. Jalankan di SQL Editor. Bagian A dan B bisa dijalankan sendiri-sendiri.
-- Grant dikembalikan persis seperti keadaan live sebelum 4 November 2026.

-- ---------------------------------------------------------------------------
-- A. Lepas pembungkus: hapus fungsi pembungkus, kembalikan nama __impl.
-- ---------------------------------------------------------------------------
BEGIN;

DROP FUNCTION public.search_facebook_messages(uuid, text);
ALTER FUNCTION public.search_facebook_messages__impl(uuid, text) RENAME TO search_facebook_messages;
GRANT EXECUTE ON FUNCTION public.search_facebook_messages(uuid, text) TO PUBLIC, anon, authenticated, service_role;

DROP FUNCTION public.search_whatsapp_messages(uuid, text);
ALTER FUNCTION public.search_whatsapp_messages__impl(uuid, text) RENAME TO search_whatsapp_messages;
GRANT EXECUTE ON FUNCTION public.search_whatsapp_messages(uuid, text) TO authenticated, service_role;

DROP FUNCTION public.get_whatsapp_conversation_ids_by_message_search(uuid, text);
ALTER FUNCTION public.get_whatsapp_conversation_ids_by_message_search__impl(uuid, text) RENAME TO get_whatsapp_conversation_ids_by_message_search;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_conversation_ids_by_message_search(uuid, text) TO authenticated, service_role;

DROP FUNCTION public.get_all_resolved_blockers(uuid, integer, timestamp with time zone, timestamp with time zone);
ALTER FUNCTION public.get_all_resolved_blockers__impl(uuid, integer, timestamp with time zone, timestamp with time zone) RENAME TO get_all_resolved_blockers;
GRANT EXECUTE ON FUNCTION public.get_all_resolved_blockers(uuid, integer, timestamp with time zone, timestamp with time zone) TO authenticated, service_role;

DROP FUNCTION public.get_employee_task_ids(uuid);
ALTER FUNCTION public.get_employee_task_ids__impl(uuid) RENAME TO get_employee_task_ids;
GRANT EXECUTE ON FUNCTION public.get_employee_task_ids(uuid) TO authenticated, service_role;

DROP FUNCTION public.resolve_form_id_for_omnichannel_submission(uuid, text);
ALTER FUNCTION public.resolve_form_id_for_omnichannel_submission__impl(uuid, text) RENAME TO resolve_form_id_for_omnichannel_submission;
GRANT EXECUTE ON FUNCTION public.resolve_form_id_for_omnichannel_submission(uuid, text) TO anon, authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- B. Kembalikan EXECUTE yang dicabut (get_traffic_dashboard + pola B).
-- ---------------------------------------------------------------------------
BEGIN;

GRANT EXECUTE ON FUNCTION public.get_traffic_dashboard(text, date, date, integer, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public._count_organization_rows(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_duplicate_payment_milestones() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_display_name(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_analytics_web_access_for_org(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_expire_stale_pending_checkouts() TO anon, authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
