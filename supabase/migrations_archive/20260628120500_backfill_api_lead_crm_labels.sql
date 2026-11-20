-- Backfill professional CRM labels for historical Public API leads.
-- Mirrors deriveApiLeadCrmFields (website_form + whatsapp_button) using latest lead_submission.

WITH latest_sub AS (
  SELECT DISTINCT ON (lead_id)
    lead_id,
    form_data,
    notes,
    web_id AS sub_web_id
  FROM lead_submissions
  WHERE lead_id IS NOT NULL
  ORDER BY lead_id, submitted_at DESC NULLS LAST, updated_at DESC NULLS LAST
),
targets AS (
  SELECT
    l.id,
    l.title,
    l.category,
    l.source,
    COALESCE(NULLIF(btrim(l.web_id), ''), NULLIF(btrim(ls.sub_web_id), ''), '') AS web_id,
    ls.form_data,
    ls.notes,
    l.attribution
  FROM leads l
  LEFT JOIN latest_sub ls ON ls.lead_id = l.id
  WHERE (
    l.title IN ('Lead Website', 'Floating WA click')
    OR l.category = 'Website API'
    OR l.created_by_name = 'Synckerja API'
    OR l.source IN ('Website', 'WhatsApp floating click')
  )
),
enriched AS (
  SELECT
    t.*,
    NULLIF(btrim(COALESCE(t.form_data->>'package_label', '')), '') AS package_label,
    NULLIF(btrim(COALESCE(t.form_data->>'industry', t.form_data->>'business_type', '')), '') AS industry,
    NULLIF(btrim(COALESCE(t.form_data->>'path', '')), '') AS click_path,
    COALESCE(t.form_data->>'source', '') = 'floating_whatsapp' AS is_floating_form,
    LEFT(NULLIF(btrim(split_part(COALESCE(t.notes, ''), E'\n', 1)), ''), 120) AS notes_first_line,
    NULLIF(
      btrim(
        regexp_replace(
          COALESCE(t.attribution->>'landing_url', ''),
          '^https?://[^/]+([^?#]*).*$',
          '\1'
        )
      ),
      ''
    ) AS landing_path
  FROM targets t
),
derived AS (
  SELECT
    id,
    CASE
      WHEN source = 'WhatsApp floating click'
        OR is_floating_form
        OR title = 'Floating WA click'
      THEN 'WhatsApp button'
      ELSE 'Website form'
    END AS new_source,
    LEFT(
      CASE
        WHEN source = 'WhatsApp floating click'
          OR is_floating_form
          OR title = 'Floating WA click'
        THEN 'WhatsApp click · ' || COALESCE(click_path, NULLIF(web_id, ''), 'unknown')
        WHEN package_label IS NOT NULL THEN 'Inquiry — ' || package_label
        WHEN notes_first_line IS NOT NULL THEN notes_first_line
        WHEN landing_path IS NOT NULL AND landing_path <> '/' THEN 'Contact form · ' || landing_path
        ELSE 'Contact form · ' || COALESCE(NULLIF(web_id, ''), 'unknown')
      END,
      120
    ) AS new_title,
    LEFT(
      CASE
        WHEN industry IS NOT NULL THEN industry
        WHEN (
          source = 'WhatsApp floating click'
          OR is_floating_form
          OR title = 'Floating WA click'
        ) AND click_path IS NOT NULL THEN click_path
        WHEN package_label IS NOT NULL
          AND NOT (
            source = 'WhatsApp floating click'
            OR is_floating_form
            OR title = 'Floating WA click'
          )
        THEN package_label
        ELSE initcap(
          replace(
            replace(COALESCE(NULLIF(web_id, ''), 'general'), '-', ' '),
            '_',
            ' '
          )
        )
      END,
      120
    ) AS new_category,
    '' AS new_created_by_name
  FROM enriched
)
UPDATE leads l
SET
  title = d.new_title,
  category = d.new_category,
  source = d.new_source,
  created_by_name = d.new_created_by_name,
  updated_at = NOW()
FROM derived d
WHERE l.id = d.id;
