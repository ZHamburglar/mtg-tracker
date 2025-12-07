/**
 * Hook to get the appropriate image URI for a card
 * Handles multi-faced cards by returning the first face image
 * @param {Object} card - The card object
 * @returns {string|null} The image URI or null if no image is available
 */
export const getCardImage = (card) => {
  if (!card) return null;
  
  // For multi-faced cards, use the first face image
  if (card.image_uri_png) return card.image_uri_png;
  if (card.image_uri_small) return card.image_uri_small;
  if (card.has_multiple_faces && card.card_faces?.[0]) {
    return card.card_faces[0].image_uri_png || card.card_faces[0].image_uri_small;
  }
  return null;
};