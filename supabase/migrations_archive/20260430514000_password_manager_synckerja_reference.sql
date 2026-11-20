-- Password Manager: password_categories (global catalog) + passwords (per-user, per-org vault)
-- Ported from synckerja-reference behavior + seed migrations for Tools/Tutorial categories.

-- 1) Tables
CREATE TABLE IF NOT EXISTS public.password_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT password_categories_pkey PRIMARY KEY (id),
  CONSTRAINT password_categories_name_key UNIQUE (name)
) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS public.passwords (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  title text NOT NULL,
  username text NOT NULL,
  password text NOT NULL,
  url text NULL,
  category_id uuid NOT NULL,
  notes text NULL,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT passwords_pkey PRIMARY KEY (id),
  CONSTRAINT passwords_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT passwords_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT passwords_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.password_categories (id) ON DELETE RESTRICT
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_passwords_user_org ON public.passwords (user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_passwords_organization_id ON public.passwords (organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_password_categories_updated_at'
  ) THEN
    CREATE TRIGGER handle_password_categories_updated_at
      BEFORE UPDATE ON public.password_categories
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_passwords_updated_at'
  ) THEN
    CREATE TRIGGER handle_passwords_updated_at
      BEFORE UPDATE ON public.passwords
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.password_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passwords ENABLE ROW LEVEL SECURITY;

-- 2) RLS: password_categories — read catalog for any authenticated user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'password_categories'
      AND policyname = 'Authenticated users can read password categories'
  ) THEN
    CREATE POLICY "Authenticated users can read password categories"
      ON public.password_categories FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;

-- 3) RLS: passwords — vault rows owned by auth.uid(), org must match membership via employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'passwords'
      AND policyname = 'Users can view own passwords in their organization'
  ) THEN
    CREATE POLICY "Users can view own passwords in their organization"
      ON public.passwords FOR SELECT
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.organization_id = public.passwords.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'passwords'
      AND policyname = 'Users can insert own passwords in their organization'
  ) THEN
    CREATE POLICY "Users can insert own passwords in their organization"
      ON public.passwords FOR INSERT
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.organization_id = public.passwords.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'passwords'
      AND policyname = 'Users can update own passwords in their organization'
  ) THEN
    CREATE POLICY "Users can update own passwords in their organization"
      ON public.passwords FOR UPDATE
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.organization_id = public.passwords.organization_id
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.organization_id = public.passwords.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'passwords'
      AND policyname = 'Users can delete own passwords in their organization'
  ) THEN
    CREATE POLICY "Users can delete own passwords in their organization"
      ON public.passwords FOR DELETE
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.user_id = auth.uid()
            AND e.organization_id = public.passwords.organization_id
        )
      );
  END IF;
END;
$$;

-- 4) Seed categories (synckerja-reference migrations + General for default vault entries)
INSERT INTO public.password_categories (name, icon, created_at, updated_at)
SELECT 'General', 'lock', timezone('utc'::text, now()), timezone('utc'::text, now())
WHERE NOT EXISTS (SELECT 1 FROM public.password_categories WHERE name = 'General');

INSERT INTO public.password_categories (name, icon, created_at, updated_at)
SELECT 'Tools', 'wrench', timezone('utc'::text, now()), timezone('utc'::text, now())
WHERE NOT EXISTS (SELECT 1 FROM public.password_categories WHERE name = 'Tools');

INSERT INTO public.password_categories (name, icon, created_at, updated_at)
SELECT 'Tutorial', 'book-open', timezone('utc'::text, now()), timezone('utc'::text, now())
WHERE NOT EXISTS (SELECT 1 FROM public.password_categories WHERE name = 'Tutorial');
