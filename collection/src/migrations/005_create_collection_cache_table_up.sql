CREATE TABLE IF NOT EXISTS user_collection_cache (
  user_id INT PRIMARY KEY,
  total_value_usd DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_cards INT NOT NULL DEFAULT 0,
  total_quantity INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_last_updated (last_updated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
