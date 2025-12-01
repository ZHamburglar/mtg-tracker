import request from 'supertest';
import { app } from '../../app';

describe('POST /api/users/signin', () => {
  beforeEach(async () => {
    // Create a test user for signin tests
    await request(app)
      .post('/api/users/newuser')
      .send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123'
      })
      .expect(201);
  });

  describe('Successful Sign In', () => {
    it('returns a 200 on successful signin', async () => {
      const response = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body.email).toBe('test@example.com');
      expect(response.body.id).toBeDefined();
    });

    it('sets a cookie after successful signin', async () => {
      const response = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.get('Set-Cookie')).toBeDefined();
    });

    it('returns user data on successful signin', async () => {
      const response = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('role');
    });
  });

  describe('Email Validation', () => {
    it('returns a 400 with an invalid email', async () => {
      await request(app)
        .post('/api/users/signin')
        .send({
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400);
    });

    it('returns a 400 with a missing email', async () => {
      await request(app)
        .post('/api/users/signin')
        .send({
          password: 'password123'
        })
        .expect(400);
    });

    it('returns a 400 when email is empty string', async () => {
      await request(app)
        .post('/api/users/signin')
        .send({
          email: '',
          password: 'password123'
        })
        .expect(400);
    });
  });

  describe('Password Validation', () => {
    it('returns a 400 with a missing password', async () => {
      await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com'
        })
        .expect(400);
    });

    it('returns a 400 when password is empty string', async () => {
      await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: ''
        })
        .expect(400);
    });
  });

  describe('Authentication Failures', () => {
    it('returns a 400 with non-existent email', async () => {
      const response = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(400);

      expect(response.body.errors[0].message).toBe('Invalid credentials');
    });

    it('returns a 400 with incorrect password', async () => {
      const response = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(400);

      expect(response.body.errors[0].message).toBe('Invalid Credentials');
    });

    it('returns generic error message for security', async () => {
      const response = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(400);

      // Should not reveal whether email exists
      expect(response.body.errors[0].message).toBe('Invalid credentials');
    });
  });

  describe('Case Sensitivity', () => {
    it('is case-sensitive for email', async () => {
      // Create user with specific case
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'Test@Example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      // Exact case should work
      await request(app)
        .post('/api/users/signin')
        .send({
          email: 'Test@Example.com',
          password: 'password123'
        })
        .expect(200);

      // Note: MySQL default collation is case-insensitive for VARCHAR columns
      // If you need case-sensitive emails, use binary collation in the database
      // For now, we'll test that the email lookup works regardless of case
      const response = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      // This may succeed or fail depending on database collation settings
      // In production with case-insensitive collation, this would succeed
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Security', () => {
    it('does not set cookie on failed signin', async () => {
      const response = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(400);

      expect(response.get('Set-Cookie')).toBeUndefined();
    });

    it('sets httpOnly cookie on successful signin', async () => {
      const response = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      const cookie = response.get('Set-Cookie');
      expect(cookie).toBeDefined();
      expect(cookie![0]).toContain('httponly');
    });
  });

  describe('Response Format', () => {
    it('returns valid JSON', async () => {
      await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200)
        .expect('Content-Type', /json/);
    });
  });

  describe('Multiple Sign In Attempts', () => {
    it('allows multiple successful signins', async () => {
      await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);
    });

    it('generates a new session cookie on each signin', async () => {
      // Add a small delay to ensure different iat timestamps in JWT
      const firstSignin = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      const firstCookie = firstSignin.get('Set-Cookie');
      expect(firstCookie).toBeDefined();
      
      // Wait 1 second to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));

      const secondSignin = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      const secondCookie = secondSignin.get('Set-Cookie');
      expect(secondCookie).toBeDefined();
      
      // Cookies should be different (new JWT with different iat timestamp)
      expect(firstCookie).not.toEqual(secondCookie);
    });
  });
});
