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

### Pagination
- `limit` (optional, default: 100, max: 1000) - Results per page
- `page` (optional, default: 1) - Page number

---

## Example Queries

### Search by Name
```bash
# Find all cards with "Lightning" in the name
curl "https://mtg-tracker.local/api/search?name=Lightning"
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

### Performance Tips
1. **Use indexes**: The database has indexes on `name`, `set_code`, `type_line`, `cmc`, and `color_identity`
2. **Limit results**: Use the `limit` parameter to reduce response size
3. **Specific searches**: More specific queries perform better (e.g., combining `set_code` with `name`)
4. **Avoid wildcards**: When possible, use exact matches instead of fuzzy searches

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


General Search:
GET /api/search/:id

Search by prices:
GET /api/search/:id/prices
GET /api/search/:id/prices/latest
Prices with query params:
GET /api/search/:id/prices?limit=50&page=1
GET /api/search/:id/prices?limit=100&page=5