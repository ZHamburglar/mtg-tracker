-- Rollback: Drop card_faces table and remove has_multiple_faces column
DROP TABLE IF EXISTS card_faces;

ALTER TABLE cards DROP COLUMN IF EXISTS has_multiple_faces;