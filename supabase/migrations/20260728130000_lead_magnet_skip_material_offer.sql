-- Skip Material offer DM: after follow gate (or directly for followers with skip follow gate),
-- send delivery DM without the intermediate material-offer postback step.

ALTER TABLE lead_magnet_campaigns
  ADD COLUMN IF NOT EXISTS skip_material_offer boolean NOT NULL DEFAULT false;

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
      'material_offer_skipped',
      'delivered',
      'dm_failed',
      'follow_check_failed'
    )
  );
