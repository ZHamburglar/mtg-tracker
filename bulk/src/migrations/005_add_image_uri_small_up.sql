-- ===========================
-- Add image_uri_small column to cards table
-- ===========================
ALTER TABLE cards
ADD COLUMN image_uri_small VARCHAR(500) AFTER image_uri_png;
