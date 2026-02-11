const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createMaggiTestProduct, createParleTestProduct } = require('../helpers/productHelper');
const Product = require('../../src/models/Product');
const Bill = require('../../src/models/Bill');
const TemporaryProduct = require('../../src/models/TemporaryProduct');

describe('Bills API (Phase 2 Billing Module)', () => {
  let token, user, maggiProduct, parleProduct;

  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;

    // Create test products using helper
    maggiProduct = await createMaggiTestProduct(user._id);
    parleProduct = await createParleTestProduct(user._id);
  });

  // -----------------------------------------------------------
  // ✅ FLOW 1: CREATE BILL — HAPPY PATH
  // -----------------------------------------------------------
  describe('POST /api/bills - Happy Path', () => {
    it('should create bill with variation-based items and deduct stock', async () => {
      const maggiPacketVariation = maggiProduct.variations.find(v => v.variationName === 'Packet');
      const parlePieceVariation = parleProduct.variations.find(v => v.variationName === 'Piece');

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: "Ramesh Retailers",
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: maggiPacketVariation._id.toString(),
              quantity: 10,  // 10 packets
              pricePerUnit: 120
            },
            {
              productId: parleProduct._id.toString(),
              variationId: parlePieceVariation._id.toString(),
              quantity: 50,  // 50 pieces
              pricePerUnit: 2
            }
          ],
          discount: 0
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.billNumber).toBeDefined();
      expect(res.body.data.finalTotal).toBe(1300); // (10*120) + (50*2)

      // Check stock deduction
      const maggiAfter = await Product.findById(maggiProduct._id);
      const parleAfter = await Product.findById(parleProduct._id);

      expect(maggiAfter.currentStock).toBe(1200); // 1440 - (10 * 24) = 1440 - 240
      expect(parleAfter.currentStock).toBe(450);  // 500 - 50
    });

    it('should create bill with multiple variations of same product', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 120
            },
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 2,
              pricePerUnit: 700
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.finalTotal).toBe(2000); // (5*120) + (2*700)

      const maggiAfter = await Product.findById(maggiProduct._id);
      // 5 packets = 120 pieces, 2 cartons = 288 pieces
      expect(maggiAfter.currentStock).toBe(1032); // 1440 - 408
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 2: LINE TOTAL NEGOTIATION (PRICE ADJUSTMENT)
  // -----------------------------------------------------------
  describe('POST /api/bills - Line Total Negotiation', () => {
    it('should allow line total adjustment above cost price', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 10,
              pricePerUnit: 120,
              lineTotal: 1150  // Negotiated down from 1200
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.finalTotal).toBe(1150);
      
      // Check warning for below MSP
      expect(res.body.data.warnings).toBeDefined();
      const hasBelowMSPWarning = res.body.data.warnings.some(w => w.type === 'BELOW_MSP');
      expect(hasBelowMSPWarning).toBe(true);
    });

    it('should block line total adjustment below cost price', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
      // Cost per packet = 4.17 * 24 = 100.08

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 10,
              pricePerUnit: 120,
              lineTotal: 950  // Effective price = 95 per packet < cost 100.08
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot sell');
      expect(res.body.error).toContain('Cost price');
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 3: PRICE VALIDATION (COST PROTECTION)
  // -----------------------------------------------------------
  describe('POST /api/bills - Price Validation', () => {
    it('should block selling below cost price', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
      // Cost per packet = 4.17 * 24 = 100.08

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 95  // Below cost
            }
          ]
        });
    //   console.log(res);
      expect(res.status).toBe(400);
    //   expect(res.body.code).toBe('PRICE_BELOW_COST');
    });

    it('should warn but allow selling below MSP', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 110  // Below MSP (120) but above cost (100.08)
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.warnings).toBeDefined();
      
      const warning = res.body.data.warnings.find(w => w.type === 'BELOW_MSP');
      expect(warning).toBeDefined();
      expect(warning.details.msp).toBe(120);
      expect(warning.details.soldAt).toBe(110);
    });
  });

//   -----------------------------------------------------------
//   ✅ FLOW 4: BILL-LEVEL DISCOUNT VALIDATION
//   -----------------------------------------------------------
  describe('POST /api/bills - Bill-Level Discount', () => {
    it('should allow discount when total stays above cost', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 10,
              pricePerUnit: 120
            }
          ],
          discount: -50  // ₹50 off
        });

      expect(res.status).toBe(201);
      expect(res.body.data.finalTotal).toBe(1150); // 1200 - 50
    });

    it('should block discount when total goes below cost', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
      // Cost = 10 packets * 100.08 = 1000.8

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 10,
              pricePerUnit: 120
            }
          ],
          discount: -250  // Total becomes 950 < cost 1000.8
        });

      expect(res.status).toBe(400);
    //   expect(res.body.code).toBe('TOTAL_BELOW_COST');
      expect(res.body.error).toContain('below cost');
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 5: INSUFFICIENT STOCK (NON-BLOCKING WARNING)
  // -----------------------------------------------------------
  describe('POST /api/bills - Stock Warnings', () => {
    it('should warn but allow overselling (insufficient stock)', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');
      // Current stock: 1440 pieces = 10 cartons
      // Trying to sell: 15 cartons

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 15,  // More than available (10)
              pricePerUnit: 700
            }
          ]
        });

      expect(res.status).toBe(201); // ✅ Still succeeds!
      
      // Check warning
      const stockWarning = res.body.data.warnings.find(w => w.type === 'INSUFFICIENT_STOCK');
      expect(stockWarning).toBeDefined();
      expect(stockWarning.details.requested).toBe(15);
      expect(stockWarning.details.available).toBe(10);
      expect(stockWarning.details.willBeNegative).toBe(true);

      // Check negative stock
      const maggiAfter = await Product.findById(maggiProduct._id);
      expect(maggiAfter.currentStock).toBe(-720); // 1440 - (15 * 144)
    });
  });

//   // -----------------------------------------------------------
  // ✅ FLOW 6: TEMPORARY PRODUCTS (QUICK ADD)
  // -----------------------------------------------------------
  describe('POST /api/bills - Temporary Products', () => {
    it('should create bill with temporary product (not in system)', async () => {
      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              tempProductName: "New Biscuit XYZ",
              quantity: 5,
              pricePerUnit: 20
            }
          ]
        });

     

      expect(res.status).toBe(201);
      expect(res.body.data.finalTotal).toBe(100);
      console.log(res.body.data);
      expect(res.body.data.temporaryProductsCount).toBe(1);

      // Check temporary product created
      const tempProduct = await TemporaryProduct.findOne({
        userId: user._id,
        productName: "New Biscuit XYZ"
      });
      
      expect(tempProduct).toBeDefined();
      expect(tempProduct.totalQuantitySold).toBe(5);
      expect(tempProduct.totalRevenue).toBe(100);
      expect(tempProduct.isPendingSetup).toBe(true);
    });

    it('should aggregate multiple bills with same temporary product', async () => {
      // First bill
      await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { tempProductName: "Test Product", quantity: 5, pricePerUnit: 10 }
          ]
        });

      // Second bill
      await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { tempProductName: "Test Product", quantity: 3, pricePerUnit: 10 }
          ]
        });

      const tempProduct = await TemporaryProduct.findOne({
        userId: user._id,
        productName: "Test Product"
      });

      expect(tempProduct.totalQuantitySold).toBe(8); // 5 + 3
      expect(tempProduct.totalRevenue).toBe(80); // 50 + 30
      expect(tempProduct.billIds.length).toBe(2);
    });

    it('should allow mixed items (existing + temporary)', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 120
            },
            {
              tempProductName: "New Item",
              quantity: 10,
              pricePerUnit: 15
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.finalTotal).toBe(750); // 600 + 150
      expect(res.body.data.itemsCount).toBe(2);
      expect(res.body.data.temporaryProductsCount).toBe(1);
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 7: TRANSACTION ATOMICITY
  // -----------------------------------------------------------
  describe('POST /api/bills - Transaction Atomicity', () => {
    it('should rollback entire bill if one item fails validation', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 120
            },
            {
              productId: parleProduct._id.toString(),
              variationId: 'invalid-variation-id',  // ❌ Will fail
              quantity: 10,
              pricePerUnit: 20
            }
          ]
        });

      expect(res.status).toBe(400);

      // Stock should be unchanged (rollback)
      const maggiAfter = await Product.findById(maggiProduct._id);
      expect(maggiAfter.currentStock).toBe(1440); // Unchanged

      // No bills created
      const billCount = await Bill.countDocuments({ userId: user._id });
      expect(billCount).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 8: GET BILLS
  // -----------------------------------------------------------
  describe('GET /api/bills - Fetch Bills', () => {
    it('should fetch all bills for user', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      // Create 2 bills
      await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 120
            }
          ]
        });

      await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 3,
              pricePerUnit: 120
            }
          ]
        });

      const res = await request(app)
        .get('/api/bills')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(2);
    });

    it('should fetch single bill by ID', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      const createRes = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: "Test Customer",
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 120
            }
          ]
        });

      const billId = createRes.body.data.billId;

      const res = await request(app)
        .get(`/api/bills/${billId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.customerName).toBe("Test Customer");
      expect(res.body.data.items.length).toBe(1);
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 9: TODAY'S BILLS
  // -----------------------------------------------------------
  describe("GET /api/bills/today - Today's Bills", () => {
    it("should return today's bills with summary", async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      // Create a bill
      await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 120
            }
          ]
        });

      const res = await request(app)
        .get('/api/bills/today')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalBills).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.totalRevenue).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 10: VALIDATION ERRORS
  // -----------------------------------------------------------
  describe('POST /api/bills - Validation Errors', () => {
    it('should reject bill with no items', async () => {
      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: []
        });

      expect(res.status).toBe(400);
    });

    it('should reject bill with future date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          billDate: futureDate.toISOString(),
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 120
            }
          ]
        });

      expect(res.status).toBe(400);
    //   expect(res.body.error).toContain('future');
    });

    it('should reject item without productId or tempProductName', async () => {
      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              quantity: 5,
              pricePerUnit: 120
            }
          ]
        });

      expect(res.status).toBe(400);
    });

    it('should reject negative quantity', async () => {
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: -5,
              pricePerUnit: 120
            }
          ]
        });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 11: TEMPORARY PRODUCTS MANAGEMENT
  // -----------------------------------------------------------
  describe('GET /api/bills/temporary-products', () => {
    it('should fetch all pending temporary products', async () => {
      // Create bill with temp product
      await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { tempProductName: "Temp Item 1", quantity: 5, pricePerUnit: 10 }
          ]
        });

      const res = await request(app)
        .get('/api/bills/temporary-products')
        .set('Authorization', `Bearer ${token}`);
      console.log(res.body);
      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].productName).toBe("Temp Item 1");
      expect(res.body.data[0].isPendingSetup).toBe(true);
    });
  });

  describe('DELETE /api/bills/temporary-products/:id', () => {
    it('should delete temporary product', async () => {
      // Create temp product
      await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { tempProductName: "To Delete", quantity: 5, pricePerUnit: 10 }
          ]
        });

      const tempProduct = await TemporaryProduct.findOne({
        userId: user._id,
        productName: "To Delete"
      });

      const res = await request(app)
        .delete(`/api/bills/temporary-products/${tempProduct._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      // Verify deleted
      const deleted = await TemporaryProduct.findById(tempProduct._id);
      expect(deleted).toBeNull();
    });
  });
});