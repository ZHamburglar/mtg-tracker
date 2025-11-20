-- ===========================
-- Remove check constraint for available column
-- ===========================

ALTER TABLE user_card_collection
  DROP CONSTRAINT check_available_quantity;
