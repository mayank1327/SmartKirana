const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createMaggiTestProduct, createParleTestProduct } = require('../helpers/productHelper');
const Product = require('../../src/models/Product');
const Purchase = require('../../src/models/Purchase');

describe('Purchase API (Phase 2)', () => {
  let token, user, maggiProduct, parleProduct;

  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;

    // Create test products
    maggiProduct = await createMaggiTestProduct(user._id);
    parleProduct = await createParleTestProduct(user._id);
  });

  // -----------------------------------------------------------
  // ✅ FLOW 1: CREATE PURCHASE - HAPPY PATH (NO COST CHANGE)
  // -----------------------------------------------------------
  describe('POST /api/purchases - Happy Path (No Cost Change)', () => {
    it('should create purchase with variation and add stock correctly', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierName: "Ram Distributors",
          supplierBillNumber: "INV-2025-001",
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,  // 10 Cartons
              costPricePerUnit: 600  // ₹600 per Carton (same as current cost)
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.purchaseNumber).toBeDefined();

      // Check stock addition
      const maggiAfter = await Product.findById(maggiProduct._id);
      // 10 Cartons × 144 pieces = 1440 pieces added
      expect(maggiAfter.currentStock).toBe(2880); // 1440 + 1440

      // Cost price should remain same (₹600/144 = ₹4.17 per piece)
      expect(maggiAfter.costPricePerBaseUnit).toBeCloseTo(4.17, 2);

      // Check response includes stock updates
      expect(res.body.data.stockUpdates).toBeDefined();
      expect(res.body.data.stockUpdates[0].stockBefore).toBe(1440);
      expect(res.body.data.stockUpdates[0].stockAfter).toBe(2880);
    });

    it('should create purchase with multiple products', async () => {
      const maggiCarton = maggiProduct.variations.find(v => v.variationName === 'Carton');
      const parlePacket = parleProduct.variations.find(v => v.variationName === 'Packet');

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierName: "Wholesale Mart",
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: maggiCarton._id.toString(),
              quantity: 5,
              costPricePerUnit: 600
            },
            {
              productId: parleProduct._id.toString(),
              variationId: parlePacket._id.toString(),
              quantity: 20,
              costPricePerUnit: 15
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.totalAmount).toBe(3300); // (5*600) + (20*15)

      // Check both stocks updated
      const maggiAfter = await Product.findById(maggiProduct._id);
      const parleAfter = await Product.findById(parleProduct._id);

      expect(maggiAfter.currentStock).toBe(2160); // 1440 + (5*144)
      expect(parleAfter.currentStock).toBe(700);  // 500 + (20*10)
    });

    it('should create purchase with decimal quantity', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 2.5,  // 2.5 Cartons
              costPricePerUnit: 600
            }
          ]
        });

      expect(res.status).toBe(201);

      const maggiAfter = await Product.findById(maggiProduct._id);
      // 2.5 Cartons × 144 = 360 pieces added
      expect(maggiAfter.currentStock).toBe(1800); // 1440 + 360
    });

    it('should recover from negative stock', async () => {
      // Set negative stock (oversold scenario)
      await Product.findByIdAndUpdate(maggiProduct._id, { currentStock: -720 });

      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,
              costPricePerUnit: 600
            }
          ]
        });

      expect(res.status).toBe(201);

      const maggiAfter = await Product.findById(maggiProduct._id);
      // -720 + (10 * 144) = 720 pieces
      expect(maggiAfter.currentStock).toBe(720);
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 2: COST PRICE CHANGED - MSP REVIEW REQUIRED
  // -----------------------------------------------------------
  describe('POST /api/purchases - Cost Changed (MSP Review)', () => {
    it('should block purchase when cost increased and MSP below new cost', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');
      // Current cost: ₹600 per Carton (₹4.17 per piece)
      // Current MSP: Carton ₹700
      // New cost: ₹720 per Carton (₹5 per piece)
      // New MSP should be >= ₹720

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,
              costPricePerUnit: 720  // Cost increased!
            }
          ]
        });
      console.log
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MSP_REVIEW_REQUIRED');
      expect(res.body.details).toBeDefined();
      expect(res.body.details.mspSuggestions).toBeDefined();

      // Check MSP suggestions provided
      const suggestions = res.body.details.mspSuggestions;
      const cartonSuggestion = suggestions.find(s => s.variationName === 'Carton');
      
      expect(cartonSuggestion).toBeDefined();
      expect(cartonSuggestion.oldCost).toBeCloseTo(600, 2);
      expect(cartonSuggestion.newCost).toBe(720);
      expect(cartonSuggestion.currentMSP).toBe(700);
      expect(cartonSuggestion.suggestedMSP).toBeGreaterThan(700);
      expect(cartonSuggestion.status).toBe('below_cost');

      // Verify stock unchanged (purchase blocked)
      const maggiAfter = await Product.findById(maggiProduct._id);
      expect(maggiAfter.currentStock).toBe(1440); // Unchanged
    });

    it('should allow purchase when cost increased and MSPs updated', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');
      const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
      const pieceVar = maggiProduct.variations.find(v => v.variationName === 'Piece');

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,
              costPricePerUnit: 720  // Cost increased
            }
          ],
          costPriceChanges: [
            {
              productId: maggiProduct._id.toString(),
              variations: [
                {
                  variationId: pieceVar._id.toString(),
                  newMinSellingPrice: 6  // Updated from 5
                },
                {
                  variationId: packetVar._id.toString(),
                  newMinSellingPrice: 140  // Updated from 120
                },
                {
                  variationId: cartonVar._id.toString(),
                  newMinSellingPrice: 800  // Updated from 700
                }
              ]
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.data.costPriceUpdated).toBe(true);

      // Verify cost and MSPs updated
      const maggiAfter = await Product.findById(maggiProduct._id);
      expect(maggiAfter.costPricePerBaseUnit).toBe(5); // 720/144

      const cartonVarAfter = maggiAfter.variations.find(v => v.variationName === 'Carton');
      const packetVarAfter = maggiAfter.variations.find(v => v.variationName === 'Packet');
      const pieceVarAfter = maggiAfter.variations.find(v => v.variationName === 'Piece');

      expect(cartonVarAfter.minSellingPrice).toBe(800);
      expect(packetVarAfter.minSellingPrice).toBe(140);
      expect(pieceVarAfter.minSellingPrice).toBe(6);

      // Verify stock added
      expect(maggiAfter.currentStock).toBe(2880); // 1440 + 1440
    });

    it('should block if new MSP is below new cost', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,
              costPricePerUnit: 720
            }
          ],
          costPriceChanges: [
            {
              productId: maggiProduct._id.toString(),
              variations: [
                {
                  variationId: cartonVar._id.toString(),
                  newMinSellingPrice: 680  // Below new cost (720)!
                }
              ]
            }
          ]
        });

      expect(res.status).toBe(400);
      // expect(res.body.code).toBe('MSP_BELOW_COST');
      expect(res.body.error).toContain('Cannot set MSP');

      // Verify no changes
      const maggiAfter = await Product.findById(maggiProduct._id);
      expect(maggiAfter.currentStock).toBe(1440);
      expect(maggiAfter.costPricePerBaseUnit).toBeCloseTo(4.17, 2);
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 3: FIRST PURCHASE (NO EXISTING COST)
  // -----------------------------------------------------------
  describe('POST /api/purchases - First Purchase', () => {
    it('should set cost price on first purchase', async () => {
      // Create product with no cost
      const newProduct = await Product.create({
        userId: user._id,
        productName: 'New Product',
        baseUnit: {
          _id: new mongoose.Types.ObjectId(),
          unitName: 'piece'
        },
        units: [
          { _id: new mongoose.Types.ObjectId(), unitName: 'piece', isBaseUnit: true }
        ],
        variations: [
          {
            _id: new mongoose.Types.ObjectId(),
            unitId: new mongoose.Types.ObjectId(),
            variationName: 'Piece',
            containsQuantity: 1,
            containsUnitId: new mongoose.Types.ObjectId(),
            conversionToBase: 1,
            minSellingPrice: 10
          }
        ],
        costPricePerBaseUnit: null,  // No cost yet
        currentStock: 0,
        isActive: true
      });

      const pieceVar = newProduct.variations[0];

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: newProduct._id.toString(),
              variationId: pieceVar._id.toString(),
              quantity: 100,
              costPricePerUnit: 8
            }
          ]
        });

      expect(res.status).toBe(201);

      // Verify cost set
      const productAfter = await Product.findById(newProduct._id);
      expect(productAfter.costPricePerBaseUnit).toBe(8);
      expect(productAfter.currentStock).toBe(100);
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 4: GET PURCHASES
  // -----------------------------------------------------------
  describe('GET /api/purchases - Fetch Purchases', () => {
    beforeEach(async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      // Create 2 purchases
      await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierName: "XYZ Distributors",
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,
              costPricePerUnit: 600
            }
          ]
        });

      await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierName: "ABC Traders",
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: 600
            }
          ]
        });
    });

    it('should fetch all purchases', async () => {
      const res = await request(app)
        .get('/api/purchases')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter by supplier name', async () => {
      const res = await request(app)
        .get('/api/purchases?supplierName=XYZ')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].supplierName).toContain('XYZ');
    });

    it('should filter by product name', async () => {
      const res = await request(app)
        .get('/api/purchases?productName=Maggi')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const res = await request(app)
        .get(`/api/purchases?startDate=${today}&endDate=${today}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should fetch single purchase by ID', async () => {
      const allPurchases = await request(app)
        .get('/api/purchases')
        .set('Authorization', `Bearer ${token}`);

      const purchaseId = allPurchases.body.data[0].purchaseId;

      const res = await request(app)
        .get(`/api/purchases/${purchaseId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.purchaseId).toBe(purchaseId);
      expect(res.body.data.items).toBeDefined();
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 5: TODAY'S PURCHASES
  // -----------------------------------------------------------
  describe("GET /api/purchases/today - Today's Purchases", () => {
    it("should return today's purchases with summary", async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      // Create a purchase
      await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: 600
            }
          ]
        });

      const res = await request(app)
        .get('/api/purchases/today')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalPurchases).toBeGreaterThanOrEqual(1);
      expect(res.body.data.summary.totalAmount).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 6: VALIDATION ERRORS
  // -----------------------------------------------------------
  describe('POST /api/purchases - Validation Errors', () => {
    it('should reject purchase with no items', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: []
        });

      expect(res.status).toBe(400);
    });

    it('should reject purchase with future date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          purchaseDate: futureDate.toISOString(),
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: 600
            }
          ]
        });

      expect(res.status).toBe(400);
      // expect(res.body.error).toContain('future');
    });

    it('should reject negative quantity', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: -5,
              costPricePerUnit: 600
            }
          ]
        });

      expect(res.status).toBe(400);
    });

    it('should reject negative cost price', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: -600
            }
          ]
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid product ID', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: 'invalid-id',
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: 600
            }
          ]
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid variation ID', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: 'invalid-variation-id',
              quantity: 5,
              costPricePerUnit: 600
            }
          ]
        });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 7: TRANSACTION ATOMICITY
  // -----------------------------------------------------------
  describe('POST /api/purchases - Transaction Atomicity', () => {
    it('should rollback entire purchase if one item fails', async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            {
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: 600
            },
            {
              productId: parleProduct._id.toString(),
              variationId: 'invalid-variation',  // Will fail
              quantity: 10,
              costPricePerUnit: 15
            }
          ]
        });

      expect(res.status).toBe(400);

      // Verify stock unchanged (rollback)
      const maggiAfter = await Product.findById(maggiProduct._id);
      expect(maggiAfter.currentStock).toBe(1440); // Unchanged

      // No purchases created
      const purchaseCount = await Purchase.countDocuments({ userId: user._id });
      expect(purchaseCount).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // ✅ FLOW 8: PAGINATION
  // -----------------------------------------------------------
  describe('GET /api/purchases - Pagination', () => {
    beforeEach(async () => {
      const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

      // Create 5 purchases
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [
              {
                productId: maggiProduct._id.toString(),
                variationId: cartonVar._id.toString(),
                quantity: 1,
                costPricePerUnit: 600
              }
            ]
          });
      }
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/purchases?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.current).toBe(1);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(5);
    });
  });
});