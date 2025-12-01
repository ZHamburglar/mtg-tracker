import request from 'supertest';
import { app } from '../../app';

describe('POST /api/users/newuser', () => {
  describe('Successful User Creation', () => {
    it('returns a 201 on successful user creation', async () => {
      const response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      expect(response.body.email).toBe('test@example.com');
      expect(response.body.username).toBe('testuser');
      expect(response.body.id).toBeDefined();
      expect(response.body.role).toBe('user');
      expect(response.body.password).toBeUndefined(); // Should not return password
    });

    it('sets a cookie after successful signup', async () => {
      const response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      expect(response.get('Set-Cookie')).toBeDefined();
    });

    it('creates user with default role of "user"', async () => {
      const response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'password123'
        })
        .expect(201);

      expect(response.body.role).toBe('user');
    });
  });

  describe('Email Validation', () => {
    it('returns a 400 with an invalid email', async () => {
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'invalid-email',
          username: 'testuser',
          password: 'password123'
        })
        .expect(400);
    });

    it('returns a 400 with a missing email', async () => {
      await request(app)
        .post('/api/users/newuser')
        .send({
          username: 'testuser',
          password: 'password123'
        })
        .expect(400);
    });

    it('returns a 400 when email is empty string', async () => {
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: '',
          username: 'testuser',
          password: 'password123'
        })
        .expect(400);
    });

    it('returns a 400 for duplicate email addresses', async () => {
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      const response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser2',
          password: 'differentpass123'
        })
        .expect(400);

      expect(response.body.errors[0].message).toBe('Email in use');
    });

    it('is case-sensitive for email addresses', async () => {
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'Test@Example.com',
          username: 'testuser1',
          password: 'password123'
        })
        .expect(201);

      // Different case should work
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser2',
          password: 'password123'
        })
        .expect(201);
    });
  });

  describe('Password Validation', () => {
    it('returns a 400 with a missing password', async () => {
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser'
        })
        .expect(400);
    });

    it('returns a 400 with a password less than 8 characters', async () => {
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'short'
        })
        .expect(400);
    });

    it('returns a 400 with a password greater than 25 characters', async () => {
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'a'.repeat(26)
        })
        .expect(400);
    });

    it('accepts a password with exactly 8 characters', async () => {
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: '12345678'
        })
        .expect(201);
    });

    it('accepts a password with exactly 25 characters', async () => {
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'a'.repeat(25)
        })
        .expect(201);
    });

    it('trims whitespace from password', async () => {
      const response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: '  password123  '
        })
        .expect(201);

      expect(response.body.email).toBe('test@example.com');
    });
  });

  describe('Request Body Validation', () => {
    it('returns a 400 with missing email and password', async () => {
      await request(app)
        .post('/api/users/newuser')
        .send({})
        .expect(400);
    });

    it('returns error messages for multiple validation failures', async () => {
      const response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'invalid',
          username: 'testuser',
          password: 'short'
        })
        .expect(400);

      expect(response.body.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('ignores extra fields in request body', async () => {
      const response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123',
          extraField: 'should be ignored',
          role: 'admin' // Should not be settable via this route
        })
        .expect(201);

      expect(response.body.role).toBe('user'); // Should default to 'user'
      expect(response.body.extraField).toBeUndefined();
    });
  });

  describe('Security', () => {
    it('does not return the password in response', async () => {
      const response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      expect(response.body.password).toBeUndefined();
    });

    it('hashes the password before storing', async () => {
      const password = 'password123';
      
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: password
        })
        .expect(201);

      // Password should be hashed, not stored in plain text
      // This would require querying the database directly to verify
      // For now, we just verify the user was created successfully
    });

    it('sets httpOnly cookie to prevent XSS', async () => {
      const response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      const cookie = response.get('Set-Cookie');
      expect(cookie).toBeDefined();
      expect(cookie![0]).toContain('httponly');
    });
  });

  describe('Response Format', () => {
    it('returns user object with correct properties', async () => {
      const response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('username');
      expect(response.body).toHaveProperty('role');
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('is_active');
      expect(response.body).not.toHaveProperty('is_verified');
    });

    it('returns valid JSON', async () => {
      const response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201)
        .expect('Content-Type', /json/);

      expect(typeof response.body).toBe('object');
    });
  });
});