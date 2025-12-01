import mysql from 'mysql2/promise';

export type FinishType = 'normal' | 'foil' | 'etched';

export interface UserCardCollectionDoc {
  id: number;
  user_id: number;
  card_id: string;
  quantity: number;
  finish_type: FinishType;
  created_at: Date;
  updated_at: Date;
}

export interface AddCardToCollectionParams {
  user_id: number;
  card_id: string;
  quantity?: number;
  finish_type?: FinishType;
}

export interface UpdateCardQuantityParams {
  user_id: number;
  card_id: string;
  finish_type: FinishType;
  quantity: number;
}

export class UserCardCollection {
  private static pool: mysql.Pool;

  static setPool(pool: mysql.Pool) {
    UserCardCollection.pool = pool;
  }

  static getPool(): mysql.Pool {
    if (!UserCardCollection.pool) {
      throw new Error('Database pool not initialized. Call UserCardCollection.setPool() first.');
    }
    return UserCardCollection.pool;
  }

  /**
   * Add a card to user's collection or update quantity if it exists
   */
  static async addCard(params: AddCardToCollectionParams): Promise<UserCardCollectionDoc> {
    if (!UserCardCollection.pool) {
      throw new Error('Database pool not initialized. Call UserCardCollection.setPool() first.');
    }

    const quantity = params.quantity || 1;
    const finish_type = params.finish_type || 'normal';

    // Use INSERT ... ON DUPLICATE KEY UPDATE to add or increment quantity
    const query = `
      INSERT INTO user_card_collection (user_id, card_id, quantity, available, finish_type)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        quantity = quantity + VALUES(quantity),
        available = available + VALUES(available),
        updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await UserCardCollection.pool.query<mysql.ResultSetHeader>(
      query,
      [params.user_id, params.card_id, quantity, quantity, finish_type]
    );

    // Update cache in background (don't await)
    UserCardCollection.updateCollectionCache(params.user_id).catch(err => 
      console.error('Failed to update collection cache:', err)
    );

    // Fetch the updated record
    return UserCardCollection.findByUserCardAndFinish(
      params.user_id,
      params.card_id,
      finish_type
    ) as Promise<UserCardCollectionDoc>;
  }

  /**
   * Update card quantity (set to specific value, not increment)
   */
  static async updateQuantity(params: UpdateCardQuantityParams): Promise<UserCardCollectionDoc | null> {
    if (!UserCardCollection.pool) {
      throw new Error('Database pool not initialized. Call UserCardCollection.setPool() first.');
    }

    if (params.quantity <= 0) {
      // If quantity is 0 or negative, remove the card
      await UserCardCollection.removeCard(params.user_id, params.card_id, params.finish_type);
      return null;
    }

    const query = `
      UPDATE user_card_collection 
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND card_id = ? AND finish_type = ?
    `;

    await UserCardCollection.pool.query(
      query,
      [params.quantity, params.user_id, params.card_id, params.finish_type]
    );

    // Update cache in background (don't await)
    UserCardCollection.updateCollectionCache(params.user_id).catch(err => 
      console.error('Failed to update collection cache:', err)
    );

    return UserCardCollection.findByUserCardAndFinish(
      params.user_id,
      params.card_id,
      params.finish_type
    );
  }

  /**
   * Remove a card from collection (or decrement quantity)
   */
  static async removeCard(
    user_id: number,
    card_id: string,
    finish_type: FinishType,
    quantity?: number
  ): Promise<boolean> {
    if (!UserCardCollection.pool) {
      throw new Error('Database pool not initialized. Call UserCardCollection.setPool() first.');
    }

    if (quantity && quantity > 0) {
      // Delete if quantity would reach 0 or below
      const deleteQuery = `
        DELETE FROM user_card_collection 
        WHERE user_id = ? AND card_id = ? AND finish_type = ? AND quantity <= ?
      `;
      const [deleteResult] = await UserCardCollection.pool.query<mysql.ResultSetHeader>(
        deleteQuery, 
        [user_id, card_id, finish_type, quantity]
      );

      // If not deleted, decrement quantity and available
      if (deleteResult.affectedRows === 0) {
        const updateQuery = `
          UPDATE user_card_collection 
          SET quantity = quantity - ?,
              available = available - ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND card_id = ? AND finish_type = ?
        `;
        await UserCardCollection.pool.query(updateQuery, [quantity, quantity, user_id, card_id, finish_type]);
      }
    } else {
      // Remove completely
      const query = `
        DELETE FROM user_card_collection 
        WHERE user_id = ? AND card_id = ? AND finish_type = ?
      `;
      const [result] = await UserCardCollection.pool.query<mysql.ResultSetHeader>(
        query,
        [user_id, card_id, finish_type]
      );
      // Update cache in background (don't await)
      UserCardCollection.updateCollectionCache(user_id).catch(err => 
        console.error('Failed to update collection cache:', err)
      );
      return result.affectedRows > 0;
    }

    // Update cache in background (don't await)
    UserCardCollection.updateCollectionCache(user_id).catch(err => 
      console.error('Failed to update collection cache:', err)
    );

    return true;
  }

  /**
   * Get specific card in user's collection by finish type
   */
  static async findByUserCardAndFinish(
    user_id: number,
    card_id: string,
    finish_type: FinishType
  ): Promise<UserCardCollectionDoc | null> {
    if (!UserCardCollection.pool) {
      throw new Error('Database pool not initialized. Call UserCardCollection.setPool() first.');
    }

    const query = `
      SELECT * FROM user_card_collection 
      WHERE user_id = ? AND card_id = ? AND finish_type = ?
    `;

    const [rows] = await UserCardCollection.pool.query<mysql.RowDataPacket[]>(
      query,
      [user_id, card_id, finish_type]
    );

    return rows.length > 0 ? (rows[0] as UserCardCollectionDoc) : null;
  }

  /**
   * Get all cards for a specific user with pagination
   */
  static async findByUser(
    user_id: number,
    options?: {
      limit?: number;
      offset?: number;
      finish_type?: FinishType;
    }
  ): Promise<{ cards: UserCardCollectionDoc[]; total: number }> {
    if (!UserCardCollection.pool) {
      throw new Error('Database pool not initialized. Call UserCardCollection.setPool() first.');
    }

    const limit = Math.min(options?.limit || 100, 1000);
    const offset = options?.offset || 0;

    let whereClause = 'WHERE user_id = ?';
    const queryParams: any[] = [user_id];

    if (options?.finish_type) {
      whereClause += ' AND finish_type = ?';
      queryParams.push(options.finish_type);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM user_card_collection ${whereClause}`;
    const [countRows] = await UserCardCollection.pool.query<mysql.RowDataPacket[]>(
      countQuery,
      queryParams
    );
    const total = countRows[0]?.total || 0;

    // Get paginated results
    const dataQuery = `
      SELECT * FROM user_card_collection 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [rows] = await UserCardCollection.pool.query<mysql.RowDataPacket[]>(
      dataQuery,
      queryParams
    );

    return {
      cards: rows as UserCardCollectionDoc[],
      total
    };
  }

  /**
   * Get all versions (finishes) of a specific card for a user
   */
  static async findAllFinishesByUserAndCard(
    user_id: number,
    card_id: string
  ): Promise<UserCardCollectionDoc[]> {
    if (!UserCardCollection.pool) {
      throw new Error('Database pool not initialized. Call UserCardCollection.setPool() first.');
    }

    const query = `
      SELECT * FROM user_card_collection 
      WHERE user_id = ? AND card_id = ?
      ORDER BY finish_type
    `;

    const [rows] = await UserCardCollection.pool.query<mysql.RowDataPacket[]>(
      query,
      [user_id, card_id]
    );

    return rows as UserCardCollectionDoc[];
  }

  /**
   * Get total quantity of a specific card across all finish types for a user
   */
  static async getTotalQuantity(user_id: number, card_id: string): Promise<number> {
    if (!UserCardCollection.pool) {
      throw new Error('Database pool not initialized. Call UserCardCollection.setPool() first.');
    }

    const query = `
      SELECT SUM(quantity) as total 
      FROM user_card_collection 
      WHERE user_id = ? AND card_id = ?
    `;

    const [rows] = await UserCardCollection.pool.query<mysql.RowDataPacket[]>(
      query,
      [user_id, card_id]
    );

    return rows[0]?.total || 0;
  }

  /**
   * Get collection statistics for a user
   */
  static async getStats(user_id: number): Promise<{
    total_cards: number;
    total_quantity: number;
    by_finish: { finish_type: FinishType; count: number; quantity: number }[];
  }> {
    if (!UserCardCollection.pool) {
      throw new Error('Database pool not initialized. Call UserCardCollection.setPool() first.');
    }

    // Get total unique cards and total quantity
    const totalQuery = `
      SELECT 
        COUNT(*) as total_cards,
        SUM(quantity) as total_quantity
      FROM user_card_collection 
      WHERE user_id = ?
    `;
    const [totalRows] = await UserCardCollection.pool.query<mysql.RowDataPacket[]>(
      totalQuery,
      [user_id]
    );

    // Get stats by finish type
    const finishQuery = `
      SELECT 
        finish_type,
        COUNT(*) as count,
        SUM(quantity) as quantity
      FROM user_card_collection 
      WHERE user_id = ?
      GROUP BY finish_type
    `;
    const [finishRows] = await UserCardCollection.pool.query<mysql.RowDataPacket[]>(
      finishQuery,
      [user_id]
    );

    return {
      total_cards: totalRows[0]?.total_cards || 0,
      total_quantity: totalRows[0]?.total_quantity || 0,
      by_finish: finishRows as { finish_type: FinishType; count: number; quantity: number }[]
    };
  }

  /**
   * Update cached collection value for a user
   * Should be called whenever collection changes (add/update/remove)
   */
  static async updateCollectionCache(user_id: number): Promise<void> {
    if (!UserCardCollection.pool) {
      throw new Error('Database pool not initialized. Call UserCardCollection.setPool() first.');
    }

    // Calculate total value based on quantity and finish type
    const query = `
      INSERT INTO user_collection_cache (user_id, total_value_usd, total_cards, total_quantity)
      SELECT 
        ucc.user_id,
        COALESCE(SUM(
          ucc.quantity * 
          CASE 
            WHEN ucc.finish_type = 'foil' THEN COALESCE(cp.price_usd_foil, 0)
            ELSE COALESCE(cp.price_usd, 0)
          END
        ), 0) as total_value_usd,
        COUNT(*) as total_cards,
        SUM(ucc.quantity) as total_quantity
      FROM user_card_collection ucc
      LEFT JOIN (
        SELECT card_id, price_usd, price_usd_foil
        FROM card_prices cp1
        WHERE created_at = (
          SELECT MAX(created_at) 
          FROM card_prices cp2 
          WHERE cp2.card_id = cp1.card_id
        )
      ) cp ON ucc.card_id = cp.card_id
      WHERE ucc.user_id = ?
      GROUP BY ucc.user_id
      ON DUPLICATE KEY UPDATE 
        total_value_usd = VALUES(total_value_usd),
        total_cards = VALUES(total_cards),
        total_quantity = VALUES(total_quantity),
        last_updated = CURRENT_TIMESTAMP
    `;

    await UserCardCollection.pool.query(query, [user_id]);
  }

  /**
   * Get cached collection value for a user
   */
  static async getCachedCollectionValue(user_id: number): Promise<{
    total_value_usd: number;
    total_cards: number;
    total_quantity: number;
    last_updated: Date;
  } | null> {
    if (!UserCardCollection.pool) {
      throw new Error('Database pool not initialized. Call UserCardCollection.setPool() first.');
    }

    const query = `
      SELECT total_value_usd, total_cards, total_quantity, last_updated
      FROM user_collection_cache
      WHERE user_id = ?
    `;

    const [rows] = await UserCardCollection.pool.query<mysql.RowDataPacket[]>(query, [user_id]);
    
    if (rows.length === 0) {
      // Cache doesn't exist, create it
      await UserCardCollection.updateCollectionCache(user_id);
      const [newRows] = await UserCardCollection.pool.query<mysql.RowDataPacket[]>(query, [user_id]);
      return newRows[0] as any || null;
    }

    return rows[0] as any;
  }
}
