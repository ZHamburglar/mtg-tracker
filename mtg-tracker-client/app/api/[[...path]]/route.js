import { NextResponse } from 'next/server';
import { searchCards, getCardById, generatePriceHistory, generateFoilPriceHistory } from '@/lib/scryfall';
import { v4 as uuidv4 } from 'uuid';

// Helper to get user from session
async function getUserFromRequest(request) {
  const cookies = request.headers.get('cookie');
  if (!cookies) return null;
  
  const sessionTokenMatch = cookies.match(/session_token=([^;]+)/);
  if (!sessionTokenMatch) return null;
  
  const sessionToken = sessionTokenMatch[1];
  const db = await getDatabase();
  const session = await db.collection('user_sessions').findOne({ session_token: sessionToken });
  
  if (!session || new Date(session.expires_at) < new Date()) {
    return null;
  }
  
  const user = await db.collection('users').findOne({ id: session.user_id });
  return user;
}

// Auth endpoints
export async function POST(request) {
  const pathname = new URL(request.url).pathname;
  
  // Session creation
  if (pathname === '/api/auth/session') {
    try {
      const body = await request.json();
      const { id, email, name, picture, session_token } = body;
      
      const db = await getDatabase();
      
      // Check if user exists
      let user = await db.collection('users').findOne({ email });
      
      if (!user) {
        // Create new user
        user = {
          id: id || uuidv4(),
          email,
          name,
          picture,
          created_at: new Date()
        };
        await db.collection('users').insertOne(user);
      }
      
      // Create session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
      
      await db.collection('user_sessions').insertOne({
        id: uuidv4(),
        user_id: user.id,
        session_token,
        expires_at: expiresAt,
        created_at: new Date()
      });
      
      // Set cookie
      const response = NextResponse.json({ success: true });
      response.cookies.set('session_token', session_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      });
      
      return response;
    } catch (error) {
      console.error('Session creation error:', error);
      return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
    }
  }
  
  // Logout
  if (pathname === '/api/auth/logout') {
    try {
      const user = await getUserFromRequest(request);
      if (user) {
        const cookies = request.headers.get('cookie');
        const sessionTokenMatch = cookies?.match(/session_token=([^;]+)/);
        if (sessionTokenMatch) {
          const db = await getDatabase();
          await db.collection('user_sessions').deleteOne({ session_token: sessionTokenMatch[1] });
        }
      }
      
      const response = NextResponse.json({ success: true });
      response.cookies.delete('session_token');
      return response;
    } catch (error) {
      console.error('Logout error:', error);
      return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
    }
  }
  
  // Add to collection
  if (pathname === '/api/collection') {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const body = await request.json();
      const { cardId, cardData } = body;
      
      const db = await getDatabase();
      
      // Check if already in collection
      const existing = await db.collection('collections').findOne({
        user_id: user.id,
        cardId
      });
      
      if (existing) {
        return NextResponse.json({ message: 'Already in collection' });
      }
      
      await db.collection('collections').insertOne({
        id: uuidv4(),
        user_id: user.id,
        cardId,
        cardData,
        added_at: new Date()
      });
      
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Add to collection error:', error);
      return NextResponse.json({ error: 'Failed to add to collection' }, { status: 500 });
    }
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(request) {
  const pathname = new URL(request.url).pathname;
  const searchParams = new URL(request.url).searchParams;
  
  // Get current user
  if (pathname === '/api/auth/me') {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, picture: user.picture } });
    } catch (error) {
      console.error('Get user error:', error);
      return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
    }
  }
  
  // Search cards
  if (pathname === '/api/cards/search') {
    try {
      const query = searchParams.get('q');
      if (!query) {
        return NextResponse.json({ cards: [] });
      }
      
      const result = await searchCards(query);
      return NextResponse.json({ cards: result.data });
    } catch (error) {
      console.error('Card search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
  }
  
  // Get card by ID with price history
  if (pathname.startsWith('/api/cards/') && pathname !== '/api/cards/search') {
    try {
      const cardId = pathname.split('/api/cards/')[1];
      const card = await getCardById(cardId);
      
      // Generate mock price history
      let priceHistory = [];
      if (card.prices?.usd) {
        const regularHistory = generatePriceHistory(card.prices.usd);
        priceHistory = regularHistory;
      }
      
      if (card.prices?.usd_foil) {
        const foilHistory = generateFoilPriceHistory(card.prices.usd_foil);
        // Merge histories
        foilHistory.forEach((foil, index) => {
          if (priceHistory[index]) {
            priceHistory[index].usd_foil = foil.usd_foil;
          } else {
            priceHistory.push(foil);
          }
        });
      }
      
      return NextResponse.json({ card, priceHistory });
    } catch (error) {
      console.error('Get card error:', error);
      return NextResponse.json({ error: 'Failed to get card' }, { status: 500 });
    }
  }
  
  // Get user collection
  if (pathname === '/api/collection') {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const db = await getDatabase();
      const collection = await db.collection('collections')
        .find({ user_id: user.id })
        .sort({ added_at: -1 })
        .toArray();
      
      return NextResponse.json({ collection });
    } catch (error) {
      console.error('Get collection error:', error);
      return NextResponse.json({ error: 'Failed to get collection' }, { status: 500 });
    }
  }
  
  // Check if card in collection
  if (pathname.startsWith('/api/collection/check/')) {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ inCollection: false });
      }
      
      const cardId = pathname.split('/api/collection/check/')[1];
      const db = await getDatabase();
      const item = await db.collection('collections').findOne({
        user_id: user.id,
        cardId
      });
      
      return NextResponse.json({ inCollection: !!item });
    } catch (error) {
      console.error('Check collection error:', error);
      return NextResponse.json({ inCollection: false });
    }
  }
  
  // Default API info
  if (pathname === '/api') {
    return NextResponse.json({ 
      name: 'MTG Collection Tracker API',
      version: '1.0.0',
      endpoints: [
        'POST /api/auth/session',
        'GET /api/auth/me',
        'POST /api/auth/logout',
        'GET /api/cards/search',
        'GET /api/cards/:id',
        'GET /api/collection',
        'POST /api/collection',
        'GET /api/collection/check/:id',
        'DELETE /api/collection/:id'
      ]
    });
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(request) {
  const pathname = new URL(request.url).pathname;
  
  // Remove from collection
  if (pathname.startsWith('/api/collection/')) {
    try {
      const user = await getUserFromRequest(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const cardId = pathname.split('/api/collection/')[1];
      const db = await getDatabase();
      
      await db.collection('collections').deleteOne({
        user_id: user.id,
        cardId
      });
      
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Remove from collection error:', error);
      return NextResponse.json({ error: 'Failed to remove from collection' }, { status: 500 });
    }
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}