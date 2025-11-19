import request from 'supertest';
import { app } from '../../app';
import { createTestUser, addTestCardToCollection } from '../../test/setup';

describe('GET /api/collection', () => {
  it('returns 401 when not authenticated', async () => {
    await request(app)
      .get('/api/collection')
      .expect(401);
  });

  it('returns empty collection for new user', async () => {
    const { cookie } = createTestUser('user1@test.com');

    const response = await request(app)
      .get('/api/collection')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body).toHaveProperty('cards');
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.cards).toHaveLength(0);
    expect(response.body.pagination.totalRecords).toBe(0);
  });

  it('returns user collection with cards', async () => {
    const { user, cookie } = createTestUser('user2@test.com');
    
    // Add cards to collection
    addTestCardToCollection(user.id, 'card-uuid-1', 4, 'normal');
    addTestCardToCollection(user.id, 'card-uuid-2', 1, 'foil');
    addTestCardToCollection(user.id, 'card-uuid-3', 2, 'etched');

    const response = await request(app)
      .get('/api/collection')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.cards).toHaveLength(3);
    expect(response.body.pagination.totalRecords).toBe(3);
  });

  it('filters collection by finish_type', async () => {
    const { user, cookie } = createTestUser('user3@test.com');
    
    addTestCardToCollection(user.id, 'card-uuid-1', 4, 'normal');
    addTestCardToCollection(user.id, 'card-uuid-2', 1, 'foil');
    addTestCardToCollection(user.id, 'card-uuid-3', 2, 'foil');

    const response = await request(app)
      .get('/api/collection')
      .query({ finish_type: 'foil' })
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.cards).toHaveLength(2);
    expect(response.body.cards.every((c: any) => c.finish_type === 'foil')).toBe(true);
  });

  it('handles pagination correctly', async () => {
    const { user, cookie } = createTestUser('user4@test.com');
    
    // Add 10 cards
    for (let i = 1; i <= 10; i++) {
      addTestCardToCollection(user.id, `card-uuid-${i}`, 1, 'normal');
    }

    const response = await request(app)
      .get('/api/collection')
      .query({ limit: 5, page: 1 })
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.cards).toHaveLength(5);
    expect(response.body.pagination.currentPage).toBe(1);
    expect(response.body.pagination.totalRecords).toBe(10);
    expect(response.body.pagination.totalPages).toBe(2);
    expect(response.body.pagination.hasNextPage).toBe(true);
    expect(response.body.pagination.hasPreviousPage).toBe(false);
  });

  it('returns 400 when limit exceeds 1000', async () => {
    const { cookie } = createTestUser('user5@test.com');

    const response = await request(app)
      .get('/api/collection')
      .query({ limit: 1001 })
      .set('Cookie', cookie)
      .expect(400);

    expect(response.body).toHaveProperty('errors');
  });
});

describe('GET /api/collection/stats', () => {
  it('returns 401 when not authenticated', async () => {
    await request(app)
      .get('/api/collection/stats')
      .expect(401);
  });

  it('returns collection statistics', async () => {
    const { user, cookie } = createTestUser('stats1@test.com');
    
    addTestCardToCollection(user.id, 'card-1', 4, 'normal');
    addTestCardToCollection(user.id, 'card-2', 1, 'foil');
    addTestCardToCollection(user.id, 'card-3', 2, 'normal');

    const response = await request(app)
      .get('/api/collection/stats')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body).toHaveProperty('stats');
    expect(response.body.stats.total_cards).toBe(3);
    expect(response.body.stats.total_quantity).toBe(7);
    expect(response.body.stats).toHaveProperty('by_finish');
  });
});

describe('GET /api/collection/:cardId', () => {
  it('returns 401 when not authenticated', async () => {
    await request(app)
      .get('/api/collection/card-uuid-1')
      .expect(401);
  });

  it('returns all versions of a card', async () => {
    const { user, cookie } = createTestUser('card1@test.com');
    
    addTestCardToCollection(user.id, 'card-uuid-1', 4, 'normal');
    addTestCardToCollection(user.id, 'card-uuid-1', 1, 'foil');
    addTestCardToCollection(user.id, 'card-uuid-1', 2, 'etched');

    const response = await request(app)
      .get('/api/collection/card-uuid-1')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.versions).toHaveLength(3);
    expect(response.body.totalQuantity).toBe(7);
    expect(response.body.cardId).toBe('card-uuid-1');
  });

  it('returns 404 for card not in collection', async () => {
    const { cookie } = createTestUser('card2@test.com');

    const response = await request(app)
      .get('/api/collection/non-existent-card')
      .set('Cookie', cookie)
      .expect(404);

    expect(response.body.error).toBe('Card not found in collection');
  });
});

describe('POST /api/collection', () => {
  it('returns 401 when not authenticated', async () => {
    await request(app)
      .post('/api/collection')
      .send({ card_id: 'card-uuid-1' })
      .expect(401);
  });

  it('adds a card to collection', async () => {
    const { cookie } = createTestUser('add1@test.com');

    const response = await request(app)
      .post('/api/collection')
      .set('Cookie', cookie)
      .send({
        card_id: '12345678-1234-1234-1234-123456789012',
        quantity: 3,
        finish_type: 'foil'
      })
      .expect(201);

    expect(response.body).toHaveProperty('card');
    expect(response.body.card.quantity).toBe(3);
    expect(response.body.card.finish_type).toBe('foil');
    expect(response.body.message).toBe('Card added to collection successfully');
  });

  it('increments quantity when adding existing card', async () => {
    const { user, cookie } = createTestUser('add2@test.com');
    
    // Add initial card
    addTestCardToCollection(user.id, '12345678-1234-1234-1234-123456789012', 2, 'normal');

    const response = await request(app)
      .post('/api/collection')
      .set('Cookie', cookie)
      .send({
        card_id: '12345678-1234-1234-1234-123456789012',
        quantity: 3,
        finish_type: 'normal'
      })
      .expect(201);

    expect(response.body.card.quantity).toBe(5); // 2 + 3
  });

  it('defaults to quantity 1 and finish_type normal', async () => {
    const { cookie } = createTestUser('add3@test.com');

    const response = await request(app)
      .post('/api/collection')
      .set('Cookie', cookie)
      .send({
        card_id: '12345678-1234-1234-1234-123456789012'
      })
      .expect(201);

    expect(response.body.card.quantity).toBe(1);
    expect(response.body.card.finish_type).toBe('normal');
  });

  it('returns 400 with invalid card_id', async () => {
    const { cookie } = createTestUser('add4@test.com');

    const response = await request(app)
      .post('/api/collection')
      .set('Cookie', cookie)
      .send({
        card_id: 'invalid-uuid'
      })
      .expect(400);

    expect(response.body).toHaveProperty('errors');
  });

  it('returns 400 with invalid finish_type', async () => {
    const { cookie } = createTestUser('add5@test.com');

    const response = await request(app)
      .post('/api/collection')
      .set('Cookie', cookie)
      .send({
        card_id: '12345678-1234-1234-1234-123456789012',
        finish_type: 'invalid'
      })
      .expect(400);

    expect(response.body).toHaveProperty('errors');
  });
});

describe('PUT /api/collection/:cardId', () => {
  it('returns 401 when not authenticated', async () => {
    await request(app)
      .put('/api/collection/card-uuid-1')
      .send({ quantity: 5, finish_type: 'normal' })
      .expect(401);
  });

  it('updates card quantity', async () => {
    const { user, cookie } = createTestUser('update1@test.com');
    
    addTestCardToCollection(user.id, 'card-uuid-1', 2, 'normal');

    const response = await request(app)
      .put('/api/collection/card-uuid-1')
      .set('Cookie', cookie)
      .send({
        quantity: 5,
        finish_type: 'normal'
      })
      .expect(200);

    expect(response.body.card.quantity).toBe(5);
    expect(response.body.message).toBe('Card quantity updated successfully');
  });

  it('removes card when quantity set to 0', async () => {
    const { user, cookie } = createTestUser('update2@test.com');
    
    addTestCardToCollection(user.id, 'card-uuid-1', 2, 'normal');

    const response = await request(app)
      .put('/api/collection/card-uuid-1')
      .set('Cookie', cookie)
      .send({
        quantity: 0,
        finish_type: 'normal'
      })
      .expect(200);

    expect(response.body.message).toBe('Card removed from collection (quantity was 0)');
  });

  it('returns 400 with missing quantity', async () => {
    const { cookie } = createTestUser('update3@test.com');

    const response = await request(app)
      .put('/api/collection/card-uuid-1')
      .set('Cookie', cookie)
      .send({
        finish_type: 'normal'
      })
      .expect(400);

    expect(response.body).toHaveProperty('errors');
  });

  it('returns 400 with invalid finish_type', async () => {
    const { cookie } = createTestUser('update4@test.com');

    const response = await request(app)
      .put('/api/collection/card-uuid-1')
      .set('Cookie', cookie)
      .send({
        quantity: 5,
        finish_type: 'invalid'
      })
      .expect(400);

    expect(response.body).toHaveProperty('errors');
  });
});

describe('DELETE /api/collection/:cardId', () => {
  it('returns 401 when not authenticated', async () => {
    await request(app)
      .delete('/api/collection/card-uuid-1')
      .query({ finish_type: 'normal' })
      .expect(401);
  });

  it('removes entire card from collection', async () => {
    const { user, cookie } = createTestUser('delete1@test.com');
    
    addTestCardToCollection(user.id, 'card-uuid-1', 5, 'normal');

    const response = await request(app)
      .delete('/api/collection/card-uuid-1')
      .query({ finish_type: 'normal' })
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.message).toBe('Card removed from collection successfully');
  });

  it('decrements quantity when specified', async () => {
    const { user, cookie } = createTestUser('delete2@test.com');
    
    addTestCardToCollection(user.id, 'card-uuid-1', 5, 'normal');

    const response = await request(app)
      .delete('/api/collection/card-uuid-1')
      .query({ finish_type: 'normal', quantity: 2 })
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.message).toBe('Removed 2 card(s) from collection');
  });

  it('returns 404 for card not in collection', async () => {
    const { cookie } = createTestUser('delete3@test.com');

    const response = await request(app)
      .delete('/api/collection/non-existent-card')
      .query({ finish_type: 'normal' })
      .set('Cookie', cookie)
      .expect(404);

    expect(response.body.error).toBe('Card not found in collection');
  });

  it('returns 400 when finish_type is missing', async () => {
    const { cookie } = createTestUser('delete4@test.com');

    const response = await request(app)
      .delete('/api/collection/card-uuid-1')
      .set('Cookie', cookie)
      .expect(400);

    expect(response.body).toHaveProperty('errors');
  });

  it('returns 400 with invalid finish_type', async () => {
    const { cookie } = createTestUser('delete5@test.com');

    const response = await request(app)
      .delete('/api/collection/card-uuid-1')
      .query({ finish_type: 'invalid' })
      .set('Cookie', cookie)
      .expect(400);

    expect(response.body).toHaveProperty('errors');
  });
});
