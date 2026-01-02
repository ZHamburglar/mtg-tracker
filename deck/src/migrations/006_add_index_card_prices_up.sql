-- Add index to speed up latest card price lookup
-- Simple single-statement create (migration runner executes whole file as one statement)
CREATE INDEX idx_card_prices_cardid_createdat ON card_prices(card_id, created_at DESC);