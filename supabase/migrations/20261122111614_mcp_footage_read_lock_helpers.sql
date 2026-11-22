-- Default privileges grant new functions to service_role. The three helpers are
-- only for the footage read functions, which already run as the owner.
REVOKE ALL ON FUNCTION public.mcp_footage_require_member(uuid, uuid) FROM service_role;
REVOKE ALL ON FUNCTION public.mcp_footage_usage_overlaps(numeric, numeric, numeric, numeric) FROM service_role;
REVOKE ALL ON FUNCTION public.mcp_footage_scene_json(uuid) FROM service_role;
