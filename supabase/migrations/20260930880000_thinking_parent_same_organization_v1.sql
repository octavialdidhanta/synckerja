-- Child rows must share organization_id with their parent.
-- workspace stays a product boundary on thinking_master_thoughts only.

ALTER TABLE public.thinking_big_thoughts
  DROP CONSTRAINT IF EXISTS thinking_big_thoughts_master_same_org_fkey;

ALTER TABLE public.thinking_territories
  DROP CONSTRAINT IF EXISTS thinking_territories_big_thought_same_org_fkey;

ALTER TABLE public.thinking_angles
  DROP CONSTRAINT IF EXISTS thinking_angles_territory_same_org_fkey;

ALTER TABLE public.thinking_ideas
  DROP CONSTRAINT IF EXISTS thinking_ideas_angle_same_org_fkey;

ALTER TABLE public.thinking_master_thoughts
  DROP CONSTRAINT IF EXISTS thinking_master_thoughts_id_org_key;

ALTER TABLE public.thinking_big_thoughts
  DROP CONSTRAINT IF EXISTS thinking_big_thoughts_id_org_key;

ALTER TABLE public.thinking_territories
  DROP CONSTRAINT IF EXISTS thinking_territories_id_org_key;

ALTER TABLE public.thinking_angles
  DROP CONSTRAINT IF EXISTS thinking_angles_id_org_key;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.thinking_big_thoughts AS child
    JOIN public.thinking_master_thoughts AS parent ON parent.id = child.master_thought_id
    WHERE child.organization_id IS DISTINCT FROM parent.organization_id
  ) THEN
    RAISE EXCEPTION 'thinking_big_thoughts.organization_id does not match parent thinking_master_thoughts.organization_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.thinking_territories AS child
    JOIN public.thinking_big_thoughts AS parent ON parent.id = child.big_thought_id
    WHERE child.organization_id IS DISTINCT FROM parent.organization_id
  ) THEN
    RAISE EXCEPTION 'thinking_territories.organization_id does not match parent thinking_big_thoughts.organization_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.thinking_angles AS child
    JOIN public.thinking_territories AS parent ON parent.id = child.territory_id
    WHERE child.organization_id IS DISTINCT FROM parent.organization_id
  ) THEN
    RAISE EXCEPTION 'thinking_angles.organization_id does not match parent thinking_territories.organization_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.thinking_ideas AS child
    JOIN public.thinking_angles AS parent ON parent.id = child.angle_id
    WHERE child.organization_id IS DISTINCT FROM parent.organization_id
  ) THEN
    RAISE EXCEPTION 'thinking_ideas.organization_id does not match parent thinking_angles.organization_id';
  END IF;
END;
$$;

ALTER TABLE public.thinking_master_thoughts
  ADD CONSTRAINT thinking_master_thoughts_id_org_key UNIQUE (id, organization_id);

ALTER TABLE public.thinking_big_thoughts
  ADD CONSTRAINT thinking_big_thoughts_master_same_org_fkey
  FOREIGN KEY (master_thought_id, organization_id)
  REFERENCES public.thinking_master_thoughts (id, organization_id)
  ON DELETE CASCADE;

ALTER TABLE public.thinking_big_thoughts
  ADD CONSTRAINT thinking_big_thoughts_id_org_key UNIQUE (id, organization_id);

ALTER TABLE public.thinking_territories
  ADD CONSTRAINT thinking_territories_big_thought_same_org_fkey
  FOREIGN KEY (big_thought_id, organization_id)
  REFERENCES public.thinking_big_thoughts (id, organization_id)
  ON DELETE CASCADE;

ALTER TABLE public.thinking_territories
  ADD CONSTRAINT thinking_territories_id_org_key UNIQUE (id, organization_id);

ALTER TABLE public.thinking_angles
  ADD CONSTRAINT thinking_angles_territory_same_org_fkey
  FOREIGN KEY (territory_id, organization_id)
  REFERENCES public.thinking_territories (id, organization_id)
  ON DELETE CASCADE;

ALTER TABLE public.thinking_angles
  ADD CONSTRAINT thinking_angles_id_org_key UNIQUE (id, organization_id);

ALTER TABLE public.thinking_ideas
  ADD CONSTRAINT thinking_ideas_angle_same_org_fkey
  FOREIGN KEY (angle_id, organization_id)
  REFERENCES public.thinking_angles (id, organization_id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT thinking_big_thoughts_master_same_org_fkey ON public.thinking_big_thoughts IS
  'Big Thought organization_id must equal its Master Thought organization_id.';
COMMENT ON CONSTRAINT thinking_territories_big_thought_same_org_fkey ON public.thinking_territories IS
  'Territory organization_id must equal its Big Thought organization_id.';
COMMENT ON CONSTRAINT thinking_angles_territory_same_org_fkey ON public.thinking_angles IS
  'Angle organization_id must equal its Territory organization_id.';
COMMENT ON CONSTRAINT thinking_ideas_angle_same_org_fkey ON public.thinking_ideas IS
  'Idea organization_id must equal its Angle organization_id.';

NOTIFY pgrst, 'reload schema';
