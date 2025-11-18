-- ===========================
-- Create 'user_card_collection' table
-- ===========================
CREATE TABLE IF NOT EXISTS user_card_collection (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  card_id CHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  finish_type ENUM('normal', 'foil', 'etched') NOT NULL DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_user_id (user_id),
  INDEX idx_card_id (card_id),
  INDEX idx_user_card (user_id, card_id),
  INDEX idx_finish_type (finish_type),
  
  -- Unique constraint to prevent duplicate entries for same user/card/finish combination
  UNIQUE KEY unique_user_card_finish (user_id, card_id, finish_type),
  
  -- Foreign key constraint to users table (assuming users table exists from auth service)
  -- Note: If users table is in a different database, remove this constraint
  CONSTRAINT fk_user_collection_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  
  -- Check constraint to ensure quantity is positive
  CHECK (quantity > 0)
);
