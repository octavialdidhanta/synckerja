ALTER TABLE public.content_ai_usage
  ADD COLUMN IF NOT EXISTS input_tokens integer NULL,
  ADD COLUMN IF NOT EXISTS output_tokens integer NULL;

ALTER TABLE public.content_ai_usage
  DROP CONSTRAINT IF EXISTS content_ai_usage_token_split_nonnegative;

ALTER TABLE public.content_ai_usage
  ADD CONSTRAINT content_ai_usage_token_split_nonnegative
  CHECK (
    (input_tokens IS NULL OR input_tokens >= 0)
    AND (output_tokens IS NULL OR output_tokens >= 0)
  );

COMMENT ON COLUMN public.content_ai_usage.input_tokens IS
  'Provider prompt tokens. Null when the provider response had no separate input count.';
COMMENT ON COLUMN public.content_ai_usage.output_tokens IS
  'Provider answer tokens plus thinking tokens. Null when the provider response had no separate output count.';
