const request = require('supertest');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createMaggiTestProduct, createParleTestProduct } = require('../helpers/productHelper');
const Product = require('../../src/models/Product');
const Purchase = require('../../src/models/Purchase');

describe('Reports API', () => {
  let token, user, maggiProduct, parleProduct;

  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;

    maggiProduct = await createMaggiTestProduct(user._id);
    parleProduct = await createParleTestProduct(user._id);
  });
  describe('GET /api/reports/dashboard', () => {

      it('should return dashboard stats with correct structure', async () => {
        const res = await request(app)
          .get('/api/reports/dashboard')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.todayBills).toBeDefined();
        expect(res.body.data.weeklyPurchases).toBeDefined();
        expect(res.body.data.stockAlerts).toBeDefined();
        expect(res.body.data.pendingTempProductsCount).toBeDefined();
      });

      it('should count low stock products correctly', async () => {
        // Maggi minStockLevel = 720, set to 500 — low stock
        await Product.findByIdAndUpdate(maggiProduct._id, { currentStock: 500 });

        const res = await request(app)
          .get('/api/reports/dashboard')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.stockAlerts.lowStockCount).toBe(1);
        expect(res.body.data.stockAlerts.outOfStockCount).toBe(0);
      });

      it('should count out of stock products correctly', async () => {
        await Product.findByIdAndUpdate(maggiProduct._id, { currentStock: 0 });

        const res = await request(app)
          .get('/api/reports/dashboard')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.stockAlerts.outOfStockCount).toBe(1);
        expect(res.body.data.stockAlerts.lowStockCount).toBe(0);
      });

      it('should show today revenue from bills', async () => {
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

        await request(app)
          .post('/api/bills')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 120
            }]
          });

        const res = await request(app)
          .get('/api/reports/dashboard')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.todayBills.totalBills).toBe(1);
        expect(res.body.data.todayBills.totalRevenue).toBe(600);
      });

      it('should show weekly purchases count', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

        await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: 576
            }]
          });

        const res = await request(app)
          .get('/api/reports/dashboard')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.weeklyPurchases.totalPurchases).toBe(1);
      });

      it('should only show data for authenticated user', async () => {
        const auth2 = await createAuthenticatedUser('owner2');

        const res = await request(app)
          .get('/api/reports/dashboard')
          .set('Authorization', `Bearer ${auth2.token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.stockAlerts.totalAlerts).toBe(0);
        expect(res.body.data.todayBills.totalBills).toBe(0);
      });

      it('should return 401 for unauthenticated request', async () => {
        const res = await request(app).get('/api/reports/dashboard');
        expect(res.status).toBe(401);
      });

  });

  describe('GET /api/reports/low-stock', () => {

    it('should return empty report when all stock is sufficient', async () => {
      // Maggi: 1440 pieces, minStockLevel: 720 — above minimum
      const res = await request(app)
        .get('/api/reports/low-stock')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.outOfStock.length).toBe(0);
      expect(res.body.data.lowStock.length).toBe(0);
      expect(res.body.data.summary.outOfStockCount).toBe(0);
      expect(res.body.data.summary.lowStockCount).toBe(0);
    });

    it('should detect out of stock products', async () => {
      await Product.findByIdAndUpdate(maggiProduct._id, { currentStock: 0 });

      const res = await request(app)
        .get('/api/reports/low-stock')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.outOfStock.length).toBe(1);
      expect(res.body.data.outOfStock[0].productName).toBe('Maggi Noodles');
      expect(res.body.data.summary.outOfStockCount).toBe(1);
    });

    it('should detect negative stock as out of stock', async () => {
      await Product.findByIdAndUpdate(maggiProduct._id, { currentStock: -144 });

      const res = await request(app)
        .get('/api/reports/low-stock')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.outOfStock.length).toBe(1);
    });

    it('should detect low stock products', async () => {
      // minStockLevel: 720, set to 500 — low stock
      await Product.findByIdAndUpdate(maggiProduct._id, { currentStock: 500 });

      const res = await request(app)
        .get('/api/reports/low-stock')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.lowStock.length).toBe(1);
      expect(res.body.data.lowStock[0].productName).toBe('Maggi Noodles');
      expect(res.body.data.summary.lowStockCount).toBe(1);
    });

    it('should return stockDisplay in response', async () => {
      await Product.findByIdAndUpdate(maggiProduct._id, { currentStock: 500 });

      const res = await request(app)
        .get('/api/reports/low-stock')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const product = res.body.data.lowStock[0];
      expect(product.stockDisplay).toBeDefined();
      expect(product.stockDisplay).toContain('3'); // 500/144 = 3 cartons
    });

    it('should show multiple products in correct categories', async () => {
      await Product.findByIdAndUpdate(maggiProduct._id, { currentStock: 0 });
      await Product.findByIdAndUpdate(parleProduct._id, {
        currentStock: 30,
        minStockLevel: 50
      });

      const res = await request(app)
        .get('/api/reports/low-stock')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.outOfStock.length).toBe(1);
      expect(res.body.data.lowStock.length).toBe(1);
    });

    it('should only show authenticated user products', async () => {
      await Product.findByIdAndUpdate(maggiProduct._id, { currentStock: 0 });

      const auth2 = await createAuthenticatedUser('owner2');

      const res = await request(app)
        .get('/api/reports/low-stock')
        .set('Authorization', `Bearer ${auth2.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.outOfStock.length).toBe(0);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app).get('/api/reports/low-stock');
      expect(res.status).toBe(401);
    });

  });

  describe('GET /api/reports/today-bills', () => {

    it('should return empty when no bills today', async () => {
      const res = await request(app)
        .get('/api/reports/today-bills')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalBills).toBe(0);
      expect(res.body.data.summary.totalRevenue).toBe(0);
      expect(res.body.data.bills.length).toBe(0);
    });

    it('should return correct summary and bills list', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: 'Ramesh',
          items: [{
            productId: maggiProduct._id.toString(),
            variationId: packetVar._id.toString(),
            quantity: 5,
            pricePerUnit: 120
          }]
        });

      await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{
            productId: maggiProduct._id.toString(),
            variationId: packetVar._id.toString(),
            quantity: 3,
            pricePerUnit: 120
          }]
        });

      const res = await request(app)
        .get('/api/reports/today-bills')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalBills).toBe(2);
      expect(res.body.data.summary.totalRevenue).toBe(960); // 600 + 360
      expect(res.body.data.bills.length).toBe(2);
      expect(res.body.data.bills[0].billNumber).toBeDefined();
    });

    it('should not return bills of other users', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{
            productId: maggiProduct._id.toString(),
            variationId: packetVar._id.toString(),
            quantity: 5,
            pricePerUnit: 120
          }]
        });

      const auth2 = await createAuthenticatedUser('owner2');

      const res = await request(app)
        .get('/api/reports/today-bills')
        .set('Authorization', `Bearer ${auth2.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalBills).toBe(0);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app).get('/api/reports/today-bills');
      expect(res.status).toBe(401);
    });

  });

  describe('GET /api/reports/weekly-purchases', () => {

    it('should return empty when no purchases this week', async () => {
      const res = await request(app)
        .get('/api/reports/weekly-purchases')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalPurchases).toBe(0);
      expect(res.body.data.purchases.length).toBe(0);
    });

    it('should return correct purchases list', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierName: 'Ram Distributors',
          items: [{
            productId: maggiProduct._id.toString(),
            variationId: cartonVar._id.toString(),
            quantity: 5,
            costPricePerUnit: 576
          }]
        });

      const res = await request(app)
        .get('/api/reports/weekly-purchases')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalPurchases).toBe(1);
      expect(res.body.data.purchases.length).toBe(1);
      expect(res.body.data.purchases[0].supplierName).toBe('Ram Distributors');
      expect(res.body.data.purchases[0].purchaseNumber).toBeDefined();
    });

    it('should not return purchases of other users', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{
            productId: maggiProduct._id.toString(),
            variationId: cartonVar._id.toString(),
            quantity: 5,
            costPricePerUnit: 576
          }]
        });

      const auth2 = await createAuthenticatedUser('owner2');

      const res = await request(app)
        .get('/api/reports/weekly-purchases')
        .set('Authorization', `Bearer ${auth2.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.totalPurchases).toBe(0);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app).get('/api/reports/weekly-purchases');
      expect(res.status).toBe(401);
    });

  });

});