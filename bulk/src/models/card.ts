import mysql from 'mysql2/promise';

export interface CardAttrs {
  id: string;                          // Scryfall card ID (UUID)
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
  edhrec_rank?: string;
  border_color?: string;
  image_uri_png?: string;
  gatherer_uri?: string;
  edhrec_uri?: string;
  tcgplayer_uri?: string;
  cardmarket_uri?: string;
  cardhoard_uri?: string;
  legalities?: Record<string, string>;
  games?: string[];
  finishes?: string[];
  reserved?: boolean;
  oversized?: boolean;
  game_changer?: boolean;
  foil?: boolean;
  nonfoil?: boolean;
  digital?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface CardCreationResult {
  successful: boolean;
  cardsCreated: number;
}

export interface CardDoc {

}

export class Card {
  private static pool: mysql.Pool;

  static setPool(pool: mysql.Pool) {
    Card.pool = pool;
  }

  static transformScryfallCard(scryfallCard: any): any {
    const transformed: any = {
      id: scryfallCard.id,
      name: scryfallCard.name,
    };

    // Only add optional fields if they have actual values
    if (scryfallCard.oracle_id) transformed.oracle_id = scryfallCard.oracle_id;
    if (scryfallCard.lang) transformed.lang = scryfallCard.lang;
    if (scryfallCard.released_at) transformed.released_at = new Date(scryfallCard.released_at);
    if (scryfallCard.layout) transformed.layout = scryfallCard.layout;
    if (scryfallCard.mana_cost) transformed.mana_cost = scryfallCard.mana_cost;
    // Cap CMC at reasonable value to avoid DECIMAL overflow (DECIMAL(10,2) max is 99999999.99)
    if (scryfallCard.cmc !== undefined) {
      const cmc = typeof scryfallCard.cmc === 'number' ? scryfallCard.cmc : parseFloat(scryfallCard.cmc);
      transformed.cmc = Math.min(cmc, 99999999);
    }
    if (scryfallCard.type_line) transformed.type_line = scryfallCard.type_line;
    if (scryfallCard.oracle_text) transformed.oracle_text = scryfallCard.oracle_text;
    if (scryfallCard.power) transformed.power = scryfallCard.power;
    if (scryfallCard.toughness) transformed.toughness = scryfallCard.toughness;
    if (scryfallCard.colors) transformed.colors = scryfallCard.colors;
    if (scryfallCard.color_identity) transformed.color_identity = scryfallCard.color_identity;
    if (scryfallCard.keywords) transformed.keywords = scryfallCard.keywords;
    if (scryfallCard.produced_mana) transformed.produced_mana = scryfallCard.produced_mana;
    if (scryfallCard.rarity) transformed.rarity = scryfallCard.rarity;
    if (scryfallCard.set_id) transformed.set_id = scryfallCard.set_id;
    if (scryfallCard.set) transformed.set_code = scryfallCard.set;
    if (scryfallCard.set_name) transformed.set_name = scryfallCard.set_name;
    if (scryfallCard.collector_number) transformed.collector_number = scryfallCard.collector_number;
    if (scryfallCard.artist) transformed.artist = scryfallCard.artist;
    if (scryfallCard.artist_ids) transformed.artist_ids = scryfallCard.artist_ids;
    if (scryfallCard.illustration_id) transformed.illustration_id = scryfallCard.illustration_id;
    if (scryfallCard.flavor_text) transformed.flavor_text = scryfallCard.flavor_text;
    if (scryfallCard.full_art !== undefined) transformed.full_art = scryfallCard.full_art;
    if (scryfallCard.textless !== undefined) transformed.textless = scryfallCard.textless;
    if (scryfallCard.promo !== undefined) transformed.promo = scryfallCard.promo;
    if (scryfallCard.reprint !== undefined) transformed.reprint = scryfallCard.reprint;
    if (scryfallCard.frame) transformed.frame = scryfallCard.frame;
    if (scryfallCard.edhrec_rank) transformed.edhrec_rank = scryfallCard.edhrec_rank.toString();
    if (scryfallCard.border_color) transformed.border_color = scryfallCard.border_color;
    if (scryfallCard.image_uris?.png) transformed.image_uri_png = scryfallCard.image_uris.png;
    if (scryfallCard.related_uris?.gatherer) transformed.gatherer_uri = scryfallCard.related_uris.gatherer;
    if (scryfallCard.related_uris?.edhrec) transformed.edhrec_uri = scryfallCard.related_uris.edhrec;
    if (scryfallCard.purchase_uris?.tcgplayer) transformed.tcgplayer_uri = scryfallCard.purchase_uris.tcgplayer;
    if (scryfallCard.purchase_uris?.cardmarket) transformed.cardmarket_uri = scryfallCard.purchase_uris.cardmarket;
    if (scryfallCard.purchase_uris?.cardhoarder) transformed.cardhoard_uri = scryfallCard.purchase_uris.cardhoarder;
    if (scryfallCard.legalities) transformed.legalities = scryfallCard.legalities;
    if (scryfallCard.games) transformed.games = scryfallCard.games;
    if (scryfallCard.finishes) transformed.finishes = scryfallCard.finishes;
    if (scryfallCard.reserved !== undefined) transformed.reserved = scryfallCard.reserved;
    if (scryfallCard.oversized !== undefined) transformed.oversized = scryfallCard.oversized;
    if (scryfallCard.game_changer !== undefined) transformed.game_changer = scryfallCard.game_changer;
    if (scryfallCard.foil !== undefined) transformed.foil = scryfallCard.foil;
    if (scryfallCard.nonfoil !== undefined) transformed.nonfoil = scryfallCard.nonfoil;
    if (scryfallCard.digital !== undefined) transformed.digital = scryfallCard.digital;

    return transformed;
  }

  static async bulkCreate(cards: any[], batchSize: number = 1000): Promise<CardCreationResult> {
    if (!Card.pool) {
      throw new Error('Database pool not initialized. Call Card.setPool() first.');
    }

    const transformedCards = cards.map(card => Card.transformScryfallCard(card));
    let totalCreated = 0;
    
    // Process in batches to avoid max_allowed_packet error
    for (let i = 0; i < transformedCards.length; i += batchSize) {
      const batch = transformedCards.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedCards.length / batchSize)} (${batch.length} cards)...`);
      
      // Build bulk insert query for this batch
      const values: any[] = [];
      const placeholders = batch.map(card => {
      values.push(
        card.id,
        card.oracle_id,
        card.name,
        card.lang,
        card.released_at,
        card.layout,
        card.mana_cost,
        card.cmc,
        card.type_line,
        card.oracle_text,
        card.power,
        card.toughness,
        card.colors ? JSON.stringify(card.colors) : null,
        card.color_identity ? JSON.stringify(card.color_identity) : null,
        card.keywords ? JSON.stringify(card.keywords) : null,
        card.produced_mana ? JSON.stringify(card.produced_mana) : null,
        card.rarity,
        card.set_id,
        card.set_code,
        card.set_name,
        card.collector_number,
        card.artist,
        card.artist_ids ? JSON.stringify(card.artist_ids) : null,
        card.illustration_id,
        card.flavor_text,
        card.full_art,
        card.textless,
        card.promo,
        card.reprint,
        card.frame,
        card.edhrec_rank,
        card.border_color,
        card.image_uri_png,
        card.gatherer_uri,
        card.edhrec_uri,
        card.tcgplayer_uri,
        card.cardmarket_uri,
        card.cardhoard_uri,
        card.legalities ? JSON.stringify(card.legalities) : null,
        card.games ? JSON.stringify(card.games) : null,
        card.finishes ? JSON.stringify(card.finishes) : null,
        card.reserved,
        card.oversized,
        card.game_changer,
        card.foil,
        card.nonfoil,
        card.digital
      );
      return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    }).join(',');

    const query = `
      INSERT INTO cards (
        id, oracle_id, name, lang, released_at, layout, mana_cost, cmc, type_line, oracle_text,
        power, toughness, colors, color_identity, keywords, produced_mana, rarity, set_id,
        set_code, set_name, collector_number, artist, artist_ids, illustration_id, flavor_text,
        full_art, textless, promo, reprint, frame, edhrec_rank, border_color, image_uri_png,
        gatherer_uri, edhrec_uri, tcgplayer_uri, cardmarket_uri, cardhoard_uri, legalities,
        games, finishes, reserved, oversized, game_changer, foil, nonfoil, digital
      ) VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        oracle_id = VALUES(oracle_id),
        name = VALUES(name),
        lang = VALUES(lang),
        released_at = VALUES(released_at),
        layout = VALUES(layout),
        mana_cost = VALUES(mana_cost),
        cmc = VALUES(cmc),
        type_line = VALUES(type_line),
        oracle_text = VALUES(oracle_text),
        power = VALUES(power),
        toughness = VALUES(toughness),
        colors = VALUES(colors),
        color_identity = VALUES(color_identity),
        keywords = VALUES(keywords),
        produced_mana = VALUES(produced_mana),
        rarity = VALUES(rarity),
        set_id = VALUES(set_id),
        set_code = VALUES(set_code),
        set_name = VALUES(set_name),
        collector_number = VALUES(collector_number),
        artist = VALUES(artist),
        artist_ids = VALUES(artist_ids),
        illustration_id = VALUES(illustration_id),
        flavor_text = VALUES(flavor_text),
        full_art = VALUES(full_art),
        textless = VALUES(textless),
        promo = VALUES(promo),
        reprint = VALUES(reprint),
        frame = VALUES(frame),
        edhrec_rank = VALUES(edhrec_rank),
        border_color = VALUES(border_color),
        image_uri_png = VALUES(image_uri_png),
        gatherer_uri = VALUES(gatherer_uri),
        edhrec_uri = VALUES(edhrec_uri),
        tcgplayer_uri = VALUES(tcgplayer_uri),
        cardmarket_uri = VALUES(cardmarket_uri),
        cardhoard_uri = VALUES(cardhoard_uri),
        legalities = VALUES(legalities),
        games = VALUES(games),
        finishes = VALUES(finishes),
        reserved = VALUES(reserved),
        oversized = VALUES(oversized),
        game_changer = VALUES(game_changer),
        foil = VALUES(foil),
        nonfoil = VALUES(nonfoil),
        digital = VALUES(digital)
    `;

      try {
        await Card.pool.query(query, values);
        totalCreated += batch.length;
      } catch (error) {
        console.error(`Error bulk creating batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }
    }

    return {
      successful: true,
      cardsCreated: totalCreated
    };
  }

  static async create(attrs: CardAttrs): Promise<CardDoc> {
    // Implementation for creating a single card in the database
    if (!Card.pool) {
      throw new Error('Database pool not initialized. Call Card.setPool() first.');
    }

    const query = `
      INSERT INTO cards (
        id, oracle_id, name, lang, released_at, layout, mana_cost, cmc, type_line, oracle_text,
        power, toughness, colors, color_identity, keywords, produced_mana, rarity, set_id,
        set_code, set_name, collector_number, artist, artist_ids, illustration_id, flavor_text,
        full_art, textless, promo, reprint, frame, edhrec_rank, border_color, image_uri_png,
        gatherer_uri, edhrec_uri, tcgplayer_uri, cardmarket_uri, cardhoard_uri, legalities,
        games, finishes, reserved, oversized, game_changer, foil, nonfoil, digital
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      attrs.id,
      attrs.oracle_id,
      attrs.name,
      attrs.lang,
      attrs.released_at,
      attrs.layout,
      attrs.mana_cost,
      attrs.cmc,
      attrs.type_line,
      attrs.oracle_text,
      attrs.power,
      attrs.toughness,
      attrs.colors ? JSON.stringify(attrs.colors) : null,
      attrs.color_identity ? JSON.stringify(attrs.color_identity) : null,
      attrs.keywords ? JSON.stringify(attrs.keywords) : null,
      attrs.produced_mana ? JSON.stringify(attrs.produced_mana) : null,
      attrs.rarity,
      attrs.set_id,
      attrs.set_code,
      attrs.set_name,
      attrs.collector_number,
      attrs.artist,
      attrs.artist_ids ? JSON.stringify(attrs.artist_ids) : null,
      attrs.illustration_id,
      attrs.flavor_text,
      attrs.full_art,
      attrs.textless,
      attrs.promo,
      attrs.reprint,
      attrs.frame,
      attrs.edhrec_rank,
      attrs.border_color,
      attrs.image_uri_png,
      attrs.gatherer_uri,
      attrs.edhrec_uri,
      attrs.tcgplayer_uri,
      attrs.cardmarket_uri,
      attrs.cardhoard_uri,
      attrs.legalities ? JSON.stringify(attrs.legalities) : null,
      attrs.games ? JSON.stringify(attrs.games) : null,
      attrs.finishes ? JSON.stringify(attrs.finishes) : null,
      attrs.reserved,
      attrs.oversized,
      attrs.game_changer,
      attrs.foil,
      attrs.nonfoil,
      attrs.digital
    ];

    await Card.pool.query(query, values);
    return {} as CardDoc;
  }
}