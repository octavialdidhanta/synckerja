-- Carousel boleh 2 sampai 10 slide. Jumlah di dalam rentang itu dipilih Naya.

DO $$
DECLARE
  src text;
BEGIN
  src := pg_get_functiondef('public.ai_employee_carousel_fields(uuid,jsonb)'::regprocedure);
  src := replace(src, 'v_count < 5 OR v_count > 8', 'v_count < 2 OR v_count > 10');
  EXECUTE src;
END $$;

COMMENT ON FUNCTION public.ai_employee_carousel_fields(uuid, jsonb) IS
  'Menyusun brief carousel 2-10 slide, caption berhashtag, tipe carousel, dan rasio 4:5.';
