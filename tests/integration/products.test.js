const request = require('supertest');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createTestProduct } = require('../helpers/testDb');
const Product = require('../../src/models/Product');

describe('Products API', () => {

  let token;

  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    token = auth.token;
  });

  // ---------------------------------------------------------
  // ✅ FLOW 1 + FLOW 2 — CREATE PRODUCT
  // ---------------------------------------------------------
  describe('POST /api/products', () => {

    it('should create a product with valid data', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Whole Milk',
          unit: 'liter',
          costPrice: 40,
          minSellingPrice: 60,
          currentStock: 100,
          minStockLevel: 10
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Whole Milk');
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({ name: 'Milk', costPrice: 40 });
      
      expect(res.status).toBe(401);
    });

    it('should not allow duplicate product names', async () => {
      await createTestProduct({ name: 'Sugar' });

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sugar', costPrice: 20, minSellingPrice: 30 });

      expect(res.status).toBe(400);
    });

    it('should reject selling price < cost price', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Oil', costPrice: 100, minSellingPrice: 50 });

      expect(res.status).toBe(400);
    });

    it('should allow adding multiple products (bulk entry flow)', async () => {
      const names = ['p', 'q', 'r'];

      for (const name of names) {
        const res = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send({ name, unit:'c', costPrice: 10, minSellingPrice: 15, currentStock: 20, minStockLevel: 5 }); 

        expect(res.status).toBe(201);
      }

      const all = await Product.find({});
      expect(all.length).toBe(3);
    });
  });

  // ---------------------------------------------------------
  // ✅ FLOW 3 — GET ALL PRODUCTS + SEARCH + LOW STOCK + PAGINATION
  // ---------------------------------------------------------
  describe('GET /api/products', () => {

    beforeEach(async () => {
      await createTestProduct({ name: 'Maggi', currentStock: 5, minStockLevel: 10 });
      await createTestProduct({ name: 'Milk', currentStock: 50, minStockLevel: 10 });
    });

    it('should return all active products', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('should filter by search term', async () => {
      const res = await request(app)
        .get('/api/products?search=mag')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Maggi');
    });

    it('should return only low-stock products', async () => {
      const res = await request(app)
        .get('/api/products?lowstock=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Maggi');
    });

    it('should support pagination', async () => {
      await createTestProduct({ name: 'Item1' });
      await createTestProduct({ name: 'Item2' });
      await createTestProduct({ name: 'Item3' });

      const res = await request(app)
        .get('/api/products?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      console.log(res.body);
      expect(res.body.pagination.total).toBe(5);
    });
  });

  // ---------------------------------------------------------
  // ✅ FLOW 5 — GET PRODUCT DETAILS
  // ---------------------------------------------------------
  describe('GET /api/products/:id', () => {

    it('should return product by ID', async () => {
      const prod = await createTestProduct({ name: 'Rice' });

      const res = await request(app)
        .get(`/api/products/${prod._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Rice');
      expect(res.body.data.isLowStock).toBeDefined();
    });

    it('should return 404 for non-existing product', async () => {
      const fakeId = '674a8c8a8c8a8c8a8c8a8c8a';

      const res = await request(app)
        .get(`/api/products/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------
  // ✅ FLOW 4 — UPDATE PRODUCT
  // ---------------------------------------------------------
  describe('PUT /api/products/:id', () => {

    it('should update allowed fields', async () => {
      const prod = await createTestProduct({ name: 'Pepsi', unit: 'bottle' });

      const res = await request(app)
        .put(`/api/products/${prod._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ unit: 'can' });

      expect(res.status).toBe(200);
      expect(res.body.data.unit).toBe('can');
    });

    it('should prevent manual editing of currentStock', async () => {
      const prod = await createTestProduct({ name: 'Chips', currentStock: 20 });

      const res = await request(app)
        .put(`/api/products/${prod._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currentStock: 999 });

      expect(res.status).toBe(200);
      expect(res.body.data.currentStock).toBe(20);
    });

    it('should not allow renaming to duplicate name', async () => {
      await createTestProduct({ name: 'Tea' });
      const prod = await createTestProduct({ name: 'Coffee' });

      const res = await request(app)
        .put(`/api/products/${prod._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tea' });

      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------
  // ✅ FLOW 6 — SOFT DELETE
  // ---------------------------------------------------------
  describe('DELETE /api/products/:id', () => {

    it('should soft delete product', async () => {
      const prod = await createTestProduct({ name: 'Bread' });

      const res = await request(app)
        .delete(`/api/products/${prod._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const deleted = await Product.findById(prod._id);
      expect(deleted.isActive).toBe(false);
    });

    it('should hide inactive products from list', async () => {
      const prod = await createTestProduct({ name: 'Paneer' });

      await request(app)
        .delete(`/api/products/${prod._id}`)
        .set('Authorization', `Bearer ${token}`);

      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${token}`);

      const names = res.body.data.map(p => p.name);
      expect(names).not.toContain('Paneer');
    });
  });

});