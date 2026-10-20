-- Freeze Shot, Angle, and Visual function on the still that was generated from them.
-- Null keeps showing the live table cell.

ALTER TABLE public.brief_storyboard_images
  ADD COLUMN IF NOT EXISTS shot_text text,
  ADD COLUMN IF NOT EXISTS angle_text text,
  ADD COLUMN IF NOT EXISTS visual_function_text text;

COMMENT ON COLUMN public.brief_storyboard_images.shot_text IS
  'Shot line frozen on this still. Null uses the live Shot cell.';
COMMENT ON COLUMN public.brief_storyboard_images.angle_text IS
  'Angle line frozen on this still. Null uses the live Angle cell.';
COMMENT ON COLUMN public.brief_storyboard_images.visual_function_text IS
  'Visual function line frozen on this still. Null uses the live Visual function cell.';
