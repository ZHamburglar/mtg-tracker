import express, { Request, Response } from 'express';
import axios from 'axios';
import cron from 'node-cron';
import { Card } from '../models/card';
import { CardPrice } from '../models/cardprice';
import { Set } from '../models/set';
import { TrendingCard } from '../models/trending-card';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { Readable } from 'stream';

const router = express.Router();

// URL for default cards
// https://data.scryfall.io/default-cards/default-cards-20251114101320.json

// Helper function to log memory usage
const logMemoryUsage = (label: string) => {
  const used = process.memoryUsage();
  console.log(`[Memory ${label}] RSS: ${Math.round(used.rss / 1024 / 1024)}MB, Heap: ${Math.round(used.heapUsed / 1024 / 1024)}/${Math.round(used.heapTotal / 1024 / 1024)}MB`);
};

// Function to fetch default cards using streaming to minimize memory usage
const fetchDefaultCards = async () => {
  try {
    console.log('Fetching default cards from Scryfall using streaming parser...');
    logMemoryUsage('Start');

    // Get the download URL
    const bulkDataResponse = await axios.get('https://api.scryfall.com/bulk-data/default_cards', {
      timeout: 30000
    });
    const download_uri = bulkDataResponse.data.download_uri;
    console.log(`Streaming bulk data from: ${download_uri}`);
    
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

    console.log('Starting stream processing...');
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
          
          console.log(`Processing card batch: ${cardBatch.length} cards (total: ${totalCards})...`);
          const cardResult = await Card.bulkCreate(cardBatch);
          cardsCreated += cardResult.cardsCreated;
          cardsUpdated += cardResult.cardsUpdated;
          
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
            console.log(`Processing price batch: ${priceBatch.length} prices...`);
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
        console.log('Stream ended, processing remaining batches...');
        
        // Process remaining cards
        if (cardBatch.length > 0) {
          console.log(`Processing final card batch: ${cardBatch.length} cards...`);
          const cardResult = await Card.bulkCreate(cardBatch);
          cardsCreated += cardResult.cardsCreated;
          cardsUpdated += cardResult.cardsUpdated;
          
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
          console.log(`Processing final price batch: ${priceBatch.length} prices...`);
          const priceResult = await CardPrice.bulkCreate(priceBatch);
          pricesCreated += priceResult.pricesCreated;
          totalPrices += priceBatch.length;
        }
        
        console.log(`Card import summary: ${cardsCreated} new cards added, ${cardsUpdated} existing cards updated`);
        console.log(`Price import summary: ${pricesCreated} price records added to history`);
        logMemoryUsage('Complete');
        console.log('Default cards import completed successfully!');
        resolve(null);
      });

      pipeline.on('error', (error: any) => {
        console.error('Stream error:', error);
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('Error fetching default cards:', error);
  }
};

// Function to fetch sets
const fetchSets = async () => {
  try {
    console.log('Fetching sets from Scryfall...');

    const response = await axios.get('https://api.scryfall.com/sets');
    const sets = response.data.data;
    
    if (!Array.isArray(sets)) {
      console.error('Expected array of sets but got:', typeof sets);
      return;
    }

    console.log(`Fetched ${sets.length} sets from Scryfall`);

    // Bulk create all sets at once for better performance
    console.log('Bulk inserting sets into database...');
    const setResult = await Set.bulkCreate(sets);
    console.log(`Set import summary: ${setResult.setsCreated} new sets added, ${setResult.setsUpdated} existing sets updated`);
    console.log('Sets import completed successfully!');
  } catch (error) {
    console.error('Error fetching sets:', error);
  }
};

// Schedule to run sets import first, then cards (sets must exist before cards due to FK constraint)
if (process.env.ENABLE_CRON !== 'false') {
  console.log('[Bulk Service] Registering cron job: Set import at 00:01 daily');
  cron.schedule('1 0 * * *', () => {
    console.log('[Bulk Service] Running scheduled task to fetch sets');
    // Run asynchronously without blocking the cron scheduler
    setImmediate(() => {
      fetchSets().catch(err => {
        console.error('[Bulk Service] Error in scheduled set import:', err);
      });
    });
  }, {
    timezone: "America/Chicago"
  });
}

// Schedule to run card import after sets have been imported
if (process.env.ENABLE_CRON !== 'false') {
  console.log('[Bulk Service] Registering cron job: Card import at 00:10 daily');
  cron.schedule('10 0 * * *', () => {
    console.log('[Bulk Service] Running scheduled task to fetch default cards');
    // Run asynchronously without blocking the cron scheduler
    setImmediate(() => {
      fetchDefaultCards().catch(err => {
        console.error('[Bulk Service] Error in scheduled card import:', err);
      });
    });
  }, {
    timezone: "America/Chicago"
  });
}

// Schedule to calculate trending cards daily at 12:30 AM (after cards/prices import)
console.log('[Bulk Service] Registering cron job: Trending calculation at 00:30 daily');
cron.schedule('30 0 * * *', () => {
  console.log('[Bulk Service] Running scheduled task to calculate trending cards');
  // Run asynchronously without blocking the cron scheduler
  setImmediate(() => {
    TrendingCard.calculateAndStoreTrendingCards().catch(err => {
      console.error('[Bulk Service] Error in scheduled trending calculation:', err);
    });
  });
}, {
  timezone: "America/Chicago"
});

router.get('/api/bulk/card', async (req: Request, res: Response) => {
  try {
    console.log('Manual trigger: Fetching and importing default cards...');
    res.status(202).json({
      message: 'Card import started',
      status: 'processing'
    });

    // Run the import asynchronously
    fetchDefaultCards().catch(err => {
      console.error('Error in background card import:', err);
    });
  } catch (error) {
    console.error('Error starting card import:', error);
    res.status(500).json({
      message: 'Failed to start card import',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/bulk/set', async (req: Request, res: Response) => {
  try {
    console.log('Manual trigger: Fetching and importing default sets...');
    res.status(202).json({
      message: 'Set import started',
      status: 'processing'
    });

    // Run the import asynchronously
    fetchSets().catch(err => {
      console.error('Error in background set import:', err);
    });
  } catch (error) {
    console.error('Error starting set import:', error);
    res.status(500).json({
      message: 'Failed to start set import',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/api/bulk/trending', async (req: Request, res: Response) => {
  try {
    console.log('Manual trigger: Calculating trending cards...');
    res.status(202).json({
      message: 'Trending cards calculation started',
      status: 'processing'
    });

    // Run the calculation asynchronously
    TrendingCard.calculateAndStoreTrendingCards()
      .then(result => {
        console.log(`Trending calculation completed: ${result.totalRecordsCreated} records in ${result.calculationTime}ms`);
      })
      .catch(err => {
        console.error('Error in background trending calculation:', err);
      });
  } catch (error) {
    console.error('Error starting trending calculation:', error);
    res.status(500).json({
      message: 'Failed to start trending calculation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as defaultCardsRouter };
