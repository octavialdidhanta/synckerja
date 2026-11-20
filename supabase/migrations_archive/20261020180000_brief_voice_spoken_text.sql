ALTER TABLE public.brief_voice_clips
  ADD COLUMN IF NOT EXISTS spoken_text text NULL;

COMMENT ON COLUMN public.brief_voice_clips.spoken_text IS 'Text actually sent to ElevenLabs. Auto-tag may add bracketed delivery marks that are not stored in the brief cell.';
