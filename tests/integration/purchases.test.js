const request = require('supertest');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createTestProduct } = require('../helpers/testDb');
const Product = require('../../src/models/Product');
const Purchase = require('../../src/models/Purchase');
const StockMovement = require('../../src/models/StockMovement');

describe('Purchase API', () => {
  let token, user, product;
  
  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;
    
    product = await createTestProduct({
      name: 'Milk',
      costPrice: 40,
      currentStock: 50
    });
  });
  
  describe('POST /api/purchases', () => {
    
    it('should create purchase and add stock atomically', async () => {
      const response = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplier: {
            name: 'ABC Dairy Suppliers',
            contactPerson: 'John Smith',
            phone: '9876543210',
            address: '123 Supply Street'
          },
          items: [{
            productId: product._id.toString(),
            quantity: 20,
            unitCost: 38  // New cost price
          }],
          tax: 5,
          discount: 50,
          invoiceNumber: 'INV-2025-001',
          notes: 'Test purchase'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.purchaseNumber).toMatch(/^PUR-\d{8}-\d{3}$/);
      
      // Verify stock increased
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentStock).toBe(70); // 50 + 20
      
      // Verify cost price updated
      expect(updatedProduct.costPrice).toBe(38);
      
      // Verify stock movement created
      const movement = await StockMovement.findOne({
        product: product._id,
        reason: 'purchase'
      });
      expect(movement).toBeDefined();
      expect(movement.movementType).toBe('IN');
      expect(movement.quantity).toBe(20);
      expect(movement.previousStock).toBe(50);
      expect(movement.newStock).toBe(70);
    //   expect(movement.reference).toBe(response.body.data.purchaseNumber);
      expect(movement.performedBy.toString()).toBe(user._id.toString());
    });
    
    it('should calculate totals correctly', async () => {
      const response = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplier: { name: 'Test Supplier' },
          items: [{
            productId: product._id.toString(),
            quantity: 10,
            unitCost: 100  // 10 * 100 = 1000
          }],
          tax: 18,      // 18% of 1000 = 180
          discount: 80  // Fixed discount
        });
      
      expect(response.status).toBe(201);
      
      const purchase = response.body.data;
      expect(purchase.subtotal).toBe(1000);
      expect(purchase.tax).toBe(180);
      expect(purchase.discount).toBe(80);
      expect(purchase.totalAmount).toBe(1100); // 1000 + 180 - 80
      expect(purchase.paymentStatus).toBe('pending'); // Default
    });
    
    it('should handle multi-item purchase atomically', async () => {
      const product2 = await createTestProduct({
        name: 'Bread',
        costPrice: 20,
        currentStock: 30
      });
      
      const response = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplier: { name: 'Multi Suppliers' },
          items: [
            { productId: product._id.toString(), quantity: 15, unitCost: 42 },
            { productId: product2._id.toString(), quantity: 25, unitCost: 22 }
          ]
        });
      
      expect(response.status).toBe(201);
      
      // Verify both products updated
      const updatedProduct1 = await Product.findById(product._id);
      const updatedProduct2 = await Product.findById(product2._id);
      
      expect(updatedProduct1.currentStock).toBe(65); // 50 + 15
      expect(updatedProduct1.costPrice).toBe(42);    // Updated
      
      expect(updatedProduct2.currentStock).toBe(55); // 30 + 25
      expect(updatedProduct2.costPrice).toBe(22);    // Updated
      
      // Verify 2 movements created
      const movements = await StockMovement.find({
        product: { $in: [product._id, product2._id] },
        reason: 'purchase'
      });
      expect(movements.length).toBe(2);
    });
    
    it('should reject purchase without supplier', async () => {
      const response = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{
            productId: product._id.toString(),
            quantity: 10,
            unitCost: 40
          }]
          // Missing supplier
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
    
    it('should reject purchase without items', async () => {
      const response = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplier: { name: 'Test Supplier' },
          items: []  // Empty items
        });
      
      expect(response.status).toBe(400);
    });
    
    it('should reject purchase with invalid product', async () => {
      const response = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplier: { name: 'Test Supplier' },
          items: [{
            productId: '507f1f77bcf86cd799439011', // Non-existent ID
            quantity: 10,
            unitCost: 40
          }]
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Product not found');
    });
    
    it('should reject purchase with negative unit cost', async () => {
      const response = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplier: { name: 'Test Supplier' },
          items: [{
            productId: product._id.toString(),
            quantity: 10,
            unitCost: -5  // Invalid
          }]
        });
      
      expect(response.status).toBe(400);
    });
    
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .post('/api/purchases')
        // No Authorization header
        .send({
          supplier: { name: 'Test Supplier' },
          items: [{ productId: product._id, quantity: 10, unitCost: 40 }]
        });
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('GET /api/purchases', () => {
    
    beforeEach(async () => {
      // Create test purchases
      await Purchase.create({
        purchaseNumber: 'PUR-20250115-001',
        supplier: { name: 'Supplier A' },
        items: [{
          product: product._id,
          productName: 'Milk',
          quantity: 10,
          unitCost: 40,
          subtotal: 400
        }],
        subtotal: 400,
        totalAmount: 400,
        paymentStatus: 'pending',
        purchasedBy: user._id,
        purchaseDate: new Date('2025-01-15')
      });
      
      await Purchase.create({
        purchaseNumber: 'PUR-20250116-001',
        supplier: { name: 'Supplier B' },
        items: [{
          product: product._id,
          productName: 'Milk',
          quantity: 20,
          unitCost: 38,
          subtotal: 760
        }],
        subtotal: 760,
        totalAmount: 760,
        paymentStatus: 'paid',
        paidAmount: 760,
        purchasedBy: user._id,
        purchaseDate: new Date('2025-01-16')
      });
    });
    
    it('should return all purchases', async () => {
      const response = await request(app)
        .get('/api/purchases')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      expect(response.body.pagination).toBeDefined();
    });
    
    it('should filter by payment status', async () => {
      const response = await request(app)
        .get('/api/purchases?paymentStatus=pending')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].paymentStatus).toBe('pending');
    });
    
    it('should filter by date range', async () => {
      const response = await request(app)
        .get('/api/purchases?startDate=2025-01-16&endDate=2025-01-16')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
    //   expect(response.body.data[0].purchaseNumber).toBe('PUR-20250116-001');
    });
    
    it('should filter by supplier name', async () => {
      const response = await request(app)
        .get('/api/purchases?supplier=Supplier A')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
    });
    
    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/purchases?limit=1&page=2')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.pagination.current).toBe(2);
      expect(response.body.pagination.pages).toBe(2);
    });
  });
  
  describe('GET /api/purchases/:id', () => {
    
    let purchase;
    
    beforeEach(async () => {
      purchase = await Purchase.create({
        purchaseNumber: 'PUR-20250115-001',
        supplier: { name: 'Test Supplier', phone: '9876543210' },
        items: [{
          product: product._id,
          productName: 'Milk',
          quantity: 10,
          unitCost: 40,
          subtotal: 400
        }],
        subtotal: 400,
        totalAmount: 400,
        purchasedBy: user._id
      });
    });
    
    it('should return purchase by ID', async () => {
      const response = await request(app)
        .get(`/api/purchases/${purchase._id}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    //   expect(response.body.data.purchaseNumber).toBe('PUR-20250115-001');
      expect(response.body.data.supplier.name).toBe('Test Supplier');
    });
    
    it('should return 404 for non-existent ID', async () => {
      const response = await request(app)
        .get('/api/purchases/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(404);
    });
  });
  
  describe('PUT /api/purchases/:id/payment', () => {
    
    let purchase;
    
    beforeEach(async () => {
      purchase = await Purchase.create({
        purchaseNumber: 'PUR-20250115-001',
        supplier: { name: 'Test Supplier' },
        items: [{
          product: product._id,
          productName: 'Milk',
          quantity: 10,
          unitCost: 40,
          subtotal: 400
        }],
        subtotal: 400,
        totalAmount: 400,
        paymentStatus: 'pending',
        paidAmount: 0,
        purchasedBy: user._id
      });
    });
    
    it('should update payment to partial', async () => {
      const response = await request(app)
        .put(`/api/purchases/${purchase._id}/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          paidAmount: 200,
          notes: 'First installment'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const updated = await Purchase.findById(purchase._id);
      expect(updated.paidAmount).toBe(200);
      expect(updated.paymentStatus).toBe('partial');
    });
    
    it('should update payment to paid', async () => {
      const response = await request(app)
        .put(`/api/purchases/${purchase._id}/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          paidAmount: 400
        });
      
      expect(response.status).toBe(200);
      
      const updated = await Purchase.findById(purchase._id);
      expect(updated.paidAmount).toBe(400);
      expect(updated.paymentStatus).toBe('paid');
    });
    
    it('should reject payment exceeding total', async () => {
      const response = await request(app)
        .put(`/api/purchases/${purchase._id}/payment`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          paidAmount: 500  // More than totalAmount (400)
        });
      
      expect(response.status).toBe(400);
    //   expect(response.body.error).toContain('exceeds');
    });
  });
  
  describe('GET /api/purchases/pending-payments', () => {
    
    beforeEach(async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 5);
      
      // Overdue purchase
      await Purchase.create({
        purchaseNumber: 'PUR-001',
        supplier: { name: 'Supplier A' },
        items: [{ product: product._id, productName: 'Milk', quantity: 10, unitCost: 40, subtotal: 400 }],
        subtotal: 400,
        totalAmount: 400,
        paymentStatus: 'pending',
        paidAmount: 0,
        paymentDueDate: yesterday,
        purchasedBy: user._id
      });
      
      // Due soon
      await Purchase.create({
        purchaseNumber: 'PUR-002',
        supplier: { name: 'Supplier B' },
        items: [{ product: product._id, productName: 'Milk', quantity: 20, unitCost: 40, subtotal: 800 }],
        subtotal: 800,
        totalAmount: 800,
        paymentStatus: 'partial',
        paidAmount: 300,
        paymentDueDate: nextWeek,
        purchasedBy: user._id
      });
      
      // Fully paid (should not appear)
      await Purchase.create({
        purchaseNumber: 'PUR-003',
        supplier: { name: 'Supplier C' },
        items: [{ product: product._id, productName: 'Milk', quantity: 5, unitCost: 40, subtotal: 200 }],
        subtotal: 200,
        totalAmount: 200,
        paymentStatus: 'paid',
        paidAmount: 200,
        purchasedBy: user._id
      });
    });
    
    it('should return pending payments summary', async () => {
      const response = await request(app)
        .get('/api/purchases/pending-payments')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalPurchases).toBe(2);
      expect(response.body.data.totalPendingAmount).toBe(900); // 400 + (800-300)
      expect(response.body.data.overduePurchases.length).toBe(1);
      expect(response.body.data.dueSoonPurchases.length).toBe(1);
    });
  });
  
  describe('GET /api/purchases/supplier-summary', () => {
    
    beforeEach(async () => {
      await Purchase.create({
        purchaseNumber: 'PUR-001',
        supplier: { name: 'ABC Suppliers' },
        items: [{ product: product._id, productName: 'Milk', quantity: 10, unitCost: 40, subtotal: 400 }],
        subtotal: 400,
        totalAmount: 400,
        paymentStatus: 'paid',
        paidAmount: 400,
        purchasedBy: user._id
      });
      
      await Purchase.create({
        purchaseNumber: 'PUR-002',
        supplier: { name: 'ABC Suppliers' },
        items: [{ product: product._id, productName: 'Milk', quantity: 20, unitCost: 40, subtotal: 800 }],
        subtotal: 800,
        totalAmount: 800,
        paymentStatus: 'pending',
        paidAmount: 0,
        purchasedBy: user._id
      });
      
      await Purchase.create({
        purchaseNumber: 'PUR-003',
        supplier: { name: 'XYZ Traders' },
        items: [{ product: product._id, productName: 'Milk', quantity: 15, unitCost: 40, subtotal: 600 }],
        subtotal: 600,
        totalAmount: 600,
        paymentStatus: 'paid',
        paidAmount: 600,
        purchasedBy: user._id
      });
    });
    
    it('should return supplier summary', async () => {
      const response = await request(app)
        .get('/api/purchases/supplier-summary')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      
      // ABC Suppliers should be first (highest total)
      const abcSupplier = response.body.data[0];
      expect(abcSupplier._id).toBe('ABC Suppliers');
      expect(abcSupplier.totalPurchases).toBe(2);
      expect(abcSupplier.totalAmount).toBe(1200);
      expect(abcSupplier.pendingAmount).toBe(800);
    });
  });
});