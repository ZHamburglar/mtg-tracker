import { useState, useEffect } from 'react';

/**
 * Hook to fetch and cache Scryfall mana symbology
 * Fetches once on mount and provides symbol-to-SVG mapping
 * @returns {Object} symbols - Map of symbol strings to SVG URIs
 */
export const useSymbology = () => {
  const [symbols, setSymbols] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSymbology = async () => {
      try {
        const response = await fetch('https://api.scryfall.com/symbology');
        const data = await response.json();
        
        // Create map: '{W}' -> 'https://svgs.scryfall.io/card-symbols/W.svg'
        const symbolMap = {};
        data.data.forEach(symbolData => {
          symbolMap[symbolData.symbol] = symbolData.svg_uri;
        });
        
        setSymbols(symbolMap);
      } catch (error) {
        console.error('Failed to fetch symbology:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSymbology();
  }, []);

  return { symbols, loading };
};
