-- Migration: Add visibility column to decks
-- Service: deck
-- Description: Adds a visibility column to decks with values 'public', 'private', 'unlisted' and a default of 'public'

ALTER TABLE decks
  ADD COLUMN visibility ENUM('public','private','unlisted') NOT NULL DEFAULT 'public',
  ADD INDEX idx_visibility (visibility);
