const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');

describe('Authentication API', () => {
  // Har test se pehle DB clean karo
  // Isliye ki tests ek doosre pe depend na karein
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {

    it('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe('john@example.com');

      // DB mein actually bana ya nahi — verify karo
      const user = await User.findOne({ email: 'john@example.com' });
      expect(user).toBeDefined();
      expect(user.name).toBe('John Doe');
    });

    it('should reject registration with duplicate email', async () => {
      // Pehla user banao
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'John Doe', email: 'john@example.com', password: 'password123' });

      // Same email se dobara try karo
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Jane Doe', email: 'john@example.com', password: 'password456' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('User already exists');
    });
    
    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'John Doe', email: 'invalid-email', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'John Doe', email: 'john@example.com', password: '123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration when name is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'john@example.com', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'John Doe', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject registration when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'John Doe', email: 'john@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

  });

  describe('POST /api/auth/login', () => {

    // Login tests mein user pehle se hona chahiye
    // beforeEach se yeh kaam karein — ek registered user ready rakho
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ name: 'John Doe', email: 'john@example.com', password: 'password123' });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'john@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe('john@example.com');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'john@example.com', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject login when email is empty', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: '', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.email).toContain('Email is required');
    });

    it('should reject login when password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'john@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

  });

});