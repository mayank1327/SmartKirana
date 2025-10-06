const request = require('supertest');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createTestProduct } = require('../helpers/testDb');
const Product = require('../../src/models/Product');
const StockMovement = require('../../src/models/StockMovement');

describe('Sales API (Transaction Tests)', () => {
  let token, user, product;
  
  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;
    
    product = await createTestProduct({
      name: 'Milk',
      currentStock: 100,
      sellingPrice: 60
    });
  });
  
  describe('POST /api/sales', () => {
    
    it('should create sale and reduce stock atomically', async () => {
      const response = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{
            productId: product._id.toString(),
            quantity: 10
          }],
          paymentMethod: 'cash'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      
      // Verify stock reduced
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct.currentStock).toBe(90); // 100 - 10
      
      // Verify stock movement created
      const movement = await StockMovement.findOne({ 
        product: product._id,
        reason: 'sale'
      });
      expect(movement).toBeDefined();
      expect(movement.quantity).toBe(10);
      expect(movement.movementType).toBe('OUT');
      expect(movement.previousStock).toBe(100);
      expect(movement.newStock).toBe(90);
    });
    
    it('should rollback on insufficient stock', async () => {
      const response = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{
            productId: product._id.toString(),
            quantity: 150  // More than available (100)
          }],
          paymentMethod: 'cash'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient stock');
      
      // Verify stock unchanged (transaction rolled back)
      const unchangedProduct = await Product.findById(product._id);
      expect(unchangedProduct.currentStock).toBe(100); // Still 100
      
      // Verify no movement created
      const movements = await StockMovement.find({ product: product._id });
      expect(movements.length).toBe(0);
    });
    
    it('should handle multi-item sale atomically', async () => {
      const product2 = await createTestProduct({
        name: 'Bread',
        currentStock: 50,
        costPrice: 15,
        sellingPrice: 30
      });
      
      const response = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { productId: product._id.toString(), quantity: 5 },
            { productId: product2._id.toString(), quantity: 3 }
          ],
          paymentMethod: 'cash'
        });
      
      expect(response.status).toBe(201);
      
      // Verify both products updated
      const updatedProduct1 = await Product.findById(product._id);
      const updatedProduct2 = await Product.findById(product2._id);
      expect(updatedProduct1.currentStock).toBe(95);
      expect(updatedProduct2.currentStock).toBe(47);
      
      // Verify 2 movements created
      const movements = await StockMovement.find({
        product: { $in: [product._id, product2._id] }
      });
      expect(movements.length).toBe(2);
    });
  });
});