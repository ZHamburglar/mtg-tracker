import express, { Request, Response } from 'express';
import { Card } from '../models/card';
import { CardPrice } from '../models/cardprice';

const router = express.Router();

router.get('/api/search/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        error: 'Card ID is required'
      });
    }

    const card = await Card.findById(id);
    
    if (!card) {
      return res.status(404).json({
        error: 'Card not found',
        id
      });
    }

    res.status(200).json({
      card,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error searching for card:', error);
    res.status(500).json({
      error: 'Failed to search for card',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search/:id/prices/latest', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        error: 'Card ID is required'
      });
    }

    const card = await Card.findById(id);
    
    if (!card) {
      return res.status(404).json({
        error: 'Card not found',
        id
      });
    }

    const latestPrice = await CardPrice.getLatestByCardId(id);

    if (!latestPrice) {
      return res.status(404).json({
        error: 'No price data found for this card',
        id
      });
    }

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
    console.error('Error fetching latest card price:', error);
    res.status(500).json({
      error: 'Failed to fetch latest card price',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search/:id/prices', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;
    
    if (!id) {
      return res.status(400).json({
        error: 'Card ID is required'
      });
    }

    // Validate pagination parameters
    if (limit > 1000) {
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
    console.error('Error fetching card prices:', error);
    res.status(500).json({
      error: 'Failed to fetch card prices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/search', async (req: Request, res: Response) => {
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
      set_id,
      set_code,
      set_name,
      legality_format,
      legality_status,
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

    if (type_line) searchParams.type_line = type_line as string;
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

    if (rarity) searchParams.rarity = rarity as string;
    if (set_id) searchParams.set_id = set_id as string;
    if (set_code) searchParams.set_code = set_code as string;
    if (set_name) searchParams.set_name = set_name as string;

    // Parse legalities (format and status must both be provided)
    if (legality_format && legality_status) {
      searchParams.legalities = {
        format: legality_format as string,
        status: legality_status as string
      };
    }

    // Perform search
    const { cards, total } = await Card.search(searchParams);

    const totalPages = Math.ceil(total / parsedLimit);

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
    console.error('Error searching for cards:', error);
    res.status(500).json({
      error: 'Failed to search for cards',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as searchRouter };