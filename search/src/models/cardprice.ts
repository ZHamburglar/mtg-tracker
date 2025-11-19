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

    // Build query with numeric LIMIT and OFFSET directly (mysql2 issue with binding numeric values)
    const query = `
      SELECT 
        id, card_id, price_usd, price_usd_foil, price_usd_etched, 
        price_eur, price_eur_foil, price_tix, created_at, updated_at
      FROM card_prices 
      WHERE card_id = ? 
      ORDER BY created_at DESC
      LIMIT ${parseInt(String(limit))} OFFSET ${parseInt(String(offset))}
    `;
    const [rows] = await CardPrice.pool.query<mysql.RowDataPacket[]>(
      query, 
      [cardId]
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

  /**
   * Get cards with greatest price changes over a time period
   * @param timeframe - '24h', '7d', or '30d'
   * @param limit - number of results to return
   * @param priceType - which price field to track (default: price_usd)
   * @param direction - 'increase' or 'decrease'
   */
  static async getTrendingCards(
    timeframe: '24h' | '7d' | '30d',
    limit: number = 15,
    priceType: 'price_usd' | 'price_usd_foil' | 'price_eur' = 'price_usd',
    direction: 'increase' | 'decrease' = 'increase'
  ): Promise<Array<{
    card_id: string;
    card_name: string;
    current_price: number;
    old_price: number;
    price_change: number;
    percent_change: number;
    current_date: Date;
    comparison_date: Date;
  }>> {
    if (!CardPrice.pool) {
      throw new Error('Database pool not initialized. Call CardPrice.setPool() first.');
    }

    // Determine the interval based on timeframe
    const intervalMap = {
      '24h': '1 DAY',
      '7d': '7 DAY',
      '30d': '30 DAY'
    };
    const interval = intervalMap[timeframe];
    const orderDirection = direction === 'increase' ? 'DESC' : 'ASC';

    const query = `
      SELECT 
        curr.card_id,
        c.name as card_name,
        curr.${priceType} as current_price,
        old.${priceType} as old_price,
        (curr.${priceType} - old.${priceType}) as price_change,
        CASE 
          WHEN old.${priceType} > 0 THEN ((curr.${priceType} - old.${priceType}) / old.${priceType} * 100)
          ELSE 0 
        END as percent_change,
        curr.created_at as current_date,
        old.created_at as comparison_date
      FROM (
        SELECT card_id, ${priceType}, created_at,
               ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY created_at DESC) as rn
        FROM card_prices
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
          AND ${priceType} > 0
      ) curr
      INNER JOIN (
        SELECT card_id, ${priceType}, created_at,
               ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY created_at ASC) as rn
        FROM card_prices
        WHERE created_at <= DATE_SUB(NOW(), INTERVAL ${interval})
          AND ${priceType} > 0
      ) old ON curr.card_id = old.card_id AND old.rn = 1
      INNER JOIN cards c ON curr.card_id = c.id
      WHERE curr.rn = 1
        AND old.${priceType} > 0
        AND ABS(curr.${priceType} - old.${priceType}) > 0.01
      ORDER BY percent_change ${orderDirection}
      LIMIT ${parseInt(String(limit))}
    `;

    const [rows] = await CardPrice.pool.query<mysql.RowDataPacket[]>(query);
    return rows as Array<{
      card_id: string;
      card_name: string;
      current_price: number;
      old_price: number;
      price_change: number;
      percent_change: number;
      current_date: Date;
      comparison_date: Date;
    }>;
  }
}
