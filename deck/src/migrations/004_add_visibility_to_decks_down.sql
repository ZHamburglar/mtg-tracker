```sql
-- Migration: Remove visibility column from decks
-- Service: deck
-- Description: Reverts the addition of the visibility column on decks

ALTER TABLE decks
  DROP INDEX IF EXISTS idx_visibility,
  DROP COLUMN visibility;

```
