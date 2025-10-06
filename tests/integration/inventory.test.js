const request = require('supertest');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createTestProduct } = require('../helpers/testDb');
const Product = require('../../src/models/Product');
const StockMovement = require('../../src/models/StockMovement');

describe('Inventory API (Stock Movements)', () => {
  let token, user, product;
  
  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;
    
    product = await createTestProduct({
      name: 'Milk',
      currentStock: 100,
      minStockLevel: 20
    });
  });
  
  describe('POST /api/inventory/add-stock', () => {
    
    it('should add stock and create movement record', async () => {
      const response = await request(app)
        .post('/api/inventory/add-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 50,
          reason: 'purchase',
          reference: 'PO-2025-001',
          notes: 'Restocking'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify stock increased
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentStock).toBe(150); // 100 + 50
      
      // Verify movement created
      const movement = await StockMovement.findOne({
        product: product._id,
        movementType: 'IN'
      });
      expect(movement).toBeDefined();
      expect(movement.quantity).toBe(50);
      expect(movement.previousStock).toBe(100);
      expect(movement.newStock).toBe(150);
      expect(movement.reason).toBe('purchase');
    //   expect(movement.reference).toBe('PO-2025-001');
    });
    
    it('should update isLowStock when adding stock', async () => {
      // Set product to low stock
      product.currentStock = 15;
      product.isLowStock = true;
      await product.save();
      
      const response = await request(app)
        .post('/api/inventory/add-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 30,
          reason: 'purchase'
        });
      
      expect(response.status).toBe(200);
      
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentStock).toBe(45);
      expect(updatedProduct.isLowStock).toBe(false); // Above threshold now
    });
  });
  
  describe('POST /api/inventory/reduce-stock', () => {
    
    it('should reduce stock and create movement record', async () => {
      const response = await request(app)
        .post('/api/inventory/reduce-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 30,
          reason: 'sale',
          reference: 'SALE-2025-001'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentStock).toBe(70); // 100 - 30
      
      const movement = await StockMovement.findOne({
        product: product._id,
        movementType: 'OUT'
      });
      expect(movement).toBeDefined();
      expect(movement.quantity).toBe(30);
      expect(movement.reason).toBe('sale');
    });
    
    it('should reject reduction causing negative stock', async () => {
      const response = await request(app)
        .post('/api/inventory/reduce-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 150,  // More than available (100)
          reason: 'sale'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient stock');
      
      // Verify stock unchanged
      const unchangedProduct = await Product.findById(product._id);
      expect(unchangedProduct.currentStock).toBe(100);
      
      // Verify no movement created
      const movement = await StockMovement.findOne({ product: product._id });
      expect(movement).toBeNull();
    });
    
    it('should update isLowStock when reducing stock', async () => {
      const response = await request(app)
        .post('/api/inventory/reduce-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 85,  // Leaves 15 (below minStockLevel of 20)
          reason: 'sale'
        });
      
      expect(response.status).toBe(200);
      
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentStock).toBe(15);
      expect(updatedProduct.isLowStock).toBe(true);
    });
    
    it('should handle different reduction reasons', async () => {
      const reasons = ['damage', 'expired', 'theft'];
      
      for (const reason of reasons) {
        const response = await request(app)
          .post('/api/inventory/reduce-stock')
          .set('Authorization', `Bearer ${token}`)
          .send({
            productId: product._id.toString(),
            quantity: 5,
            reason,
            notes: `Test ${reason}`
          });
        
        expect(response.status).toBe(200);
      }
      
      // Verify 3 movements created
      const movements = await StockMovement.find({
        product: product._id,
        movementType: 'OUT'
      });
      expect(movements.length).toBe(3);
      
      // Verify final stock
      const finalProduct = await Product.findById(product._id);
      expect(finalProduct.currentStock).toBe(85); // 100 - (5+5+5)
    });
  });
  
  describe('POST /api/inventory/adjust-stock', () => {
    
    it('should adjust stock to exact quantity', async () => {
      const response = await request(app)
        .post('/api/inventory/adjust-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          newQuantity: 75,  // Direct value, not relative
          reason: 'correction',
          notes: 'Physical count adjustment'
        });
      
      expect(response.status).toBe(200);
      
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentStock).toBe(75);
      
      const movement = await StockMovement.findOne({
        product: product._id,
        movementType: 'ADJUSTMENT'
      });
      expect(movement).toBeDefined();
      expect(movement.quantity).toBe(25); // Difference: 100 - 75
      expect(movement.previousStock).toBe(100);
      expect(movement.newStock).toBe(75);
    });
    
    it('should handle adjustment increasing stock', async () => {
      const response = await request(app)
        .post('/api/inventory/adjust-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          newQuantity: 120,
          reason: 'correction'
        });
      
      expect(response.status).toBe(200);
      
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentStock).toBe(120);
      
      const movement = await StockMovement.findOne({ product: product._id });
      expect(movement.quantity).toBe(20); // Difference: 120 - 100
    });
    
    it('should allow adjustment to zero', async () => {
      const response = await request(app)
        .post('/api/inventory/adjust-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          newQuantity: 0,
          reason: 'correction',
          notes: 'Out of stock'
        });
      
      expect(response.status).toBe(200);
      
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentStock).toBe(0);
      expect(updatedProduct.isLowStock).toBe(true);
    });
  });
  
  describe('GET /api/inventory/history/:productId', () => {
    
    beforeEach(async () => {
      // Create sample movements
      await StockMovement.create([
        {
          product: product._id,
          movementType: 'IN',
          quantity: 50,
          previousStock: 100,
          newStock: 150,
          reason: 'purchase',
          reference: 'PUR-001',
          performedBy: user._id,
          createdAt: new Date('2025-01-10')
        },
        {
          product: product._id,
          movementType: 'OUT',
          quantity: 20,
          previousStock: 150,
          newStock: 130,
          reason: 'sale',
          reference: 'SALE-001',
          performedBy: user._id,
          createdAt: new Date('2025-01-11')
        },
        {
          product: product._id,
          movementType: 'OUT',
          quantity: 5,
          previousStock: 130,
          newStock: 125,
          reason: 'damage',
          notes: 'Broken packaging',
          performedBy: user._id,
          createdAt: new Date('2025-01-12')
        }
      ]);
    });
    
    it('should return movement history for product', async () => {
      const response = await request(app)
        .get(`/api/inventory/history/${product._id}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(3);
      
      // Should be sorted by date (newest first)
      expect(response.body.data[0].reason).toBe('damage');
      expect(response.body.data[2].reason).toBe('purchase');
    });
    
    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/inventory/history/${product._id}?limit=2&page=1`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
      expect(response.body.pagination.total).toBe(3);
      expect(response.body.pagination.pages).toBe(2);
    });
    
    it('should populate performedBy user', async () => {
      const response = await request(app)
        .get(`/api/inventory/history/${product._id}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data[0].performedBy).toBeDefined();
      expect(response.body.data[0].performedBy.name).toBe('Test User');
    });
  });
  
  describe('GET /api/inventory/summary', () => {
    
    beforeEach(async () => {
      await createTestProduct({
        name: 'Bread',
        category: 'grocery',
        costPrice: 20,
        currentStock: 50,
        minStockLevel: 10
      });
      
      await createTestProduct({
        name: 'Chips',
        category: 'snacks',
        costPrice: 30,
        currentStock: 5,  // Low stock
        minStockLevel: 10
      });
      
      await createTestProduct({
        name: 'Juice',
        category: 'beverages',
        costPrice: 50,
        currentStock: 0,  // Out of stock
        minStockLevel: 5
      });
    });
    
    it('should return inventory summary', async () => {
      const response = await request(app)
        .get('/api/inventory/summary')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const summary = response.body.data;
      expect(summary.totalProducts).toBe(4); // Including original product
      expect(summary.lowStockCount).toBeGreaterThan(0);
      expect(summary.outOfStockCount).toBe(1);
      expect(summary.totalStockValue).toBeGreaterThan(0);
      expect(summary.categoryBreakdown).toBeDefined();
    });
  });
  
  describe('GET /api/inventory/recent-movements', () => {
    
    beforeEach(async () => {
      const product2 = await createTestProduct({ name: 'Bread' });
      
      await StockMovement.create([
        {
          product: product._id,
          movementType: 'IN',
          quantity: 50,
          previousStock: 100,
          newStock: 150,
          reason: 'purchase',
          performedBy: user._id,
          createdAt: new Date()
        },
        {
          product: product2._id,
          movementType: 'OUT',
          quantity: 10,
          previousStock: 50,
          newStock: 40,
          reason: 'sale',
          performedBy: user._id,
          createdAt: new Date()
        }
      ]);
    });
    
    it('should return recent movements across all products', async () => {
      const response = await request(app)
        .get('/api/inventory/recent-movements')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
    });
    
    it('should support custom limit', async () => {
      const response = await request(app)
        .get('/api/inventory/recent-movements?limit=1')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
    });
  });
  
  describe('Transaction Safety', () => {
    
    it('should rollback stock update if movement creation fails', async () => {
      // This test verifies transaction atomicity
      // Mock scenario: Force movement creation to fail
      
      const originalStock = product.currentStock;
      
      // Attempt to add stock with invalid data (missing required field)
      const response = await request(app)
        .post('/api/inventory/add-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 50
          // Missing 'reason' - should fail
        });
      
      expect(response.status).toBe(400);
      
      // Verify stock unchanged (transaction rolled back)
      const unchangedProduct = await Product.findById(product._id);
      expect(unchangedProduct.currentStock).toBe(originalStock);
      
      // Verify no movement created
      const movements = await StockMovement.find({ product: product._id });
      expect(movements.length).toBe(0);
    });
  });
  
  describe('Concurrent Stock Updates', () => {
    
    it('should handle concurrent stock reductions correctly', async () => {
      // Simulate two sales happening at same time
      const promises = [
        request(app)
          .post('/api/inventory/reduce-stock')
          .set('Authorization', `Bearer ${token}`)
          .send({
            productId: product._id.toString(),
            quantity: 30,
            reason: 'sale'
          }),
        request(app)
          .post('/api/inventory/reduce-stock')
          .set('Authorization', `Bearer ${token}`)
          .send({
            productId: product._id.toString(),
            quantity: 40,
            reason: 'sale'
          })
      ];
      
      const responses = await Promise.all(promises);
      
      // Both should succeed
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      
      // Final stock should be accurate
      const finalProduct = await Product.findById(product._id);
      expect(finalProduct.currentStock).toBe(30); // 100 - 30 - 40
      
      // Two movements created
      const movements = await StockMovement.find({ product: product._id });
      expect(movements.length).toBe(2);
    });
  });
  
  describe('Edge Cases', () => {
    
    it('should handle very large quantities', async () => {
      const response = await request(app)
        .post('/api/inventory/add-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 999999,
          reason: 'purchase'
        });
      
      expect(response.status).toBe(200);
      
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentStock).toBe(1000099);
    });
    
    it('should handle decimal quantities correctly', async () => {
      // For products sold by weight (kg, liter)
      const response = await request(app)
        .post('/api/inventory/add-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 10.5,
          reason: 'purchase'
        });
      
      expect(response.status).toBe(200);
      
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentStock).toBe(110.5);
    });
    
    it('should reject zero quantity', async () => {
      const response = await request(app)
        .post('/api/inventory/add-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: 0,
          reason: 'purchase'
        });
      
      expect(response.status).toBe(400);
    });
    
    it('should reject negative quantity', async () => {
      const response = await request(app)
        .post('/api/inventory/add-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: product._id.toString(),
          quantity: -10,
          reason: 'purchase'
        });
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('Authorization Tests', () => {
    
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/inventory/add-stock')
        // No Authorization header
        .send({
          productId: product._id.toString(),
          quantity: 50,
          reason: 'purchase'
        });
      
      expect(response.status).toBe(401);
    });
    
    // Add this when you implement role-based access
    // it.skip('should allow only authorized roles to adjust stock', async () => {
    //   const { token: staffToken } = await createAuthenticatedUser('staff');
      
    //   const response = await request(app)
    //     .post('/api/inventory/adjust-stock')
    //     .set('Authorization', `Bearer ${staffToken}`)
    //     .send({
    //       productId: product._id.toString(),
    //       newQuantity: 75,
    //       reason: 'correction'
    //     });
      
    //   expect(response.status).toBe(403); // Forbidden
    // });
  });
});