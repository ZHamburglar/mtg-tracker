# Collection Cache Migration

## Overview
This migration adds a cache table to store pre-calculated collection values for better performance.

## Run Migration

```bash
# Connect to your MySQL database
mysql -u root -p mtg_tracker

# Run the migration
source /path/to/collection/src/migrations/003_create_collection_cache_table_up.sql
```

## How It Works

1. **Cache Table**: `user_collection_cache` stores:
   - `total_value_usd`: Total USD value of collection (accounting for foil vs normal prices)
   - `total_cards`: Number of unique cards
   - `total_quantity`: Total number of cards (including duplicates)
   - `last_updated`: Timestamp of last cache update

2. **Automatic Updates**: Cache is automatically updated when:
   - A card is added to collection
   - Card quantity is updated
   - A card is removed from collection

3. **Background Processing**: Cache updates happen in the background to avoid blocking API responses

## API Response

The `/api/collection` endpoint now includes:

```json
{
  "cards": [...],
  "pagination": {...},
  "collectionValue": {
    "totalValueUsd": 1234.56,
    "totalCards": 150,
    "totalQuantity": 250,
    "lastUpdated": "2025-12-01T12:00:00.000Z"
  }
}
```

## Benefits

- **Fast**: Single database lookup instead of calculating across all cards
- **Accurate**: Uses latest prices and accounts for finish types (foil vs normal)
- **Scalable**: Works efficiently even with thousands of cards
- **Real-time**: Updates automatically whenever collection changes
