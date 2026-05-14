-- Aggregate "read" from Meta webhooks (whatsapp_campaign_recipients.wa_delivery_status = read).

ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS read_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.whatsapp_campaigns.read_count IS 'Recipients with wa_delivery_status = read (Meta read receipt); incremented via trigger.';

UPDATE public.whatsapp_campaigns c
SET read_count = sub.n
FROM (
  SELECT campaign_id, count(*)::integer AS n
  FROM public.whatsapp_campaign_recipients
  WHERE wa_delivery_status IS NOT NULL AND lower(trim(wa_delivery_status)) = 'read'
  GROUP BY campaign_id
) sub
WHERE c.id = sub.campaign_id;

CREATE OR REPLACE FUNCTION public.bump_whatsapp_campaign_read_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.wa_delivery_status IS NOT NULL
       AND lower(trim(NEW.wa_delivery_status)) = 'read'
       AND (
         OLD.wa_delivery_status IS NULL
         OR lower(trim(OLD.wa_delivery_status)) IS DISTINCT FROM 'read'
       )
    THEN
      UPDATE public.whatsapp_campaigns
      SET read_count = read_count + 1,
          updated_at = now()
      WHERE id = NEW.campaign_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_campaign_recipients_read_count ON public.whatsapp_campaign_recipients;
CREATE TRIGGER trg_whatsapp_campaign_recipients_read_count
  AFTER UPDATE OF wa_delivery_status ON public.whatsapp_campaign_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_whatsapp_campaign_read_count();

-- Realtime: list kampanye ikut saat read_count berubah
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'whatsapp_campaigns'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_campaigns;
  END IF;
END $$;
