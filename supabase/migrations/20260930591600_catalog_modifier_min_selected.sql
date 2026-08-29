-- Minimum options required when modifier limit is on and the group is required.

ALTER TABLE public.catalog_modifier_groups
  ADD COLUMN IF NOT EXISTS min_selected integer NOT NULL DEFAULT 0;

UPDATE public.catalog_modifier_groups
SET min_selected = 1
WHERE limit_enabled = true
  AND is_required = true
  AND min_selected < 1;

ALTER TABLE public.catalog_modifier_groups
  DROP CONSTRAINT IF EXISTS catalog_modifier_groups_min_selected_check;

ALTER TABLE public.catalog_modifier_groups
  ADD CONSTRAINT catalog_modifier_groups_min_selected_check
  CHECK (min_selected >= 0);

ALTER TABLE public.catalog_modifier_groups
  DROP CONSTRAINT IF EXISTS catalog_modifier_groups_max_gte_min_check;

ALTER TABLE public.catalog_modifier_groups
  ADD CONSTRAINT catalog_modifier_groups_max_gte_min_check
  CHECK (max_selected >= min_selected);

COMMENT ON COLUMN public.catalog_modifier_groups.min_selected IS
  'Minimum options the customer must pick when limit_enabled and is_required. 0 when optional.';
