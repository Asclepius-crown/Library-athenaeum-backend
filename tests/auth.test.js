import request from 'supertest';
import mongoose from 'mongoose';
import app from '../index.js'; // Import the configured Express app

describe('Auth Endpoints', () => {
  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should get a welcome message from the root API', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toEqual('Athenaeum backend API running');
  });

  // Example for a protected route (requires token, mock auth or proper setup)
  // it('should not allow access to /auth/me without a token', async () => {
  //   const res = await request(app).get('/api/auth/me');
  //   expect(res.statusCode).toEqual(401); // Assuming 401 Unauthorized for missing token
  // });

  // Add more specific tests for /register, /login, /change-password
  // These would typically involve mocking the User model and database interactions
  // to avoid actual database calls during unit/integration tests.
});
