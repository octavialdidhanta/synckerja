-- Required so Realtime filters on organization_id work for UPDATE/DELETE
-- (default replica identity only emits PK columns).
ALTER TABLE public.catalog_ingredient_outlets REPLICA IDENTITY FULL;
