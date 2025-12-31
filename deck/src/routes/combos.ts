import express, { Request, Response } from 'express';
import axios from 'axios';
import { Deck } from '../models/deck';
import { DeckCard } from '../models/deck-card';
import { logger } from '../logger';

const router = express.Router();

/**
 * GET /api/deck/:id/combos
 * Checks the cards in a deck and sends them to Commander Spellbook API to get combos
 */
router.get(
  '/api/deck/:id/combos',
  async (req: Request, res: Response) => {
    try {
      const deckId = parseInt(String(req.params.id));

      // Find the deck and verify ownership
      const deck = await Deck.findById(deckId);
      if (!deck) {
        return res.status(404).json({ error: 'Deck not found' });
      }

      // Get all cards in the deck (mainboard only for now)
      const cards = await DeckCard.findByDeck(deckId);

      // Structure for Commander Spellbook API (only cards with valid name)
      const main = cards
        .filter(card => card.category === 'mainboard' && card.card?.name && card.card.name.trim())
        .map(card => (
          {
          card: card.card?.name,
          quantity: card.quantity
        }));
      const commanders = cards
        .filter(card => card.category === 'commander' && card.card?.name && card.card.name.trim())
        .map(card => ({
          card: card.card?.name,
          quantity: card.quantity
        }));

      const payload = { main, commanders };

      // Send request to Commander Spellbook API
      const apiUrl = 'https://backend.commanderspellbook.com/find-my-combos';
      const apiResponse = await axios.post(apiUrl, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      // Normalize included to an array (some API responses use object maps)
      let includedRaw = apiResponse.data.results?.included || [];
      let included: any[] = [];
      if (Array.isArray(includedRaw)) {
        included = includedRaw;
      } else if (includedRaw && typeof includedRaw === 'object') {
        included = Object.values(includedRaw);
      }

      // Aggregate bracketTags counts from included items
      const bracketTagsCount: Record<string, number> = {};
      if (Array.isArray(included)) {
        included.forEach((item: any) => {
          // Accept multiple possible field names and shapes from the external API
          const tags = item?.bracketTags ?? item?.bracketTag ?? item?.bracket_tags ?? item?.bracket_tag;
          if (!tags) return;

          if (Array.isArray(tags)) {
            tags.forEach((tag: any) => {
              const name = typeof tag === 'string' ? tag : (tag?.name ? String(tag.name) : null);
              if (name) {
                bracketTagsCount[name] = (bracketTagsCount[name] || 0) + 1;
              }
            });
            return;
          }

          if (typeof tags === 'string') {
            bracketTagsCount[tags] = (bracketTagsCount[tags] || 0) + 1;
            return;
          }

          // If tags is an object, try common shapes (e.g., { name: 'S' } or { tags: ['S'] })
          if (typeof tags === 'object') {
            if (tags.name && typeof tags.name === 'string') {
              bracketTagsCount[tags.name] = (bracketTagsCount[tags.name] || 0) + 1;
            } else if (Array.isArray(tags.tags)) {
              tags.tags.forEach((t: any) => {
                const name = typeof t === 'string' ? t : (t?.name ? String(t.name) : null);
                if (name) bracketTagsCount[name] = (bracketTagsCount[name] || 0) + 1;
              });
            }
          }
        });
      }

      // Return included count and a small sample to help debugging
      const includedCount = included.length;

      // Helper to strip image fields from a card object
      const stripCardImages = (card: any) => {
        if (!card || typeof card !== 'object') return card;
        const c = { ...card };
        // common image fields to remove
        [
          'imageUriFrontPng', 'imageUriBackPng', 'imageUriFrontLarge', 'imageUriFrontSmall', 'imageUriFrontNormal',
          'imageUriBackLarge', 'imageUriBackSmall', 'imageUriBackNormal', 'imageUriBackArtCrop', 'imageUriFrontArtCrop'
        ].forEach(f => { if (f in c) delete c[f]; });
        return c;
      };

      // Sanitize included items: remove `of` and strip images from nested cards
      const sanitizeItem = (item: any) => {
        if (!item || typeof item !== 'object') return item;
        const copy = { ...item };
        if ('of' in copy) delete copy.of;
        if (Array.isArray(copy.uses)) {
          copy.uses = copy.uses.map((u: any) => {
            if (u && u.card) {
              return { ...u, card: stripCardImages(u.card) };
            }
            return u;
          });
        }
        return copy;
      };

      const sanitizedIncluded = included.map(sanitizeItem);

      // Normalize and sanitize almostIncluded as well
      let almostIncludedRaw = apiResponse.data.results?.almostIncluded || [];
      let sanitizedAlmostIncluded: any[] = [];
      if (Array.isArray(almostIncludedRaw)) {
        sanitizedAlmostIncluded = almostIncludedRaw.map(sanitizeItem);
      } else if (almostIncludedRaw && typeof almostIncludedRaw === 'object') {
        sanitizedAlmostIncluded = Object.values(almostIncludedRaw).map(sanitizeItem);
      }

      res.status(200).json({
        count: includedCount,
        combos: sanitizedIncluded,
        almostIncluded: sanitizedAlmostIncluded,
        bracketTags: bracketTagsCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error checking combos for deck:', error);
      res.status(500).json({
        error: 'Failed to check combos',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export { router as comboRouter };
