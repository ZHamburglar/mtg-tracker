-- ===========================
-- Create 'card_prices' table
-- ===========================
CREATE TABLE IF NOT EXISTS card_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id CHAR(36) NOT NULL,
  price_usd DECIMAL(10,2),
  price_usd_foil DECIMAL(10,2),
  price_usd_etched DECIMAL(10,2),
  price_eur DECIMAL(10,2),
  price_eur_foil DECIMAL(10,2),
  price_tix DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_card_created (card_id, created_at),

  CONSTRAINT fk_card_prices_card
  FOREIGN KEY (card_id) REFERENCES cards(id)
    ON DELETE CASCADE
);

  
  

  
  
  
  
  
  


