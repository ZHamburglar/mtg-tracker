import { User } from '../models/user';

// Mock user storage for testing
let mockUsers: any[] = [];
let mockUserId = 1;

// Mock mysql2/promise module
jest.mock('mysql2/promise', () => {
  return {
    createPool: () => ({
      query: async (sql: string, params?: any[]) => {
        const sqlLower = sql.toLowerCase().trim();

        // INSERT user
        if (sqlLower.startsWith('insert into users')) {
          const [email, password, role, username] = params || [];
          const existingUser = mockUsers.find(u => u.email === email);
          
          if (existingUser) {
            throw new Error('Duplicate entry');
          }

          const newUser = {
            id: mockUserId++,
            email,
            password,
            role: role || 'user',
            username,
            is_active: true,
            is_verified: false,
            created_at: new Date(),
            updated_at: new Date()
          };
          
          mockUsers.push(newUser);
          
          return [{ insertId: newUser.id }];
        }

        // SELECT by id
        if (sqlLower.includes('where id = ?')) {
          const id = params?.[0];
          const user = mockUsers.find(u => u.id === id);
          return [user ? [user] : []];
        }

        // SELECT by email
        if (sqlLower.includes('where email = ?')) {
          const email = params?.[0];
          const user = mockUsers.find(u => u.email === email);
          return [user ? [user] : []];
        }

        // SELECT all users
        if (sqlLower.includes('select * from users')) {
          return [mockUsers];
        }

        // UPDATE user
        if (sqlLower.startsWith('update users')) {
          const id = params?.[params.length - 1];
          const userIndex = mockUsers.findIndex(u => u.id === id);
          
          if (userIndex !== -1) {
            // Parse SET clause updates
            if (sqlLower.includes('email = ?')) {
              mockUsers[userIndex].email = params?.[0];
            }
            if (sqlLower.includes('password = ?')) {
              const passwordIndex = sqlLower.includes('email = ?') ? 1 : 0;
              mockUsers[userIndex].password = params?.[passwordIndex];
            }
            if (sqlLower.includes('username = ?')) {
              // Find the index of username parameter
              let usernameIndex = 0;
              if (sqlLower.includes('email = ?')) usernameIndex++;
              if (sqlLower.includes('password = ?')) usernameIndex++;
              mockUsers[userIndex].username = params?.[usernameIndex];
            }
            if (sqlLower.includes('role = ?')) {
              const roleIndex = params!.length - 2;
              mockUsers[userIndex].role = params?.[roleIndex];
            }
            if (sqlLower.includes('is_verified = ?')) {
              mockUsers[userIndex].is_verified = params?.[0];
            }
            if (sqlLower.includes('is_active = ?')) {
              mockUsers[userIndex].is_active = params?.[0];
            }
            mockUsers[userIndex].updated_at = new Date();
          }
          
          return [{ affectedRows: userIndex !== -1 ? 1 : 0 }];
        }

        // DELETE user
        if (sqlLower.startsWith('delete from users')) {
          const id = params?.[0];
          const userIndex = mockUsers.findIndex(u => u.id === id);
          
          if (userIndex !== -1) {
            mockUsers.splice(userIndex, 1);
            return [{ affectedRows: 1 }];
          }
          
          return [{ affectedRows: 0 }];
        }

        return [[]];
      }
    })
  };
});

beforeAll(async () => {
  process.env.JWT_KEY = 'test-jwt-secret';
  
  // Set up mocked connection pool for User model
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool();
  User.setPool(pool);
});

beforeEach(() => {
  // Clear mock users before each test
  mockUsers = [];
  mockUserId = 1;
});

afterAll(async () => {
  // No cleanup needed for mocks
});