import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface DeckCardAttrs {
  deck_id: number;
  card_id: number;
  quantity: number;
  category: 'mainboard' | 'sideboard' | 'commander';
  is_commander: boolean;
}

export interface DeckCardDoc extends RowDataPacket {
  id: number;
  deck_id: number;
  card_id: number;
  quantity: number;
  category: 'mainboard' | 'sideboard' | 'commander';
  is_commander: boolean;
  created_at: Date;
  card?: any; // Card details from JOIN
}

export class DeckCard {
  private static pool: Pool;

  static setPool(pool: Pool) {
    this.pool = pool;
  }

  static async create(attrs: DeckCardAttrs): Promise<DeckCardDoc> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO deck_cards (deck_id, card_id, quantity, category, is_commander)
       VALUES (?, ?, ?, ?, ?)`,
      [
        attrs.deck_id,
        attrs.card_id,
        attrs.quantity,
        attrs.category,
        attrs.is_commander
      ]
    );

    const [rows] = await this.pool.execute<DeckCardDoc[]>(
      'SELECT * FROM deck_cards WHERE id = ?',
      [result.insertId]
    );

    if (!rows[0]) {
      throw new Error('Failed to create deck card');
    }

    return rows[0];
  }

  static async findByDeck(deckId: number): Promise<DeckCardDoc[]> {
    const [rows] = await this.pool.execute<DeckCardDoc[]>(
      `SELECT 
        dc.*,
        c.id as 'card.id',
        c.name as 'card.name',
        c.mana_cost as 'card.mana_cost',
        c.cmc as 'card.cmc',
        c.type_line as 'card.type_line',
        c.oracle_text as 'card.oracle_text',
        c.colors as 'card.colors',
        c.color_identity as 'card.color_identity',
        c.set_code as 'card.set_code',
        c.rarity as 'card.rarity',
        c.image_uri_small as 'card.image_uri_small',
        c.image_uri_png as 'card.image_uri_png'
      FROM deck_cards dc
      LEFT JOIN cards c ON dc.card_id = c.id
      WHERE dc.deck_id = ?
      ORDER BY 
        CASE dc.category
          WHEN 'commander' THEN 1
          WHEN 'mainboard' THEN 2
          WHEN 'sideboard' THEN 3
        END,
        c.cmc ASC,
        c.name ASC`,
      [deckId]
    );

    // Transform nested card data
    return rows.map(row => {
      const card = {
        id: row['card.id'],
        name: row['card.name'],
        mana_cost: row['card.mana_cost'],
        cmc: row['card.cmc'],
        type_line: row['card.type_line'],
        oracle_text: row['card.oracle_text'],
        colors: row['card.colors'],
        color_identity: row['card.color_identity'],
        set_code: row['card.set_code'],
        rarity: row['card.rarity'],
        image_uris: {
          small: row['card.image_uri_small'],
          normal: row['card.image_uri_png'],
          png: row['card.image_uri_png']
        }
      };

      return {
        id: row.id,
        deck_id: row.deck_id,
        card_id: row.card_id,
        quantity: row.quantity,
        category: row.category,
        is_commander: row.is_commander,
        created_at: row.created_at,
        card
      } as DeckCardDoc;
    });
  }

  static async findByDeckAndCard(
    deckId: number,
    cardId: number,
    category: string
  ): Promise<DeckCardDoc | null> {
    const [rows] = await this.pool.execute<DeckCardDoc[]>(
      'SELECT * FROM deck_cards WHERE deck_id = ? AND card_id = ? AND category = ?',
      [deckId, cardId, category]
    );

    return rows[0] || null;
  }

  static async updateQuantity(
    deckId: number,
    cardId: number,
    category: string,
    quantity: number
  ): Promise<DeckCardDoc | null> {
    await this.pool.execute(
      'UPDATE deck_cards SET quantity = ? WHERE deck_id = ? AND card_id = ? AND category = ?',
      [quantity, deckId, cardId, category]
    );

    return this.findByDeckAndCard(deckId, cardId, category);
  }

  static async update(
    deckId: number,
    cardId: number,
    category: string,
    updates: Partial<Pick<DeckCardAttrs, 'quantity' | 'is_commander'>>
  ): Promise<DeckCardDoc | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.quantity !== undefined) {
      fields.push('quantity = ?');
      values.push(updates.quantity);
    }

    if (updates.is_commander !== undefined) {
      fields.push('is_commander = ?');
      values.push(updates.is_commander);
    }

    if (fields.length === 0) {
      return this.findByDeckAndCard(deckId, cardId, category);
    }

    const query = `UPDATE deck_cards SET ${fields.join(', ')} WHERE deck_id = ? AND card_id = ? AND category = ?`;
    values.push(deckId, cardId, category);

    await this.pool.execute(query, values);

    return this.findByDeckAndCard(deckId, cardId, category);
  }

  static async delete(
    deckId: number,
    cardId: number,
    category: string
  ): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM deck_cards WHERE deck_id = ? AND card_id = ? AND category = ?',
      [deckId, cardId, category]
    );

    return result.affectedRows > 0;
  }

  static async deleteByDeck(deckId: number): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'DELETE FROM deck_cards WHERE deck_id = ?',
      [deckId]
    );

    return result.affectedRows;
  }

  static async countByDeck(deckId: number, category?: string): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM deck_cards WHERE deck_id = ?';
    const params: any[] = [deckId];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    const [rows] = await this.pool.execute<RowDataPacket[]>(query, params);

    return rows[0]?.count || 0;
  }
}
