const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createMaggiTestProduct, createParleTestProduct } = require('../helpers/productHelper');
const Product = require('../../src/models/Product');
const Bill = require('../../src/models/Bill');
const TemporaryProduct = require('../../src/models/TemporaryProduct');

describe('Bills API', () => {
  let token, user, maggiProduct, parleProduct;

  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;

    // Create test products using helper
    maggiProduct = await createMaggiTestProduct(user._id);
    parleProduct = await createParleTestProduct(user._id);
  });


  describe('POST /api/bills', () => {

    describe('Happy Path', () => {

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

      it('should create bill with 10 mixed items (regular + temporary)', async () => {
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');
        const pieceVar = maggiProduct.variations.find(v => v.variationName === 'Piece');
        const parlePacketVar = parleProduct.variations.find(v => v.variationName === 'Packet');
        const parlePieceVar = parleProduct.variations.find(v => v.variationName === 'Piece');
      
        const res = await request(app)
          .post('/api/bills')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customerName: 'Ramesh Retailers',
            items: [
              // Regular items — Maggi
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
              },
              {
                productId: maggiProduct._id.toString(),
                variationId: pieceVar._id.toString(),
                quantity: 10,
                pricePerUnit: 5
              },
              // Regular items — Parle
              {
                productId: parleProduct._id.toString(),
                variationId: parlePacketVar._id.toString(),
                quantity: 3,
                pricePerUnit: 20
              },
              {
                productId: parleProduct._id.toString(),
                variationId: parlePieceVar._id.toString(),
                quantity: 20,
                pricePerUnit: 2
              },
              // Temporary items
              {
                isTemporary: true,
                productName: 'Lays Classic',
                quantity: 10,
                pricePerUnit: 20
              },
              {
                isTemporary: true,
                productName: 'Kurkure',
                quantity: 5,
                pricePerUnit: 10
              },
              {
                isTemporary: true,
                productName: 'Frooti',
                quantity: 8,
                pricePerUnit: 15
              },
              {
                isTemporary: true,
                productName: 'Bisleri',
                quantity: 12,
                pricePerUnit: 20
              },
              {
                isTemporary: true,
                productName: 'Lays Classic', // Same temp product — aggregate hona chahiye
                quantity: 5,
                pricePerUnit: 20
              }
            ],
            discount: -50
          });

      
        expect(res.status).toBe(201);
        expect(res.body.data.itemsCount).toBe(10);
      
        // finalTotal calculate karo
        // Maggi: (5*120) + (2*700) + (10*5) = 600 + 1400 + 50 = 2050
        // Parle: (3*20) + (20*2) = 60 + 40 = 100
        // Temp: (10*20) + (5*10) + (8*15) + (12*20) + (5*20) = 200 + 50 + 120 + 240 + 100 = 710
        // subTotal = 2050 + 100 + 710 = 2860
        // discount = -50
        // finalTotal = 2810
        expect(res.body.data.finalTotal).toBe(2810);
      
        // Maggi stock check
        // 5 packets = 120, 2 cartons = 288, 10 pieces = 10 — total 418
        const maggiAfter = await Product.findById(maggiProduct._id);
        expect(maggiAfter.currentStock).toBe(1022); // 1440 - 418
      
        // Parle stock check
        // 3 packets = 30, 20 pieces = 20 — total 50
        const parleAfter = await Product.findById(parleProduct._id);
        expect(parleAfter.currentStock).toBe(450); // 500 - 50
      
        // Temp products check — Lays Classic aggregate hona chahiye
        const lays = await TemporaryProduct.findOne({
          userId: user._id,
          productName: 'Lays Classic'
        });
        
        expect(lays.totalRevenue).toBe(300);     // 200 + 100
      
        // Alag temp products
        const kurkure = await TemporaryProduct.findOne({ userId: user._id, productName: 'Kurkure' });
        expect(kurkure).toBeDefined();
      
        const frooti = await TemporaryProduct.findOne({ userId: user._id, productName: 'Frooti' });
        expect(frooti).toBeDefined();
      });

    });

    describe('Line Total Negotiation', () => {
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

    describe('Price Validation', () => {
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

    describe('Bill-Level Discount', () => {
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

    describe('Stock Warnings', () => {
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

    describe('Temporary Products', () => {
      it('should create bill with temporary product (not in system)', async () => {
        const res = await request(app)
          .post('/api/bills')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [
              {
                isTemporary: true,
                productName: "New Biscuit XYZ",
                quantity: 5,
                pricePerUnit: 20
              }
            ]
          });

      

        expect(res.status).toBe(201);
        expect(res.body.data.finalTotal).toBe(100);

        // Check temporary product created
        const tempProduct = await TemporaryProduct.findOne({
          userId: user._id,
          productName: "New Biscuit XYZ"
        });
        
        expect(tempProduct).toBeDefined();

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
              {  isTemporary: true, productName: "Test Product", quantity: 5, pricePerUnit: 10 }
            ]
          });

        // Second bill
        await request(app)
          .post('/api/bills')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [
              { isTemporary: true, productName: "Test Product", quantity: 3, pricePerUnit: 10 }
            ]
          });

        const tempProduct = await TemporaryProduct.findOne({
          userId: user._id,
          productName: "Test Product"
        });

      
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
                isTemporary: true,
                productName: "New Item",
                quantity: 10,
                pricePerUnit: 15
              }
            ]
          });

        expect(res.status).toBe(201);
        expect(res.body.data.finalTotal).toBe(750); // 600 + 150
        expect(res.body.data.itemsCount).toBe(2);
      });
    });

    describe('Transaction Atomicity', () => {
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

    describe('Validation Errors', () => {
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
  })

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

      it('should not return bills of other users', async () => {
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
      
        // Pehle user ka bill
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
      
        // Doosra user
        const auth2 = await createAuthenticatedUser('owner2');
      
        const res = await request(app)
          .get('/api/bills')
          .set('Authorization', `Bearer ${auth2.token}`);
      
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
      });
      
      it('should filter bills by date range', async () => {
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
      
        const today = new Date().toISOString().slice(0, 10);
      
        const res = await request(app)
          .get(`/api/bills?startDate=${today}&endDate=${today}`)
          .set('Authorization', `Bearer ${token}`);
      
        expect(res.status).toBe(200);
        expect(res.body.count).toBeGreaterThanOrEqual(1);
      });
      
      it('should filter bills by customer name', async () => {
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
      
        await request(app)
          .post('/api/bills')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customerName: 'Ramesh Retailers',
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
            customerName: 'Suresh Store',
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 3,
              pricePerUnit: 120
            }]
          });
      
        const res = await request(app)
          .get('/api/bills?customerName=ramesh')
          .set('Authorization', `Bearer ${token}`);
      
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].customerName).toBe('Ramesh Retailers');
      });
      
      it('should paginate bills correctly', async () => {
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
      
        // 3 bills create karo
        for (let i = 0; i < 3; i++) {
          await request(app)
            .post('/api/bills')
            .set('Authorization', `Bearer ${token}`)
            .send({
              items: [{
                productId: maggiProduct._id.toString(),
                variationId: packetVar._id.toString(),
                quantity: 1,
                pricePerUnit: 120
              }]
            });
        }
      
        const res = await request(app)
          .get('/api/bills?page=1&limit=2')
          .set('Authorization', `Bearer ${token}`);
      
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(2);
        expect(res.body.pagination.total).toBe(3);
        expect(res.body.pagination.pages).toBe(2);
      });
      
      it('should return 401 for unauthenticated request', async () => {
        const res = await request(app)
          .get('/api/bills');
      
        expect(res.status).toBe(401);
      });
  });

  describe('GET /api/bills/:billId', () => {

      it('should return complete bill details by ID', async () => {
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
    
        const createRes = await request(app)
          .post('/api/bills')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customerName: 'Ramesh Retailers',
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 120
            }],
            discount: -50
          });
    
        const billId = createRes.body.data.billId;
    
        const res = await request(app)
          .get(`/api/bills/${billId}`)
          .set('Authorization', `Bearer ${token}`);
    
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.billNumber).toBeDefined();
        expect(res.body.data.customerName).toBe('Ramesh Retailers');
        expect(res.body.data.items.length).toBe(1);
        expect(res.body.data.subTotal).toBe(600);
        expect(res.body.data.discount).toBe(-50);
        expect(res.body.data.finalTotal).toBe(550);
      });
    
      it('should return correct item details', async () => {
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
    
        const createRes = await request(app)
          .post('/api/bills')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: packetVar._id.toString(),
              quantity: 5,
              pricePerUnit: 120,
              lineTotal: 550  // Adjusted
            }]
          });
    
        const billId = createRes.body.data.billId;
    
        const res = await request(app)
          .get(`/api/bills/${billId}`)
          .set('Authorization', `Bearer ${token}`);
    
        expect(res.status).toBe(200);
        const item = res.body.data.items[0];
        expect(item.productName).toBe('Maggi Noodles');
        expect(item.variationName).toBe('Packet');
        expect(item.quantity).toBe(5);
        expect(item.pricePerUnit).toBe(120);
        expect(item.effectivePricePerUnit).toBe(110); // 550 / 5
        expect(item.lineTotal).toBe(550);
        expect(item.isTemporary).toBe(false);
      });
    
      it('should show isTemporary true for temp items', async () => {
        const createRes = await request(app)
          .post('/api/bills')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              isTemporary: true,
              productName: 'Lays Classic',
              quantity: 5,
              pricePerUnit: 20
            }]
          });
    
        const billId = createRes.body.data.billId;
    
        const res = await request(app)
          .get(`/api/bills/${billId}`)
          .set('Authorization', `Bearer ${token}`);
    
        expect(res.status).toBe(200);
        const item = res.body.data.items[0];
        expect(item.productName).toBe('Lays Classic');
        expect(item.isTemporary).toBe(true);
        expect(item.variationName).toBeNull();
      });
    
      it('should return 404 for non-existent bill', async () => {
        const fakeId = '507f1f77bcf86cd799439011';
    
        const res = await request(app)
          .get(`/api/bills/${fakeId}`)
          .set('Authorization', `Bearer ${token}`);
    
        expect(res.status).toBe(404);
      });
    
      it('should return 404 when accessing another user bill', async () => {
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
    
        const createRes = await request(app)
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
    
        const billId = createRes.body.data.billId;
        const auth2 = await createAuthenticatedUser('owner2');
    
        const res = await request(app)
          .get(`/api/bills/${billId}`)
          .set('Authorization', `Bearer ${auth2.token}`);
    
        expect(res.status).toBe(404);
      });
    
      it('should return 400 for invalid bill ID format', async () => {
        const res = await request(app)
          .get('/api/bills/invalid-id')
          .set('Authorization', `Bearer ${token}`);
    
        expect(res.status).toBe(400);
      });
    
      it('should return 401 for unauthenticated request', async () => {
        const res = await request(app)
          .get('/api/bills/507f1f77bcf86cd799439011');
    
        expect(res.status).toBe(401);
      });
    
  });

});