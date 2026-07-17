-- Humanize Lead Magnet mirror messages in Live Chat inbox (instagram + facebook).

-- Outbound: strip "[Tombol: ...]" suffix and store button titles in raw_metadata.
UPDATE public.instagram_messages m
SET
  body = trim(regexp_replace(m.body, E'\\n\\n\\[Tombol: .+\\]\\s*$', '', 'g')),
  message_type = 'lead_magnet_buttons',
  raw_metadata = COALESCE(m.raw_metadata, '{}'::jsonb) || jsonb_build_object(
    'lead_magnet_buttons',
    jsonb_build_object(
      'buttons',
      COALESCE(
        (
          SELECT jsonb_agg(jsonb_build_object('title', trim(btn)))
          FROM unnest(
            string_to_array(
              COALESCE(substring(m.body from E'\\[Tombol:\\s*(.+)\\]\\s*$'), ''),
              ','
            )
          ) AS btn
          WHERE trim(btn) <> ''
        ),
        '[]'::jsonb
      )
    )
  )
WHERE m.direction = 'outbound'
  AND m.body ~ E'\\n\\n\\[Tombol: .+\\]\\s*$';

UPDATE public.facebook_messages m
SET
  body = trim(regexp_replace(m.body, E'\\n\\n\\[Tombol: .+\\]\\s*$', '', 'g')),
  message_type = 'lead_magnet_buttons',
  raw_metadata = COALESCE(m.raw_metadata, '{}'::jsonb) || jsonb_build_object(
    'lead_magnet_buttons',
    jsonb_build_object(
      'buttons',
      COALESCE(
        (
          SELECT jsonb_agg(jsonb_build_object('title', trim(btn)))
          FROM unnest(
            string_to_array(
              COALESCE(substring(m.body from E'\\[Tombol:\\s*(.+)\\]\\s*$'), ''),
              ','
            )
          ) AS btn
          WHERE trim(btn) <> ''
        ),
        '[]'::jsonb
      )
    )
  )
WHERE m.direction = 'outbound'
  AND m.body ~ E'\\n\\n\\[Tombol: .+\\]\\s*$';

-- Inbound postback: replace lm:uuid:action body with human label.
UPDATE public.instagram_messages m
SET body = CASE regexp_replace(m.body, '^lm:[^:]+:', '')
  WHEN 'follow_confirm' THEN 'Sudah Follow'
  WHEN 'get_framework' THEN 'Ambil Materi'
  WHEN 'download' THEN 'Unduh'
  ELSE m.body
END
WHERE m.message_type = 'postback'
  AND m.body LIKE 'lm:%';

UPDATE public.facebook_messages m
SET body = CASE regexp_replace(m.body, '^lm:[^:]+:', '')
  WHEN 'follow_confirm' THEN 'Sudah Follow'
  WHEN 'get_framework' THEN 'Ambil Materi'
  WHEN 'download' THEN 'Unduh'
  ELSE m.body
END
WHERE m.message_type = 'postback'
  AND m.body LIKE 'lm:%';

-- Refresh conversation previews for affected threads.
UPDATE public.instagram_conversations c
SET last_message_body = LEFT(m.body, 200)
FROM public.instagram_messages m
WHERE m.conversation_id = c.id
  AND m.created_at = (
    SELECT MAX(m2.created_at)
    FROM public.instagram_messages m2
    WHERE m2.conversation_id = c.id
  );

UPDATE public.facebook_conversations c
SET last_message_body = LEFT(m.body, 200)
FROM public.facebook_messages m
WHERE m.conversation_id = c.id
  AND m.created_at = (
    SELECT MAX(m2.created_at)
    FROM public.facebook_messages m2
    WHERE m2.conversation_id = c.id
  );
