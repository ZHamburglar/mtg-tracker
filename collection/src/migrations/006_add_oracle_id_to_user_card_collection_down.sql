-- Remove oracle_id column from user_card_collection
ALTER TABLE user_card_collection
  DROP INDEX idx_oracle_id,
  DROP COLUMN oracle_id;
