INSERT INTO public.organization_omnichannel_api_tokens (organization_id, token_hash, token_prefix, label, web_id, allowed_origins, token_type, is_active)
VALUES
  ('663c9336-8cb6-4a36-9ad9-313126e70a1a', '7c58a3229e649cedc7ca4d9edd49fd1fd21104858f304b0a2b82ee0bd421a4b8', 'sk_omni_scope_sd', 'Scope test SDK', 'vialdi-wedding', ARRAY['https://vialdi.id']::text[], 'sdk', true),
  ('663c9336-8cb6-4a36-9ad9-313126e70a1a', 'ff371294934d8a9f08c91d7da6f06ff73ff29c1f155696ecb494f65d8cb96b51', 'sk_omni_scope_se', 'Scope test Server', 'vialdi-wedding', ARRAY[]::text[], 'server', true);
