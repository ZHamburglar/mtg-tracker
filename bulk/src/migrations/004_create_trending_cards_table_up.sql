-- ===========================
-- Create 'trending_cards' table
-- ===========================

CREATE TABLE IF NOT EXISTS trending_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id CHAR(36) NOT NULL,
  card_name VARCHAR(255) NOT NULL,
  timeframe ENUM('24h', '7d', '30d') NOT NULL,
  price_type ENUM('price_usd', 'price_usd_foil', 'price_eur') NOT NULL,
  direction ENUM('increase', 'decrease') NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  old_price DECIMAL(10, 2) NOT NULL,
  price_change DECIMAL(10, 2) NOT NULL,
  percent_change DECIMAL(10, 2) NOT NULL,
  curr_date DATETIME NOT NULL,
  old_date DATETIME NOT NULL,
  `rank` INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_timeframe_pricetype_direction (timeframe, price_type, direction),
  INDEX idx_card_id (card_id),
  INDEX idx_rank (`rank`),
  INDEX idx_created_at (created_at),
  
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
