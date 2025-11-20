-- ===========================
-- Remove 'available' column from user_card_collection
-- ===========================

ALTER TABLE user_card_collection
  DROP CONSTRAINT check_available_quantity;

ALTER TABLE user_card_collection
  DROP COLUMN available;
