-- Migration: Remove oracle_id column from deck_cards
-- Service: deck
-- Description: Reverts addition of oracle_id column

ALTER TABLE deck_cards
  DROP INDEX IF EXISTS idx_deck_cards_oracle_id,
  DROP COLUMN oracle_id;
