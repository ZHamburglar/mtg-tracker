-- Add index to speed up latest card price lookup
CREATE INDEX IF NOT EXISTS idx_card_prices_cardid_createdat ON card_prices(card_id, created_at DESC);