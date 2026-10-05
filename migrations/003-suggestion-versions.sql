ALTER TABLE suggestions ADD COLUMN embedding_revision text NOT NULL DEFAULT 'legacy';
ALTER TABLE posts ADD COLUMN intent_model text;
DO $$
DECLARE item record;
BEGIN
 FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='suggestions'::regclass AND contype='u' AND cardinality(conkey)>2
 LOOP EXECUTE format('ALTER TABLE suggestions DROP CONSTRAINT %I',item.conname); END LOOP;
END $$;
ALTER TABLE suggestions ADD CONSTRAINT suggestions_versions_unique UNIQUE(tenant_id,post_id,image_id,post_version,image_version,threshold_version,embedding_revision);
