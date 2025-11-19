import { Card } from '../models/card';
import { CardPrice } from '../models/cardprice';
import { Set } from '../models/set';

// Mock data storage
let mockCards: any[] = [];
let mockPrices: any[] = [];
let mockSets: any[] = [];

// Mock mysql2/promise module
jest.mock('mysql2/promise', () => {
  return {
    createPool: () => ({
      query: async (sql: string, params?: any[]) => {
        const sqlLower = sql.toLowerCase().trim();

        // ========== CARD OPERATIONS ==========
        
        // INSERT IGNORE cards (bulk insert)
        if (sqlLower.startsWith('insert ignore into cards')) {
          // For bulk insert, params would be an array of card arrays
          let insertedCount = 0;
          if (params && Array.isArray(params)) {
            for (const cardData of params) {
              const existingCard = mockCards.find(c => c.id === cardData[0]);
              if (!existingCard) {
                mockCards.push({
                  id: cardData[0],
                  name: cardData[1],
                  mana_cost: cardData[2],
                  cmc: cardData[3],
                  type_line: cardData[4],
                  oracle_text: cardData[5],
                  colors: cardData[6],
                  color_identity: cardData[7],
                  keywords: cardData[8],
                  set_code: cardData[9],
                  set_name: cardData[10],
                  collector_number: cardData[11],
                  rarity: cardData[12],
                  image_uris: cardData[13],
                  legalities: cardData[14],
                  released_at: cardData[15],
                  oracle_id: cardData[16]
                });
                insertedCount++;
              }
            }
          }
          return [{ affectedRows: insertedCount }];
        }

        // UPDATE cards (bulk update)
        if (sqlLower.startsWith('insert into cards') && sqlLower.includes('on duplicate key update')) {
          let updatedCount = 0;
          if (params && Array.isArray(params)) {
            for (const cardData of params) {
              const cardIndex = mockCards.findIndex(c => c.id === cardData[0]);
              if (cardIndex !== -1) {
                mockCards[cardIndex] = {
                  ...mockCards[cardIndex],
                  name: cardData[1],
                  mana_cost: cardData[2],
                  cmc: cardData[3],
                  type_line: cardData[4],
                  oracle_text: cardData[5],
                  colors: cardData[6],
                  color_identity: cardData[7],
                  keywords: cardData[8],
                  set_code: cardData[9],
                  set_name: cardData[10],
                  collector_number: cardData[11],
                  rarity: cardData[12],
                  image_uris: cardData[13],
                  legalities: cardData[14],
                  released_at: cardData[15],
                  oracle_id: cardData[16]
                };
                updatedCount++;
              }
            }
          }
          return [{ affectedRows: updatedCount }];
        }

        // COUNT cards
        if (sqlLower === 'select count(*) as total from cards') {
          return [[{ total: mockCards.length }]];
        }

        // ========== CARD PRICE OPERATIONS ==========
        
        // INSERT card prices
        if (sqlLower.startsWith('insert into card_prices')) {
          let insertedCount = 0;
          if (params && Array.isArray(params)) {
            for (const priceData of params) {
              mockPrices.push({
                card_id: priceData[0],
                usd: priceData[1],
                usd_foil: priceData[2],
                usd_etched: priceData[3],
                eur: priceData[4],
                eur_foil: priceData[5],
                tix: priceData[6],
                recorded_at: new Date()
              });
              insertedCount++;
            }
          }
          return [{ affectedRows: insertedCount }];
        }

        // COUNT card prices
        if (sqlLower === 'select count(*) as total from card_prices') {
          return [[{ total: mockPrices.length }]];
        }

        // ========== SET OPERATIONS ==========
        
        // INSERT IGNORE sets (bulk insert)
        if (sqlLower.startsWith('insert ignore into sets')) {
          let insertedCount = 0;
          if (params && Array.isArray(params)) {
            for (const setData of params) {
              const existingSet = mockSets.find(s => s.id === setData[0]);
              if (!existingSet) {
                mockSets.push({
                  id: setData[0],
                  code: setData[1],
                  name: setData[2],
                  set_type: setData[3],
                  released_at: setData[4],
                  card_count: setData[5],
                  icon_svg_uri: setData[6],
                  digital: setData[7],
                  foil_only: setData[8]
                });
                insertedCount++;
              }
            }
          }
          return [{ affectedRows: insertedCount }];
        }

        // UPDATE sets (bulk update)
        if (sqlLower.startsWith('insert into sets') && sqlLower.includes('on duplicate key update')) {
          let updatedCount = 0;
          if (params && Array.isArray(params)) {
            for (const setData of params) {
              const setIndex = mockSets.findIndex(s => s.id === setData[0]);
              if (setIndex !== -1) {
                mockSets[setIndex] = {
                  ...mockSets[setIndex],
                  code: setData[1],
                  name: setData[2],
                  set_type: setData[3],
                  released_at: setData[4],
                  card_count: setData[5],
                  icon_svg_uri: setData[6],
                  digital: setData[7],
                  foil_only: setData[8]
                };
                updatedCount++;
              }
            }
          }
          return [{ affectedRows: updatedCount }];
        }

        // COUNT sets
        if (sqlLower === 'select count(*) as total from sets') {
          return [[{ total: mockSets.length }]];
        }

        return [[]];
      }
    })
  };
});

// Mock axios for Scryfall API calls
jest.mock('axios');

// Mock node-cron to prevent scheduled tasks from running during tests
jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

beforeAll(async () => {
  // Set up mocked connection pool for models
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool();
  Card.setPool(pool);
  CardPrice.setPool(pool);
  Set.setPool(pool);
});

beforeEach(() => {
  // Clear mock data before each test
  mockCards = [];
  mockPrices = [];
  mockSets = [];
});

afterAll(async () => {
  // No cleanup needed for mocks
});
