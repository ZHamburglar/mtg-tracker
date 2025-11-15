import express, { Request, Response } from 'express';
import axios from 'axios';
import cron from 'node-cron';
import { Card } from '../models/card';
import { CardPrice } from '../models/cardprice';
import { Set } from '../models/set';

const router = express.Router();

// URL for default cards
// https://data.scryfall.io/default-cards/default-cards-20251114101320.json
// Function to fetch default cards
const fetchDefaultCards = async () => {
  try {
    console.log('Fetching default cards from Scryfall...');

    const bulkDataResponse = await axios.get('https://api.scryfall.com/bulk-data/default_cards');
    const download_uri = bulkDataResponse.data.download_uri;
    const response = await axios.get(download_uri);
    const cards = response.data;
    
    if (!Array.isArray(cards)) {
      console.error('Expected array of cards but got:', typeof cards);
      return;
    }

    console.log(`Fetched ${cards.length} cards from Scryfall`);

    // Bulk create all cards at once for better performance
    console.log('Bulk inserting cards into database...');
    const cardResult = await Card.bulkCreate(cards);
    console.log(`Card import summary: ${cardResult.cardsCreated} new cards added, ${cardResult.cardsUpdated} existing cards updated`);

    // Process card prices
    console.log('Processing card prices...');
    const pricesData = cards
      .filter(card => card.prices && (card.prices.usd || card.prices.usd_foil || card.prices.usd_etched || card.prices.eur || card.prices.eur_foil || card.prices.tix))
      .map(card => ({
        card_id: card.id,
        usd: card.prices.usd ? parseFloat(card.prices.usd) : 0,
        usd_foil: card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : 0,
        usd_etched: card.prices.usd_etched ? parseFloat(card.prices.usd_etched) : 0,
        eur: card.prices.eur ? parseFloat(card.prices.eur) : 0,
        eur_foil: card.prices.eur_foil ? parseFloat(card.prices.eur_foil) : 0,
        tix: card.prices.tix ? parseFloat(card.prices.tix) : 0,
      }));

    console.log(`Found ${pricesData.length} cards with prices out of ${cards.length} total cards`);
    
    const priceResult = await CardPrice.bulkCreate(pricesData);
    console.log(`Price import summary: ${priceResult.pricesCreated} price records added to history`);
    console.log('Default cards import completed successfully!');
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

// Schedule to run every night at midnight
cron.schedule('1 0 * * *', () => {
  console.log('Running scheduled task to fetch default cards at midnight');
  fetchDefaultCards().catch(err => {
    console.error('Error in scheduled card import:', err);
  });
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

export { router as defaultCardsRouter };
