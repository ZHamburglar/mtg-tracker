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
    
    // Parse JSON fields
    return {
      ...row,
      colors: row.colors ? JSON.parse(row.colors) : undefined,
      color_identity: row.color_identity ? JSON.parse(row.color_identity) : undefined,
      keywords: row.keywords ? JSON.parse(row.keywords) : undefined,
      produced_mana: row.produced_mana ? JSON.parse(row.produced_mana) : undefined,
      artist_ids: row.artist_ids ? JSON.parse(row.artist_ids) : undefined,
      legalities: row.legalities ? JSON.parse(row.legalities) : undefined,
      games: row.games ? JSON.parse(row.games) : undefined,
      finishes: row.finishes ? JSON.parse(row.finishes) : undefined,
    } as CardDoc;
  }
}