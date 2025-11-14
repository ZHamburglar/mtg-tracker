-- ===========================
-- Create 'card_prices' table
-- ===========================
CREATE TABLE IF NOT EXISTS card_prices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  card_id CHAR(36) NOT NULL,
  usd DECIMAL(10,2),
  usd_foil DECIMAL(10,2),
  usd_etched DECIMAL(10,2),
  eur DECIMAL(10,2),
  eur_foil DECIMAL(10,2),
  tix DECIMAL(10,2),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_card_prices_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);