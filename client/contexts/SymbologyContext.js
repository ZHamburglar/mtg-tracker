'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const SymbologyContext = createContext({ symbols: {}, loading: true });

export const SymbologyProvider = ({ children }) => {
  const [symbols, setSymbols] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSymbology = async () => {
      try {
        const response = await fetch('/api/symbology');
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

  return (
    <SymbologyContext.Provider value={{ symbols, loading }}>
      {children}
    </SymbologyContext.Provider>
  );
};

export const useSymbology = () => {
  const context = useContext(SymbologyContext);
  if (!context) {
    throw new Error('useSymbology must be used within a SymbologyProvider');
  }
  return context;
};
