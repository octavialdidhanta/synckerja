-- Isolate Thinking Lab rows from legacy /thinking without a second table.
-- Null workspace remains the legacy Master Thought list.

ALTER TABLE public.thinking_master_thoughts
  ADD COLUMN IF NOT EXISTS workspace text NULL;

ALTER TABLE public.thinking_master_thoughts
  DROP CONSTRAINT IF EXISTS thinking_master_thoughts_workspace_check;

ALTER TABLE public.thinking_master_thoughts
  ADD CONSTRAINT thinking_master_thoughts_workspace_check
  CHECK (workspace IS NULL OR workspace = 'thinking_lab');

COMMENT ON COLUMN public.thinking_master_thoughts.workspace IS
  'Null is the legacy /thinking workspace. thinking_lab rows belong only to /thinking-lab.';

NOTIFY pgrst, 'reload schema';
