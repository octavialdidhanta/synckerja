-- Satu-satunya definisi yang dipakai aplikasi: get_traffic_dashboard(text, date, date, int, int, int).
-- Overload legacy (tiga argumen text) sering muncul dari eksperimen/manual di DB dan membuat PostgREST
-- gagal memilih fungsi saat klien mengirim p_web_id / p_from / p_to sebagai string JSON
-- ("Could not choose the best candidate function …").

DROP FUNCTION IF EXISTS public.get_traffic_dashboard(text, text, text);
