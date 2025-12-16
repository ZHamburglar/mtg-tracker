-- Migration: Alter deck_cards.card_id from INT to CHAR(36)
-- Service: deck
-- Description: Changes card_id column to support UUID format and matches collation with cards table

ALTER TABLE deck_cards 
  MODIFY COLUMN card_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL;
