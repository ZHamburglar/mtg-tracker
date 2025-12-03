-- Migration: Create card_faces table for multi-faced cards
-- This allows proper storage and querying of cards with multiple faces (e.g., transform, modal DFC, split cards)

CREATE TABLE IF NOT EXISTS card_faces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id CHAR(36) NOT NULL,
  face_order INT NOT NULL,
  name VARCHAR(255),
  mana_cost VARCHAR(100),
  type_line VARCHAR(255),
  oracle_text TEXT,
  power VARCHAR(20),
  toughness VARCHAR(20),
  colors JSON,
  color_indicator JSON,
  flavor_text TEXT,
  artist VARCHAR(255),
  illustration_id VARCHAR(255),
  image_uri_small VARCHAR(500),
  image_uri_normal VARCHAR(500),
  image_uri_large VARCHAR(500),
  image_uri_png VARCHAR(500),
  image_uri_art_crop VARCHAR(500),
  image_uri_border_crop VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  INDEX idx_card_id (card_id),
  INDEX idx_face_order (card_id, face_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
