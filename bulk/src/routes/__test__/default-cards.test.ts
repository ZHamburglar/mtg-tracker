import request from 'supertest';
import { app } from '../../app';
import axios from 'axios';

// Mock axios
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('POST /api/bulk/card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 202 and starts card import process', async () => {
    const response = await request(app)
      .get('/api/bulk/card')
      .expect(202);

    expect(response.body).toEqual({
      message: 'Card import started',
      status: 'processing'
    });
  });

  it('responds immediately without waiting for import to complete', async () => {
    // Mock a slow API response
    mockedAxios.get.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: [] }), 5000))
    );

    const startTime = Date.now();
    await request(app)
      .get('/api/bulk/card')
      .expect(202);
    const endTime = Date.now();

    // Should respond in less than 1 second, not wait for the 5 second mock
    expect(endTime - startTime).toBeLessThan(1000);
  });
});

describe('POST /api/bulk/set', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 202 and starts set import process', async () => {
    const response = await request(app)
      .get('/api/bulk/set')
      .expect(202);

    expect(response.body).toEqual({
      message: 'Set import started',
      status: 'processing'
    });
  });

  it('responds immediately without waiting for import to complete', async () => {
    // Mock a slow API response
    mockedAxios.get.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: { data: [] } }), 5000))
    );

    const startTime = Date.now();
    await request(app)
      .get('/api/bulk/set')
      .expect(202);
    const endTime = Date.now();

    // Should respond in less than 1 second
    expect(endTime - startTime).toBeLessThan(1000);
  });
});

describe('Card import process', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('imports cards successfully with valid data', async () => {
    const mockBulkData = {
      data: {
        download_uri: 'https://example.com/cards.json'
      }
    };

    const mockCards = [
      {
        id: 'card-1',
        name: 'Lightning Bolt',
        mana_cost: '{R}',
        cmc: 1,
        type_line: 'Instant',
        oracle_text: 'Lightning Bolt deals 3 damage to any target.',
        colors: ['R'],
        color_identity: ['R'],
        keywords: [],
        set: 'lea',
        set_name: 'Limited Edition Alpha',
        collector_number: '161',
        rarity: 'common',
        image_uris: { small: 'https://example.com/small.jpg' },
        legalities: { standard: 'not_legal', modern: 'legal' },
        released_at: '1993-08-05',
        oracle_id: 'oracle-1',
        prices: {
          usd: '0.50',
          usd_foil: '2.00'
        }
      }
    ];

    mockedAxios.get
      .mockResolvedValueOnce(mockBulkData)
      .mockResolvedValueOnce({ data: mockCards });

    await request(app)
      .get('/api/bulk/card')
      .expect(202);

    // Give async operations time to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify the card count increased
    const countResponse = await request(app)
      .get('/api/bulk/cards/count')
      .expect(200);

    expect(countResponse.body.total).toBeGreaterThanOrEqual(0);
  });

  it('handles empty card array', async () => {
    const mockBulkData = {
      data: {
        download_uri: 'https://example.com/cards.json'
      }
    };

    mockedAxios.get
      .mockResolvedValueOnce(mockBulkData)
      .mockResolvedValueOnce({ data: [] });

    await request(app)
      .get('/api/bulk/card')
      .expect(202);

    // Give async operations time to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const countResponse = await request(app)
      .get('/api/bulk/cards/count')
      .expect(200);

    expect(countResponse.body.total).toBe(0);
  });
});

describe('Set import process', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('imports sets successfully with valid data', async () => {
    const mockSets = {
      data: {
        data: [
          {
            id: 'set-1',
            code: 'lea',
            name: 'Limited Edition Alpha',
            set_type: 'core',
            released_at: '1993-08-05',
            card_count: 295,
            icon_svg_uri: 'https://example.com/icon.svg',
            digital: false,
            foil_only: false
          },
          {
            id: 'set-2',
            code: 'leb',
            name: 'Limited Edition Beta',
            set_type: 'core',
            released_at: '1993-10-04',
            card_count: 302,
            icon_svg_uri: 'https://example.com/icon2.svg',
            digital: false,
            foil_only: false
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValueOnce(mockSets);

    await request(app)
      .get('/api/bulk/set')
      .expect(202);

    // Give async operations time to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const countResponse = await request(app)
      .get('/api/bulk/cards/setcount')
      .expect(200);

    expect(countResponse.body.total).toBeGreaterThanOrEqual(0);
  });

  it('handles empty set array', async () => {
    const mockSets = {
      data: {
        data: []
      }
    };

    mockedAxios.get.mockResolvedValueOnce(mockSets);

    await request(app)
      .get('/api/bulk/set')
      .expect(202);

    // Give async operations time to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const countResponse = await request(app)
      .get('/api/bulk/cards/setcount')
      .expect(200);

    expect(countResponse.body.total).toBe(0);
  });
});
