import express, { Request, Response } from 'express';
import axios from 'axios';
import cron from 'node-cron';
import { Card } from '../models/card';
import { CardPrice } from '../models/cardprice';

const router = express.Router();

// URL for default cards
// https://data.scryfall.io/default-cards/default-cards-20251114101320.json
// Function to fetch default cards
const fetchDefaultCards = async () => {
  try {
    console.log('Fetching default cards from Scryfall...');
    const response = await axios.get('https://data.scryfall.io/default-cards/default-cards-20251114101320.json');
    const cards = response.data;
    
    if (!Array.isArray(cards)) {
      console.error('Expected array of cards but got:', typeof cards);
      return;
    }

    console.log(`Fetched ${cards.length} cards from Scryfall`);

    // Bulk create all cards at once for better performance
    console.log('Bulk inserting cards into database...');
    const cardResult = await Card.bulkCreate(cards);
    console.log(`Successfully created/updated ${cardResult.cardsCreated} cards`);

    // Process card prices
    console.log('Processing card prices...');
    let pricesCreated = 0;
    let pricesSkipped = 0;

    for (const card of cards) {
      // Only create price record if prices exist
      if (card.prices && (card.prices.usd || card.prices.usd_foil || card.prices.usd_etched || card.prices.eur || card.prices.eur_foil || card.prices.tix)) {
        try {
          await CardPrice.create({
            card_id: card.id,
            usd: card.prices.usd ? parseFloat(card.prices.usd) : 0,
            usd_foil: card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : 0,
            usd_etched: card.prices.usd_etched ? parseFloat(card.prices.usd_etched) : 0,
            eur: card.prices.eur ? parseFloat(card.prices.eur) : 0,
            eur_foil: card.prices.eur_foil ? parseFloat(card.prices.eur_foil) : 0,
            tix: card.prices.tix ? parseFloat(card.prices.tix) : 0,
          });
          pricesCreated++;
        } catch (error) {
          console.error(`Error creating price for card ${card.id}:`, error);
        }
      } else {
        pricesSkipped++;
      }

      // Log progress every 10,000 cards
      if ((pricesCreated + pricesSkipped) % 10000 === 0) {
        console.log(`Processed ${pricesCreated + pricesSkipped} card prices...`);
      }
    }

    console.log(`Card prices processing complete: ${pricesCreated} created, ${pricesSkipped} skipped`);
    console.log('Default cards import completed successfully!');
  } catch (error) {
    console.error('Error fetching default cards:', error);
  }
};

// Schedule to run every 1 day
cron.schedule('* * */1 * *', () => {
  console.log('Running scheduled task to fetch default cards');
  fetchDefaultCards();
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

export { router as defaultCardsRouter };
