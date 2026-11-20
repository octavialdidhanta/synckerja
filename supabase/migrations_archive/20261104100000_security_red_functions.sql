-- Hardening 4 November 2026: fungsi MERAH (SECURITY DEFINER tanpa batas organisasi).
-- Lanjutan docs/security/revoke-anon-wave1.md bagian "Sisa pekerjaan".
-- Rollback: supabase/rollback/20261104_security_red_functions_rollback.sql
--
-- Pola A (dipakai klien): fungsi asli di-RENAME ke __impl (badan tidak berubah),
-- lalu dibuat pembungkus dengan nama dan argumen yang sama. Pembungkus menolak
-- authenticated/anon di luar organisasinya. service_role dan postgres lewat tanpa cek.
-- Grant pembungkus: authenticated, service_role. Grant __impl: service_role.
--
-- Pola B (tidak dipakai klien, hanya server): EXECUTE dicabut dari PUBLIC,
-- anon, authenticated. service_role tetap.

-- ---------------------------------------------------------------------------
-- A1. get_traffic_dashboard(text,date,date,int,int,int): hanya cabut anon.
-- Tidak dibungkus: rantai fungsi di dalamnya
-- (get_traffic_dashboard_base_before_utm_click_sync) sudah menolak dengan
-- can_access_web_id, jadi anon dan org lain sudah mendapat 'forbidden'.
-- Diuji 4 Nov: anon -> forbidden sebelum perubahan ini.
-- Klien: src/6-0-traffic/hooks/useTrafficDashboardController.ts (user login).
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_traffic_dashboard(text, date, date, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_traffic_dashboard(text, date, date, integer, integer, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A2. search_facebook_messages(uuid,text)
-- Bisa dipanggil tanpa login dan mencari isi pesan Messenger organisasi mana pun.
-- Klien: src/5-3-whatsapp/hooks/useFacebookMessageSearch.ts
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.search_facebook_messages(uuid, text)
  RENAME TO search_facebook_messages__impl;

CREATE OR REPLACE FUNCTION public.search_facebook_messages(p_organization_id uuid, p_search text)
 RETURNS TABLE(conversation_id uuid, message_id uuid, body text, created_at timestamp with time zone, direction text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.search_facebook_messages__impl(p_organization_id, p_search);
END;
$function$;

-- ---------------------------------------------------------------------------
-- A3. search_whatsapp_messages(uuid,text)
-- User login bisa mencari isi pesan WhatsApp organisasi lain.
-- Klien: src/5-3-whatsapp/hooks/useWhatsAppMessageSearch.ts
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.search_whatsapp_messages(uuid, text)
  RENAME TO search_whatsapp_messages__impl;

CREATE OR REPLACE FUNCTION public.search_whatsapp_messages(p_organization_id uuid, p_search text)
 RETURNS TABLE(conversation_id uuid, message_id uuid, body text, created_at timestamp with time zone, direction text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.search_whatsapp_messages__impl(p_organization_id, p_search);
END;
$function$;

-- ---------------------------------------------------------------------------
-- A4. get_whatsapp_conversation_ids_by_message_search(uuid,text)
-- Klien: src/5-3-whatsapp/hooks/useWhatsAppConversationIdsByMessageSearch.ts
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.get_whatsapp_conversation_ids_by_message_search(uuid, text)
  RENAME TO get_whatsapp_conversation_ids_by_message_search__impl;

CREATE OR REPLACE FUNCTION public.get_whatsapp_conversation_ids_by_message_search(p_organization_id uuid, p_search text)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_whatsapp_conversation_ids_by_message_search__impl(p_organization_id, p_search);
END;
$function$;

-- ---------------------------------------------------------------------------
-- A5. get_all_resolved_blockers(uuid,int,timestamptz,timestamptz)
-- User login bisa membaca judul task dan blocker organisasi lain.
-- Klien: src/8-2-DailyTaskReport/components/PerformanceTable.tsx,
--        android-mobile/5-daily-task-report/components/PerformanceTable.tsx
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.get_all_resolved_blockers(uuid, integer, timestamp with time zone, timestamp with time zone)
  RENAME TO get_all_resolved_blockers__impl;

CREATE OR REPLACE FUNCTION public.get_all_resolved_blockers(
  p_organization_id uuid,
  p_limit integer DEFAULT 100,
  p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone
)
 RETURNS TABLE(blocker_resolved_id uuid, task_step_history_id uuid, task_title text, step_title text, sub_step_title text, resolved_at timestamp with time zone, blocker_description text, resolution_description text, blocker_created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_all_resolved_blockers__impl(p_organization_id, p_limit, p_start_date, p_end_date);
END;
$function$;

-- ---------------------------------------------------------------------------
-- A6. get_employee_task_ids(uuid)
-- User login bisa melihat task id karyawan organisasi lain.
-- Klien: src/8-2-DailyTask/utils/globalTaskIdsCache.ts
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.get_employee_task_ids(uuid)
  RENAME TO get_employee_task_ids__impl;

CREATE OR REPLACE FUNCTION public.get_employee_task_ids(p_employee_id uuid)
 RETURNS TABLE(task_id uuid, assignment_level text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND NOT EXISTS (
       SELECT 1
       FROM public.employees e
       WHERE e.id = p_employee_id
         AND e.organization_id IN (SELECT public.user_organization_ids())
     ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_employee_task_ids__impl(p_employee_id);
END;
$function$;

-- ---------------------------------------------------------------------------
-- A7. resolve_form_id_for_omnichannel_submission(uuid,text)
-- Bisa dipanggil tanpa login untuk organisasi mana pun.
-- Klien: src/shared/lib/leadSubmissionProfile.ts (user login).
-- Catatan: badan asli gagal "invalid input syntax for type uuid" bila
-- lead_submissions.form_id berisi slug (mis. 'contact-page'). Bug lama,
-- tidak diubah di sini.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.resolve_form_id_for_omnichannel_submission(uuid, text)
  RENAME TO resolve_form_id_for_omnichannel_submission__impl;

CREATE OR REPLACE FUNCTION public.resolve_form_id_for_omnichannel_submission(
  p_organization_id uuid,
  p_web_id text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon')
     AND p_organization_id IS NOT NULL
     AND NOT (p_organization_id IN (SELECT public.user_organization_ids())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN public.resolve_form_id_for_omnichannel_submission__impl(p_organization_id, p_web_id);
END;
$function$;

-- Grant pola A.
REVOKE EXECUTE ON FUNCTION public.search_facebook_messages__impl(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_facebook_messages__impl(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.search_facebook_messages(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_facebook_messages(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.search_whatsapp_messages__impl(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_whatsapp_messages__impl(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.search_whatsapp_messages(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_whatsapp_messages(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_whatsapp_conversation_ids_by_message_search__impl(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_conversation_ids_by_message_search__impl(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_whatsapp_conversation_ids_by_message_search(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_conversation_ids_by_message_search(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_all_resolved_blockers__impl(uuid, integer, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_resolved_blockers__impl(uuid, integer, timestamp with time zone, timestamp with time zone) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_all_resolved_blockers(uuid, integer, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_all_resolved_blockers(uuid, integer, timestamp with time zone, timestamp with time zone) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_employee_task_ids__impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_task_ids__impl(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_employee_task_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_task_ids(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.resolve_form_id_for_omnichannel_submission__impl(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_form_id_for_omnichannel_submission__impl(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_form_id_for_omnichannel_submission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_form_id_for_omnichannel_submission(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Pola B. Tidak ada pemanggil di src/, android-mobile/, supabase/functions/,
-- fungsi lain, policy, view, atau cron. Dikunci ke service_role.
--   _count_organization_rows        : jumlah baris per tabel untuk org mana pun
--   audit_duplicate_payment_milestones : daftar organization_id semua tenant
--   employee_display_name           : nama/email karyawan dari id
--   ensure_analytics_web_access_for_org : bisa mematikan akses traffic org lain
--                                     (di repo sejak Juni sudah service_role saja)
--   pos_expire_stale_pending_checkouts : membatalkan checkout QRIS pending
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public._count_organization_rows(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._count_organization_rows(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.audit_duplicate_payment_milestones() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_duplicate_payment_milestones() TO service_role;

REVOKE EXECUTE ON FUNCTION public.employee_display_name(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_display_name(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_analytics_web_access_for_org(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_analytics_web_access_for_org(uuid, text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.pos_expire_stale_pending_checkouts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_expire_stale_pending_checkouts() TO service_role;

NOTIFY pgrst, 'reload schema';
