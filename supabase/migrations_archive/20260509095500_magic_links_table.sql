-- Magic Links table for first-login / invitation flow.
-- Based on provided schema: token-based, expiring, with status transitions.

CREATE TABLE IF NOT EXISTS public.magic_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + '24:00:00'::interval),
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  email_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending'::text,
  CONSTRAINT magic_links_pkey PRIMARY KEY (id),
  CONSTRAINT magic_links_token_key UNIQUE (token),
  CONSTRAINT magic_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT check_magic_links_status CHECK (
    status = ANY (ARRAY['pending'::text, 'clicked'::text, 'completed'::text, 'expired'::text])
  )
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_magic_links_token ON public.magic_links USING btree (token) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_magic_links_expires_at ON public.magic_links USING btree (expires_at) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_magic_links_user_id ON public.magic_links USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON public.magic_links USING btree (email) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_magic_links_email_verified ON public.magic_links USING btree (email_verified) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_magic_links_status ON public.magic_links USING btree (status) TABLESPACE pg_default;

DROP TRIGGER IF EXISTS update_magic_links_updated_at ON public.magic_links;
CREATE TRIGGER update_magic_links_updated_at
  BEFORE UPDATE ON public.magic_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

