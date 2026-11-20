ALTER TABLE public.content_ai_usage
  ADD COLUMN IF NOT EXISTS thinking_master_thought_id uuid NULL
    REFERENCES public.thinking_master_thoughts (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_content_ai_usage_master_thought
  ON public.content_ai_usage USING btree (thinking_master_thought_id, created_at DESC);

COMMENT ON COLUMN public.content_ai_usage.thinking_master_thought_id IS
  'Thinking Lab master thought that a text generation belongs to. Null for brief content usage.';
