import mysql from 'mysql2/promise';

export interface CardDoc {
  id: string;
  oracle_id?: string;
  name: string;
  lang?: string;
  released_at?: Date;
  layout?: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  produced_mana?: string[];
  rarity?: string;
  set_id?: string;
  set_code?: string;
  set_name?: string;
  collector_number?: string;
  artist?: string;
  artist_ids?: string[];
  illustration_id?: string;
  flavor_text?: string;
  full_art?: boolean;
  textless?: boolean;
  promo?: boolean;
  reprint?: boolean;
  frame?: string;
  edhrec_rank?: number;
  border_color?: string;
  image_uri_png?: string;
  gatherer_uri?: string;
  edhrec_uri?: string;
  tcgplayer_uri?: string;
  cardmarket_uri?: string;
  cardhoarder_uri?: string;
  legalities?: Record<string, string>;
  games?: string[];
  finishes?: string[];
  reserved?: boolean;
  oversized?: boolean;
  game_changer?: boolean;
  foil?: boolean;
  nonfoil?: boolean;
  digital?: boolean;
}

export class Card {
  private static pool: mysql.Pool;

  private static safeJsonParse(value: any): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;
    
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('Failed to parse JSON field:', value);
      return undefined;
    }
  }

  static setPool(pool: mysql.Pool) {
    Card.pool = pool;
  }

  static async findById(id: string): Promise<CardDoc | null> {
    if (!Card.pool) {
      throw new Error('Database pool not initialized. Call Card.setPool() first.');
    }

    const query = 'SELECT * FROM cards WHERE id = ? LIMIT 1';
    const [rows] = await Card.pool.query<mysql.RowDataPacket[]>(query, [id]);
    
    if (rows.length === 0 || !rows[0]) {
      return null;
    }

    const row = rows[0];
    
    // Parse JSON fields safely
    return {
      ...row,
      colors: Card.safeJsonParse(row.colors),
      color_identity: Card.safeJsonParse(row.color_identity),
      keywords: Card.safeJsonParse(row.keywords),
      produced_mana: Card.safeJsonParse(row.produced_mana),
      artist_ids: Card.safeJsonParse(row.artist_ids),
      legalities: Card.safeJsonParse(row.legalities),
      games: Card.safeJsonParse(row.games),
      finishes: Card.safeJsonParse(row.finishes),
    } as CardDoc;
  }
}