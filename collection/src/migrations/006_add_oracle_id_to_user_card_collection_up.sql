-- Add oracle_id column to user_card_collection for faster queries by oracle
ALTER TABLE user_card_collection
  ADD COLUMN oracle_id CHAR(36) NULL AFTER card_id,
  ADD INDEX idx_oracle_id (oracle_id);

-- Note: existing rows will have NULL oracle_id. Backfill can be performed separately if desired.
