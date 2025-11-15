-- ===========================
-- Create 'sets' table
-- ===========================
CREATE TABLE IF NOT EXISTS sets (
  id CHAR(36) NOT NULL PRIMARY KEY,  -- Scryfall set_id (UUID)
  code VARCHAR(10) NOT NULL UNIQUE,  -- e.g. "blb", "tsp"
  mtgo_code VARCHAR(10),             -- MTGO code
  arena_code VARCHAR(10),            -- Arena code
  tcgplayer_id INT,                  -- TCGPlayer ID
  name VARCHAR(255) NOT NULL,        -- e.g. "Bloomburrow"
  uri VARCHAR(500),                  -- Scryfall API URI
  scryfall_uri VARCHAR(500),         -- Scryfall web URI
  search_uri VARCHAR(500),           -- Cards search URI
  released_at DATE,
  set_type VARCHAR(50),              -- e.g. "expansion"
  card_count INT,
  digital BOOLEAN,
  nonfoil_only BOOLEAN,
  foil_only BOOLEAN,
  icon_svg_uri VARCHAR(500),
  parent_set_code VARCHAR(10),       -- Parent set code if applicable
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_code (code),
  INDEX idx_parent_set_code (parent_set_code)
);