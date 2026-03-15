const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createMaggiTestProduct, createParleTestProduct } = require('../helpers/productHelper');
const Product = require('../../src/models/Product');
const Purchase = require('../../src/models/Purchase');

describe('Purchase API', () => {
  let token, user, maggiProduct, parleProduct;

  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;

    maggiProduct = await createMaggiTestProduct(user._id);
    parleProduct = await createParleTestProduct(user._id);
  });

  describe('POST /api/purchases', () => {

    describe('Happy Path', () => {

      it('should create purchase and add stock correctly', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            supplierName: 'Ram Distributors',
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,
              costPricePerUnit: 600  // 600/144 = 4 — same as current cost
            }]
          });
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.purchaseNumber).toBeDefined();
        expect(res.body.data.totalAmount).toBe(6000); // 10 * 600

        // Stock check — 10 cartons × 144 = 1440 added
        const maggiAfter = await Product.findById(maggiProduct._id);
        expect(maggiAfter.currentStock).toBe(2880); // 1440 + 1440

        // StockUpdates response mein
        expect(res.body.data.stockUpdates[0].stockBefore).toBe(1440);
        expect(res.body.data.stockUpdates[0].stockAfter).toBe(2880);
        expect(res.body.data.stockUpdates[0].stockAdded).toBe(1440);
      });

      it('should create purchase with multiple products', async () => {
        const maggiCarton = maggiProduct.variations.find(v => v.variationName === 'Carton');
        const parlePacket = parleProduct.variations.find(v => v.variationName === 'Packet');

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            supplierName: 'Wholesale Mart',
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

        const maggiAfter = await Product.findById(maggiProduct._id);
        const parleAfter = await Product.findById(parleProduct._id);

        expect(maggiAfter.currentStock).toBe(2160); // 1440 + (5*144)
        expect(parleAfter.currentStock).toBe(700);  // 500 + (20*10)
      });

      it('should allow decimal quantity', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 2.5,
              costPricePerUnit: 600
            }]
          });

        expect(res.status).toBe(201);

        const maggiAfter = await Product.findById(maggiProduct._id);
        // 2.5 × 144 = 360
        expect(maggiAfter.currentStock).toBe(1800); // 1440 + 360
      });

      it('should recover from negative stock', async () => {
        await Product.findByIdAndUpdate(maggiProduct._id, { currentStock: -720 });

        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,
              costPricePerUnit: 600
            }]
          });

        expect(res.status).toBe(201);

        const maggiAfter = await Product.findById(maggiProduct._id);
        // -720 + (10 * 144) = 720
        expect(maggiAfter.currentStock).toBe(720);
      });

      it('should not change cost price when cost is same', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

        await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: 576  // 576/144 = 4 — same as current
            }]
          });

        const maggiAfter = await Product.findById(maggiProduct._id);
        expect(maggiAfter.costPricePerBaseUnit).toBe(4); // Unchanged
      });

    });

    describe('First Purchase', () => {

      it('should set cost price on first purchase', async () => {
        // Product with no cost — null MSP bhi allowed
        const newProduct = await Product.create({
          userId: user._id,
          productName: 'New Product',
          baseUnit: { _id: new mongoose.Types.ObjectId(), unitName: 'piece' },
          units: [{ _id: new mongoose.Types.ObjectId(), unitName: 'piece', isBaseUnit: true }],
          variations: [{
            _id: new mongoose.Types.ObjectId(),
            unitId: new mongoose.Types.ObjectId(),
            variationName: 'Piece',
            containsQuantity: 1,
            containsUnitId: new mongoose.Types.ObjectId(),
            conversionToBase: 1,
            minSellingPrice: null  // null — first purchase pe set hogi
          }],
          costPricePerBaseUnit: null,
          currentStock: 0,
          isActive: true
        });

        const pieceVar = newProduct.variations[0];

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: newProduct._id.toString(),
              variationId: pieceVar._id.toString(),
              quantity: 100,
              costPricePerUnit: 8,
              mspUpdates: [
                { variationId: pieceVar._id.toString(), newMinSellingPrice: 10 }
              ]
            }]
          });

        expect(res.status).toBe(201);

        const productAfter = await Product.findById(newProduct._id);
        expect(productAfter.costPricePerBaseUnit).toBe(8);
        expect(productAfter.currentStock).toBe(100);

        const variation = productAfter.variations[0];
        expect(variation.minSellingPrice).toBe(10);
      });

      it('should block first purchase if MSP not provided', async () => {
        const newProduct = await Product.create({
          userId: user._id,
          productName: 'No MSP Product',
          baseUnit: { _id: new mongoose.Types.ObjectId(), unitName: 'piece' },
          units: [{ _id: new mongoose.Types.ObjectId(), unitName: 'piece', isBaseUnit: true }],
          variations: [{
            _id: new mongoose.Types.ObjectId(),
            unitId: new mongoose.Types.ObjectId(),
            variationName: 'Piece',
            containsQuantity: 1,
            containsUnitId: new mongoose.Types.ObjectId(),
            conversionToBase: 1,
            minSellingPrice: null
          }],
          costPricePerBaseUnit: null,
          currentStock: 0,
          isActive: true
        });

        const pieceVar = newProduct.variations[0];

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: newProduct._id.toString(),
              variationId: pieceVar._id.toString(),
              quantity: 100,
              costPricePerUnit: 8
              // mspUpdates nahi diya
            }]
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('MSP required');
      });

    });

    describe('Cost Price Changed', () => {

      it('should block purchase when cost changed and mspUpdates not provided', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,
              costPricePerUnit: 720  // Cost changed — 720/144 = 5, was 4
              // mspUpdates nahi diya
            }]
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('MSP required');

        // Stock unchanged
        const maggiAfter = await Product.findById(maggiProduct._id);
        expect(maggiAfter.currentStock).toBe(1440);
      });

      it('should allow purchase when cost changed and all MSPs provided', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
        const pieceVar = maggiProduct.variations.find(v => v.variationName === 'Piece');

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,
              costPricePerUnit: 720,  // 720/144 = 5
              mspUpdates: [
                { variationId: pieceVar._id.toString(),   newMinSellingPrice: 7 },
                { variationId: packetVar._id.toString(),  newMinSellingPrice: 150 },
                { variationId: cartonVar._id.toString(),  newMinSellingPrice: 900 }
              ]
            }]
          });

        expect(res.status).toBe(201);
        expect(res.body.data.costPriceUpdates.length).toBeGreaterThan(0);

        const maggiAfter = await Product.findById(maggiProduct._id);
        expect(maggiAfter.costPricePerBaseUnit).toBe(5); // 720/144 = 5

        const cartonAfter = maggiAfter.variations.find(v => v.variationName === 'Carton');
        const packetAfter = maggiAfter.variations.find(v => v.variationName === 'Packet');
        const pieceAfter  = maggiAfter.variations.find(v => v.variationName === 'Piece');

        expect(cartonAfter.minSellingPrice).toBe(900);
        expect(packetAfter.minSellingPrice).toBe(150);
        expect(pieceAfter.minSellingPrice).toBe(7);

        // Stock bhi add hua
        expect(maggiAfter.currentStock).toBe(2880);
      });

      it('should block if any MSP is below new cost', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');
        const pieceVar  = maggiProduct.variations.find(v => v.variationName === 'Piece');

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,
              costPricePerUnit: 720,  // newCost = 5 per piece
              mspUpdates: [
                { variationId: pieceVar._id.toString(),   newMinSellingPrice: 4 },  // 4 < 5 ❌
                { variationId: packetVar._id.toString(),  newMinSellingPrice: 150 },
                { variationId: cartonVar._id.toString(),  newMinSellingPrice: 900 }
              ]
            }]
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('below cost');

        // Verify no changes
        const maggiAfter = await Product.findById(maggiProduct._id);
        expect(maggiAfter.currentStock).toBe(1440);
        expect(maggiAfter.costPricePerBaseUnit).toBe(4);
      });

      it('should block if not all variations MSP provided', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 10,
              costPricePerUnit: 720,
              mspUpdates: [
                // Sirf 2 variations — 3 chahiye
                { variationId: packetVar._id.toString(),  newMinSellingPrice: 150 },
                { variationId: cartonVar._id.toString(),  newMinSellingPrice: 900 }
              ]
            }]
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('MSP required for all');
      });

    });

    describe('Transaction Atomicity', () => {

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
                variationId: new mongoose.Types.ObjectId().toString(), // Valid format, doesn't exist
                quantity: 10,
                costPricePerUnit: 15
              }
            ]
          });
        expect(res.status).toBe(400);

        // Stock unchanged
        const maggiAfter = await Product.findById(maggiProduct._id);
        expect(maggiAfter.currentStock).toBe(1440);

        // No purchases created
        const purchaseCount = await Purchase.countDocuments({ userId: user._id });
        expect(purchaseCount).toBe(0);
      });

      it('should reject duplicate product in same purchase', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');
        const packetVar = maggiProduct.variations.find(v => v.variationName === 'Packet');

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
                productId: maggiProduct._id.toString(), // Same product!
                variationId: packetVar._id.toString(),
                quantity: 10,
                costPricePerUnit: 120
              }
            ]
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('cannot appear multiple times');
      });

    });

    describe('Validation Errors', () => {

      it('should reject purchase with no items', async () => {
        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({ items: [] });

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
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: 600
            }]
          });

        expect(res.status).toBe(400);
      });

      it('should reject negative quantity', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: -5,
              costPricePerUnit: 600
            }]
          });

        expect(res.status).toBe(400);
      });

      it('should reject negative cost price', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: -600
            }]
          });

        expect(res.status).toBe(400);
      });

      it('should reject invalid product ID format', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

        const res = await request(app)
          .post('/api/purchases')
          .set('Authorization', `Bearer ${token}`)
          .send({
            items: [{
              productId: 'invalid-id',
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: 600
            }]
          });

        expect(res.status).toBe(400);
      });

      it('should reject unauthenticated request', async () => {
        const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

        const res = await request(app)
          .post('/api/purchases')
          .send({
            items: [{
              productId: maggiProduct._id.toString(),
              variationId: cartonVar._id.toString(),
              quantity: 5,
              costPricePerUnit: 600
            }]
          });

        expect(res.status).toBe(401);
      });

    });

  });


  // describe('GET /api/purchases', () => {

  //   beforeEach(async () => {
  //     const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

  //     await request(app)
  //       .post('/api/purchases')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send({
  //         supplierName: 'XYZ Distributors',
  //         items: [{
  //           productId: maggiProduct._id.toString(),
  //           variationId: cartonVar._id.toString(),
  //           quantity: 10,
  //           costPricePerUnit: 600
  //         }]
  //       });

  //     await request(app)
  //       .post('/api/purchases')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send({
  //         supplierName: 'ABC Traders',
  //         items: [{
  //           productId: maggiProduct._id.toString(),
  //           variationId: cartonVar._id.toString(),
  //           quantity: 5,
  //           costPricePerUnit: 600
  //         }]
  //       });
  //   });

  //   it('should fetch all purchases', async () => {
  //     const res = await request(app)
  //       .get('/api/purchases')
  //       .set('Authorization', `Bearer ${token}`);

  //     expect(res.status).toBe(200);
  //     expect(res.body.count).toBeGreaterThanOrEqual(2);
  //     expect(res.body.pagination).toBeDefined();
  //   });

  //   it('should not return purchases of other users', async () => {
  //     const auth2 = await createAuthenticatedUser('owner2');

  //     const res = await request(app)
  //       .get('/api/purchases')
  //       .set('Authorization', `Bearer ${auth2.token}`);

  //     expect(res.status).toBe(200);
  //     expect(res.body.count).toBe(0);
  //   });

  //   it('should filter by supplier name', async () => {
  //     const res = await request(app)
  //       .get('/api/purchases?supplierName=XYZ')
  //       .set('Authorization', `Bearer ${token}`);

  //     expect(res.status).toBe(200);
  //     expect(res.body.data[0].supplierName).toContain('XYZ');
  //   });

  //   it('should filter by product name', async () => {
  //     const res = await request(app)
  //       .get('/api/purchases?productName=Maggi')
  //       .set('Authorization', `Bearer ${token}`);

  //     expect(res.status).toBe(200);
  //     expect(res.body.data.length).toBeGreaterThan(0);
  //   });

  //   it('should filter by date range', async () => {
  //     const today = new Date().toISOString().split('T')[0];

  //     const res = await request(app)
  //       .get(`/api/purchases?startDate=${today}&endDate=${today}`)
  //       .set('Authorization', `Bearer ${token}`);

  //     expect(res.status).toBe(200);
  //     expect(res.body.data.length).toBeGreaterThan(0);
  //   });

  //   it('should paginate results', async () => {
  //     const res = await request(app)
  //       .get('/api/purchases?page=1&limit=1')
  //       .set('Authorization', `Bearer ${token}`);

  //     expect(res.status).toBe(200);
  //     expect(res.body.data.length).toBe(1);
  //     expect(res.body.pagination.pages).toBeGreaterThanOrEqual(2);
  //   });

  //   it('should return 401 for unauthenticated request', async () => {
  //     const res = await request(app).get('/api/purchases');
  //     expect(res.status).toBe(401);
  //   });

  // });

  // describe('GET /api/purchases/:purchaseId', () => {

  //   it('should return complete purchase details', async () => {
  //     const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

  //     const createRes = await request(app)
  //       .post('/api/purchases')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send({
  //         supplierName: 'Test Supplier',
  //         items: [{
  //           productId: maggiProduct._id.toString(),
  //           variationId: cartonVar._id.toString(),
  //           quantity: 5,
  //           costPricePerUnit: 600
  //         }]
  //       });

  //     const purchaseId = createRes.body.data.purchaseId;

  //     const res = await request(app)
  //       .get(`/api/purchases/${purchaseId}`)
  //       .set('Authorization', `Bearer ${token}`);

  //     expect(res.status).toBe(200);
  //     expect(res.body.data.purchaseId).toBe(purchaseId);
  //     expect(res.body.data.supplierName).toBe('Test Supplier');
  //     expect(res.body.data.items.length).toBe(1);
  //     expect(res.body.data.items[0].productName).toBe('Maggi Noodles');
  //     expect(res.body.data.items[0].stockBefore).toBeDefined();
  //     expect(res.body.data.items[0].stockAfter).toBeDefined();
  //     expect(res.body.data.totalAmount).toBe(3000);
  //   });

  //   it('should return 404 for non-existent purchase', async () => {
  //     const res = await request(app)
  //       .get('/api/purchases/507f1f77bcf86cd799439011')
  //       .set('Authorization', `Bearer ${token}`);

  //     expect(res.status).toBe(404);
  //   });

  //   it('should return 404 when accessing another user purchase', async () => {
  //     const cartonVar = maggiProduct.variations.find(v => v.variationName === 'Carton');

  //     const createRes = await request(app)
  //       .post('/api/purchases')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send({
  //         items: [{
  //           productId: maggiProduct._id.toString(),
  //           variationId: cartonVar._id.toString(),
  //           quantity: 5,
  //           costPricePerUnit: 600
  //         }]
  //       });

  //     const purchaseId = createRes.body.data.purchaseId;
  //     const auth2 = await createAuthenticatedUser('owner2');

  //     const res = await request(app)
  //       .get(`/api/purchases/${purchaseId}`)
  //       .set('Authorization', `Bearer ${auth2.token}`);

  //     expect(res.status).toBe(404);
  //   });

  //   it('should return 400 for invalid purchase ID format', async () => {
  //     const res = await request(app)
  //       .get('/api/purchases/invalid-id')
  //       .set('Authorization', `Bearer ${token}`);

  //     expect(res.status).toBe(400);
  //   });

  //   it('should return 401 for unauthenticated request', async () => {
  //     const res = await request(app)
  //       .get('/api/purchases/507f1f77bcf86cd799439011');

  //     expect(res.status).toBe(401);
  //   });

  // });

});