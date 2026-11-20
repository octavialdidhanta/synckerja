-- Lead Magnet CRM: clear incorrect analytics web_id and backfill created_by_name from connected social accounts.

-- lead_submissions.web_id may be NOT NULL on some deployments; allow NULL for omnichannel Lead Magnet rows.
ALTER TABLE public.lead_submissions
  ALTER COLUMN web_id DROP NOT NULL;

UPDATE public.leads
SET web_id = NULL,
    updated_at = now()
WHERE (source = 'Lead Magnet' OR category = 'Lead Magnet')
  AND web_id IS NOT NULL;

UPDATE public.lead_submissions s
SET web_id = NULL,
    updated_at = now()
WHERE s.lead_magnet_enrollment_id IS NOT NULL
  AND s.web_id IS NOT NULL;

-- Backfill created_by_name on Lead Magnet leads from connected IG/FB account labels.
UPDATE public.leads l
SET created_by_name = COALESCE(
  NULLIF(
    CASE
      WHEN e.platform = 'instagram' THEN (
        SELECT CASE
          WHEN NULLIF(TRIM(ia.instagram_username), '') IS NOT NULL
            THEN '@' || TRIM(BOTH '@' FROM TRIM(ia.instagram_username))
          WHEN NULLIF(TRIM(ia.instagram_name), '') IS NOT NULL
            THEN TRIM(ia.instagram_name)
          ELSE NULL
        END
        FROM public.organization_instagram_accounts ia
        WHERE ia.organization_id = l.organization_id
          AND ia.is_active = true
          AND ia.instagram_business_account_id = COALESCE(
            ca.account_id,
            c.account_id
          )
        ORDER BY ia.updated_at DESC
        LIMIT 1
      )
      WHEN e.platform = 'facebook' THEN (
        SELECT NULLIF(TRIM(fp.page_name), '')
        FROM public.organization_facebook_pages fp
        WHERE fp.organization_id = l.organization_id
          AND fp.is_active = true
          AND fp.facebook_page_id = COALESCE(
            ca.account_id,
            c.account_id
          )
        ORDER BY fp.updated_at DESC
        LIMIT 1
      )
      ELSE NULL
    END,
    ''
  ),
  l.created_by_name
),
updated_at = now()
FROM public.lead_magnet_enrollments e
JOIN public.lead_magnet_campaigns c ON c.id = e.campaign_id
LEFT JOIN public.lead_magnet_campaign_accounts ca
  ON ca.campaign_id = c.id AND ca.platform = e.platform
WHERE l.id = e.lead_id
  AND (l.source = 'Lead Magnet' OR l.category = 'Lead Magnet')
  AND (l.created_by_name IS NULL OR TRIM(l.created_by_name) = '');

COMMENT ON COLUMN public.leads.web_id IS
  'Source website web_id from analytics / API ingest. NULL for omnichannel Lead Magnet leads.';
