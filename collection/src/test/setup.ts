import { UserCardCollection } from '../models/user-card-collection';

// Mock data storage
let mockUsers: any[] = [];
let mockUserCards: any[] = [];
let mockUserId = 1;
let mockUserCardId = 1;

// Mock mysql2/promise module
jest.mock('mysql2/promise', () => {
  return {
    createPool: () => ({
      query: async (sql: string, params?: any[]) => {
        const sqlLower = sql.toLowerCase().trim();

        // ========== USER OPERATIONS ==========
        
        // INSERT user
        if (sqlLower.startsWith('insert into users')) {
          const [email, password, role] = params || [];
          const existingUser = mockUsers.find(u => u.email === email);
          
          if (existingUser) {
            throw new Error('Duplicate entry');
          }

          const newUser = {
            id: mockUserId++,
            email,
            password,
            role: role || 'user',
            is_active: true,
            is_verified: false,
            created_at: new Date(),
            updated_at: new Date()
          };
          
          mockUsers.push(newUser);
          
          return [{ insertId: newUser.id }];
        }

        // SELECT user by id
        if (sqlLower.includes('select * from users where id = ?')) {
          const id = params?.[0];
          const user = mockUsers.find(u => u.id === id);
          return [user ? [user] : []];
        }

        // ========== USER CARD COLLECTION OPERATIONS ==========
        
        // INSERT or UPDATE card in collection (ON DUPLICATE KEY UPDATE)
        if (sqlLower.startsWith('insert into user_card_collection') && sqlLower.includes('on duplicate key update')) {
          const [user_id, card_id, quantity, finish_type] = params || [];
          
          const existing = mockUserCards.find(uc => 
            uc.user_id === user_id && 
            uc.card_id === card_id && 
            uc.finish_type === finish_type
          );

          if (existing) {
            // Update existing
            existing.quantity += quantity;
            existing.updated_at = new Date();
            return [{ affectedRows: 1, insertId: existing.id }];
          } else {
            // Insert new
            const newCard = {
              id: mockUserCardId++,
              user_id,
              card_id,
              quantity,
              finish_type,
              created_at: new Date(),
              updated_at: new Date()
            };
            mockUserCards.push(newCard);
            return [{ affectedRows: 1, insertId: newCard.id }];
          }
        }

        // SELECT card by user_id, card_id, finish_type
        if (sqlLower.includes('select * from user_card_collection') && 
            sqlLower.includes('where user_id = ?') && 
            sqlLower.includes('and card_id = ?') &&
            sqlLower.includes('and finish_type = ?')) {
          const [user_id, card_id, finish_type] = params || [];
          const card = mockUserCards.find(uc => 
            uc.user_id === user_id && 
            uc.card_id === card_id && 
            uc.finish_type === finish_type
          );
          return [card ? [card] : []];
        }

        // SELECT all cards for a user with pagination
        if (sqlLower.includes('select * from user_card_collection') &&
            sqlLower.includes('where user_id = ?') &&
            sqlLower.includes('order by created_at desc')) {
          const user_id = params?.[0];
          let userCards = mockUserCards.filter(uc => uc.user_id === user_id);

          // Filter by finish_type if specified
          if (sqlLower.includes('and finish_type = ?') && params && params.length > 1) {
            const finish_type = params[1];
            userCards = userCards.filter(uc => uc.finish_type === finish_type);
          }

          // Sort by created_at descending
          userCards = userCards.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          // Apply LIMIT and OFFSET (handles both ? params and literal values)
          if (sqlLower.includes('limit')) {
            const limitMatch = sqlLower.match(/limit\s+(\d+)/);
            const offsetMatch = sqlLower.match(/offset\s+(\d+)/);
            const limit = limitMatch && limitMatch[1] ? parseInt(limitMatch[1]) : 100;
            const offset = offsetMatch && offsetMatch[1] ? parseInt(offsetMatch[1]) : 0;
            userCards = userCards.slice(offset, offset + limit);
          }

          return [userCards];
        }

        // COUNT cards for a user
        if (sqlLower.includes('select count(*) as total from user_card_collection where user_id = ?')) {
          const user_id = params?.[0];
          let count = mockUserCards.filter(uc => uc.user_id === user_id).length;

          // Filter by finish_type if specified
          if (sqlLower.includes('and finish_type = ?') && params && params.length > 1) {
            const finish_type = params[1];
            count = mockUserCards.filter(uc => 
              uc.user_id === user_id && uc.finish_type === finish_type
            ).length;
          }

          return [[{ total: count }]];
        }

        // SELECT all finishes of a card for a user
        if (sqlLower.includes('select * from user_card_collection') &&
            sqlLower.includes('where user_id = ?') &&
            sqlLower.includes('and card_id = ?') &&
            !sqlLower.includes('and finish_type = ?')) {
          const [user_id, card_id] = params || [];
          const cards = mockUserCards.filter(uc => 
            uc.user_id === user_id && uc.card_id === card_id
          );
          return [cards];
        }

        // SELECT total quantity of a card across all finishes
        if (sqlLower.includes('select sum(quantity) as total') &&
            sqlLower.includes('from user_card_collection') &&
            sqlLower.includes('where user_id = ? and card_id = ?')) {
          const [user_id, card_id] = params || [];
          const cards = mockUserCards.filter(uc => 
            uc.user_id === user_id && uc.card_id === card_id
          );
          const total = cards.reduce((sum, card) => sum + card.quantity, 0);
          return [[{ total }]];
        }

        // SELECT collection stats - total cards and quantity
        if (sqlLower.includes('select') && 
            sqlLower.includes('count(*) as total_cards') &&
            sqlLower.includes('sum(quantity) as total_quantity') &&
            sqlLower.includes('from user_card_collection') &&
            sqlLower.includes('where user_id = ?')) {
          const user_id = params?.[0];
          const userCards = mockUserCards.filter(uc => uc.user_id === user_id);
          const totalCards = userCards.length;
          const totalQuantity = userCards.reduce((sum, card) => sum + card.quantity, 0);
          
          return [[{
            total_cards: totalCards,
            total_quantity: totalQuantity
          }]];
        }

        // SELECT stats by finish type
        if (sqlLower.includes('select') && 
            sqlLower.includes('finish_type') &&
            sqlLower.includes('count(*) as count') &&
            sqlLower.includes('sum(quantity) as quantity') &&
            sqlLower.includes('group by finish_type')) {
          const user_id = params?.[0];
          const userCards = mockUserCards.filter(uc => uc.user_id === user_id);
          
          // Group by finish_type
          const byFinish: Record<string, any> = {};
          userCards.forEach(uc => {
            if (!byFinish[uc.finish_type]) {
              byFinish[uc.finish_type] = { finish_type: uc.finish_type, count: 0, quantity: 0 };
            }
            byFinish[uc.finish_type].count++;
            byFinish[uc.finish_type].quantity += uc.quantity;
          });

          return [Object.values(byFinish)];
        }

        // UPDATE card quantity
        if (sqlLower.includes('update user_card_collection') &&
            sqlLower.includes('set quantity = ?') &&
            sqlLower.includes('where user_id = ? and card_id = ? and finish_type = ?')) {
          const [quantity, user_id, card_id, finish_type] = params || [];
          const cardIndex = mockUserCards.findIndex(uc => 
            uc.user_id === user_id && 
            uc.card_id === card_id && 
            uc.finish_type === finish_type
          );

          if (cardIndex !== -1) {
            mockUserCards[cardIndex].quantity = quantity;
            mockUserCards[cardIndex].updated_at = new Date();
            return [{ affectedRows: 1 }];
          }

          return [{ affectedRows: 0 }];
        }

        // DELETE card from collection
        if (sqlLower.startsWith('delete from user_card_collection')) {
          const [user_id, card_id, finish_type] = params || [];
          const initialLength = mockUserCards.length;
          
          mockUserCards = mockUserCards.filter(uc => 
            !(uc.user_id === user_id && 
              uc.card_id === card_id && 
              uc.finish_type === finish_type)
          );

          const deletedCount = initialLength - mockUserCards.length;
          return [{ affectedRows: deletedCount }];
        }

        return [[]];
      }
    })
  };
});

beforeAll(async () => {
  process.env.JWT_KEY = 'test-jwt-secret';
  
  // Set up mocked connection pool for UserCardCollection model
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool();
  UserCardCollection.setPool(pool);
});

beforeEach(() => {
  // Clear mock data before each test
  mockUsers.length = 0;
  mockUserCards.length = 0;
  mockUserId = 1;
  mockUserCardId = 1;
});

afterAll(async () => {
  // No cleanup needed for mocks
});

// Helper function to create a test user and get auth cookie
export const createTestUser = (email: string = 'test@test.com') => {
  const user = {
    id: mockUserId++,
    email,
    password: 'hashedpassword',
    role: 'user',
    is_active: true,
    is_verified: false,
    created_at: new Date(),
    updated_at: new Date()
  };
  mockUsers.push(user);
  
  // Create JWT token
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { id: user.id.toString(), email: user.email },
    process.env.JWT_KEY || 'test-jwt-secret'
  );
  
  // Create cookie session format that express-session expects
  const session = Buffer.from(JSON.stringify({ jwt: token })).toString('base64');
  const cookie = [`session=${session}`];
  
  return { user, token, cookie };
};

// Helper function to add a card to user's collection
export const addTestCardToCollection = (user_id: number, card_id: string, quantity: number = 1, finish_type: string = 'normal') => {
  const card = {
    id: mockUserCardId++,
    user_id,
    card_id,
    quantity,
    finish_type,
    created_at: new Date(),
    updated_at: new Date()
  };
  mockUserCards.push(card);
  return card;
};
