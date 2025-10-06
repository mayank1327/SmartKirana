const request = require('supertest');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createTestProduct } = require('../helpers/testDb');

describe('Products API', () => {
  let token;
  let user;
  
  // Setup: Create authenticated user before each test
  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;
  });
  
  describe('POST /api/products', () => {
    
    it('should create product with valid data', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)  // Auth header
        .send({
          name: 'Whole Milk',
          category: 'dairy',
          costPrice: 40,
          sellingPrice: 60,
          currentStock: 100,
          minStockLevel: 10,
          unit: 'liter'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Whole Milk');
      expect(response.body.data.isLowStock).toBe(false);
    });
    
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/products')
        // No Authorization header
        .send({
          name: 'Milk',
          category: 'dairy',
          costPrice: 40,
          sellingPrice: 60
        });
      
      expect(response.status).toBe(401);
    });
    
    it('should reject invalid selling price (less than cost)', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Milk',
          category: 'dairy',
          costPrice: 60,
          sellingPrice: 40  // Less than cost!
        });
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('GET /api/products', () => {
    
    it('should return all active products', async () => {
      // Create test products
      await createTestProduct({ name: 'Milk' });
      await createTestProduct({ name: 'Bread' });
      await createTestProduct({ name: 'Inactive', isActive: false });
      
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2); // Only active
      expect(response.body.pagination).toBeDefined();
    });
    
    it('should filter by category', async () => {
      await createTestProduct({ name: 'Milk', category: 'dairy' });
      await createTestProduct({ name: 'Chips', category: 'snacks' });
      
      const response = await request(app)
        .get('/api/products?category=dairy')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Milk');
    });
  });
});