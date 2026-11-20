-- Empty private bucket left by Instagram outreach. Direct deletes require this setting.

SELECT set_config('storage.allow_delete_query', 'true', true);

DELETE FROM storage.buckets WHERE id = 'instagram-outreach-media';
