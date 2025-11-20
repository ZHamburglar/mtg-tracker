-- ===========================
-- Add 'available' column to user_card_collection
-- ===========================
-- This tracks how many cards are available for listing/trading
-- available = quantity - (cards currently listed/sold)

ALTER TABLE user_card_collection
  ADD COLUMN available INT NOT NULL DEFAULT 0 AFTER quantity;

-- Set available = quantity for all existing records
UPDATE user_card_collection SET available = quantity;

-- Add check constraint to ensure available doesn't exceed quantity
ALTER TABLE user_card_collection
  ADD CONSTRAINT check_available_quantity CHECK (available >= 0 AND available <= quantity);
