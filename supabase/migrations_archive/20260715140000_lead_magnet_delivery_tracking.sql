-- Lead Magnet: delivery tracking columns + extended funnel event types.

ALTER TABLE public.lead_magnet_enrollments
  ADD COLUMN IF NOT EXISTS private_reply_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS private_reply_message_id text NULL,
  ADD COLUMN IF NOT EXISTS comment_reply_id text NULL,
  ADD COLUMN IF NOT EXISTS first_dm_method text NULL
    CONSTRAINT lead_magnet_enrollments_first_dm_method_chk CHECK (
      first_dm_method IS NULL
      OR first_dm_method IN ('private_reply_button', 'private_reply_text', 'standard')
    );

ALTER TABLE public.lead_magnet_funnel_events
  DROP CONSTRAINT IF EXISTS lead_magnet_funnel_events_type_chk;

ALTER TABLE public.lead_magnet_funnel_events
  ADD CONSTRAINT lead_magnet_funnel_events_type_chk CHECK (
    event_type IN (
      'comment_matched',
      'comment_replied',
      'comment_reply_sent',
      'private_reply_sent',
      'private_reply_failed',
      'follow_checked',
      'follow_gate_sent',
      'follow_retry',
      'follow_validated',
      'framework_offered',
      'delivered',
      'dm_failed',
      'follow_check_failed'
    )
  );
