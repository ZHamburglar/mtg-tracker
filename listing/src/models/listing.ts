import { Pool, ResultSetHeader } from 'mysql2/promise';

export type ListingType = 'physical' | 'online';
export type ListingStatus = 'active' | 'sold' | 'cancelled' | 'expired';
export type CardCondition = 'near_mint' | 'lightly_played' | 'moderately_played' | 'heavily_played' | 'damaged';
export type FinishType = 'normal' | 'foil' | 'etched';

export interface Listing {
  id: number;
  user_id: number;
  card_id: string;
  collection_id: number;
  quantity: number;
  finish_type: FinishType;
  condition: CardCondition;
  language: string;
  listing_type: ListingType;
  marketplace?: string;
  price_cents: number;
  currency: string;
  status: ListingStatus;
  notes?: string;
  listed_at: Date;
  updated_at: Date;
  sold_at?: Date;
}

export interface CreateListingInput {
  user_id: number;
  card_id: string;
  collection_id: number;
  quantity: number;
  finish_type: FinishType;
  condition: CardCondition;
  language?: string;
  listing_type: ListingType;
  marketplace?: string;
  price_cents: number;
  currency?: string;
  notes?: string;
}

export interface UpdateListingInput {
  quantity?: number;
  condition?: CardCondition;
  price_cents?: number;
  marketplace?: string;
  notes?: string;
}

export class ListingModel {
  private static pool: Pool;

  static setPool(pool: Pool) {
    this.pool = pool;
  }

  static getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call ListingModel.setPool() first.');
    }
    return this.pool;
  }

  /**
   * Create a new listing
   * Also decreases the available count in user_card_collection
   */
  static async createListing(input: CreateListingInput): Promise<Listing> {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Check if user has enough available cards
      const [collectionRows] = await connection.query<any[]>(
        'SELECT quantity, available, finish_type FROM user_card_collection WHERE id = ? AND user_id = ? FOR UPDATE',
        [input.collection_id, input.user_id]
      );

      if (collectionRows.length === 0) {
        throw new Error('Collection entry not found');
      }

      const collection = collectionRows[0];

      if (collection.finish_type !== input.finish_type) {
        throw new Error('Finish type does not match collection entry');
      }

      if (collection.available < input.quantity) {
        throw new Error(`Not enough available cards. Available: ${collection.available}, Requested: ${input.quantity}`);
      }

      // Decrease available count
      await connection.query(
        'UPDATE user_card_collection SET available = available - ? WHERE id = ?',
        [input.quantity, input.collection_id]
      );

      // Create listing
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO card_listings 
        (user_id, card_id, collection_id, quantity, finish_type, \`condition\`, language, listing_type, marketplace, price_cents, currency, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.user_id,
          input.card_id,
          input.collection_id,
          input.quantity,
          input.finish_type,
          input.condition,
          input.language || 'en',
          input.listing_type,
          input.marketplace,
          input.price_cents,
          input.currency || 'USD',
          input.notes
        ]
      );

      await connection.commit();

      // Fetch and return the created listing
      const [listings] = await connection.query<any[]>(
        'SELECT * FROM card_listings WHERE id = ?',
        [result.insertId]
      );

      return listings[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get listing by ID
   */
  static async getListingById(id: number, userId?: number): Promise<Listing | null> {
    const query = userId
      ? 'SELECT * FROM card_listings WHERE id = ? AND user_id = ?'
      : 'SELECT * FROM card_listings WHERE id = ?';
    
    const params = userId ? [id, userId] : [id];
    
    const [rows] = await this.pool.query<any[]>(query, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get all listings for a user
   */
  static async getUserListings(
    userId: number,
    status?: ListingStatus,
    listingType?: ListingType
  ): Promise<Listing[]> {
    let query = 'SELECT * FROM card_listings WHERE user_id = ?';
    const params: any[] = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (listingType) {
      query += ' AND listing_type = ?';
      params.push(listingType);
    }

    query += ' ORDER BY listed_at DESC';

    const [rows] = await this.pool.query<any[]>(query, params);
    return rows;
  }

  /**
   * Get all listings for a specific card
   */
  static async getCardListings(
    cardId: string,
    status: ListingStatus = 'active',
    listingType?: ListingType
  ): Promise<Listing[]> {
    let query = 'SELECT * FROM card_listings WHERE card_id = ? AND status = ?';
    const params: any[] = [cardId, status];

    if (listingType) {
      query += ' AND listing_type = ?';
      params.push(listingType);
    }

    query += ' ORDER BY price_cents ASC';

    const [rows] = await this.pool.query<any[]>(query, params);
    return rows;
  }

  /**
   * Update listing details
   */
  static async updateListing(
    id: number,
    userId: number,
    updates: UpdateListingInput
  ): Promise<Listing> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get current listing
      const [listings] = await connection.query<any[]>(
        'SELECT * FROM card_listings WHERE id = ? AND user_id = ? FOR UPDATE',
        [id, userId]
      );

      if (listings.length === 0) {
        throw new Error('Listing not found');
      }

      const currentListing = listings[0];

      if (currentListing.status !== 'active') {
        throw new Error('Can only update active listings');
      }

      // If quantity is being changed, adjust available count
      if (updates.quantity !== undefined && updates.quantity !== currentListing.quantity) {
        const quantityDiff = updates.quantity - currentListing.quantity;

        // Check if user has enough available cards for increase
        if (quantityDiff > 0) {
          const [collectionRows] = await connection.query<any[]>(
            'SELECT available FROM user_card_collection WHERE id = ? FOR UPDATE',
            [currentListing.collection_id]
          );

          if (collectionRows[0].available < quantityDiff) {
            throw new Error('Not enough available cards to increase listing quantity');
          }
        }

        // Adjust available count (decrease if quantity increased, increase if decreased)
        await connection.query(
          'UPDATE user_card_collection SET available = available - ? WHERE id = ?',
          [quantityDiff, currentListing.collection_id]
        );
      }

      // Build update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (updates.quantity !== undefined) {
        updateFields.push('quantity = ?');
        updateValues.push(updates.quantity);
      }
      if (updates.condition !== undefined) {
        updateFields.push('`condition` = ?');
        updateValues.push(updates.condition);
      }
      if (updates.price_cents !== undefined) {
        updateFields.push('price_cents = ?');
        updateValues.push(updates.price_cents);
      }
      if (updates.marketplace !== undefined) {
        updateFields.push('marketplace = ?');
        updateValues.push(updates.marketplace);
      }
      if (updates.notes !== undefined) {
        updateFields.push('notes = ?');
        updateValues.push(updates.notes);
      }

      if (updateFields.length > 0) {
        updateValues.push(id, userId);
        await connection.query(
          `UPDATE card_listings SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
          updateValues
        );
      }

      await connection.commit();

      // Fetch and return updated listing
      const [updatedListings] = await connection.query<any[]>(
        'SELECT * FROM card_listings WHERE id = ?',
        [id]
      );

      return updatedListings[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Cancel a listing
   * Returns the quantity back to available in collection
   */
  static async cancelListing(id: number, userId: number): Promise<Listing> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get listing
      const [listings] = await connection.query<any[]>(
        'SELECT * FROM card_listings WHERE id = ? AND user_id = ? FOR UPDATE',
        [id, userId]
      );

      if (listings.length === 0) {
        throw new Error('Listing not found');
      }

      const listing = listings[0];

      if (listing.status !== 'active') {
        throw new Error('Can only cancel active listings');
      }

      // Return quantity to available
      await connection.query(
        'UPDATE user_card_collection SET available = available + ? WHERE id = ?',
        [listing.quantity, listing.collection_id]
      );

      // Update listing status
      await connection.query(
        'UPDATE card_listings SET status = ? WHERE id = ?',
        ['cancelled', id]
      );

      await connection.commit();

      // Fetch and return updated listing
      const [updatedListings] = await connection.query<any[]>(
        'SELECT * FROM card_listings WHERE id = ?',
        [id]
      );

      return updatedListings[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Mark listing as sold
   */
  static async markAsSold(id: number, userId: number): Promise<Listing> {
    const [result] = await this.pool.query<ResultSetHeader>(
      'UPDATE card_listings SET status = ?, sold_at = NOW() WHERE id = ? AND user_id = ? AND status = ?',
      ['sold', id, userId, 'active']
    );

    if (result.affectedRows === 0) {
      throw new Error('Listing not found or not active');
    }

    const [listings] = await this.pool.query<any[]>(
      'SELECT * FROM card_listings WHERE id = ?',
      [id]
    );

    return listings[0];
  }

  /**
   * Delete a listing (admin only or if cancelled/expired)
   */
  static async deleteListing(id: number, userId: number): Promise<void> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get listing
      const [listings] = await connection.query<any[]>(
        'SELECT * FROM card_listings WHERE id = ? AND user_id = ?',
        [id, userId]
      );

      if (listings.length === 0) {
        throw new Error('Listing not found');
      }

      const listing = listings[0];

      // If listing is active, return quantity to available
      if (listing.status === 'active') {
        await connection.query(
          'UPDATE user_card_collection SET available = available + ? WHERE id = ?',
          [listing.quantity, listing.collection_id]
        );
      }

      // Delete listing
      await connection.query('DELETE FROM card_listings WHERE id = ?', [id]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
