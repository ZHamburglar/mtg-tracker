import mysql from 'mysql2/promise';
import { logger } from '../logger';

export interface CardFaceAttrs {
  id: string;
  card_id: string;
  face_order: number;
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors?: string[];
  color_indicator?: string[];
  flavor_text?: string;
  artist?: string;
  illustration_id?: string;
  image_uri_small?: string;
  image_uri_normal?: string;
  image_uri_large?: string;
  image_uri_png?: string;
  image_uri_art_crop?: string;
  image_uri_border_crop?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class CardFace {
  private static pool: mysql.Pool;

  static setPool(pool: mysql.Pool) {
    CardFace.pool = pool;
  }

  static getPool(): mysql.Pool {
    if (!CardFace.pool) {
      throw new Error('Database pool not initialized. Call CardFace.setPool() first.');
    }
    return CardFace.pool;
  }

  static async findByCardId(cardId: string): Promise<CardFaceAttrs[]> {
    if (!CardFace.pool) {
      throw new Error('Database pool not initialized. Call CardFace.setPool() first.');
    }

    const query = `
      SELECT * FROM card_faces 
      WHERE card_id = ? 
      ORDER BY face_order ASC
    `;
    
    const [rows] = await CardFace.pool.query<mysql.RowDataPacket[]>(query, [cardId]);

    return rows.map(row => ({
      ...row,
      colors: row.colors ? JSON.parse(row.colors) : undefined,
      color_indicator: row.color_indicator ? JSON.parse(row.color_indicator) : undefined,
    })) as CardFaceAttrs[];
  }
}
