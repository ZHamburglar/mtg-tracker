import mysql from 'mysql2/promise';

export interface CardPriceAttrs {
  card_id: string;  // UUID from cards table
  usd: number;
  usd_foil: number;
  usd_etched: number;
  eur: number;
  eur_foil: number;
  tix: number;
}

export interface CardPriceDoc {
  id: number;
  card_id: string;
  price_usd: number;
  price_usd_foil: number;
  price_usd_etched: number;
  price_eur: number;
  price_eur_foil: number;
  price_tix: number;
  created_at: Date;
  updated_at: Date;
}

export class CardPrice {
  private static pool: mysql.Pool;

  static setPool(pool: mysql.Pool) {
    CardPrice.pool = pool;
  }

  static async create(attrs: CardPriceAttrs): Promise<void> {
    if (!CardPrice.pool) {
      throw new Error('Database pool not initialized. Call CardPrice.setPool() first.');
    }

    await CardPrice.pool.query(
      `INSERT INTO card_prices (card_id, price_usd, price_usd_foil, price_usd_etched, price_eur, price_eur_foil, price_tix) 
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         price_usd = VALUES(price_usd),
         price_usd_foil = VALUES(price_usd_foil),
         price_usd_etched = VALUES(price_usd_etched),
         price_eur = VALUES(price_eur),
         price_eur_foil = VALUES(price_eur_foil),
         price_tix = VALUES(price_tix)`,
      [attrs.card_id, attrs.usd, attrs.usd_foil, attrs.usd_etched, attrs.eur, attrs.eur_foil, attrs.tix]
    );
  }
}