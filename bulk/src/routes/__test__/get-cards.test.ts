import request from 'supertest';
import { app } from '../../app';

describe('GET /api/bulk/cards/count', () => {
  it('returns the total count of cards', async () => {
    const response = await request(app)
      .get('/api/bulk/cards/count')
      .expect(200);

    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('timestamp');
    expect(typeof response.body.total).toBe('number');
  });

  it('returns 0 when no cards exist', async () => {
    const response = await request(app)
      .get('/api/bulk/cards/count')
      .expect(200);

    expect(response.body.total).toBe(0);
  });
});

describe('GET /api/bulk/cards/pricescount', () => {
  it('returns the total count of card prices', async () => {
    const response = await request(app)
      .get('/api/bulk/cards/pricescount')
      .expect(200);

    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('timestamp');
    expect(typeof response.body.total).toBe('number');
  });

  it('returns 0 when no prices exist', async () => {
    const response = await request(app)
      .get('/api/bulk/cards/pricescount')
      .expect(200);

    expect(response.body.total).toBe(0);
  });
});

describe('GET /api/bulk/cards/setcount', () => {
  it('returns the total count of sets', async () => {
    const response = await request(app)
      .get('/api/bulk/cards/setcount')
      .expect(200);

    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('timestamp');
    expect(typeof response.body.total).toBe('number');
  });

  it('returns 0 when no sets exist', async () => {
    const response = await request(app)
      .get('/api/bulk/cards/setcount')
      .expect(200);

    expect(response.body.total).toBe(0);
  });
});
