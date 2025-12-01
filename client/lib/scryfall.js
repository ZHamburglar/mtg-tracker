const SCRYFALL_API_BASE = 'https://api.scryfall.com';
const DELAY_MS = 100; // Scryfall rate limit

let lastRequestTime = 0;

async function rateLimitedFetch(url) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, DELAY_MS - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return fetch(url);
}

export async function searchCards(query) {
  try {
    const response = await rateLimitedFetch(
      `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return { data: [] };
      }
      throw new Error(`Scryfall API error: ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.data || [] };
  } catch (error) {
    console.error('Scryfall search error:', error);
    throw error;
  }
}

export async function getCardById(cardId) {
  try {
    const response = await rateLimitedFetch(
      `${SCRYFALL_API_BASE}/cards/${cardId}`
    );
    
    if (!response.ok) {
      throw new Error(`Scryfall API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Scryfall get card error:', error);
    throw error;
  }
}

// Generate mock price history for demonstration
export function generatePriceHistory(currentPrice, days = 30) {
  if (!currentPrice) {return [];}
  
  const price = parseFloat(currentPrice);
  const history = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Generate realistic price variation (±10% volatility)
    const variation = 1 + (Math.random() - 0.5) * 0.2;
    const dayPrice = price * variation;
    
    history.push({
      date: date.toISOString().split('T')[0],
      usd: parseFloat(dayPrice.toFixed(2)),
      usd_foil: null
    });
  }
  
  return history;
}

export function generateFoilPriceHistory(currentPrice, days = 30) {
  if (!currentPrice) {return [];}
  
  const price = parseFloat(currentPrice);
  const history = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Foil prices tend to be more volatile
    const variation = 1 + (Math.random() - 0.5) * 0.3;
    const dayPrice = price * variation;
    
    history.push({
      date: date.toISOString().split('T')[0],
      usd: null,
      usd_foil: parseFloat(dayPrice.toFixed(2))
    });
  }
  
  return history;
}