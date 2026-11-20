-- Meeting Notes core tables (meeting_points + issues + solutions)
-- Ported to match synckerja-reference structure, with notes column support.

-- 1) Generic updated_at trigger function (if not already present)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- 2) Specific updated_at triggers used by issues/solutions migrations
CREATE OR REPLACE FUNCTION public.update_meeting_point_issues_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_meeting_point_solutions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3) Tables
CREATE TABLE IF NOT EXISTS public.meeting_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  discussion_point text NOT NULL,
  request_by text NULL,
  status text NULL DEFAULT 'Not Started'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by uuid NULL,
  employee_id uuid NULL,
  updates text NULL,
  CONSTRAINT meeting_points_pkey PRIMARY KEY (id),
  CONSTRAINT fk_meeting_points_employee FOREIGN KEY (employee_id) REFERENCES public.employees (id) ON DELETE SET NULL,
  CONSTRAINT meeting_points_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT meeting_points_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT meeting_points_status_check CHECK (
    status = ANY (
      ARRAY[
        'Not Started'::text,
        'On Going'::text,
        'Completed'::text,
        'Rejected'::text,
        'Presented'::text
      ]
    )
  )
) TABLESPACE pg_default;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'handle_meeting_points_updated_at'
  ) THEN
    CREATE TRIGGER handle_meeting_points_updated_at
    BEFORE UPDATE ON public.meeting_points
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.meeting_points ENABLE ROW LEVEL SECURITY;

-- Organization-scoped access via employees (same style as other modules)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_points'
      AND policyname = 'Users can view meeting points in their organization'
  ) THEN
    CREATE POLICY "Users can view meeting points in their organization"
      ON public.meeting_points FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_points.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_points'
      AND policyname = 'Users can create meeting points in their organization'
  ) THEN
    CREATE POLICY "Users can create meeting points in their organization"
      ON public.meeting_points FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_points.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_points'
      AND policyname = 'Users can update meeting points in their organization'
  ) THEN
    CREATE POLICY "Users can update meeting points in their organization"
      ON public.meeting_points FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_points.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_points'
      AND policyname = 'Users can delete meeting points in their organization'
  ) THEN
    CREATE POLICY "Users can delete meeting points in their organization"
      ON public.meeting_points FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_points.organization_id
        )
      );
  END IF;
END;
$$;

-- meeting_point_issues
CREATE TABLE IF NOT EXISTS public.meeting_point_issues (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  meeting_point_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  issue_description text NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  created_by uuid NULL,
  notes text NULL,
  CONSTRAINT meeting_point_issues_pkey PRIMARY KEY (id),
  CONSTRAINT meeting_point_issues_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT meeting_point_issues_meeting_point_id_fkey FOREIGN KEY (meeting_point_id) REFERENCES public.meeting_points (id) ON DELETE CASCADE,
  CONSTRAINT meeting_point_issues_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meeting_point_issues_meeting_point_id
  ON public.meeting_point_issues USING btree (meeting_point_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_meeting_point_issues_organization_id
  ON public.meeting_point_issues USING btree (organization_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_meeting_point_issues_created_at
  ON public.meeting_point_issues USING btree (created_at desc) TABLESPACE pg_default;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_update_meeting_point_issues_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_meeting_point_issues_updated_at
    BEFORE UPDATE ON public.meeting_point_issues
    FOR EACH ROW
    EXECUTE FUNCTION public.update_meeting_point_issues_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.meeting_point_issues ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_point_issues'
      AND policyname = 'Users can view issues in their organization'
  ) THEN
    CREATE POLICY "Users can view issues in their organization"
      ON public.meeting_point_issues FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_point_issues.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_point_issues'
      AND policyname = 'Users can create issues in their organization'
  ) THEN
    CREATE POLICY "Users can create issues in their organization"
      ON public.meeting_point_issues FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_point_issues.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_point_issues'
      AND policyname = 'Users can update issues in their organization'
  ) THEN
    CREATE POLICY "Users can update issues in their organization"
      ON public.meeting_point_issues FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_point_issues.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_point_issues'
      AND policyname = 'Users can delete issues in their organization'
  ) THEN
    CREATE POLICY "Users can delete issues in their organization"
      ON public.meeting_point_issues FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_point_issues.organization_id
        )
      );
  END IF;
END;
$$;

-- meeting_point_solutions
CREATE TABLE IF NOT EXISTS public.meeting_point_solutions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  meeting_point_issue_id uuid NOT NULL,
  meeting_point_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  solution_description text NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  created_by uuid NULL,
  notes text NULL,
  CONSTRAINT meeting_point_solutions_pkey PRIMARY KEY (id),
  CONSTRAINT meeting_point_solutions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT meeting_point_solutions_meeting_point_id_fkey FOREIGN KEY (meeting_point_id) REFERENCES public.meeting_points (id) ON DELETE CASCADE,
  CONSTRAINT meeting_point_solutions_meeting_point_issue_id_fkey FOREIGN KEY (meeting_point_issue_id) REFERENCES public.meeting_point_issues (id) ON DELETE CASCADE,
  CONSTRAINT meeting_point_solutions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meeting_point_solutions_issue_id
  ON public.meeting_point_solutions USING btree (meeting_point_issue_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_meeting_point_solutions_meeting_point_id
  ON public.meeting_point_solutions USING btree (meeting_point_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_meeting_point_solutions_organization_id
  ON public.meeting_point_solutions USING btree (organization_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_meeting_point_solutions_created_at
  ON public.meeting_point_solutions USING btree (created_at desc) TABLESPACE pg_default;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_update_meeting_point_solutions_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_meeting_point_solutions_updated_at
    BEFORE UPDATE ON public.meeting_point_solutions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_meeting_point_solutions_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.meeting_point_solutions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_point_solutions'
      AND policyname = 'Users can view solutions in their organization'
  ) THEN
    CREATE POLICY "Users can view solutions in their organization"
      ON public.meeting_point_solutions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_point_solutions.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_point_solutions'
      AND policyname = 'Users can create solutions in their organization'
  ) THEN
    CREATE POLICY "Users can create solutions in their organization"
      ON public.meeting_point_solutions FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_point_solutions.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_point_solutions'
      AND policyname = 'Users can update solutions in their organization'
  ) THEN
    CREATE POLICY "Users can update solutions in their organization"
      ON public.meeting_point_solutions FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_point_solutions.organization_id
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meeting_point_solutions'
      AND policyname = 'Users can delete solutions in their organization'
  ) THEN
    CREATE POLICY "Users can delete solutions in their organization"
      ON public.meeting_point_solutions FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE public.employees.user_id = auth.uid()
            AND public.employees.organization_id = public.meeting_point_solutions.organization_id
        )
      );
  END IF;
END;
$$;

