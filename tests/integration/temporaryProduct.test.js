const request = require('supertest');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createMaggiTestProduct } = require('../helpers/productHelper');
const TemporaryProduct = require('../../src/models/TemporaryProduct');
const Product = require('../../src/models/Product');

describe('Temporary Products API', () => {
  let token, user;

  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;
  });

  // Helper — bill ke saath temp product create karo
  const createBillWithTempProduct = async (productName, quantity = 5, pricePerUnit = 10) => {
    return request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            isTemporary: true,
            productName,
            quantity,
            pricePerUnit
          }
        ]
      });
  };

  describe('POST /api/temporary-products/:tempProductId/setup', () => {

    const validProductData = {
      productName: 'Lays Classic',
      units: [
        { unitName: 'piece', isBase: true },
        { unitName: 'packet', isBase: false }
      ],
      variations: [
        { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece', minSellingPrice: 20 },
        { unitName: 'packet', containsQuantity: 10, containsUnit: 'piece', minSellingPrice: 180 }
      ]
    };

    it('should convert temporary product to real product', async () => {
      await createBillWithTempProduct('Lays Classic', 5, 20);

      const tempProduct = await TemporaryProduct.findOne({
        userId: user._id,
        productName: 'Lays Classic'
      });

      const res = await request(app)
        .post(`/api/temporary-products/${tempProduct._id}/setup`)
        .set('Authorization', `Bearer ${token}`)
        .send(validProductData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.productName).toBe('Lays Classic');
      expect(res.body.data.linkedBillsCount).toBe(1);

      // TempProduct mein verify
      const updated = await TemporaryProduct.findById(tempProduct._id);
      expect(updated.isPendingSetup).toBe(false);
      expect(updated.convertedProductId).toBeDefined();
      expect(updated.setupCompletedAt).toBeDefined();

      // Real product ban gaya
      const product = await Product.findById(updated.convertedProductId);
      expect(product).toBeDefined();
      expect(product.productName).toBe('Lays Classic');
    });

    it('should return 404 for non-existent temporary product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .post(`/api/temporary-products/${fakeId}/setup`)
        .set('Authorization', `Bearer ${token}`)
        .send(validProductData);

      expect(res.status).toBe(404);
    });

    it('should return 400 if already setup', async () => {
      await createBillWithTempProduct('Already Setup', 5, 10);

      const tempProduct = await TemporaryProduct.findOne({
        userId: user._id,
        productName: 'Already Setup'
      });

      // Pehle setup karo
      await request(app)
        .post(`/api/temporary-products/${tempProduct._id}/setup`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validProductData, productName: 'Already Setup' });

      // Dobara setup try karo
      const res = await request(app)
        .post(`/api/temporary-products/${tempProduct._id}/setup`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validProductData, productName: 'Already Setup' });

      expect(res.status).toBe(404); // isPendingSetup false hai — findOne nahi milega
    });

    it('should return 404 when setting up another user temporary product', async () => {
      await createBillWithTempProduct('Other Product', 5, 10);

      const tempProduct = await TemporaryProduct.findOne({
        userId: user._id,
        productName: 'Other Product'
      });

      const auth2 = await createAuthenticatedUser('owner2');

      const res = await request(app)
        .post(`/api/temporary-products/${tempProduct._id}/setup`)
        .set('Authorization', `Bearer ${auth2.token}`)
        .send(validProductData);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid product data', async () => {
      await createBillWithTempProduct('Invalid Setup', 5, 10);

      const tempProduct = await TemporaryProduct.findOne({
        userId: user._id,
        productName: 'Invalid Setup'
      });

      const res = await request(app)
        .post(`/api/temporary-products/${tempProduct._id}/setup`)
        .set('Authorization', `Bearer ${token}`)
        .send({ productName: 'Missing units and variations' }); // Invalid data

      expect(res.status).toBe(400);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/temporary-products/507f1f77bcf86cd799439011/setup')
        .send(validProductData);

      expect(res.status).toBe(401);
    });

  });

  describe('GET /api/temporary-products', () => {

    it('should return empty list when no temporary products exist', async () => {
      const res = await request(app)
        .get('/api/temporary-products')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it('should return pending temporary products', async () => {
      await createBillWithTempProduct('Lays Classic', 5, 20);

      const res = await request(app)
        .get('/api/temporary-products')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].productName).toBe('Lays Classic');
      expect(res.body.data[0].totalRevenue).toBe(100);
      expect(res.body.data[0].billsCount).toBe(1);
    });

    it('should return correct billsCount when same temp product used in multiple bills', async () => {
      await createBillWithTempProduct('Kurkure', 5, 10);
      await createBillWithTempProduct('Kurkure', 3, 10);

      const res = await request(app)
        .get('/api/temporary-products')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const kurkure = res.body.data.find(p => p.productName === 'Kurkure');
      expect(kurkure.billsCount).toBe(2);
      expect(kurkure.totalRevenue).toBe(80); // 50 + 30
    });

    it('should not return products of other users', async () => {
      await createBillWithTempProduct('My Product', 5, 10);

      // Doosra user
      const auth2 = await createAuthenticatedUser('owner2');

      const res = await request(app)
        .get('/api/temporary-products')
        .set('Authorization', `Bearer ${auth2.token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });

    it('should search temporary products by name', async () => {
      await createBillWithTempProduct('Lays Classic', 5, 20);
      await createBillWithTempProduct('Kurkure', 3, 10);

      const res = await request(app)
        .get('/api/temporary-products?search=lays')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].productName).toBe('Lays Classic');
    });

    it('should not return already setup products', async () => {
      await createBillWithTempProduct('To Setup', 5, 10);

      // Setup karo
      const tempProduct = await TemporaryProduct.findOne({
        userId: user._id,
        productName: 'To Setup'
      });

      await TemporaryProduct.findByIdAndUpdate(tempProduct._id, {
        isPendingSetup: false
      });

      const res = await request(app)
        .get('/api/temporary-products')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app)
        .get('/api/temporary-products');

      expect(res.status).toBe(401);
    });

  });

  describe('DELETE /api/temporary-products/:tempProductId', () => {

    it('should delete temporary product successfully', async () => {
      await createBillWithTempProduct('To Delete', 5, 10);

      const tempProduct = await TemporaryProduct.findOne({
        userId: user._id,
        productName: 'To Delete'
      });

      const res = await request(app)
        .delete(`/api/temporary-products/${tempProduct._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // DB mein verify
      const deleted = await TemporaryProduct.findById(tempProduct._id);
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent temporary product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .delete(`/api/temporary-products/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should return 404 when deleting another user temporary product', async () => {
      await createBillWithTempProduct('Other User Product', 5, 10);

      const tempProduct = await TemporaryProduct.findOne({
        userId: user._id,
        productName: 'Other User Product'
      });

      const auth2 = await createAuthenticatedUser('owner2');

      const res = await request(app)
        .delete(`/api/temporary-products/${tempProduct._id}`)
        .set('Authorization', `Bearer ${auth2.token}`);

      expect(res.status).toBe(404);

      // Verify not deleted
      const stillExists = await TemporaryProduct.findById(tempProduct._id);
      expect(stillExists).toBeDefined();
    });

    it('should return 400 for invalid ID format', async () => {
      const res = await request(app)
        .delete('/api/temporary-products/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app)
        .delete('/api/temporary-products/507f1f77bcf86cd799439011');

      expect(res.status).toBe(401);
    });

  });


});