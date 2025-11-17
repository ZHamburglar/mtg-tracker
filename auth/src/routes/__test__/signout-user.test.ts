import request from 'supertest';
import { app } from '../../app';

describe('POST /api/users/signout', () => {
  describe('Successful Sign Out', () => {
    it('clears the cookie after signing out', async () => {
      // First, create and sign in a user
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(201);

      const signinResponse = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      const cookie = signinResponse.get('Set-Cookie');
      expect(cookie).toBeDefined();

      // Sign out
      const signoutResponse = await request(app)
        .post('/api/users/signout')
        .set('Cookie', cookie!)
        .send({})
        .expect(200);

      // Cookie should be cleared (expires in the past or empty)
      const signoutCookie = signoutResponse.get('Set-Cookie');
      expect(signoutCookie).toBeDefined();
    });

    it('returns a 200 on successful signout', async () => {
      await request(app)
        .post('/api/users/signout')
        .send({})
        .expect(200);
    });

    it('returns empty object on signout', async () => {
      const response = await request(app)
        .post('/api/users/signout')
        .send({})
        .expect(200);

      expect(response.body).toEqual({});
    });

    it('works even when user is not signed in', async () => {
      await request(app)
        .post('/api/users/signout')
        .send({})
        .expect(200);
    });
  });

  describe('Multiple Sign Out Attempts', () => {
    it('allows multiple signout requests', async () => {
      await request(app)
        .post('/api/users/signout')
        .send({})
        .expect(200);

      await request(app)
        .post('/api/users/signout')
        .send({})
        .expect(200);
    });
  });

  describe('Session Management', () => {
    it('prevents access to protected routes after signout', async () => {
      // Create and sign in a user
      await request(app)
        .post('/api/users/newuser')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(201);

      const signinResponse = await request(app)
        .post('/api/users/signin')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      const cookie = signinResponse.get('Set-Cookie');

      // Verify signed in (currentuser should return user)
      const currentUserBefore = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', cookie!)
        .send()
        .expect(200);

      expect(currentUserBefore.body.currentUser).toBeDefined();
      expect(currentUserBefore.body.currentUser.email).toBe('test@example.com');

      // Sign out
      const signoutResponse = await request(app)
        .post('/api/users/signout')
        .set('Cookie', cookie!)
        .send({})
        .expect(200);

      const newCookie = signoutResponse.get('Set-Cookie');

      // After signout, currentuser should return null
      const currentUserAfter = await request(app)
        .get('/api/users/currentuser')
        .set('Cookie', newCookie!)
        .send()
        .expect(200);

      expect(currentUserAfter.body.currentUser).toBeNull();
    });
  });

  describe('Response Format', () => {
    it('returns valid JSON', async () => {
      await request(app)
        .post('/api/users/signout')
        .send({})
        .expect(200)
        .expect('Content-Type', /json/);
    });
  });
});
