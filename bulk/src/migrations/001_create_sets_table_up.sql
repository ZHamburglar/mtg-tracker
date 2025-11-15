-- ===========================
-- Create 'sets' table
-- ===========================
CREATE TABLE IF NOT EXISTS sets (
  id CHAR(36) NOT NULL PRIMARY KEY,  -- Scryfall set_id (UUID)
  code VARCHAR(10) NOT NULL UNIQUE,  -- e.g. "blb", "tsp"
  name VARCHAR(255) NOT NULL,        -- e.g. "Bloomburrow"
  set_type VARCHAR(50),              -- e.g. "expansion"
  released_at DATE,
  card_count INT,
  digital BOOLEAN,
  foil_only BOOLEAN,
  nonfoil_only BOOLEAN,
  icon_svg_uri VARCHAR(500),
  scryfall_uri VARCHAR(500),
  search_uri VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);