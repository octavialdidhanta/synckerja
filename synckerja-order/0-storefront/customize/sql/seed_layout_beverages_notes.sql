-- =============================================================================
-- Seed [LAYOUT] Beverages (qty opsi) pada [LAYOUT] Promo Mix
-- Synckerja Office / Taman Cibodas
--
-- Jalankan dulu migrasi 20260930687000_synckerja_order_option_qty_notes.sql
-- (kolom option_qty_enabled). Aman di-run ulang.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_org    uuid := '663c9336-8cb6-4a36-9ad9-313126e70a1a';
  v_outlet uuid := 'b9b1e2ef-1a3b-4f0a-8b47-fc0bf1fa6737';
  v_mix    uuid := 'a1a1a1a1-0004-4000-8000-000000000004';
  v_g_bev  uuid := 'a1a1a1a1-2005-4000-8000-000000000005';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations o
    JOIN public.pos_outlets po ON po.organization_id = o.id AND po.id = v_outlet
    WHERE o.id = v_org
      AND o.company_name = 'Synckerja Office'
      AND po.name = 'Taman Cibodas'
  ) THEN
    RAISE EXCEPTION 'Org / outlet tidak cocok. Batalkan seed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'catalog_modifier_groups'
      AND column_name = 'option_qty_enabled'
  ) THEN
    RAISE EXCEPTION 'Kolom option_qty_enabled belum ada. Jalankan migrasi 20260930687000 dulu.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.default_prices
    WHERE id = v_mix AND organization_id = v_org AND name = '[LAYOUT] Promo Mix'
  ) THEN
    RAISE EXCEPTION '[LAYOUT] Promo Mix tidak ditemukan. Jalankan seed layout Promo dulu.';
  END IF;

  DELETE FROM public.catalog_product_modifiers
  WHERE organization_id = v_org AND group_id = v_g_bev;

  DELETE FROM public.catalog_modifier_outlets
  WHERE organization_id = v_org AND group_id = v_g_bev;

  DELETE FROM public.catalog_modifier_options
  WHERE organization_id = v_org AND group_id = v_g_bev;

  DELETE FROM public.catalog_modifier_groups
  WHERE organization_id = v_org
    AND (id = v_g_bev OR name = '[LAYOUT] Beverages');

  INSERT INTO public.catalog_modifier_groups (
    id, organization_id, name, sort_order, is_active,
    limit_enabled, is_required, min_selected, max_selected, stock_enabled, option_qty_enabled
  ) VALUES (
    v_g_bev, v_org, '[LAYOUT] Beverages', 4, true,
    true, true, 1, 2, false, true
  );

  INSERT INTO public.catalog_modifier_options (
    organization_id, group_id, name, extra_price, sort_order, is_active
  ) VALUES
    (v_org, v_g_bev, 'Lemon Tea - Iced', 0,    0, true),
    (v_org, v_g_bev, 'Ice Tea',          2000, 1, true),
    (v_org, v_g_bev, 'Lemonade',         3000, 2, true);

  INSERT INTO public.catalog_product_modifiers (product_id, group_id, organization_id)
  VALUES (v_mix, v_g_bev, v_org);

  RAISE NOTICE 'Seed [LAYOUT] Beverages pada Promo Mix selesai.';
END $$;

COMMIT;
