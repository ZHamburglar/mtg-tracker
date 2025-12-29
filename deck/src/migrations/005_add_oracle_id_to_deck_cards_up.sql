-- Migration: Add oracle_id column to deck_cards
-- Service: deck
-- Description: Stores oracle_id on deck_cards for faster lookups and collection checks

ALTER TABLE deck_cards
  ADD COLUMN oracle_id CHAR(36) NULL AFTER card_id,
  ADD INDEX idx_deck_cards_oracle_id (oracle_id);
