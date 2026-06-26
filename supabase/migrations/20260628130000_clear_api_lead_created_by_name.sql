-- Clear misleading created_by_name on Public API leads (web_id set).
-- CRM displays — for Created By; Web/Property uses leads.web_id.

UPDATE leads
SET created_by_name = '', updated_at = NOW()
WHERE btrim(coalesce(web_id, '')) <> ''
  AND created_by_name IN ('Website form', 'Synckerja API');
