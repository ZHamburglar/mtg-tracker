import { Card } from '../models/card';
import { CardPrice } from '../models/cardprice';

// Mock data storage
let mockCards: any[] = [];
let mockPrices: any[] = [];

// Mock mysql2/promise module
jest.mock('mysql2/promise', () => {
  return {
    createPool: () => ({
      query: async (sql: string, params?: any[]) => {
        const sqlLower = sql.toLowerCase().trim();

        // ========== CARD OPERATIONS ==========
        
        // SELECT card by id
        if (sqlLower.includes('select * from cards where id = ?')) {
          const id = params?.[0];
          const card = mockCards.find(c => c.id === id);
          return [card ? [card] : []];
        }

        // COUNT cards for search
        if (sqlLower.startsWith('select count(') && sqlLower.includes('from cards')) {
          // For oracle_id grouping queries
          if (sqlLower.includes('distinct oracle_id')) {
            const uniqueOracleIds = new Set(mockCards.map(c => c.oracle_id));
            return [[{ total: uniqueOracleIds.size }]];
          }
          return [[{ total: mockCards.length }]];
        }

        // SELECT cards with search/filters
        if (sqlLower.includes('select * from cards') || sqlLower.includes('select c1.* from cards c1')) {
          let filteredCards = [...mockCards];

          // Apply filters based on WHERE conditions and params in order
          if (params && params.length > 0) {
            let paramIndex = 0;
            
            if (sqlLower.includes('name like')) {
              const searchTerm = params[paramIndex]?.toString().replace(/%/g, '').toLowerCase();
              if (searchTerm) {
                filteredCards = filteredCards.filter(c => 
                  c.name.toLowerCase().includes(searchTerm)
                );
              }
              paramIndex++;
            }

            if (sqlLower.includes('type_line like')) {
              const searchTerm = params[paramIndex]?.toString().replace(/%/g, '').toLowerCase();
              if (searchTerm) {
                filteredCards = filteredCards.filter(c => 
                  c.type_line.toLowerCase().includes(searchTerm)
                );
              }
              paramIndex++;
            }

            if (sqlLower.includes('rarity = ?')) {
              const rarityValue = params[paramIndex];
              if (rarityValue) {
                filteredCards = filteredCards.filter(c => c.rarity === rarityValue);
              }
              paramIndex++;
            }

            if (sqlLower.includes('set_code = ?')) {
              const setCodeValue = params[paramIndex];
              if (setCodeValue) {
                filteredCards = filteredCards.filter(c => c.set_code === setCodeValue);
              }
              paramIndex++;
            }
          }

          // Handle oracle_id grouping (unique_prints = false)
          if (sqlLower.includes('left join cards c2 on c1.oracle_id = c2.oracle_id')) {
            // Group by oracle_id and keep only the most recent
            const groupedByOracle = new Map();
            filteredCards.forEach(card => {
              const existing = groupedByOracle.get(card.oracle_id);
              if (!existing || new Date(card.released_at) > new Date(existing.released_at)) {
                groupedByOracle.set(card.oracle_id, card);
              }
            });
            filteredCards = Array.from(groupedByOracle.values());
          }

          // Apply LIMIT and OFFSET
          if (sqlLower.includes('limit') && sqlLower.includes('offset')) {
            const limitMatch = sqlLower.match(/limit\s+(\d+)/);
            const offsetMatch = sqlLower.match(/offset\s+(\d+)/);
            const limit = limitMatch && limitMatch[1] ? parseInt(limitMatch[1]) : 100;
            const offset = offsetMatch && offsetMatch[1] ? parseInt(offsetMatch[1]) : 0;
            filteredCards = filteredCards.slice(offset, offset + limit);
          }

          return [filteredCards];
        }

        // ========== CARD PRICE OPERATIONS ==========
        
        // SELECT latest price by card_id
        if (sqlLower.includes('from card_prices') && sqlLower.includes('order by created_at desc limit 1')) {
          const cardId = params?.[0];
          const prices = mockPrices.filter(p => p.card_id === cardId);
          if (prices.length === 0) return [[]];
          
          // Sort by created_at descending and get first
          const sorted = prices.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          return [[sorted[0]]];
        }

        // SELECT price history with pagination
        if (sqlLower.includes('from card_prices') && sqlLower.includes('order by created_at desc')) {
          const cardId = params?.[0];
          let prices = mockPrices.filter(p => p.card_id === cardId);
          
          // Sort by created_at descending
          prices = prices.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          // Apply LIMIT and OFFSET
          if (sqlLower.includes('limit') && sqlLower.includes('offset')) {
            const limitMatch = sqlLower.match(/limit\s+(\d+)/);
            const offsetMatch = sqlLower.match(/offset\s+(\d+)/);
            const limit = limitMatch && limitMatch[1] ? parseInt(limitMatch[1]) : 100;
            const offset = offsetMatch && offsetMatch[1] ? parseInt(offsetMatch[1]) : 0;
            prices = prices.slice(offset, offset + limit);
          }

          return [prices];
        }

        // COUNT prices by card_id
        if (sqlLower.includes('select count(*) as total from card_prices where card_id = ?')) {
          const cardId = params?.[0];
          const count = mockPrices.filter(p => p.card_id === cardId).length;
          return [[{ total: count }]];
        }

        return [[]];
      }
    })
  };
});

beforeAll(async () => {
  // Set up mocked connection pool for models
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool();
  Card.setPool(pool);
  CardPrice.setPool(pool);
});

beforeEach(() => {
  // Clear mock data before each test
  mockCards = [];
  mockPrices = [];
});

afterAll(async () => {
  // No cleanup needed for mocks
});

// Helper function to add test cards
export const addTestCard = (cardData: any) => {
  const card = {
    id: cardData.id || `card-${mockCards.length + 1}`,
    name: cardData.name || 'Test Card',
    mana_cost: cardData.mana_cost || '{1}{U}',
    cmc: cardData.cmc || 2,
    type_line: cardData.type_line || 'Instant',
    oracle_text: cardData.oracle_text || 'Test card text',
    colors: cardData.colors || JSON.stringify(['U']),
    color_identity: cardData.color_identity || JSON.stringify(['U']),
    keywords: cardData.keywords || JSON.stringify([]),
    set_code: cardData.set_code || 'test',
    set_name: cardData.set_name || 'Test Set',
    collector_number: cardData.collector_number || '1',
    rarity: cardData.rarity || 'common',
    image_uris: cardData.image_uris || JSON.stringify({ small: 'test.jpg' }),
    legalities: cardData.legalities || JSON.stringify({ standard: 'legal' }),
    released_at: cardData.released_at || '2024-01-01',
    oracle_id: cardData.oracle_id || `oracle-${mockCards.length + 1}`
  };
  mockCards.push(card);
  return card;
};

// Helper function to add test price
export const addTestPrice = (priceData: any) => {
  const price = {
    id: mockPrices.length + 1,
    card_id: priceData.card_id,
    price_usd: priceData.usd || priceData.price_usd || 0,
    price_usd_foil: priceData.usd_foil || priceData.price_usd_foil || 0,
    price_usd_etched: priceData.usd_etched || priceData.price_usd_etched || 0,
    price_eur: priceData.eur || priceData.price_eur || 0,
    price_eur_foil: priceData.eur_foil || priceData.price_eur_foil || 0,
    price_tix: priceData.tix || priceData.price_tix || 0,
    created_at: priceData.recorded_at || priceData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  mockPrices.push(price);
  return price;
};
