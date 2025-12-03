import mysql from 'mysql2/promise';
import { logger } from '../logger';

export interface CardFaceAttrs {
  id?: string;
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

  static async build(attrs: CardFaceAttrs): Promise<void> {
    if (!CardFace.pool) {
      throw new Error('Database pool not initialized. Call CardFace.setPool() first.');
    }

    // Build query dynamically based on whether id is provided
    const columns = attrs.id 
      ? 'id, card_id, face_order, name, mana_cost, type_line, oracle_text, power, toughness, colors, color_indicator, flavor_text, artist, illustration_id, image_uri_small, image_uri_normal, image_uri_large, image_uri_png, image_uri_art_crop, image_uri_border_crop'
      : 'card_id, face_order, name, mana_cost, type_line, oracle_text, power, toughness, colors, color_indicator, flavor_text, artist, illustration_id, image_uri_small, image_uri_normal, image_uri_large, image_uri_png, image_uri_art_crop, image_uri_border_crop';
    
    const placeholders = attrs.id 
      ? '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      : '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    const query = `
      INSERT INTO card_faces (${columns})
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        mana_cost = VALUES(mana_cost),
        type_line = VALUES(type_line),
        oracle_text = VALUES(oracle_text),
        power = VALUES(power),
        toughness = VALUES(toughness),
        colors = VALUES(colors),
        color_indicator = VALUES(color_indicator),
        flavor_text = VALUES(flavor_text),
        artist = VALUES(artist),
        illustration_id = VALUES(illustration_id),
        image_uri_small = VALUES(image_uri_small),
        image_uri_normal = VALUES(image_uri_normal),
        image_uri_large = VALUES(image_uri_large),
        image_uri_png = VALUES(image_uri_png),
        image_uri_art_crop = VALUES(image_uri_art_crop),
        image_uri_border_crop = VALUES(image_uri_border_crop),
        updated_at = CURRENT_TIMESTAMP
    `;

    const values = attrs.id 
      ? [
          attrs.id,
          attrs.card_id,
          attrs.face_order,
          attrs.name || null,
          attrs.mana_cost || null,
          attrs.type_line || null,
          attrs.oracle_text || null,
          attrs.power || null,
          attrs.toughness || null,
          attrs.colors ? JSON.stringify(attrs.colors) : null,
          attrs.color_indicator ? JSON.stringify(attrs.color_indicator) : null,
          attrs.flavor_text || null,
          attrs.artist || null,
          attrs.illustration_id || null,
          attrs.image_uri_small || null,
          attrs.image_uri_normal || null,
          attrs.image_uri_large || null,
          attrs.image_uri_png || null,
          attrs.image_uri_art_crop || null,
          attrs.image_uri_border_crop || null,
        ]
      : [
          attrs.card_id,
          attrs.face_order,
          attrs.name || null,
          attrs.mana_cost || null,
          attrs.type_line || null,
          attrs.oracle_text || null,
          attrs.power || null,
          attrs.toughness || null,
          attrs.colors ? JSON.stringify(attrs.colors) : null,
          attrs.color_indicator ? JSON.stringify(attrs.color_indicator) : null,
          attrs.flavor_text || null,
          attrs.artist || null,
          attrs.illustration_id || null,
          attrs.image_uri_small || null,
          attrs.image_uri_normal || null,
          attrs.image_uri_large || null,
          attrs.image_uri_png || null,
          attrs.image_uri_art_crop || null,
          attrs.image_uri_border_crop || null,
        ];

    await CardFace.pool.execute(query, values);
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

  static async deleteByCardId(cardId: string): Promise<void> {
    if (!CardFace.pool) {
      throw new Error('Database pool not initialized. Call CardFace.setPool() first.');
    }

    const query = 'DELETE FROM card_faces WHERE card_id = ?';
    await CardFace.pool.execute(query, [cardId]);
  }

  static async getTotal(): Promise<number> {
    if (!CardFace.pool) {
      throw new Error('Database pool not initialized. Call CardFace.setPool() first.');
    }

    const query = 'SELECT COUNT(*) as total FROM card_faces';
    const [rows] = await CardFace.pool.query<mysql.RowDataPacket[]>(query);
    return rows[0]?.total || 0;
  }
}
