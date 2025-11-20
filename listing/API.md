# Listing Service API Documentation

The Listing Service manages card listings for both physical (store) and online (TCGPlayer, etc.) marketplaces.

## Features

- ✅ Create listings from cards in user collections
- ✅ Track available inventory (automatically decrements from collection)
- ✅ Support for both physical and online marketplace listings  
- ✅ Card condition tracking
- ✅ Price management in cents
- ✅ Multiple listing statuses (active, sold, cancelled, expired)
- ✅ Automatic inventory management when listings are cancelled or deleted

## Database Schema

### `card_listings` Table
- Stores all card listings with pricing, condition, and marketplace info
- Tracks listing status (active, sold, cancelled, expired)
- Links to `user_card_collection` for inventory management

### `user_card_collection` Table Updates
**Added:** `available` column
- Tracks how many cards are available for listing
- Formula: `available` = `quantity` - (cards currently listed)
- Automatically managed by listing operations

## API Endpoints

### Create Listing
`POST /api/listing`

### Get Listing
`GET /api/listing/:id`

### Get User Listings
`GET /api/listing/user/:userId`

### Get Card Listings  
`GET /api/listing/card/:cardId`

### Update Listing
`PUT /api/listing/:id`

### Cancel Listing
`POST /api/listing/:id/cancel`

### Mark as Sold
`POST /api/listing/:id/sold`

### Delete Listing
`DELETE /api/listing/:id`

See full API documentation in the codebase comments.

## Card Conditions
- `near_mint`, `lightly_played`, `moderately_played`, `heavily_played`, `damaged`

## Listing Types
- `physical` - In-store or local
- `online` - TCGPlayer, CardMarket, etc.

## Migrations Required

1. **Collection Service**: Run `002_add_available_column_up.sql`
2. **Listing Service**: Run `001_create_card_listings_table_up.sql`
