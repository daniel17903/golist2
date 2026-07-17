-- List metadata conflict resolution must not use the aggregate list activity
-- timestamp: item writes advance updated_at and would otherwise make an older
-- list name appear newer than a valid offline rename.
ALTER TABLE shared_lists
ADD COLUMN IF NOT EXISTS metadata_updated_at TIMESTAMPTZ;

UPDATE shared_lists
SET metadata_updated_at = updated_at
WHERE metadata_updated_at IS NULL;

ALTER TABLE shared_lists
ALTER COLUMN metadata_updated_at SET DEFAULT NOW(),
ALTER COLUMN metadata_updated_at SET NOT NULL;
