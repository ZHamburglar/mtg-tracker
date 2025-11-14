import express, { Request, Response } from 'express';
import axios from 'axios';
import cron from 'node-cron';

const router = express.Router();

// Function to fetch default cards
const fetchDefaultCards = async () => {
  try {
    console.log('Fetching default cards...');
    // Make HTTP request to your own endpoint
    const response = await axios.get('https://api.scryfall.com/cards/named?fuzzy=aust+com');
    const data = response.data;
    console.log('Default cards fetched:', data);
  } catch (error) {
    console.error('Error fetching default cards:', error);
  }
};

// Schedule to run every 2 minutes
cron.schedule('*/2 * * * *', () => {
  console.log('Running scheduled task to fetch default cards');
  fetchDefaultCards();
});

router.get('/api/bulk/card', (req: Request, res: Response) => {
  console.log('Received request for default cards');
  res.status(200).json({
    status: 'healthy',
    service: 'bulk',
    timestamp: new Date().toISOString()
  });
});

export { router as defaultCardsRouter };
