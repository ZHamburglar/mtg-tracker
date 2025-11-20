-- ===========================
-- Add check constraint for available column
-- ===========================

ALTER TABLE user_card_collection
  ADD CONSTRAINT check_available_quantity CHECK (available >= 0 AND available <= quantity);
