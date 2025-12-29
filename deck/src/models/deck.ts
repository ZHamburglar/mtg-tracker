import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export type Visibility = 'public' | 'private' | 'unlisted';

export interface DeckAttrs {
  user_id: number;
  name: string;
  description?: string | null;
  format: string;
  visibility?: Visibility;
}

export interface DeckDoc extends RowDataPacket {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  format: string;
  visibility: Visibility;
  created_at: Date;
  updated_at: Date;
}

export interface DeckQueryOptions {
  limit?: number;
  offset?: number;
  format?: string;
}

export class Deck {
  private static pool: Pool;

  static setPool(pool: Pool) {
    this.pool = pool;
  }

  static async create(attrs: DeckAttrs): Promise<DeckDoc> {
    const visibility = attrs.visibility || 'public';

    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO decks (user_id, name, description, format, visibility)
       VALUES (?, ?, ?, ?, ?)`,
      [attrs.user_id, attrs.name, attrs.description || null, attrs.format, visibility]
    );

    const [rows] = await this.pool.execute<DeckDoc[]>(
      'SELECT * FROM decks WHERE id = ?',
      [result.insertId]
    );

    if (!rows[0]) {
      throw new Error('Failed to create deck');
    }

    return rows[0];
  }

  static async findById(id: number): Promise<DeckDoc | null> {
    const [rows] = await this.pool.execute<DeckDoc[]>(
      'SELECT * FROM decks WHERE id = ?',
      [id]
    );

    return rows[0] || null;
  }

  static async findByUser(
    userId: number,
    options: DeckQueryOptions = {}
  ): Promise<DeckDoc[]> {
    const { limit = 50, offset = 0, format } = options;

    let query = 'SELECT * FROM decks WHERE user_id = ?';
    const params: any[] = [userId];

    if (format) {
      query += ' AND format = ?';
      params.push(format);
    }

    query += ` ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await this.pool.execute<DeckDoc[]>(query, params);

    return rows;
  }

  static async findRecent(limit: number = 6): Promise<DeckDoc[]> {
    const [rows] = await this.pool.execute<DeckDoc[]>(
      `SELECT * FROM decks ORDER BY created_at DESC LIMIT ${limit}`
    );

    return rows;
  }

  static async update(
    id: number,
    updates: Partial<Pick<DeckAttrs, 'name' | 'description' | 'format' | 'visibility'>>
  ): Promise<DeckDoc | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (updates.format !== undefined) {
      fields.push('format = ?');
      values.push(updates.format);
    }

    if (updates.visibility !== undefined) {
      fields.push('visibility = ?');
      values.push(updates.visibility);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = NOW()');

    const query = `UPDATE decks SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    await this.pool.execute(query, values);

    return this.findById(id);
  }

  static async delete(id: number): Promise<boolean> {
    // First delete all cards in the deck
    await this.pool.execute(
      'DELETE FROM deck_cards WHERE deck_id = ?',
      [id]
    );

    // Then delete the deck
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM decks WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }

  static async deleteByUser(userId: number): Promise<number> {
    // Get all deck IDs for the user
    const [decks] = await this.pool.execute<DeckDoc[]>(
      'SELECT id FROM decks WHERE user_id = ?',
      [userId]
    );

    if (decks.length === 0) {
      return 0;
    }

    const deckIds = decks.map(d => d.id);

    // Delete all cards for these decks
    await this.pool.execute(
      `DELETE FROM deck_cards WHERE deck_id IN (${deckIds.map(() => '?').join(',')})`,
      deckIds
    );

    // Delete all decks
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM decks WHERE user_id = ?',
      [userId]
    );

    return result.affectedRows;
  }

  static async countByUser(userId: number, format?: string): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM decks WHERE user_id = ?';
    const params: any[] = [userId];

    if (format) {
      query += ' AND format = ?';
      params.push(format);
    }

    const [rows] = await this.pool.execute<RowDataPacket[]>(query, params);

    return rows[0]?.count || 0;
  }
}
