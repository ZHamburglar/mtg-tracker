import mysql from 'mysql2/promise';

export interface TrendingCardDoc {
  id: number;
  card_id: string;
  card_name: string;
  timeframe: '24h' | '7d' | '30d';
  price_type: 'price_usd' | 'price_usd_foil' | 'price_eur';
  direction: 'increase' | 'decrease';
  current_price: number;
  old_price: number;
  price_change: number;
  percent_change: number;
  curr_date: Date;
  old_date: Date;
  rank: number; // 1-100 for top increases/decreases
  created_at: Date;
  updated_at: Date;
}

export class TrendingCard {
  private static pool: mysql.Pool;

  static setPool(pool: mysql.Pool) {
    TrendingCard.pool = pool;
  }

  /**
   * Calculate and store trending cards for all combinations of timeframe, price_type, and direction
   * This is meant to be called by a cron job
   */
  static async calculateAndStoreTrendingCards(): Promise<{
    totalRecordsCreated: number;
    calculationTime: number;
  }> {
    if (!TrendingCard.pool) {
      throw new Error('Database pool not initialized. Call TrendingCard.setPool() first.');
    }

    const startTime = Date.now();
    console.log('Starting trending cards calculation...');

    const timeframes: Array<'24h' | '7d' | '30d'> = ['24h', '7d', '30d'];
    const priceTypes: Array<'price_usd' | 'price_usd_foil' | 'price_eur'> = ['price_usd', 'price_usd_foil', 'price_eur'];
    const directions: Array<'increase' | 'decrease'> = ['increase', 'decrease'];
    const limit = 100; // Store top 100 for each combination

    let totalRecordsCreated = 0;

    // Clear old trending data
    await TrendingCard.pool.query('TRUNCATE TABLE trending_cards');
    console.log('Cleared old trending data');

    // Calculate for each combination
    for (const timeframe of timeframes) {
      for (const priceType of priceTypes) {
        for (const direction of directions) {
          console.log(`Calculating trending for ${timeframe} ${priceType} ${direction}...`);

          const intervalMap = {
            '24h': '1 DAY',
            '7d': '7 DAY',
            '30d': '30 DAY'
          };
          const interval = intervalMap[timeframe];
          const orderDirection = direction === 'increase' ? 'DESC' : 'ASC';

          // Use the same SQL logic as the original getTrendingCards method
          const query = `
            INSERT INTO trending_cards (
              card_id, card_name, timeframe, price_type, direction,
              current_price, old_price, price_change, percent_change,
              curr_date, old_date, \`rank\`
            )
            SELECT 
              curr.card_id,
              c.name as card_name,
              ? as timeframe,
              ? as price_type,
              ? as direction,
              curr.${priceType} as current_price,
              old.${priceType} as old_price,
              (curr.${priceType} - old.${priceType}) as price_change,
              CASE 
                WHEN old.${priceType} > 0 THEN ((curr.${priceType} - old.${priceType}) / old.${priceType} * 100)
                ELSE 0 
              END as percent_change,
              curr.created_at as curr_date,
              old.created_at as old_date,
              ROW_NUMBER() OVER (ORDER BY 
                CASE 
                  WHEN old.${priceType} > 0 THEN ((curr.${priceType} - old.${priceType}) / old.${priceType} * 100)
                  ELSE 0 
                END ${orderDirection}
              ) as \`rank\`
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
            LIMIT ${limit}
          `;

          try {
            const [result] = await TrendingCard.pool.query<mysql.ResultSetHeader>(
              query,
              [timeframe, priceType, direction]
            );
            const recordsCreated = result.affectedRows;
            totalRecordsCreated += recordsCreated;
            console.log(`  ✓ Created ${recordsCreated} records for ${timeframe} ${priceType} ${direction}`);
          } catch (error) {
            console.error(`  ✗ Error calculating ${timeframe} ${priceType} ${direction}:`, error);
            throw error;
          }
        }
      }
    }

    const calculationTime = Date.now() - startTime;
    console.log(`Trending cards calculation completed in ${calculationTime}ms`);
    console.log(`Total records created: ${totalRecordsCreated}`);

    return {
      totalRecordsCreated,
      calculationTime
    };
  }

  /**
   * Get trending cards from the pre-calculated table
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
        card_id, card_name, timeframe, price_type, direction,
        current_price, old_price, price_change, percent_change,
        curr_date, old_date, \`rank\`, created_at
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
