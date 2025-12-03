import mysql from 'mysql2/promise';

import { logger } from '../logger';

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
  has_multiple_faces?: boolean;
  card_faces?: any[];
}

export class Card {
  private static pool: mysql.Pool;

  private static safeJsonParse(value: any): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;
    
    try {
      return JSON.parse(value);
    } catch (error) {
      logger.warn('Failed to parse JSON field:', value);
      return undefined;
    }
  }

  static setPool(pool: mysql.Pool) {
    Card.pool = pool;
  }

  static getPool(): mysql.Pool {
    if (!Card.pool) {
      throw new Error('Database pool not initialized. Call Card.setPool() first.');
    }
    return Card.pool;
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
    const card = {
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

    // Fetch card faces if card has multiple faces
    if (card.has_multiple_faces) {
      const [faceRows] = await Card.pool.query<mysql.RowDataPacket[]>(
        'SELECT * FROM card_faces WHERE card_id = ? ORDER BY face_order',
        [id]
      );
      card.card_faces = faceRows.map(face => ({
        ...face,
        colors: Card.safeJsonParse(face.colors),
        color_indicator: Card.safeJsonParse(face.color_indicator),
      }));
    }

    return card;
  }

  static async findByOracleId(oracleId: string): Promise<CardDoc[]> {
    if (!Card.pool) {
      throw new Error('Database pool not initialized. Call Card.setPool() first.');
    }

    const query = `
      SELECT * FROM cards 
      WHERE oracle_id = ? 
      ORDER BY released_at DESC, set_name ASC
    `;
    const [rows] = await Card.pool.query<mysql.RowDataPacket[]>(query, [oracleId]);
    
    // Parse JSON fields for all rows
    return rows.map(row => ({
      ...row,
      colors: Card.safeJsonParse(row.colors),
      color_identity: Card.safeJsonParse(row.color_identity),
      keywords: Card.safeJsonParse(row.keywords),
      produced_mana: Card.safeJsonParse(row.produced_mana),
      artist_ids: Card.safeJsonParse(row.artist_ids),
      legalities: Card.safeJsonParse(row.legalities),
      games: Card.safeJsonParse(row.games),
      finishes: Card.safeJsonParse(row.finishes),
    } as CardDoc));
  }

  static async getAllArtists(): Promise<string[]> {
    if (!Card.pool) {
      throw new Error('Database pool not initialized. Call Card.setPool() first.');
    }

    const query = `
      SELECT DISTINCT artist 
      FROM cards 
      WHERE artist IS NOT NULL AND artist != ''
      ORDER BY artist ASC
    `;
    const [rows] = await Card.pool.query<mysql.RowDataPacket[]>(query);
    
    return rows.map(row => row.artist as string);
  }

  static async search(params: {
    name?: string;
    released_at?: string;
    mana_cost?: string;
    cmc?: number;
    cmc_min?: number;
    cmc_max?: number;
    type_line?: string | string[];
    oracle_text?: string;
    power?: string;
    toughness?: string;
    colors?: string[];
    color_identity?: string[];
    keywords?: string[];
    rarity?: string | string[];
    artist?: string | string[];
    set_id?: string;
    set_code?: string;
    set_name?: string | string[];
    legality_format?: string[];
    unique_prints?: boolean; // If true, returns all prints; if false (default), groups by oracle_id
    include_all_types?: boolean; // If true, includes all set types; if false (default), excludes token and memorabilia
    limit?: number;
    offset?: number;
  }): Promise<{ cards: CardDoc[]; total: number }> {
    if (!Card.pool) {
      throw new Error('Database pool not initialized. Call Card.setPool() first.');
    }

    const whereClauses: string[] = [];
    const queryParams: any[] = [];
    const uniquePrints = params.unique_prints === true;

    // Fuzzy search for name (case-insensitive)
    if (params.name) {
      whereClauses.push('name LIKE ?');
      queryParams.push(`%${params.name}%`);
    }

    // Exact or range search for released_at
    if (params.released_at) {
      whereClauses.push('released_at = ?');
      queryParams.push(params.released_at);
    }

    // Fuzzy search for mana_cost
    if (params.mana_cost) {
      whereClauses.push('mana_cost LIKE ?');
      queryParams.push(`%${params.mana_cost}%`);
    }

    // CMC exact or range search
    if (params.cmc !== undefined) {
      whereClauses.push('cmc = ?');
      queryParams.push(params.cmc);
    } else {
      if (params.cmc_min !== undefined) {
        whereClauses.push('cmc >= ?');
        queryParams.push(params.cmc_min);
      }
      if (params.cmc_max !== undefined) {
        whereClauses.push('cmc <= ?');
        queryParams.push(params.cmc_max);
      }
    }

    // Fuzzy search for type_line - matches if type_line contains ALL of the provided types
    if (params.type_line) {
      if (Array.isArray(params.type_line) && params.type_line.length > 0) {
        // Use LIKE with AND to match only if ALL types appear in the type_line
        const typeConditions = params.type_line.map(() => 'type_line LIKE ?').join(' AND ');
        whereClauses.push(`(${typeConditions})`);
        params.type_line.forEach(t => queryParams.push(`%${t}%`));
      } else if (typeof params.type_line === 'string') {
        whereClauses.push('type_line LIKE ?');
        queryParams.push(`%${params.type_line}%`);
      }
    }

    // Fuzzy search for oracle_text
    if (params.oracle_text) {
      whereClauses.push('oracle_text LIKE ?');
      queryParams.push(`%${params.oracle_text}%`);
    }

    // Exact search for power and toughness
    if (params.power) {
      whereClauses.push('power = ?');
      queryParams.push(params.power);
    }

    if (params.toughness) {
      whereClauses.push('toughness = ?');
      queryParams.push(params.toughness);
    }

    // JSON array searches for colors (using JSON_CONTAINS)
    if (params.colors && params.colors.length > 0) {
      const colorConditions = params.colors.map(() => 'JSON_CONTAINS(colors, ?)').join(' AND ');
      whereClauses.push(`(${colorConditions})`);
      params.colors.forEach(color => {
        queryParams.push(JSON.stringify(color));
      });
    }

    // JSON array searches for color_identity
    if (params.color_identity && params.color_identity.length > 0) {
      const colorIdConditions = params.color_identity.map(() => 'JSON_CONTAINS(color_identity, ?)').join(' AND ');
      whereClauses.push(`(${colorIdConditions})`);
      params.color_identity.forEach(color => {
        queryParams.push(JSON.stringify(color));
      });
    }

    // JSON array searches for keywords
    if (params.keywords && params.keywords.length > 0) {
      const keywordConditions = params.keywords.map(() => 'JSON_CONTAINS(keywords, ?)').join(' AND ');
      whereClauses.push(`(${keywordConditions})`);
      params.keywords.forEach(keyword => {
        queryParams.push(JSON.stringify(keyword));
      });
    }

    // Exact search for rarity (supports multiple values)
    if (params.rarity) {
      if (Array.isArray(params.rarity) && params.rarity.length > 0) {
        const placeholders = params.rarity.map(() => '?').join(', ');
        whereClauses.push(`rarity IN (${placeholders})`);
        params.rarity.forEach(r => queryParams.push(r));
      } else if (typeof params.rarity === 'string') {
        whereClauses.push('rarity = ?');
        queryParams.push(params.rarity);
      }
    }

    // Exact search for artist (supports multiple values)
    if (params.artist) {
      if (Array.isArray(params.artist) && params.artist.length > 0) {
        const placeholders = params.artist.map(() => '?').join(', ');
        whereClauses.push(`artist IN (${placeholders})`);
        params.artist.forEach(a => queryParams.push(a));
      } else if (typeof params.artist === 'string') {
        whereClauses.push('artist = ?');
        queryParams.push(params.artist);
      }
    }

    // Exact search for set_code
    if (params.set_id) {
      whereClauses.push('set_id = ?');
      queryParams.push(params.set_id);
    }

    // Exact search for set_code
    if (params.set_code) {
      whereClauses.push('set_code = ?');
      queryParams.push(params.set_code);
    }

    // Fuzzy search for set_name (supports array for multiple sets)
    if (params.set_name) {
      if (Array.isArray(params.set_name) && params.set_name.length > 0) {
        const placeholders = params.set_name.map(() => '?').join(', ');
        whereClauses.push(`set_name IN (${placeholders})`);
        params.set_name.forEach(s => queryParams.push(s));
      } else if (typeof params.set_name === 'string') {
        whereClauses.push('set_name LIKE ?');
        queryParams.push(`%${params.set_name}%`);
      }
    }

    // JSON object search for legalities - card must be legal in at least one of the specified formats
    if (params.legality_format && params.legality_format.length > 0) {
      const legalityConditions = params.legality_format.map(() => 'JSON_EXTRACT(legalities, ?) = "legal"').join(' OR ');
      whereClauses.push(`(${legalityConditions})`);
      params.legality_format.forEach(format => {
        queryParams.push(`$.${format}`);
      });
    }

    // Filter out token and memorabilia set types by default
    if (params.include_all_types !== true) {
      whereClauses.push('set_id IN (SELECT id FROM sets WHERE set_type NOT IN ("token", "memorabilia"))');
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const limit = Math.min(params.limit || 100, 1000);
    const offset = params.offset || 0;

    // Group by oracle_id unless unique_prints is true
    // When grouping, select the most recent printing (by released_at)
    let groupByClause = '';
    let selectClause = '*';
    
    if (!uniquePrints) {
      // Use a subquery to get one card per oracle_id (most recent by released_at)
      // For cards without oracle_id, treat each as unique
      groupByClause = `
        AND id IN (
          SELECT c1.id FROM cards c1
          LEFT JOIN cards c2 
            ON c1.oracle_id = c2.oracle_id 
            AND c1.oracle_id IS NOT NULL
            AND (c2.released_at > c1.released_at OR (c2.released_at = c1.released_at AND c2.id > c1.id))
          WHERE c2.id IS NULL
          ${whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : ''}
        )
      `;
    }

    // Get total count (of unique oracle_ids if not showing all prints)
    let countQuery: string;
    if (!uniquePrints) {
      // Count distinct oracle_ids (treating NULL oracle_ids as separate)
      countQuery = `
        SELECT COUNT(DISTINCT COALESCE(oracle_id, id)) as total 
        FROM cards 
        ${whereClause}
      `;
    } else {
      countQuery = `SELECT COUNT(*) as total FROM cards ${whereClause}`;
    }
    
    const [countRows] = await Card.pool.query<mysql.RowDataPacket[]>(countQuery, queryParams);
    const total = countRows[0]?.total || 0;

    // Get paginated results
    let dataQuery: string;
    if (!uniquePrints) {
      // Build WHERE clause with c1 prefix for subquery
      const prefixedWhereClauses = whereClauses.map(clause => {
        // Replace column names with c1. prefix for disambiguation
        return clause
          .replace(/^name /i, 'c1.name ')
          .replace(/^released_at /i, 'c1.released_at ')
          .replace(/^mana_cost /i, 'c1.mana_cost ')
          .replace(/^cmc /i, 'c1.cmc ')
          .replace(/type_line LIKE/g, 'c1.type_line LIKE')
          .replace(/^type_line /i, 'c1.type_line ')
          .replace(/^oracle_text /i, 'c1.oracle_text ')
          .replace(/^power /i, 'c1.power ')
          .replace(/^toughness /i, 'c1.toughness ')
          .replace(/^rarity /i, 'c1.rarity ')
          .replace(/^artist /i, 'c1.artist ')
          .replace(/^set_id /i, 'c1.set_id ')
          .replace(/^set_code /i, 'c1.set_code ')
          .replace(/^set_name /i, 'c1.set_name ')
          .replace(/JSON_CONTAINS\(colors/g, 'JSON_CONTAINS(c1.colors')
          .replace(/JSON_CONTAINS\(color_identity/g, 'JSON_CONTAINS(c1.color_identity')
          .replace(/JSON_CONTAINS\(keywords/g, 'JSON_CONTAINS(c1.keywords')
          .replace(/JSON_EXTRACT\(legalities/g, 'JSON_EXTRACT(c1.legalities')
          .replace(/JSON_EXTRACT\(c1\.legalities/g, 'JSON_EXTRACT(c1.legalities');
      });

      // Get one card per oracle_id
      dataQuery = `
        SELECT * FROM cards 
        WHERE id IN (
          SELECT c1.id FROM cards c1
          LEFT JOIN cards c2 
            ON c1.oracle_id = c2.oracle_id 
            AND c1.oracle_id IS NOT NULL
            AND (c2.released_at > c1.released_at OR (c2.released_at = c1.released_at AND c2.id > c1.id))
          WHERE c2.id IS NULL
          ${prefixedWhereClauses.length > 0 ? `AND (${prefixedWhereClauses.join(' AND ')})` : ''}
        )
        ORDER BY name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      dataQuery = `
        SELECT * FROM cards 
        ${whereClause}
        ORDER BY name ASC, released_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    
    const [rows] = await Card.pool.query<mysql.RowDataPacket[]>(dataQuery, queryParams);

    const cards = rows.map(row => ({
      ...row,
      colors: Card.safeJsonParse(row.colors),
      color_identity: Card.safeJsonParse(row.color_identity),
      keywords: Card.safeJsonParse(row.keywords),
      produced_mana: Card.safeJsonParse(row.produced_mana),
      artist_ids: Card.safeJsonParse(row.artist_ids),
      legalities: Card.safeJsonParse(row.legalities),
      games: Card.safeJsonParse(row.games),
      finishes: Card.safeJsonParse(row.finishes),
    })) as CardDoc[];

    // Fetch card faces for multi-faced cards
    const cardIds = cards.filter(card => card.has_multiple_faces).map(card => card.id);
    if (cardIds.length > 0) {
      const placeholders = cardIds.map(() => '?').join(', ');
      const [faceRows] = await Card.pool.query<mysql.RowDataPacket[]>(
        `SELECT * FROM card_faces WHERE card_id IN (${placeholders}) ORDER BY card_id, face_order`,
        cardIds
      );

      // Group faces by card_id
      const facesByCardId: { [key: string]: any[] } = {};
      faceRows.forEach(face => {
        if (!facesByCardId[face.card_id]) {
          facesByCardId[face.card_id] = [];
        }
        facesByCardId[face.card_id]!.push({
          ...face,
          colors: Card.safeJsonParse(face.colors),
          color_indicator: Card.safeJsonParse(face.color_indicator),
        });
      });

      // Add faces to cards
      cards.forEach(card => {
        if (card.has_multiple_faces && facesByCardId[card.id]) {
          card.card_faces = facesByCardId[card.id]!;
        }
      });
    }

    return { cards, total };
  }
}