-- ===========================
-- Remove image_uri_small column from cards table
-- ===========================
ALTER TABLE cards
DROP COLUMN image_uri_small;
