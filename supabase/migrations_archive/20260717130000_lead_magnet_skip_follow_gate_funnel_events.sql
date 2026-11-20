-- Funnel events for Instagram skip-follow-gate opener + re-check flow.

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
      'follow_rechecked_after_opener',
      'follow_gate_skipped_follower',
      'framework_offered',
      'material_offer_skipped',
      'delivered',
      'dm_failed',
      'follow_check_failed'
    )
  );
