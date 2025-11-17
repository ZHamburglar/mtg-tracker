import mysql from 'mysql2/promise';

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

  static async findByCardId(
    cardId: string, 
    limit: number = 100, 
    offset: number = 0
  ): Promise<CardPriceDoc[]> {
    if (!CardPrice.pool) {
      throw new Error('Database pool not initialized. Call CardPrice.setPool() first.');
    }

    // Only select the columns we need, add LIMIT and OFFSET for pagination
    const query = `
      SELECT 
        id, card_id, price_usd, price_usd_foil, price_usd_etched, 
        price_eur, price_eur_foil, price_tix, created_at, updated_at
      FROM card_prices 
      WHERE card_id = ? 
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await CardPrice.pool.query<mysql.RowDataPacket[]>(
      query, 
      [cardId, limit, offset]
    );
    
    return rows as CardPriceDoc[];
  }

  static async countByCardId(cardId: string): Promise<number> {
    if (!CardPrice.pool) {
      throw new Error('Database pool not initialized. Call CardPrice.setPool() first.');
    }

    const query = 'SELECT COUNT(*) as total FROM card_prices WHERE card_id = ?';
    const [rows] = await CardPrice.pool.query<mysql.RowDataPacket[]>(query, [cardId]);
    return rows[0]?.total || 0;
  }

  static async getLatestByCardId(cardId: string): Promise<CardPriceDoc | null> {
    if (!CardPrice.pool) {
      throw new Error('Database pool not initialized. Call CardPrice.setPool() first.');
    }

    const query = `
      SELECT 
        id, card_id, price_usd, price_usd_foil, price_usd_etched, 
        price_eur, price_eur_foil, price_tix, created_at, updated_at
      FROM card_prices 
      WHERE card_id = ? 
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const [rows] = await CardPrice.pool.query<mysql.RowDataPacket[]>(query, [cardId]);
    
    return rows.length > 0 ? (rows[0] as CardPriceDoc) : null;
  }
}
