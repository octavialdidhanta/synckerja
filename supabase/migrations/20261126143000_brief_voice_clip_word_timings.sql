-- Word timings of a VO clip (from ElevenLabs /with-timestamps): [{"text","start","end"}] in seconds.
-- Used for subtitles that follow the voice and for cutting shots on the VO.
ALTER TABLE public.brief_voice_clips ADD COLUMN IF NOT EXISTS word_timings jsonb;

COMMENT ON COLUMN public.brief_voice_clips.word_timings IS
  'Word timings of the VO clip from ElevenLabs with-timestamps: [{text, start, end}] in seconds. Null for older clips.';
