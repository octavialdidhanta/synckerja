SELECT 'richard_session' AS check_type, utm_source, utm_medium, utm_campaign, utm_term, gclid, fbclid, has_gclid
FROM public.analytics_sessions
WHERE id = 'a39203ec-43d2-4e82-bb5b-892c606f586b';

SELECT 'richard_lead' AS check_type, l.ticket_id, l.client, l.gclid, l.fbclid, ls.name AS status,
       l.converted_at IS NOT NULL AS converted, l.attribution->>'utm_source' AS utm_source
FROM public.leads l
LEFT JOIN public.lead_statuses ls ON ls.id = l.status_id
WHERE l.id = '3cbf20ab-103e-4a62-8e65-dc8a9be3ed94';

SELECT 'richard_form' AS check_type, form_data
FROM public.lead_submissions
WHERE lead_id = '3cbf20ab-103e-4a62-8e65-dc8a9be3ed94';

SELECT 'richard_invoice' AS check_type, invoice_number, amount, lead_id, whatsapp_status, whatsapp_message_id
FROM public.sales_invoices
WHERE id = '6715b485-8a31-430c-b680-d9214ae63e3b';

SELECT 'richard_sa' AS check_type, id, client_name, total_amount, lead_id, description, status, activity_type
FROM public.sales_activities
WHERE id = 'a72ea66a-8385-48ca-9748-2822782bed47';

SELECT 'dedi_lead' AS check_type, l.ticket_id, l.client, l.gclid, l.fbclid, ls.name AS status,
       l.converted_at IS NOT NULL AS converted
FROM public.leads l
LEFT JOIN public.lead_statuses ls ON ls.id = l.status_id
WHERE l.id = 'f2580a2d-2a9b-461c-90df-fb90fbcaa261';

SELECT 'dedi_form' AS check_type, form_data
FROM public.lead_submissions
WHERE lead_id = 'f2580a2d-2a9b-461c-90df-fb90fbcaa261';

SELECT 'dedi_invoice' AS check_type, invoice_number, amount, whatsapp_status
FROM public.sales_invoices
WHERE id = '67b82eb3-2764-40bb-9928-8fc1413f8a00';

SELECT 'dedi_sa' AS check_type, id, client_name, total_amount, status
FROM public.sales_activities
WHERE id = '8962ebd4-f4fa-4f0d-b76b-26eb788e5ee9';
