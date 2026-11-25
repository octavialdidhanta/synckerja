-- Deleting a content-plan subcategory removes the Content Studio product
-- only when that product has no description and no live photo.
-- A product that already has either keeps its visual columns. The existing
-- ON DELETE SET NULL then clears the link.

COMMENT ON COLUMN public.catalog_menus.sub_service_id IS
  'Content-plan subcategory (sub_services) used when the dish is not an Item Library product. Deleting the subcategory removes this product when it has no description and no live photo. A product that already has either keeps its visual columns and the link is cleared.';

CREATE OR REPLACE FUNCTION public.catalog_drop_empty_menu_for_sub_service()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $drop_empty$
BEGIN
  DELETE FROM public.catalog_menus AS m
  WHERE m.sub_service_id = OLD.id
    AND NOT EXISTS (
      SELECT 1
      FROM public.catalog_menu_fields AS f
      WHERE f.menu_id = m.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.catalog_menu_photos AS p
      WHERE p.menu_id = m.id
        AND p.deleted_at IS NULL
    );
  RETURN OLD;
END;
$drop_empty$;

REVOKE ALL ON FUNCTION public.catalog_drop_empty_menu_for_sub_service() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS catalog_menus_drop_empty_on_sub_service_delete ON public.sub_services;
CREATE TRIGGER catalog_menus_drop_empty_on_sub_service_delete
  BEFORE DELETE ON public.sub_services
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_drop_empty_menu_for_sub_service();
