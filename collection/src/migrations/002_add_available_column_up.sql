-- ===========================
-- Add 'available' column to user_card_collection
-- ===========================
-- This tracks how many cards are available for listing/trading
-- available = quantity - (cards currently listed/sold)

-- Step 1: Add the column with default value
ALTER TABLE user_card_collection
  ADD COLUMN available INT NOT NULL DEFAULT 0 AFTER quantity;
