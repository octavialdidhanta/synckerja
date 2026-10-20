-- Edited image prompts stay on the still that was generated from them.
-- Null means the slide shows the live Veo 3 prompt cell.

ALTER TABLE public.brief_storyboard_images
  ADD COLUMN IF NOT EXISTS prompt_override text;

COMMENT ON COLUMN public.brief_storyboard_images.prompt_override IS
  'Edited image prompt frozen on this still. Null uses the live Veo 3 prompt cell.';
