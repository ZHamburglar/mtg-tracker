import mysql from 'mysql2/promise';

export interface TrendingCardDoc {
  card_id: string;
  card_name: string;
  current_price: number;
  old_price: number;
  price_change: number;
  percent_change: number;
  curr_date: Date;
  old_date: Date;
  rank: number;
}

export class TrendingCard {
  private static pool: mysql.Pool;

  static setPool(pool: mysql.Pool) {
    TrendingCard.pool = pool;
  }

  /**
   * Get trending cards from the pre-calculated table
   * This is a read-only operation - the Bulk service populates this table
   */
  static async getTrendingCards(
    timeframe: '24h' | '7d' | '30d',
    limit: number = 15,
    priceType: 'price_usd' | 'price_usd_foil' | 'price_eur' = 'price_usd',
    direction: 'increase' | 'decrease' = 'increase'
  ): Promise<TrendingCardDoc[]> {
    if (!TrendingCard.pool) {
      throw new Error('Database pool not initialized. Call TrendingCard.setPool() first.');
    }

    const query = `
      SELECT 
        card_id, card_name, current_price, old_price, 
        price_change, percent_change, curr_date, old_date, \`rank\`
      FROM trending_cards
      WHERE timeframe = ?
        AND price_type = ?
        AND direction = ?
      ORDER BY \`rank\` ASC
      LIMIT ${parseInt(String(limit))}
    `;

    const [rows] = await TrendingCard.pool.query<mysql.RowDataPacket[]>(
      query,
      [timeframe, priceType, direction]
    );

    return rows as TrendingCardDoc[];
  }

  /**
   * Get the last update time for trending cards
   */
  static async getLastUpdateTime(): Promise<Date | null> {
    if (!TrendingCard.pool) {
      throw new Error('Database pool not initialized. Call TrendingCard.setPool() first.');
    }

    const query = `
      SELECT MAX(created_at) as last_update
      FROM trending_cards
    `;

    const [rows] = await TrendingCard.pool.query<mysql.RowDataPacket[]>(query);
    return rows[0]?.last_update || null;
  }
}
