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

  static async search(params: {
    name?: string;
    released_at?: string;
    mana_cost?: string;
    cmc?: number;
    cmc_min?: number;
    cmc_max?: number;
    type_line?: string;
    oracle_text?: string;
    power?: string;
    toughness?: string;
    colors?: string[];
    color_identity?: string[];
    keywords?: string[];
    rarity?: string;
    set_id?: string;
    set_code?: string;
    set_name?: string;
    legalities?: { format: string; status: string };
    unique_prints?: boolean; // If true, returns all prints; if false (default), groups by oracle_id
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

    // Fuzzy search for type_line
    if (params.type_line) {
      whereClauses.push('type_line LIKE ?');
      queryParams.push(`%${params.type_line}%`);
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

    // Exact search for rarity
    if (params.rarity) {
      whereClauses.push('rarity = ?');
      queryParams.push(params.rarity);
    }

    // Exact search for set_id
    if (params.set_id) {
      whereClauses.push('set_id = ?');
      queryParams.push(params.set_id);
    }

    // Exact search for set_code
    if (params.set_code) {
      whereClauses.push('set_code = ?');
      queryParams.push(params.set_code);
    }

    // Fuzzy search for set_name
    if (params.set_name) {
      whereClauses.push('set_name LIKE ?');
      queryParams.push(`%${params.set_name}%`);
    }

    // JSON object search for legalities
    if (params.legalities) {
      whereClauses.push('JSON_EXTRACT(legalities, ?) = ?');
      queryParams.push(`$.${params.legalities.format}`);
      queryParams.push(params.legalities.status);
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
          .replace(/^type_line /i, 'c1.type_line ')
          .replace(/^oracle_text /i, 'c1.oracle_text ')
          .replace(/^power /i, 'c1.power ')
          .replace(/^toughness /i, 'c1.toughness ')
          .replace(/^rarity /i, 'c1.rarity ')
          .replace(/^set_id /i, 'c1.set_id ')
          .replace(/^set_code /i, 'c1.set_code ')
          .replace(/^set_name /i, 'c1.set_name ')
          .replace(/JSON_CONTAINS\(colors/g, 'JSON_CONTAINS(c1.colors')
          .replace(/JSON_CONTAINS\(color_identity/g, 'JSON_CONTAINS(c1.color_identity')
          .replace(/JSON_CONTAINS\(keywords/g, 'JSON_CONTAINS(c1.keywords')
          .replace(/JSON_EXTRACT\(legalities/g, 'JSON_EXTRACT(c1.legalities');
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

    return { cards, total };
  }
}