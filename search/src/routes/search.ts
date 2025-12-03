import express, { Request, Response } from 'express';
import { Card } from '../models/card';
import { CardPrice } from '../models/cardprice';
import { Set } from '../models/set';
import { logger } from '../logger';

const router = express.Router();

// Cache for artists endpoint
let artistsCache: { data: string[]; timestamp: number } | null = null;
const ARTISTS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Cache for keywords endpoint
let keywordsCache: { data: string[]; timestamp: number } | null = null;
const KEYWORDS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

router.get('/api/search/sets', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  logger.log('GET /api/search/sets - Request started', {
    timestamp: new Date().toISOString()
  });

  try {
    const sets = await Set.getAllSets();

    logger.log('GET /api/search/sets - Success', {
      totalSets: sets.length,
      duration: Date.now() - startTime
    });

    res.status(200).json({
      sets,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('GET /api/search/sets - Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    });
    res.status(500).json({
      error: 'Failed to fetch sets',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search/artists', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  logger.log('GET /api/search/artists - Request started', {
    timestamp: new Date().toISOString(),
    cacheHit: artistsCache !== null && (Date.now() - artistsCache.timestamp) < ARTISTS_CACHE_TTL
  });

  try {
    let artists: string[];

    // Check if cache exists and is still valid
    if (artistsCache && (Date.now() - artistsCache.timestamp) < ARTISTS_CACHE_TTL) {
      artists = artistsCache.data;
      logger.log('GET /api/search/artists - Cache hit', {
        totalArtists: artists.length,
        cacheAge: Date.now() - artistsCache.timestamp,
        duration: Date.now() - startTime
      });
    } else {
      // Fetch from database if cache is invalid or doesn't exist
      artists = await Card.getAllArtists();
      
      // Update cache
      artistsCache = {
        data: artists,
        timestamp: Date.now()
      };

      logger.log('GET /api/search/artists - Cache miss, fetched from DB', {
        totalArtists: artists.length,
        duration: Date.now() - startTime
      });
    }

    res.status(200).json({
      artists,
      timestamp: new Date().toISOString(),
      cached: artistsCache !== null && (Date.now() - artistsCache.timestamp) < ARTISTS_CACHE_TTL
    });
  } catch (error) {
    logger.error('GET /api/search/artists - Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    });
    res.status(500).json({
      error: 'Failed to fetch artists',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search/keywords', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  logger.log('GET /api/search/keywords - Request started', {
    timestamp: new Date().toISOString(),
    cacheHit: keywordsCache !== null && (Date.now() - keywordsCache.timestamp) < KEYWORDS_CACHE_TTL
  });

  try {
    let keywords: string[];

    // Check if cache exists and is still valid
    if (keywordsCache && (Date.now() - keywordsCache.timestamp) < KEYWORDS_CACHE_TTL) {
      keywords = keywordsCache.data;
      logger.log('GET /api/search/keywords - Cache hit', {
        totalKeywords: keywords.length,
        cacheAge: Date.now() - keywordsCache.timestamp,
        duration: Date.now() - startTime
      });
    } else {
      // Fetch from Scryfall API if cache is invalid or doesn't exist
      const [abilitiesResponse, actionsResponse] = await Promise.all([
        fetch('https://api.scryfall.com/catalog/keyword-abilities'),
        fetch('https://api.scryfall.com/catalog/keyword-actions')
      ]);

      if (!abilitiesResponse.ok || !actionsResponse.ok) {
        throw new Error('Failed to fetch keywords from Scryfall API');
      }

      const abilitiesData = await abilitiesResponse.json();
      const actionsData = await actionsResponse.json();

      // Merge keywords from both endpoints
      const mergedKeywords: string[] = [...abilitiesData.data, ...actionsData.data];
      
      // Deduplicate and sort alphabetically
      const seen = new Map<string, boolean>();
      const uniqueKeywords: string[] = [];
      for (const keyword of mergedKeywords) {
        if (!seen.has(keyword)) {
          seen.set(keyword, true);
          uniqueKeywords.push(keyword);
        }
      }
      keywords = uniqueKeywords.sort((a, b) => a.localeCompare(b));
      
      // Update cache
      keywordsCache = {
        data: keywords,
        timestamp: Date.now()
      };

      logger.log('GET /api/search/keywords - Cache miss, fetched from Scryfall', {
        totalKeywords: keywords.length,
        duration: Date.now() - startTime
      });
    }

    res.status(200).json({
      keywords,
      timestamp: new Date().toISOString(),
      cached: keywordsCache !== null && (Date.now() - keywordsCache.timestamp) < KEYWORDS_CACHE_TTL
    });
  } catch (error) {
    logger.error('GET /api/search/keywords - Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    });
    res.status(500).json({
      error: 'Failed to fetch keywords',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search/:id', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { id } = req.params;
  
  logger.log('GET /api/search/:id - Request started', {
    cardId: id,
    timestamp: new Date().toISOString()
  });

  try {
    if (!id) {
      logger.log('GET /api/search/:id - Bad request: Missing card ID');
      return res.status(400).json({
        error: 'Card ID is required'
      });
    }

    const card = await Card.findById(id);
    
    if (!card) {
      logger.log('GET /api/search/:id - Card not found', {
        cardId: id,
        duration: Date.now() - startTime
      });
      return res.status(404).json({
        error: 'Card not found',
        id
      });
    }

    logger.log('GET /api/search/:id - Success', {
      cardId: id,
      cardName: card.name,
      duration: Date.now() - startTime
    });

    res.status(200).json({
      card,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('GET /api/search/:id - Error', {
      cardId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    });
    res.status(500).json({
      error: 'Failed to search for card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search/:id/prints', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { id } = req.params;
  
  logger.log('GET /api/search/:id/prints - Request started', {
    cardId: id,
    timestamp: new Date().toISOString()
  });

  try {
    if (!id) {
      logger.log('GET /api/search/:id/prints - Bad request: Missing card ID');
      return res.status(400).json({
        error: 'Card ID is required'
      });
    }

    // First get the card to find its oracle_id
    const card = await Card.findById(id);
    
    if (!card) {
      logger.log('GET /api/search/:id/prints - Card not found', {
        cardId: id,
        duration: Date.now() - startTime
      });
      return res.status(404).json({
        error: 'Card not found',
        id
      });
    }

    if (!card.oracle_id) {
      logger.log('GET /api/search/:id/prints - No oracle_id', {
        cardId: id,
        cardName: card.name,
        duration: Date.now() - startTime
      });
      return res.status(200).json({
        cards: [card],
        count: 1,
        timestamp: new Date().toISOString()
      });
    }

    // Get all cards with the same oracle_id
    const prints = await Card.findByOracleId(card.oracle_id);

    logger.log('GET /api/search/:id/prints - Success', {
      cardId: id,
      oracleId: card.oracle_id,
      printsCount: prints.length,
      duration: Date.now() - startTime
    });

    res.status(200).json({
      cards: prints,
      count: prints.length,
      oracle_id: card.oracle_id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('GET /api/search/:id/prints - Error', {
      cardId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    });
    res.status(500).json({
      error: 'Failed to fetch card prints',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search/:id/prices/latest', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { id } = req.params;
  
  logger.log('GET /api/search/:id/prices/latest - Request started', {
    cardId: id,
    timestamp: new Date().toISOString()
  });

  try {
    if (!id) {
      logger.log('GET /api/search/:id/prices/latest - Bad request: Missing card ID');
      return res.status(400).json({
        error: 'Card ID is required'
      });
    }

    const card = await Card.findById(id);
    
    if (!card) {
      logger.log('GET /api/search/:id/prices/latest - Card not found', {
        cardId: id,
        duration: Date.now() - startTime
      });
      return res.status(404).json({
        error: 'Card not found',
        id
      });
    }

    const latestPrice = await CardPrice.getLatestByCardId(id);

    if (!latestPrice) {
      logger.log('GET /api/search/:id/prices/latest - No price data', {
        cardId: id,
        cardName: card.name,
        duration: Date.now() - startTime
      });
      return res.status(404).json({
        error: 'No price data found for this card',
        id
      });
    }

    logger.log('GET /api/search/:id/prices/latest - Success', {
      cardId: id,
      cardName: card.name,
      priceUsd: latestPrice.price_usd,
      duration: Date.now() - startTime
    });

    res.status(200).json({
      card: {
        id: card.id,
        name: card.name,
        set_code: card.set_code,
        set_name: card.set_name
      },
      price: latestPrice,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('GET /api/search/:id/prices/latest - Error', {
      cardId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    });
    res.status(500).json({
      error: 'Failed to fetch latest card price',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search/:id/prices', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { id } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;
  const page = parseInt(req.query.page as string) || 1;
  const offset = (page - 1) * limit;
  
  logger.log('GET /api/search/:id/prices - Request started', {
    cardId: id,
    limit,
    page,
    timestamp: new Date().toISOString()
  });

  try {
    if (!id) {
      logger.log('GET /api/search/:id/prices - Bad request: Missing card ID');
      return res.status(400).json({
        error: 'Card ID is required'
      });
    }

    // Validate pagination parameters
    if (limit > 1000) {
      logger.log('GET /api/search/:id/prices - Bad request: Limit exceeds max', {
        cardId: id,
        limit
      });
      return res.status(400).json({
        error: 'Limit cannot exceed 1000'
      });
    }

    // First verify the card exists
    const card = await Card.findById(id);
    
    if (!card) {
      return res.status(404).json({
        error: 'Card not found',
        id
      });
    }

    // Get paginated price history and total count
    const [prices, total] = await Promise.all([
      CardPrice.findByCardId(id, limit, offset),
      CardPrice.countByCardId(id)
    ]);

    const totalPages = Math.ceil(total / limit);

    logger.log('GET /api/search/:id/prices - Success', {
      cardId: id,
      cardName: card.name,
      totalRecords: total,
      page,
      limit,
      recordsReturned: prices.length,
      duration: Date.now() - startTime
    });

    res.status(200).json({
      card: {
        id: card.id,
        name: card.name,
        set_code: card.set_code,
        set_name: card.set_name
      },
      priceHistory: prices,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: total,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('GET /api/search/:id/prices - Error', {
      cardId: id,
      limit,
      page,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    });
    res.status(500).json({
      error: 'Failed to fetch card prices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  logger.log('GET /api/search - Request started', {
    queryParams: Object.keys(req.query).length,
    timestamp: new Date().toISOString()
  });

  try {
    // Extract and parse query parameters
    const {
      name,
      released_at,
      mana_cost,
      cmc,
      cmc_min,
      cmc_max,
      type_line,
      oracle_text,
      power,
      toughness,
      colors,
      color_identity,
      keywords,
      rarity,
      artist,
      set_id,
      set_code,
      set_name,
      legality_format,
      unique_prints,
      include_all_types,
      limit,
      page
    } = req.query;

    // Parse pagination
    const parsedLimit = limit ? parseInt(limit as string) : 100;
    const parsedPage = page ? parseInt(page as string) : 1;
    const offset = (parsedPage - 1) * parsedLimit;

    // Validate limit
    if (parsedLimit > 1000) {
      return res.status(400).json({
        error: 'Limit cannot exceed 1000'
      });
    }

    // Build search parameters
    const searchParams: any = {
      limit: parsedLimit,
      offset
    };

    if (name) searchParams.name = name as string;
    if (released_at) searchParams.released_at = released_at as string;
    if (mana_cost) searchParams.mana_cost = mana_cost as string;
    
    // CMC can be exact or range
    if (cmc) {
      searchParams.cmc = parseFloat(cmc as string);
    } else {
      if (cmc_min) searchParams.cmc_min = parseFloat(cmc_min as string);
      if (cmc_max) searchParams.cmc_max = parseFloat(cmc_max as string);
    }

    if (type_line) {
      searchParams.type_line = Array.isArray(type_line)
        ? type_line
        : (type_line as string).split(',').map(t => t.trim());
    }
    if (oracle_text) searchParams.oracle_text = oracle_text as string;
    if (power) searchParams.power = power as string;
    if (toughness) searchParams.toughness = toughness as string;

    // Parse array parameters (can be comma-separated or multiple query params)
    if (colors) {
      searchParams.colors = Array.isArray(colors) 
        ? colors 
        : (colors as string).split(',').map(c => c.trim());
    }

    if (color_identity) {
      searchParams.color_identity = Array.isArray(color_identity)
        ? color_identity
        : (color_identity as string).split(',').map(c => c.trim());
    }

    if (keywords) {
      searchParams.keywords = Array.isArray(keywords)
        ? keywords
        : (keywords as string).split(',').map(k => k.trim());
    }

    if (rarity) {
      searchParams.rarity = Array.isArray(rarity)
        ? rarity
        : (rarity as string).split(',').map(r => r.trim());
    }
    if (artist) {
      searchParams.artist = Array.isArray(artist)
        ? artist
        : (artist as string).split(',').map(a => a.trim());
    }
    if (set_id) searchParams.set_id = set_id as string;
    if (set_code) searchParams.set_code = set_code as string;
    if (set_name) {
      searchParams.set_name = Array.isArray(set_name)
        ? set_name
        : (set_name as string).split(',').map(s => s.trim());
    }

    // Parse legality_format - cards must be legal in at least one of the specified formats
    if (legality_format) {
      searchParams.legality_format = Array.isArray(legality_format)
        ? legality_format
        : (legality_format as string).split(',').map(f => f.trim());
    }

    // Parse unique_prints flag (default false - group by oracle_id)
    searchParams.unique_prints = unique_prints === 'true' || unique_prints === '1';

    // Parse include_all_types flag (default false - exclude token and memorabilia sets)
    searchParams.include_all_types = include_all_types === 'true' || include_all_types === '1';

    logger.log('GET /api/search - Executing search', {
      filters: {
        name: name ? true : false,
        type_line: type_line ? true : false,
        oracle_text: oracle_text ? true : false,
        set_code: set_code ? true : false,
        rarity: rarity ? true : false,
        colors: colors ? true : false
      },
      limit: parsedLimit,
      page: parsedPage,
      unique_prints: searchParams.unique_prints
    });

    // Perform search
    const { cards, total } = await Card.search(searchParams);

    const totalPages = Math.ceil(total / parsedLimit);

    logger.log('GET /api/search - Success', {
      totalRecords: total,
      cardsReturned: cards.length,
      page: parsedPage,
      totalPages,
      duration: Date.now() - startTime
    });

    res.status(200).json({
      cards,
      pagination: {
        currentPage: parsedPage,
        pageSize: parsedLimit,
        totalRecords: total,
        totalPages: totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPreviousPage: parsedPage > 1
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('GET /api/search - Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    });
    res.status(500).json({
      error: 'Failed to search for cards',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as searchRouter };