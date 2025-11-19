# MTG Tracker Search API Documentation

## Endpoints

### 1. Search by Card ID
**GET** `/api/search/:id`

Returns a single card by its Scryfall UUID.

**Example:**
```bash
curl https://mtg-tracker.local/api/search/57b852b6-4388-4a41-a5c0-bba37a5c1451
```

---

### 2. Get Latest Price for Card
**GET** `/api/search/:id/prices/latest`

Returns the most recent price data for a specific card.

**Example:**
```bash
curl https://mtg-tracker.local/api/search/57b852b6-4388-4a41-a5c0-bba37a5c1451/prices/latest
```

---

### 3. Get Price History for Card
**GET** `/api/search/:id/prices`

Returns paginated price history for a specific card.

**Query Parameters:**
- `limit` (optional, default: 100, max: 1000) - Number of results per page
- `page` (optional, default: 1) - Page number

**Example:**
```bash
curl "https://mtg-tracker.local/api/search/57b852b6-4388-4a41-a5c0-bba37a5c1451/prices?limit=50&page=1"
```

---

### 4. Search Cards (Advanced)
**GET** `/api/search`

Search for cards using various filters. All parameters are optional and can be combined.

## Query Parameters

### Text Search (Fuzzy)
- `name` - Card name (partial match, case-insensitive)
- `type_line` - Card type line (partial match)
- `oracle_text` - Card rules text (partial match)
- `set_name` - Set name (partial match)
- `mana_cost` - Mana cost (partial match, e.g., "2U" finds "{2}{U}")

### Numeric Search
- `cmc` - Exact converted mana cost
- `cmc_min` - Minimum CMC (range search)
- `cmc_max` - Maximum CMC (range search)

### Exact Match
- `released_at` - Release date (YYYY-MM-DD format)
- `power` - Creature power
- `toughness` - Creature toughness
- `rarity` - Card rarity (common, uncommon, rare, mythic)
- `set_id` - Scryfall set UUID
- `set_code` - Set code (e.g., "blb", "tsp")

### Array Searches (Comma-separated)
- `colors` - Card colors (W, U, B, R, G)
- `color_identity` - Color identity (W, U, B, R, G)
- `keywords` - Card keywords (e.g., "Flying", "Trample")

### Legality Search
- `legality_format` - Format name (e.g., "standard", "modern", "commander")
- `legality_status` - Legal status (e.g., "legal", "banned", "restricted")

**Note:** Both `legality_format` and `legality_status` must be provided together.

### Print Handling
- `unique_prints` (optional, default: false) - Controls duplicate card handling
  - `false` (default) - Returns only one printing per unique card (grouped by `oracle_id`, selects most recent)
  - `true` - Returns all printings/versions of matching cards

**Note:** By default, the API groups cards by their `oracle_id` to avoid showing duplicate versions of the same card (e.g., Lightning Bolt from different sets). Use `unique_prints=true` to see all printings.

### Pagination
- `limit` (optional, default: 100, max: 1000) - Results per page
- `page` (optional, default: 1) - Page number

---

### 5. Get Trending Cards (Price Changes)
**GET** `/api/search/trending`

Returns cards with the greatest price changes over a specified timeframe.

**Query Parameters:**
- `timeframe` (optional, default: "24h") - Time period to analyze
  - `24h` - Last 24 hours
  - `7d` - Last 7 days
  - `30d` - Last 30 days
- `limit` (optional, default: 15, max: 100) - Number of results to return
- `priceType` (optional, default: "price_usd") - Which price to track
  - `price_usd` - Regular USD price
  - `price_usd_foil` - Foil USD price
  - `price_eur` - EUR price
- `direction` (optional, default: "increase") - Sort direction
  - `increase` - Cards with greatest price increases
  - `decrease` - Cards with greatest price decreases

**Examples:**
```bash
# Get top 15 price increases in last 24 hours
curl "https://mtg-tracker.local/api/search/trending"

# Get top 10 price decreases in last week
curl "https://mtg-tracker.local/api/search/trending?timeframe=7d&direction=decrease&limit=10"

# Track foil prices over 30 days
curl "https://mtg-tracker.local/api/search/trending?timeframe=30d&priceType=price_usd_foil"

# Find biggest gainers in the last month
curl "https://mtg-tracker.local/api/search/trending?timeframe=30d&direction=increase&limit=20"
```

**Response Format:**
```json
{
  "timeframe": "24h",
  "priceType": "price_usd",
  "direction": "increase",
  "count": 15,
  "cards": [
    {
      "card_id": "57b852b6-4388-4a41-a5c0-bba37a5c1451",
      "card_name": "Lightning Bolt",
      "current_price": 1.50,
      "old_price": 1.00,
      "price_change": 0.50,
      "percent_change": 50.0,
      "current_date": "2025-11-18T12:00:00.000Z",
      "comparison_date": "2025-11-17T12:00:00.000Z"
    }
  ],
  "timestamp": "2025-11-18T12:34:56.789Z"
}
```

---

## Example Queries

### Search by Name
```bash
# Find all cards with "Lightning" in the name (one per unique card)
curl "https://mtg-tracker.local/api/search?name=Lightning"

# Find all printings of cards with "Lightning" in the name
curl "https://mtg-tracker.local/api/search?name=Lightning&unique_prints=true"
```

### Search by Type
```bash
# Find all Legendary Creatures
curl "https://mtg-tracker.local/api/search?type_line=Legendary%20Creature"
```

### Search by CMC Range
```bash
# Find all cards with CMC between 3 and 5
curl "https://mtg-tracker.local/api/search?cmc_min=3&cmc_max=5"
```

### Search by Colors
```bash
# Find all blue and red cards
curl "https://mtg-tracker.local/api/search?colors=U,R"

# Find all mono-blue cards (only blue in color identity)
curl "https://mtg-tracker.local/api/search?color_identity=U"
```

### Search by Keywords
```bash
# Find all cards with Flying and Haste
curl "https://mtg-tracker.local/api/search?keywords=Flying,Haste"
```

### Search by Rarity and Set
```bash
# Find all mythic rares from Bloomburrow
curl "https://mtg-tracker.local/api/search?rarity=mythic&set_code=blb"
```

### Search by Oracle Text
```bash
# Find all cards that mention "exile"
curl "https://mtg-tracker.local/api/search?oracle_text=exile"
```

### Search by Power/Toughness
```bash
# Find all 2/2 creatures
curl "https://mtg-tracker.local/api/search?power=2&toughness=2"
```

### Search by Legality
```bash
# Find all cards legal in Standard
curl "https://mtg-tracker.local/api/search?legality_format=standard&legality_status=legal"

# Find all cards banned in Modern
curl "https://mtg-tracker.local/api/search?legality_format=modern&legality_status=banned"
```

### Complex Search with Pagination
```bash
# Find all blue mythic rares with CMC 3-5 that are legal in Commander, page 1
curl "https://mtg-tracker.local/api/search?color_identity=U&rarity=mythic&cmc_min=3&cmc_max=5&legality_format=commander&legality_status=legal&limit=50&page=1"
```

### Search by Mana Cost
```bash
# Find all cards with blue mana in their cost
curl "https://mtg-tracker.local/api/search?mana_cost=U"

# Find all cards with exactly {2}{U}{U}
curl "https://mtg-tracker.local/api/search?mana_cost=%7B2%7D%7BU%7D%7BU%7D"
```

---

## Response Format

### Card Search Response
```json
{
  "cards": [
    {
      "id": "57b852b6-4388-4a41-a5c0-bba37a5c1451",
      "name": "Lightning Bolt",
      "mana_cost": "{R}",
      "cmc": 1,
      "type_line": "Instant",
      "oracle_text": "Lightning Bolt deals 3 damage to any target.",
      "colors": ["R"],
      "color_identity": ["R"],
      "rarity": "common",
      "set_code": "lea",
      "set_name": "Limited Edition Alpha",
      "legalities": {
        "standard": "not_legal",
        "modern": "legal",
        "legacy": "legal",
        "vintage": "legal",
        "commander": "legal"
      }
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 100,
    "totalRecords": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "timestamp": "2025-11-17T12:34:56.789Z"
}
```

---

## Notes

### Color Codes
- `W` - White
- `U` - Blue
- `B` - Black
- `R` - Red
- `G` - Green

### Rarity Values
- `common`
- `uncommon`
- `rare`
- `mythic`

### Common Legality Formats
- `standard`
- `pioneer`
- `modern`
- `legacy`
- `vintage`
- `commander`
- `pauper`
- `historic`
- `alchemy`
- `brawl`

### Legality Status Values
- `legal`
- `not_legal`
- `banned`
- `restricted`

### Oracle ID Grouping (Duplicate Handling)

**Default Behavior** (`unique_prints=false` or omitted):
- Returns only ONE printing per unique card
- Groups by `oracle_id` (Scryfall's unique card identifier)
- Selects the most recent printing by `released_at` date
- Useful for card lookup and avoiding duplicates in search results

**Example:** Searching for "Lightning Bolt" returns 1 card (most recent printing)

**All Prints Mode** (`unique_prints=true`):
- Returns ALL printings/versions of matching cards
- Includes every set, art variation, and edition
- Useful for collectors tracking specific printings or comparing prices across versions

**Example:** Searching for "Lightning Bolt" with `unique_prints=true` returns 50+ cards (from Alpha, Beta, Revised, Modern Masters, etc.)

### Trending Cards Use Cases

**For Traders & Investors:**
- Monitor 24h price spikes to identify trending cards
- Track weekly trends to spot emerging meta shifts
- Compare foil vs non-foil price movements

**For Players:**
- Find budget alternatives (cards with price decreases)
- Identify when to buy or sell cards
- Track price history before major tournaments

**For Collectors:**
- Monitor high-value card price trends
- Track foil and special edition pricing
- Identify good times to complete sets

### Performance Tips
1. **Use indexes**: The database has indexes on `name`, `set_code`, `type_line`, `cmc`, and `color_identity`
2. **Limit results**: Use the `limit` parameter to reduce response size
3. **Specific searches**: More specific queries perform better (e.g., combining `set_code` with `name`)
4. **Avoid wildcards**: When possible, use exact matches instead of fuzzy searches
5. **Default grouping**: The default `unique_prints=false` performs better for general searches
6. **Trending queries**: Optimized with window functions for efficient price change calculations across 100k+ cards

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Limit cannot exceed 1000"
}
```

### 404 Not Found
```json
{
  "error": "Card not found",
  "id": "57b852b6-4388-4a41-a5c0-bba37a5c1451"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to search for cards",
  "message": "Database connection error"
}
```
