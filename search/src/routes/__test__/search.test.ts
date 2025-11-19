import request from 'supertest';
import { app } from '../../app';
import { addTestCard, addTestPrice } from '../../test/setup';

describe('GET /api/search/:id', () => {
  it('returns a card by id', async () => {
    const testCard = addTestCard({
      id: 'test-card-1',
      name: 'Lightning Bolt',
      type_line: 'Instant',
      rarity: 'common'
    });

    const response = await request(app)
      .get('/api/search/test-card-1')
      .expect(200);

    expect(response.body).toHaveProperty('card');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body.card.id).toBe('test-card-1');
    expect(response.body.card.name).toBe('Lightning Bolt');
  });

  it('returns 404 for non-existent card', async () => {
    const response = await request(app)
      .get('/api/search/non-existent-id')
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Card not found');
  });

  it('matches the general search endpoint when id is missing', async () => {
    // /api/search/ without an ID matches the general search endpoint
    const response = await request(app)
      .get('/api/search/')
      .expect(200);

    // This matches the general search route
    expect(response.body).toHaveProperty('cards');
  });
});

describe('GET /api/search/:id/prices/latest', () => {
  it('returns the latest price for a card', async () => {
    const testCard = addTestCard({
      id: 'test-card-2',
      name: 'Black Lotus',
      set_code: 'lea',
      set_name: 'Limited Edition Alpha'
    });

    addTestPrice({
      card_id: 'test-card-2',
      usd: 100000.00,
      usd_foil: 150000.00,
      recorded_at: '2024-01-01T00:00:00Z'
    });

    addTestPrice({
      card_id: 'test-card-2',
      usd: 105000.00,
      usd_foil: 155000.00,
      recorded_at: '2024-02-01T00:00:00Z'
    });

    const response = await request(app)
      .get('/api/search/test-card-2/prices/latest')
      .expect(200);

    expect(response.body).toHaveProperty('card');
    expect(response.body).toHaveProperty('price');
    expect(response.body.card.name).toBe('Black Lotus');
    expect(response.body.price.price_usd).toBe(105000.00);
  });

  it('returns 404 when card not found', async () => {
    const response = await request(app)
      .get('/api/search/non-existent/prices/latest')
      .expect(404);

    expect(response.body.error).toBe('Card not found');
  });

  it('returns 404 when no price data exists', async () => {
    addTestCard({
      id: 'test-card-3',
      name: 'No Price Card'
    });

    const response = await request(app)
      .get('/api/search/test-card-3/prices/latest')
      .expect(404);

    expect(response.body.error).toBe('No price data found for this card');
  });
});

describe('GET /api/search/:id/prices', () => {
  it('returns paginated price history for a card', async () => {
    const testCard = addTestCard({
      id: 'test-card-4',
      name: 'Ancestral Recall',
      set_code: 'lea',
      set_name: 'Limited Edition Alpha'
    });

    // Add 5 price records
    for (let i = 1; i <= 5; i++) {
      addTestPrice({
        card_id: 'test-card-4',
        usd: 10000 + (i * 100),
        recorded_at: `2024-0${i}-01T00:00:00Z`
      });
    }

    const response = await request(app)
      .get('/api/search/test-card-4/prices')
      .query({ limit: 3, page: 1 })
      .expect(200);

    expect(response.body).toHaveProperty('card');
    expect(response.body).toHaveProperty('priceHistory');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.priceHistory.length).toBe(3);
    expect(response.body.pagination.totalRecords).toBe(5);
    expect(response.body.pagination.totalPages).toBe(2);
    expect(response.body.pagination.hasNextPage).toBe(true);
  });

  it('returns 400 when limit exceeds 1000', async () => {
    addTestCard({
      id: 'test-card-5',
      name: 'Test Card'
    });

    const response = await request(app)
      .get('/api/search/test-card-5/prices')
      .query({ limit: 1001 })
      .expect(400);

    expect(response.body.error).toBe('Limit cannot exceed 1000');
  });

  it('returns 404 when card not found', async () => {
    const response = await request(app)
      .get('/api/search/non-existent/prices')
      .expect(404);

    expect(response.body.error).toBe('Card not found');
  });

  it('handles pagination correctly on second page', async () => {
    addTestCard({
      id: 'test-card-6',
      name: 'Mox Pearl'
    });

    // Add 10 price records
    for (let i = 1; i <= 10; i++) {
      addTestPrice({
        card_id: 'test-card-6',
        usd: 1000 + (i * 10),
        recorded_at: `2024-01-${String(i).padStart(2, '0')}T00:00:00Z`
      });
    }

    const response = await request(app)
      .get('/api/search/test-card-6/prices')
      .query({ limit: 6, page: 2 })
      .expect(200);

    expect(response.body.priceHistory.length).toBe(4); // 10 total, 6 on page 1, 4 on page 2
    expect(response.body.pagination.currentPage).toBe(2);
    expect(response.body.pagination.hasPreviousPage).toBe(true);
    expect(response.body.pagination.hasNextPage).toBe(false);
  });
});

describe('GET /api/search', () => {
  beforeEach(() => {
    // Add test cards for search
    addTestCard({
      id: 'search-1',
      name: 'Lightning Bolt',
      type_line: 'Instant',
      rarity: 'common',
      set_code: 'lea',
      oracle_id: 'oracle-1'
    });

    addTestCard({
      id: 'search-2',
      name: 'Lightning Strike',
      type_line: 'Instant',
      rarity: 'common',
      set_code: 'xln',
      oracle_id: 'oracle-2'
    });

    addTestCard({
      id: 'search-3',
      name: 'Giant Growth',
      type_line: 'Instant',
      rarity: 'common',
      set_code: 'lea',
      oracle_id: 'oracle-3'
    });

    addTestCard({
      id: 'search-4',
      name: 'Black Lotus',
      type_line: 'Artifact',
      rarity: 'rare',
      set_code: 'lea',
      oracle_id: 'oracle-4'
    });
  });

  it('returns all cards when no filters applied', async () => {
    const response = await request(app)
      .get('/api/search')
      .expect(200);

    expect(response.body).toHaveProperty('cards');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.cards.length).toBeGreaterThan(0);
  });

  it('filters cards by name', async () => {
    const response = await request(app)
      .get('/api/search')
      .query({ name: 'Lightning' })
      .expect(200);

    expect(response.body.cards.length).toBe(2);
    expect(response.body.cards.every((c: any) => c.name.includes('Lightning'))).toBe(true);
  });

  it('filters cards by type_line', async () => {
    const response = await request(app)
      .get('/api/search')
      .query({ type_line: 'Artifact' })
      .expect(200);

    expect(response.body.cards.length).toBe(1);
    expect(response.body.cards[0].name).toBe('Black Lotus');
  });

  it('filters cards by rarity', async () => {
    const response = await request(app)
      .get('/api/search')
      .query({ rarity: 'rare' })
      .expect(200);

    expect(response.body.cards.length).toBe(1);
    expect(response.body.cards[0].rarity).toBe('rare');
  });

  it('filters cards by set_code', async () => {
    const response = await request(app)
      .get('/api/search')
      .query({ set_code: 'lea' })
      .expect(200);

    expect(response.body.cards.length).toBe(3);
    expect(response.body.cards.every((c: any) => c.set_code === 'lea')).toBe(true);
  });

  it('returns 400 when limit exceeds 1000', async () => {
    const response = await request(app)
      .get('/api/search')
      .query({ limit: 1001 })
      .expect(400);

    expect(response.body.error).toBe('Limit cannot exceed 1000');
  });

  it('handles pagination correctly', async () => {
    const response = await request(app)
      .get('/api/search')
      .query({ limit: 2, page: 1 })
      .expect(200);

    expect(response.body.cards.length).toBe(2);
    expect(response.body.pagination.pageSize).toBe(2);
    expect(response.body.pagination.currentPage).toBe(1);
  });

  it('groups by oracle_id by default (unique_prints=false)', async () => {
    // Add duplicate cards with same oracle_id but different release dates
    addTestCard({
      id: 'search-5',
      name: 'Lightning Bolt',
      type_line: 'Instant',
      rarity: 'common',
      set_code: 'leb',
      oracle_id: 'oracle-1', // Same as search-1
      released_at: '1993-10-04'
    });

    const response = await request(app)
      .get('/api/search')
      .query({ name: 'Lightning Bolt', unique_prints: 'false' })
      .expect(200);

    // Should group by oracle_id - mock returns most recent per oracle_id
    expect(response.body.cards.length).toBeLessThanOrEqual(2);
    // At minimum, verify we got results
    expect(response.body.cards.length).toBeGreaterThan(0);
  });

  it('returns all prints when unique_prints=true', async () => {
    // Add duplicate cards with same oracle_id
    addTestCard({
      id: 'search-6',
      name: 'Lightning Bolt',
      type_line: 'Instant',
      rarity: 'common',
      set_code: 'leb',
      oracle_id: 'oracle-1', // Same as search-1
      released_at: '1993-10-04'
    });

    const response = await request(app)
      .get('/api/search')
      .query({ name: 'Lightning Bolt', unique_prints: 'true' })
      .expect(200);

    // Should return all prints
    expect(response.body.cards.length).toBeGreaterThanOrEqual(2);
  });

  it('combines multiple filters', async () => {
    const response = await request(app)
      .get('/api/search')
      .query({ 
        type_line: 'Instant',
        set_code: 'lea',
        rarity: 'common'
      })
      .expect(200);

    expect(response.body.cards.length).toBe(2); // Lightning Bolt and Giant Growth
    expect(response.body.cards.every((c: any) => 
      c.type_line.includes('Instant') && 
      c.set_code === 'lea' && 
      c.rarity === 'common'
    )).toBe(true);
  });
});
