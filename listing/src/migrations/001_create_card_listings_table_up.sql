-- ===========================
-- Create 'card_listings' table
-- ===========================
CREATE TABLE IF NOT EXISTS card_listings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  card_id CHAR(36) NOT NULL,
  collection_id INT NOT NULL, -- Reference to user_card_collection
  
  -- Listing details
  quantity INT NOT NULL DEFAULT 1,
  finish_type ENUM('normal', 'foil', 'etched') NOT NULL DEFAULT 'normal',
  condition ENUM('near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged') NOT NULL DEFAULT 'near_mint',
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  
  -- Listing type and location
  listing_type ENUM('physical', 'online') NOT NULL,
  marketplace VARCHAR(50), -- 'store', 'tcgplayer', 'cardmarket', 'ebay', etc.
  
  -- Pricing
  price_cents INT NOT NULL, -- Price in cents (e.g., $5.99 = 599)
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  
  -- Status
  status ENUM('active', 'sold', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
  
  -- Additional details
  notes TEXT,
  
  -- Timestamps
  listed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  sold_at TIMESTAMP NULL,
  
  -- Indexes for performance
  INDEX idx_user_id (user_id),
  INDEX idx_card_id (card_id),
  INDEX idx_collection_id (collection_id),
  INDEX idx_status (status),
  INDEX idx_listing_type (listing_type),
  INDEX idx_marketplace (marketplace),
  INDEX idx_listed_at (listed_at),
  
  -- Composite indexes for common queries
  INDEX idx_user_status (user_id, status),
  INDEX idx_card_status (card_id, status),
  INDEX idx_type_marketplace (listing_type, marketplace, status),
  
  -- Check constraints
  CHECK (quantity > 0),
  CHECK (price_cents >= 0)
);
