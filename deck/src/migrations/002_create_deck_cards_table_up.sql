-- Migration: Create deck_cards table
-- Service: deck
-- Description: Creates the deck_cards table for storing cards in decks with quantities and categories

CREATE TABLE IF NOT EXISTS deck_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deck_id INT NOT NULL,
  card_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  category ENUM('mainboard', 'sideboard', 'commander') NOT NULL DEFAULT 'mainboard',
  is_commander BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_deck_id (deck_id),
  INDEX idx_card_id (card_id),
  INDEX idx_category (category),
  UNIQUE KEY unique_deck_card_category (deck_id, card_id, category),
  CONSTRAINT fk_deck_cards_deck FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
