import express, { Request, Response } from 'express';
import axios from 'axios';
import cron from 'node-cron';
import { Card } from '../models/card';
import { CardPrice } from '../models/cardprice';
import { CardFace } from '../models/cardface';
import { Set } from '../models/set';
import { TrendingCard } from '../models/trending-card';
import { checkPriceChangesAndNotify } from '../cron/price-change-notifications';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { Readable } from 'stream';

import { logger } from '../logger';

const router = express.Router();

// Helper function to log memory usage
const logMemoryUsage = (label: string) => {
  const used = process.memoryUsage();
  logger.log(`[Memory ${label}] RSS: ${Math.round(used.rss / 1024 / 1024)}MB, Heap: ${Math.round(used.heapUsed / 1024 / 1024)}/${Math.round(used.heapTotal / 1024 / 1024)}MB`);
};

// Function to fetch default cards using streaming to minimize memory usage
const fetchDefaultCards = async () => {
  try {
    logger.log('Fetching default cards from Scryfall using streaming parser...');
    logMemoryUsage('Start');

    // Get the download URL
    const bulkDataResponse = await axios.get('https://api.scryfall.com/bulk-data/default_cards', {
      timeout: 30000
    });
    const download_uri = bulkDataResponse.data.download_uri;
    logger.log(`Streaming bulk data from: ${download_uri}`);
    
    // Stream the data instead of loading it all into memory
    const response = await axios.get(download_uri, {
      timeout: 300000,
      responseType: 'stream', // Stream the response
      decompress: true
    });

    // Batch processing configuration
    const CARD_BATCH_SIZE = 1000;
    const PRICE_BATCH_SIZE = 5000;
    
    let cardBatch: any[] = [];
    let priceBatch: any[] = [];
    let totalCards = 0;
    let totalPrices = 0;
    let cardsCreated = 0;
    let cardsUpdated = 0;
    let pricesCreated = 0;

    logger.log('Starting stream processing...');
    logMemoryUsage('Before Stream');

    // Create a promise to handle the stream
    await new Promise((resolve, reject) => {
      const pipeline = chain([
        response.data,
        parser(),
        streamArray()
      ]);

      pipeline.on('data', async (data: any) => {
        const card = data.value;
        totalCards++;

        // Add card to batch
        cardBatch.push(card);

        // Process card batch when it reaches the batch size
        if (cardBatch.length >= CARD_BATCH_SIZE) {
          pipeline.pause(); // Pause stream while processing
          
          logger.log(`Processing card batch: ${cardBatch.length} cards (total: ${totalCards})...`);
          const cardResult = await Card.bulkCreate(cardBatch);
          cardsCreated += cardResult.cardsCreated;
          cardsUpdated += cardResult.cardsUpdated;
          
          // Process card_faces for multi-faced cards
          for (const c of cardBatch) {
            if (c.card_faces && Array.isArray(c.card_faces) && c.card_faces.length > 0) {
              // Delete existing faces for this card (if any) before inserting new ones
              await CardFace.deleteByCardId(c.id);
              
              // Insert each face
              for (let faceIndex = 0; faceIndex < c.card_faces.length; faceIndex++) {
                const face = c.card_faces[faceIndex];
                await CardFace.build({
                  card_id: c.id,
                  face_order: faceIndex,
                  name: face.name,
                  mana_cost: face.mana_cost,
                  type_line: face.type_line,
                  oracle_text: face.oracle_text,
                  power: face.power,
                  toughness: face.toughness,
                  colors: face.colors,
                  color_indicator: face.color_indicator,
                  flavor_text: face.flavor_text,
                  artist: face.artist,
                  illustration_id: face.illustration_id,
                  image_uri_small: face.image_uris?.small?.substring(0, 500),
                  image_uri_normal: face.image_uris?.normal?.substring(0, 500),
                  image_uri_large: face.image_uris?.large?.substring(0, 500),
                  image_uri_png: face.image_uris?.png?.substring(0, 500),
                  image_uri_art_crop: face.image_uris?.art_crop?.substring(0, 500),
                  image_uri_border_crop: face.image_uris?.border_crop?.substring(0, 500)
                });
              }
            }
          }
          
          // Extract prices from this card batch
          for (const c of cardBatch) {
            if (c.prices && (c.prices.usd || c.prices.usd_foil || c.prices.usd_etched || c.prices.eur || c.prices.eur_foil || c.prices.tix)) {
              priceBatch.push({
                card_id: c.id,
                usd: c.prices.usd ? parseFloat(c.prices.usd) : 0,
                usd_foil: c.prices.usd_foil ? parseFloat(c.prices.usd_foil) : 0,
                usd_etched: c.prices.usd_etched ? parseFloat(c.prices.usd_etched) : 0,
                eur: c.prices.eur ? parseFloat(c.prices.eur) : 0,
                eur_foil: c.prices.eur_foil ? parseFloat(c.prices.eur_foil) : 0,
                tix: c.prices.tix ? parseFloat(c.prices.tix) : 0,
              });
            }
          }
          
          cardBatch = []; // Clear card batch
          
          // Process price batch if it's large enough
          if (priceBatch.length >= PRICE_BATCH_SIZE) {
            logger.log(`Processing price batch: ${priceBatch.length} prices...`);
            const priceResult = await CardPrice.bulkCreate(priceBatch);
            pricesCreated += priceResult.pricesCreated;
            totalPrices += priceBatch.length;
            priceBatch = []; // Clear price batch
            
            if (totalCards % 5000 === 0) {
              logMemoryUsage(`Processed ${totalCards} cards`);
            }
          }
          
          pipeline.resume(); // Resume stream
        }
      });

      pipeline.on('end', async () => {
        logger.log('Stream ended, processing remaining batches...');
        
        // Process remaining cards
        if (cardBatch.length > 0) {
          logger.log(`Processing final card batch: ${cardBatch.length} cards...`);
          const cardResult = await Card.bulkCreate(cardBatch);
          cardsCreated += cardResult.cardsCreated;
          cardsUpdated += cardResult.cardsUpdated;
          
          // Process card_faces for multi-faced cards
          for (const c of cardBatch) {
            if (c.card_faces && Array.isArray(c.card_faces) && c.card_faces.length > 0) {
              // Delete existing faces for this card (if any) before inserting new ones
              await CardFace.deleteByCardId(c.id);
              
              // Insert each face
              for (let faceIndex = 0; faceIndex < c.card_faces.length; faceIndex++) {
                const face = c.card_faces[faceIndex];
                await CardFace.build({
                  card_id: c.id,
                  face_order: faceIndex,
                  name: face.name,
                  mana_cost: face.mana_cost,
                  type_line: face.type_line,
                  oracle_text: face.oracle_text,
                  power: face.power,
                  toughness: face.toughness,
                  colors: face.colors,
                  color_indicator: face.color_indicator,
                  flavor_text: face.flavor_text,
                  artist: face.artist,
                  illustration_id: face.illustration_id,
                  image_uri_small: face.image_uris?.small?.substring(0, 500),
                  image_uri_normal: face.image_uris?.normal?.substring(0, 500),
                  image_uri_large: face.image_uris?.large?.substring(0, 500),
                  image_uri_png: face.image_uris?.png?.substring(0, 500),
                  image_uri_art_crop: face.image_uris?.art_crop?.substring(0, 500),
                  image_uri_border_crop: face.image_uris?.border_crop?.substring(0, 500)
                });
              }
            }
          }
          
          // Extract prices from final card batch
          for (const c of cardBatch) {
            if (c.prices && (c.prices.usd || c.prices.usd_foil || c.prices.usd_etched || c.prices.eur || c.prices.eur_foil || c.prices.tix)) {
              priceBatch.push({
                card_id: c.id,
                usd: c.prices.usd ? parseFloat(c.prices.usd) : 0,
                usd_foil: c.prices.usd_foil ? parseFloat(c.prices.usd_foil) : 0,
                usd_etched: c.prices.usd_etched ? parseFloat(c.prices.usd_etched) : 0,
                eur: c.prices.eur ? parseFloat(c.prices.eur) : 0,
                eur_foil: c.prices.eur_foil ? parseFloat(c.prices.eur_foil) : 0,
                tix: c.prices.tix ? parseFloat(c.prices.tix) : 0,
              });
            }
          }
        }
        
        // Process remaining prices
        if (priceBatch.length > 0) {
          logger.log(`Processing final price batch: ${priceBatch.length} prices...`);
          const priceResult = await CardPrice.bulkCreate(priceBatch);
          pricesCreated += priceResult.pricesCreated;
          totalPrices += priceBatch.length;
        }
        
        logger.log(`Card import summary: ${cardsCreated} new cards added, ${cardsUpdated} existing cards updated`);
        logger.log(`Price import summary: ${pricesCreated} price records added to history`);
        logMemoryUsage('Complete');
        logger.log('Default cards import completed successfully!');
        resolve(null);
      });

      pipeline.on('error', (error: any) => {
        logger.error('Stream error:', error);
        reject(error);
      });
    });
    
  } catch (error) {
    logger.error('Error fetching default cards:', error);
  }
};

// Function to fetch sets
const fetchSets = async () => {
  try {
    logger.log('Fetching sets from Scryfall...');

    const response = await axios.get('https://api.scryfall.com/sets');
    const sets = response.data.data;
    
    if (!Array.isArray(sets)) {
      logger.error('Expected array of sets but got:', typeof sets);
      return;
    }

    logger.log(`Fetched ${sets.length} sets from Scryfall`);

    // Bulk create all sets at once for better performance
    logger.log('Bulk inserting sets into database...');
    const setResult = await Set.bulkCreate(sets);
    logger.log(`Set import summary: ${setResult.setsCreated} new sets added, ${setResult.setsUpdated} existing sets updated`);
    logger.log('Sets import completed successfully!');
  } catch (error) {
    logger.error('Error fetching sets:', error);
  }
};

// Schedule to run sets import first, then cards (sets must exist before cards due to FK constraint)
if (process.env.ENABLE_CRON !== 'false') {
  logger.log('Registering cron job: Set import at 00:01 daily');
  cron.schedule('1 0 * * *', () => {
    logger.log('Running scheduled task to fetch sets');
    // Run asynchronously without blocking the cron scheduler
    setImmediate(() => {
      fetchSets().catch(err => {
        logger.error('Error in scheduled set import:', err);
      });
    });
  }, {
    timezone: "America/Chicago"
  });
}

// Schedule to run card import after sets have been imported
if (process.env.ENABLE_CRON !== 'false') {
  logger.log('Registering cron job: Card import at 00:10 daily');
  cron.schedule('10 0 * * *', () => {
    logger.log('Running scheduled task to fetch default cards');
    // Run asynchronously without blocking the cron scheduler
    setImmediate(() => {
      fetchDefaultCards().catch(err => {
        logger.error('Error in scheduled card import:', err);
      });
    });
  }, {
    timezone: "America/Chicago"
  });
}

// Schedule to calculate trending cards daily at 12:30 AM (after cards/prices import)
if (process.env.ENABLE_CRON !== 'false') {
  logger.log('Registering cron job: Trending calculation at 00:30 daily');
  cron.schedule('30 0 * * *', () => {
    logger.log('Running scheduled task to calculate trending cards');
    // Run asynchronously without blocking the cron scheduler
    setImmediate(() => {
      TrendingCard.calculateAndStoreTrendingCards().catch(err => {
        logger.error('Error in scheduled trending calculation:', err);
      });
    });
  }, {
    timezone: "America/Chicago"
  });
}

// Schedule to check price changes and notify users at 12:45 AM (after trending calculation)
if (process.env.ENABLE_CRON !== 'false') {
  logger.log('Registering cron job: Price change notifications at 00:45 daily');
  cron.schedule('45 0 * * *', () => {
    logger.log('Running scheduled task to check price changes and notify users');
    // Run asynchronously without blocking the cron scheduler
    setImmediate(() => {
      const pool = CardPrice.getPool();
      checkPriceChangesAndNotify(pool).catch(err => {
        logger.error('Error in scheduled price change notifications:', err);
      });
    });
  }, {
    timezone: "America/Chicago"
  });
}



router.get('/api/bulk/card', async (req: Request, res: Response) => {
  try {
    logger.log('Manual trigger: Fetching and importing default cards...');
    res.status(202).json({
      message: 'Card import started',
      status: 'processing'
    });

    // Run the import asynchronously
    fetchDefaultCards().catch(err => {
      logger.error('Error in background card import:', err);
    });
  } catch (error) {
    logger.error('Error starting card import:', error);
    res.status(500).json({
      message: 'Failed to start card import',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/bulk/set', async (req: Request, res: Response) => {
  try {
    logger.log('Manual trigger: Fetching and importing default sets...');
    res.status(202).json({
router.get('/api/bulk/trending', async (req: Request, res: Response) => {
  try {
    logger.log('Manual trigger: Calculating trending cards...');
    res.status(202).json({
      message: 'Trending cards calculation started',
      status: 'processing'
    });

    // Run the calculation asynchronously
    TrendingCard.calculateAndStoreTrendingCards()
      .then(result => {
        logger.log(`Trending calculation completed: ${result.totalRecordsCreated} records in ${result.calculationTime}ms`);
      })
      .catch(err => {
        logger.error('Error in background trending calculation:', err);
      });
  } catch (error) {
    logger.error('Error starting trending calculation:', error);
    res.status(500).json({
      message: 'Failed to start trending calculation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/bulk/price-notifications', async (req: Request, res: Response) => {
  try {
    logger.log('Manual trigger: Checking price changes and sending notifications...');
    res.status(202).json({
      message: 'Price change notification check started',
      status: 'processing'
    });

    // Run the check asynchronously
    const pool = CardPrice.getPool();
    checkPriceChangesAndNotify(pool)
      .catch(err => {
        logger.error('Error in background price change notifications:', err);
      });
  } catch (error) {
    logger.error('Error starting price change notifications:', error);
    res.status(500).json({
      message: 'Failed to start price change notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as defaultCardsRouter };y
    TrendingCard.calculateAndStoreTrendingCards()
      .then(result => {
        logger.log(`Trending calculation completed: ${result.totalRecordsCreated} records in ${result.calculationTime}ms`);
      })
      .catch(err => {
        logger.error('Error in background trending calculation:', err);
      });
  } catch (error) {
    logger.error('Error starting trending calculation:', error);
    res.status(500).json({
      message: 'Failed to start trending calculation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as defaultCardsRouter };
