import mysql from 'mysql2/promise';

export interface SetAttrs {
  id: string;                    // Scryfall set ID (UUID)
  code: string;                  // Set code (e.g., "dsk")
  mtgo_code?: string;
  arena_code?: string;
  tcgplayer_id?: number;
  name: string;                  // Set name
  uri?: string;                  // Scryfall API URI
  scryfall_uri?: string;         // Scryfall web URI
  search_uri?: string;           // Cards search URI
  released_at?: Date;            // Release date
  set_type?: string;             // Set type (e.g., "expansion")
  card_count?: number;           // Number of cards in set
  digital?: boolean;
  nonfoil_only?: boolean;
  foil_only?: boolean;
  icon_svg_uri?: string;         // Set icon SVG
  parent_set_code?: string;      // Parent set code if applicable
}

export class Set {
  private static pool: mysql.Pool;

  static setPool(pool: mysql.Pool) {
    Set.pool = pool;
  }

  static async getAllSets(): Promise<SetAttrs[]> {
    if (!Set.pool) {
      throw new Error('Database pool not initialized. Call Set.setPool() first.');
    }

    const [rows] = await Set.pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM sets`
    );

    return rows as SetAttrs[];
  }
};