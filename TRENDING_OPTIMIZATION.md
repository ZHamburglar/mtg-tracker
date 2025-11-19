# Trending Cards Performance Optimization

## Summary

Moved trending cards calculation from on-demand (9 seconds per request) to pre-calculated daily batch processing with instant queries from a dedicated table.

## Architecture Changes

### Before (Slow)
- **Search Service**: Calculated trending cards on every API request
- **Performance**: ~9 seconds per request
- **Method**: Complex SQL with window functions executed on-demand
- **Tables Used**: `card_prices` (500k records)

### After (Fast)
- **Bulk Service**: Pre-calculates trending data once daily at 12:15 AM
- **Search Service**: Queries pre-calculated results from `trending_cards` table
- **Performance**: Sub-second queries (instant lookup)
- **Method**: Pre-computed results stored and indexed

## New Database Table

### `trending_cards`
Stores pre-calculated trending data for all combinations of:
- 3 timeframes (24h, 7d, 30d)
- 3 price types (USD, USD foil, EUR)
- 2 directions (increase, decrease)
- Top 100 cards per combination
- **Total records**: ~1,800 (refreshed daily)

**Schema:**
```sql
CREATE TABLE trending_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id VARCHAR(36) NOT NULL,
  card_name VARCHAR(255) NOT NULL,
  timeframe ENUM('24h', '7d', '30d') NOT NULL,
  price_type ENUM('price_usd', 'price_usd_foil', 'price_eur') NOT NULL,
  direction ENUM('increase', 'decrease') NOT NULL,
  current_price DECIMAL(10, 2) NOT NULL,
  old_price DECIMAL(10, 2) NOT NULL,
  price_change DECIMAL(10, 2) NOT NULL,
  percent_change DECIMAL(10, 2) NOT NULL,
  curr_date DATETIME NOT NULL,
  old_date DATETIME NOT NULL,
  `rank` INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_timeframe_pricetype_direction (timeframe, price_type, direction),
  INDEX idx_card_id (card_id),
  INDEX idx_rank (`rank`),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);
```

## New Files Created

### Bulk Service
1. **`bulk/src/models/trending-card.ts`**
   - `calculateAndStoreTrendingCards()` - Computes all trending combinations
   - `getTrendingCards()` - Query method (used for testing)
   - `getLastUpdateTime()` - Returns when data was last calculated

2. **`bulk/src/migrations/005_create_trending_cards_table.sql`**
   - Migration to create the new table

3. **`bulk/src/routes/default-cards.ts`** (modified)
   - Added cron job: Daily at 12:15 AM
   - Added route: `GET /api/bulk/trending` for manual trigger

### Search Service
1. **`search/src/models/trending-card.ts`**
   - Read-only model to query pre-calculated data
   - `getTrendingCards()` - Fast lookup by timeframe/priceType/direction
   - `getLastUpdateTime()` - Informs users when data was calculated

2. **`search/src/routes/trending.ts`** (modified)
   - Changed from calculating to querying
   - Added `lastUpdate` field to response

## API Changes

### Bulk Service - New Endpoint
**GET** `/api/bulk/trending`
- Manually triggers trending calculation
- Returns 202 Accepted (runs asynchronously)
- Useful for initial setup or ad-hoc recalculation

### Search Service - Enhanced Response
**GET** `/api/search/trending`
- Now returns `lastUpdate` field
- Response time: ~9 seconds → <100ms (estimated)

**Example Response:**
```json
{
  "timeframe": "24h",
  "priceType": "price_usd",
  "direction": "increase",
  "count": 15,
  "cards": [...],
  "lastUpdate": "2025-11-19T00:15:32.000Z",
  "timestamp": "2025-11-19T12:34:56.789Z"
}
```

## Cron Schedule

### Bulk Service Scheduled Jobs
1. **12:01 AM** - Import cards and prices from Scryfall
2. **12:09 AM** (Sunday) - Import sets from Scryfall
3. **12:15 AM** (NEW) - Calculate trending cards

## Deployment Steps

1. **Apply migration**: Run `005_create_trending_cards_table.sql` on your MySQL database
2. **Deploy Bulk service**: Includes new model and cron job
3. **Deploy Search service**: Uses new TrendingCard model
4. **Initial calculation**: Call `GET /api/bulk/trending` to populate initial data
5. **Verify**: Query `GET /api/search/trending` to confirm fast responses

## Performance Benefits

- **Query Speed**: 9 seconds → <100ms (99% reduction)
- **Database Load**: Heavy computation once daily vs. on every request
- **Scalability**: Handles concurrent requests without performance degradation
- **User Experience**: Instant results for trending data

## Data Freshness

- **Update Frequency**: Once per day (12:15 AM)
- **Data Age**: Maximum 24 hours old
- **Visible to Users**: `lastUpdate` field in response
- **Manual Refresh**: Available via `/api/bulk/trending` endpoint

## Testing

To test the optimization:
1. Run initial calculation: `curl http://localhost:3000/api/bulk/trending`
2. Wait for completion (check logs)
3. Query trending: `curl http://localhost:3000/api/search/trending`
4. Measure response time (should be <100ms)

## Rollback Plan

If issues arise, the old calculation logic is preserved in:
- `search/src/models/cardprice.ts` - `getTrendingCards()` method

Simply revert `search/src/routes/trending.ts` to use `CardPrice.getTrendingCards()` instead of `TrendingCard.getTrendingCards()`.
