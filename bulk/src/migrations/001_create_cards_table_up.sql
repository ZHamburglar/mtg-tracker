-- ===========================
-- Create 'cards' table
-- ===========================
CREATE TABLE IF NOT EXISTS cards (
  id CHAR(36) NOT NULL PRIMARY KEY,                        -- Scryfall card ID (UUID)
  oracle_id CHAR(36),
  
  -- Core searchable card metadata
  name VARCHAR(255) NOT NULL,
  lang VARCHAR(10),
  released_at DATE,
  layout VARCHAR(50),
  mana_cost VARCHAR(50),
  cmc DECIMAL(10,2),
  type_line VARCHAR(255),
  oracle_text TEXT,
  power VARCHAR(10),
  toughness VARCHAR(10),

  -- JSON fields (correctly used)
  colors JSON,
  color_identity JSON,
  keywords JSON,
  produced_mana JSON,

  -- Set information
  rarity VARCHAR(50),
  set_id CHAR(36),
  set_code VARCHAR(10),
  set_name VARCHAR(255),
  collector_number VARCHAR(20),

  -- Artist + art info
  artist VARCHAR(255),
  artist_ids JSON,
  illustration_id CHAR(36),

  -- Flavor & appearance
  flavor_text TEXT,
  full_art BOOLEAN,
  textless BOOLEAN,
  promo BOOLEAN,
  reprint BOOLEAN,
  frame VARCHAR(10),
  border_color VARCHAR(20),

  -- EDHREC score (numeric)
  edhrec_rank INT,

  -- Image & external URIs
  image_uri_png VARCHAR(500),
  gatherer_uri VARCHAR(500),
  edhrec_uri VARCHAR(500),
  tcgplayer_uri VARCHAR(500),
  cardmarket_uri VARCHAR(500),
  cardhoarder_uri VARCHAR(500),

  -- JSON objects
  legalities JSON,
  games JSON,
  finishes JSON,

  -- Flags
  reserved BOOLEAN,
  oversized BOOLEAN,
  game_changer BOOLEAN,
  foil BOOLEAN,
  nonfoil BOOLEAN,
  digital BOOLEAN,

  -- timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- performance indexes
  INDEX idx_name (name),
  INDEX idx_set_code (set_code),
  INDEX idx_oracle (oracle_id),
  INDEX idx_type (type_line),
  INDEX idx_cmc (cmc),
  INDEX idx_color_identity ((CAST(JSON_EXTRACT(color_identity, '$') AS CHAR(50))))

  CONSTRAINT fk_cards_set
    FOREIGN KEY (set_id) REFERENCES sets(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
);