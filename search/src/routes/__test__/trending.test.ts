import request from 'supertest';
import { app } from '../../app';
import { addTestCard, addTestPrice } from '../../test/setup';

describe('GET /api/search/trending', () => {
  it('returns 400 with invalid timeframe', async () => {
    await request(app)
      .get('/api/search/trending')
      .query({ timeframe: 'invalid' })
      .expect(400);
  });

  it('returns 400 with invalid limit', async () => {
    await request(app)
      .get('/api/search/trending')
      .query({ limit: 0 })
      .expect(400);

    await request(app)
      .get('/api/search/trending')
      .query({ limit: 101 })
      .expect(400);
  });

  it('returns 400 with invalid price type', async () => {
    await request(app)
      .get('/api/search/trending')
      .query({ priceType: 'invalid' })
      .expect(400);
  });

  it('returns 400 with invalid direction', async () => {
    await request(app)
      .get('/api/search/trending')
      .query({ direction: 'invalid' })
      .expect(400);
  });

  it('returns empty array when no cards exist', async () => {
    const response = await request(app)
      .get('/api/search/trending')
      .expect(200);

    expect(response.body.cards).toEqual([]);
    expect(response.body.count).toBe(0);
    expect(response.body.timeframe).toBe('24h');
  });

  it('returns cards with greatest price increases over 24h', async () => {
    // Add test cards
    const card1 = addTestCard({ 
      id: 'card-1', 
      name: 'Lightning Bolt',
      rarity: 'common'
    });
    const card2 = addTestCard({ 
      id: 'card-2', 
      name: 'Black Lotus',
      rarity: 'rare'
    });
    const card3 = addTestCard({ 
      id: 'card-3', 
      name: 'Counterspell',
      rarity: 'common'
    });

    // Add price history - card1 increased 50% ($1 -> $1.50)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    addTestPrice({ 
      card_id: 'card-1', 
      price_usd: 1.00,
      created_at: yesterday.toISOString()
    });
    addTestPrice({ 
      card_id: 'card-1', 
      price_usd: 1.50,
      created_at: new Date().toISOString()
    });

    // card2 increased 25% ($100 -> $125)
    addTestPrice({ 
      card_id: 'card-2', 
      price_usd: 100.00,
      created_at: yesterday.toISOString()
    });
    addTestPrice({ 
      card_id: 'card-2', 
      price_usd: 125.00,
      created_at: new Date().toISOString()
    });

    // card3 increased 10% ($0.50 -> $0.55)
    addTestPrice({ 
      card_id: 'card-3', 
      price_usd: 0.50,
      created_at: yesterday.toISOString()
    });
    addTestPrice({ 
      card_id: 'card-3', 
      price_usd: 0.55,
      created_at: new Date().toISOString()
    });

    const response = await request(app)
      .get('/api/search/trending')
      .query({ timeframe: '24h', direction: 'increase' })
      .expect(200);

    expect(response.body.cards).toHaveLength(3);
    expect(response.body.cards[0].card_name).toBe('Lightning Bolt');
    expect(response.body.cards[0].percent_change).toBeCloseTo(50, 1);
    expect(response.body.cards[1].card_name).toBe('Black Lotus');
    expect(response.body.cards[1].percent_change).toBeCloseTo(25, 1);
    expect(response.body.cards[2].card_name).toBe('Counterspell');
    expect(response.body.cards[2].percent_change).toBeCloseTo(10, 1);
  });

  it('returns cards with greatest price decreases', async () => {
    // Add test cards
    const card1 = addTestCard({ 
      id: 'card-1', 
      name: 'Falling Star',
      rarity: 'uncommon'
    });
    const card2 = addTestCard({ 
      id: 'card-2', 
      name: 'Dwindling Returns',
      rarity: 'common'
    });

    // Add price history - card1 decreased 40% ($10 -> $6)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    addTestPrice({ 
      card_id: 'card-1', 
      price_usd: 10.00,
      created_at: weekAgo.toISOString()
    });
    addTestPrice({ 
      card_id: 'card-1', 
      price_usd: 6.00,
      created_at: new Date().toISOString()
    });

    // card2 decreased 20% ($5 -> $4)
    addTestPrice({ 
      card_id: 'card-2', 
      price_usd: 5.00,
      created_at: weekAgo.toISOString()
    });
    addTestPrice({ 
      card_id: 'card-2', 
      price_usd: 4.00,
      created_at: new Date().toISOString()
    });

    const response = await request(app)
      .get('/api/search/trending')
      .query({ timeframe: '7d', direction: 'decrease' })
      .expect(200);

    expect(response.body.cards).toHaveLength(2);
    expect(response.body.cards[0].card_name).toBe('Falling Star');
    expect(response.body.cards[0].percent_change).toBeCloseTo(-40, 1);
    expect(response.body.cards[1].card_name).toBe('Dwindling Returns');
    expect(response.body.cards[1].percent_change).toBeCloseTo(-20, 1);
  });

  it('respects limit parameter', async () => {
    // Add 5 cards with price changes
    for (let i = 1; i <= 5; i++) {
      addTestCard({ 
        id: `card-${i}`, 
        name: `Card ${i}`,
        rarity: 'common'
      });
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      addTestPrice({ 
        card_id: `card-${i}`, 
        price_usd: 1.00,
        created_at: yesterday.toISOString()
      });
      addTestPrice({ 
        card_id: `card-${i}`, 
        price_usd: 1.00 + (i * 0.1),
        created_at: new Date().toISOString()
      });
    }

    const response = await request(app)
      .get('/api/search/trending')
      .query({ limit: 3 })
      .expect(200);

    expect(response.body.cards).toHaveLength(3);
  });

  it('tracks foil prices when specified', async () => {
    const card = addTestCard({ 
      id: 'card-1', 
      name: 'Foil Card',
      rarity: 'mythic'
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Regular price stays same
    addTestPrice({ 
      card_id: 'card-1', 
      price_usd: 5.00,
      price_usd_foil: 10.00,
      created_at: yesterday.toISOString()
    });
    addTestPrice({ 
      card_id: 'card-1', 
      price_usd: 5.00,
      price_usd_foil: 15.00,
      created_at: new Date().toISOString()
    });

    const response = await request(app)
      .get('/api/search/trending')
      .query({ priceType: 'price_usd_foil' })
      .expect(200);

    expect(response.body.cards).toHaveLength(1);
    expect(response.body.cards[0].old_price).toBe(10.00);
    expect(response.body.cards[0].current_price).toBe(15.00);
    expect(response.body.cards[0].percent_change).toBeCloseTo(50, 1);
  });

  it('returns proper response structure', async () => {
    const card = addTestCard({ id: 'card-1', name: 'Test Card' });
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    addTestPrice({ 
      card_id: 'card-1', 
      price_usd: 1.00,
      created_at: yesterday.toISOString()
    });
    addTestPrice({ 
      card_id: 'card-1', 
      price_usd: 2.00,
      created_at: new Date().toISOString()
    });

    const response = await request(app)
      .get('/api/search/trending')
      .expect(200);

    expect(response.body).toHaveProperty('timeframe');
    expect(response.body).toHaveProperty('priceType');
    expect(response.body).toHaveProperty('direction');
    expect(response.body).toHaveProperty('count');
    expect(response.body).toHaveProperty('cards');
    expect(response.body).toHaveProperty('timestamp');
    
    const card_result = response.body.cards[0];
    expect(card_result).toHaveProperty('card_id');
    expect(card_result).toHaveProperty('card_name');
    expect(card_result).toHaveProperty('current_price');
    expect(card_result).toHaveProperty('old_price');
    expect(card_result).toHaveProperty('price_change');
    expect(card_result).toHaveProperty('percent_change');
  });

  it('filters out cards with no price change', async () => {
    const card1 = addTestCard({ id: 'card-1', name: 'Stable Card' });
    const card2 = addTestCard({ id: 'card-2', name: 'Volatile Card' });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // card1 - no change
    addTestPrice({ 
      card_id: 'card-1', 
      price_usd: 5.00,
      created_at: yesterday.toISOString()
    });
    addTestPrice({ 
      card_id: 'card-1', 
      price_usd: 5.00,
      created_at: new Date().toISOString()
    });

    // card2 - has change
    addTestPrice({ 
      card_id: 'card-2', 
      price_usd: 5.00,
      created_at: yesterday.toISOString()
    });
    addTestPrice({ 
      card_id: 'card-2', 
      price_usd: 6.00,
      created_at: new Date().toISOString()
    });

    const response = await request(app)
      .get('/api/search/trending')
      .expect(200);

    expect(response.body.cards).toHaveLength(1);
    expect(response.body.cards[0].card_name).toBe('Volatile Card');
  });
});
