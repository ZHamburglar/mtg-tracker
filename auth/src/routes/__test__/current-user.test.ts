import request from 'supertest';
import { app } from '../../app';

describe('GET /api/users/currentuser', () => {
  describe('Authenticated User', () => {
    it('returns current user details when signed in', async () => {
      // Create and sign in a user
      const signupResponse = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      const cookie = signupResponse.get('Set-Cookie');

      const response = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', cookie!)
        .send()
        .expect(200);

      expect(response.body.currentUser).toBeDefined();
      expect(response.body.currentUser.email).toBe('test@example.com');
      expect(response.body.currentUser.id).toBeDefined();
    });

    it('includes user role in response', async () => {
      const signupResponse = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      const cookie = signupResponse.get('Set-Cookie');

      const response = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', cookie!)
        .send()
        .expect(200);

      expect(response.body.currentUser.role).toBeDefined();
      expect(response.body.currentUser.role).toBe('user');
    });

    it('maintains session across multiple requests', async () => {
      const signupResponse = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      const cookie = signupResponse.get('Set-Cookie');

      // First request
      await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', cookie!)
        .send()
        .expect(200);

      // Second request with same cookie
      const response = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', cookie!)
        .send()
        .expect(200);

      expect(response.body.currentUser).toBeDefined();
      expect(response.body.currentUser.email).toBe('test@example.com');
    });
  });

  describe('Unauthenticated User', () => {
    it('returns null when not signed in', async () => {
      const response = await request(app)
        .get('/api/users/currentuser')
        .send()
        .expect(200);

      expect(response.body.currentUser).toBeNull();
    });

    it('returns null with invalid cookie', async () => {
      const response = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', 'session=invalid')
        .send()
        .expect(200);

      expect(response.body.currentUser).toBeNull();
    });

    it('returns null after signout', async () => {
      // Sign up and get cookie
      const signupResponse = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      const cookie = signupResponse.get('Set-Cookie');

      // Verify signed in
      const beforeSignout = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', cookie!)
        .send()
        .expect(200);

      expect(beforeSignout.body.currentUser).toBeDefined();

      // Sign out
      const signoutResponse = await request(app)
        .post('/api/users/signout')
        .set('Cookie', cookie!)
        .send()
        .expect(200);

      const newCookie = signoutResponse.get('Set-Cookie');

      // Check currentuser after signout
      const afterSignout = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', newCookie!)
        .send()
        .expect(200);

      expect(afterSignout.body.currentUser).toBeNull();
    });
  });

  describe('Multiple Users', () => {
    it('returns correct user for each session', async () => {
      // Create first user
      const user1Response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'user1@example.com',
          username: 'user1',
          password: 'password123'
        })
        .expect(201);

      const user1Cookie = user1Response.get('Set-Cookie');

      // Create second user
      const user2Response = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'user2@example.com',
          username: 'user2',
          password: 'password123'
        })
        .expect(201);

      const user2Cookie = user2Response.get('Set-Cookie');

      // Check first user
      const user1Current = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', user1Cookie!)
        .send()
        .expect(200);

      expect(user1Current.body.currentUser.email).toBe('user1@example.com');

      // Check second user
      const user2Current = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', user2Cookie!)
        .send()
        .expect(200);

      expect(user2Current.body.currentUser.email).toBe('user2@example.com');
    });
  });

  describe('Response Format', () => {
    it('returns valid JSON', async () => {
      await request(app)
        .get('/api/users/currentuser')
        .send()
        .expect(200)
        .expect('Content-Type', /json/);
    });

    it('always has currentUser property', async () => {
      const response = await request(app)
        .get('/api/users/currentuser')
        .send()
        .expect(200);

      expect(response.body).toHaveProperty('currentUser');
    });

    it('does not expose sensitive user data', async () => {
      const signupResponse = await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123'
        })
        .expect(201);

      const cookie = signupResponse.get('Set-Cookie');

      const response = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', cookie!)
        .send()
        .expect(200);

      expect(response.body.currentUser.password).toBeUndefined();
      expect(response.body.currentUser).not.toHaveProperty('password');
    });
  });

  describe('JWT Token Validation', () => {
    it('rejects expired or malformed tokens', async () => {
      // Create a malformed cookie
      const response = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', 'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid')
        .send()
        .expect(200);

      expect(response.body.currentUser).toBeNull();
    });
  });
});
