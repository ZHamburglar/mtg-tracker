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

export interface CardPriceCreationResult {
  successful: boolean;
  pricesCreated: number;
}

export class CardPrice {
  private static pool: mysql.Pool;

  static setPool(pool: mysql.Pool) {
    CardPrice.pool = pool;
  }

  // Accessor needed for maintenance queries that operate directly on the pool
  // (e.g., complex DELETE joins). Throws if pool not initialized to prevent
  // silent runtime failures.
  static getPool(): mysql.Pool {
    if (!CardPrice.pool) {
      throw new Error('Database pool not initialized. Call CardPrice.setPool() first.');
    }
    return CardPrice.pool;
  }

  static async bulkCreate(prices: CardPriceAttrs[], batchSize: number = 1000): Promise<CardPriceCreationResult> {
    if (!CardPrice.pool) {
      throw new Error('Database pool not initialized. Call CardPrice.setPool() first.');
    }

    let totalCreated = 0;

    // Process in batches
    for (let i = 0; i < prices.length; i += batchSize) {
      const batch = prices.slice(i, i + batchSize);
      console.log(`Processing card price batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(prices.length / batchSize)} (${batch.length} prices)...`);

      // Build bulk insert query for this batch
      const values: any[] = [];
      const placeholders = batch.map(price => {
        values.push(
          price.card_id,
          price.usd,
          price.usd_foil,
          price.usd_etched,
          price.eur,
          price.eur_foil,
          price.tix
        );
        return '(?, ?, ?, ?, ?, ?, ?)';
      }).join(',');

      const query = `
        INSERT INTO card_prices (card_id, price_usd, price_usd_foil, price_usd_etched, price_eur, price_eur_foil, price_tix) 
        VALUES ${placeholders}
      `;

      try {
        const [result] = await CardPrice.pool.query<mysql.ResultSetHeader>(query, values);
        totalCreated += result.affectedRows;
      } catch (error) {
        console.error(`Error bulk creating price batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }
    }

    return {
      successful: true,
      pricesCreated: totalCreated
    };
  }

  static async create(attrs: CardPriceAttrs): Promise<void> {
    if (!CardPrice.pool) {
      throw new Error('Database pool not initialized. Call CardPrice.setPool() first.');
    }

    await CardPrice.pool.query(
      `INSERT INTO card_prices (card_id, price_usd, price_usd_foil, price_usd_etched, price_eur, price_eur_foil, price_tix) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [attrs.card_id, attrs.usd, attrs.usd_foil, attrs.usd_etched, attrs.eur, attrs.eur_foil, attrs.tix]
    );
  }

  static async getTotal(): Promise<number> {
    if (!CardPrice.pool) {
      throw new Error('Database pool not initialized. Call CardPrice.setPool() first.');
    }

    const query = 'SELECT COUNT(*) as total FROM card_prices';
    const [rows] = await CardPrice.pool.query<mysql.RowDataPacket[]>(query);
    return rows[0]?.total || 0;
  }
}