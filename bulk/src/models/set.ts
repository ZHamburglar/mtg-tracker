import mysql from 'mysql2/promise';

import { logger } from '../logger';

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

export interface SetCreationResult {
  successful: boolean;
  setsCreated: number;
  setsUpdated: number;
}

export class Set {
  private static pool: mysql.Pool;

  static setPool(pool: mysql.Pool) {
    Set.pool = pool;
  }

  static transformScryfallSet(scryfallSet: any): SetAttrs {
    const transformed: SetAttrs = {
      id: scryfallSet.id,
      code: scryfallSet.code,
      name: scryfallSet.name,
    };

    // Add optional fields
    if (scryfallSet.mtgo_code) transformed.mtgo_code = scryfallSet.mtgo_code;
    if (scryfallSet.arena_code) transformed.arena_code = scryfallSet.arena_code;
    if (scryfallSet.tcgplayer_id) transformed.tcgplayer_id = scryfallSet.tcgplayer_id;
    if (scryfallSet.uri) transformed.uri = scryfallSet.uri;
    if (scryfallSet.scryfall_uri) transformed.scryfall_uri = scryfallSet.scryfall_uri;
    if (scryfallSet.search_uri) transformed.search_uri = scryfallSet.search_uri;
    if (scryfallSet.released_at) transformed.released_at = new Date(scryfallSet.released_at);
    if (scryfallSet.set_type) transformed.set_type = scryfallSet.set_type;
    if (scryfallSet.card_count !== undefined) transformed.card_count = scryfallSet.card_count;
    if (scryfallSet.digital !== undefined) transformed.digital = scryfallSet.digital;
    if (scryfallSet.nonfoil_only !== undefined) transformed.nonfoil_only = scryfallSet.nonfoil_only;
    if (scryfallSet.foil_only !== undefined) transformed.foil_only = scryfallSet.foil_only;
    if (scryfallSet.icon_svg_uri) transformed.icon_svg_uri = scryfallSet.icon_svg_uri;
    if (scryfallSet.parent_set_code) transformed.parent_set_code = scryfallSet.parent_set_code;

    return transformed;
  }

  static async bulkCreate(sets: any[], batchSize: number = 1000): Promise<SetCreationResult> {
    if (!Set.pool) {
      throw new Error('Database pool not initialized. Call Set.setPool() first.');
    }

    const transformedSets = sets.map(set => Set.transformScryfallSet(set));
    let totalCreated = 0;
    let totalUpdated = 0;

    // Process in batches
    for (let i = 0; i < transformedSets.length; i += batchSize) {
      const batch = transformedSets.slice(i, i + batchSize);
      logger.log(`Processing set batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedSets.length / batchSize)} (${batch.length} sets)...`);

      // Build bulk insert query for this batch
      const values: any[] = [];
      const placeholders = batch.map(set => {
        values.push(
          set.id,
          set.code,
          set.mtgo_code,
          set.arena_code,
          set.tcgplayer_id,
          set.name,
          set.uri,
          set.scryfall_uri,
          set.search_uri,
          set.released_at,
          set.set_type,
          set.card_count,
          set.digital,
          set.nonfoil_only,
          set.foil_only,
          set.icon_svg_uri,
          set.parent_set_code
        );
        return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      }).join(',');

      const query = `
        INSERT INTO sets (
          id, code, mtgo_code, arena_code, tcgplayer_id, name, uri, scryfall_uri, 
          search_uri, released_at, set_type, card_count, digital, nonfoil_only, 
          foil_only, icon_svg_uri, parent_set_code
        ) VALUES ${placeholders}
        ON DUPLICATE KEY UPDATE
          code = VALUES(code),
          mtgo_code = VALUES(mtgo_code),
          arena_code = VALUES(arena_code),
          tcgplayer_id = VALUES(tcgplayer_id),
          name = VALUES(name),
          uri = VALUES(uri),
          scryfall_uri = VALUES(scryfall_uri),
          search_uri = VALUES(search_uri),
          released_at = VALUES(released_at),
          set_type = VALUES(set_type),
          card_count = VALUES(card_count),
          digital = VALUES(digital),
          nonfoil_only = VALUES(nonfoil_only),
          foil_only = VALUES(foil_only),
          icon_svg_uri = VALUES(icon_svg_uri),
          parent_set_code = VALUES(parent_set_code)
      `;

      try {
        const [result] = await Set.pool.query<mysql.ResultSetHeader>(query, values);
        const batchLength = batch.length;
        const actualUpdates = result.changedRows || 0;
        const inserts = result.affectedRows - (actualUpdates * 2);
        const noChanges = batchLength - inserts - actualUpdates;

        totalCreated += inserts;
        totalUpdated += actualUpdates;

        if (noChanges > 0) {
          logger.log(`  - ${noChanges} sets already up-to-date (no changes needed)`);
        }
      } catch (error) {
        logger.error(`Error bulk creating set batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }
    }

    return {
      successful: true,
      setsCreated: totalCreated,
      setsUpdated: totalUpdated
    };
  }

  static async create(attrs: SetAttrs): Promise<void> {
    if (!Set.pool) {
      throw new Error('Database pool not initialized. Call Set.setPool() first.');
    }

    const query = `
      INSERT INTO sets (
        id, code, mtgo_code, arena_code, tcgplayer_id, name, uri, scryfall_uri, 
        search_uri, released_at, set_type, card_count, digital, nonfoil_only, 
        foil_only, icon_svg_uri, parent_set_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      attrs.id,
      attrs.code,
      attrs.mtgo_code,
      attrs.arena_code,
      attrs.tcgplayer_id,
      attrs.name,
      attrs.uri,
      attrs.scryfall_uri,
      attrs.search_uri,
      attrs.released_at,
      attrs.set_type,
      attrs.card_count,
      attrs.digital,
      attrs.nonfoil_only,
      attrs.foil_only,
      attrs.icon_svg_uri,
      attrs.parent_set_code
    ];

    await Set.pool.query(query, values);
  }

  static async getTotal(): Promise<number> {
    if (!Set.pool) {
      throw new Error('Database pool not initialized. Call Set.setPool() first.');
    }

    const query = 'SELECT COUNT(*) as total FROM sets';
    const [rows] = await Set.pool.query<mysql.RowDataPacket[]>(query);
    return rows[0]?.total || 0;
  }
}