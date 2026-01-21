// const request = require('supertest');
// const app = require('../../src/app');
// const { createAuthenticatedUser } = require('../helpers/authHelper');
// const { createTestProduct } = require('../helpers/testDb');
// const Product = require('../../src/models/Product');

// describe('Products API', () => {

//   let token;

//   beforeEach(async () => {
//     const auth = await createAuthenticatedUser('owner');
//     token = auth.token;
//   });

//   // ---------------------------------------------------------
//   // ✅ FLOW 1 + FLOW 2 — CREATE PRODUCT
//   // ---------------------------------------------------------
//   describe('POST /api/products', () => {

//     it('should create a product with valid data', async () => {
//       const res = await request(app)
//         .post('/api/products')
//         .set('Authorization', `Bearer ${token}`)
//         .send({
//           name: 'Whole Milk',
//           unit: 'liter',
//           costPrice: 40,
//           minSellingPrice: 60,
//           currentStock: 100,
//           minStockLevel: 10
//         });

//       expect(res.status).toBe(201);
//       expect(res.body.data.name).toBe('Whole Milk');
//     });

//     it('should reject unauthenticated request', async () => {
//       const res = await request(app)
//         .post('/api/products')
//         .send({ name: 'Milk', costPrice: 40 });
      
//       expect(res.status).toBe(401);
//     });

//     it('should not allow duplicate product names', async () => {
//       await createTestProduct({ name: 'Sugar' });

//       const res = await request(app)
//         .post('/api/products')
//         .set('Authorization', `Bearer ${token}`)
//         .send({ name: 'Sugar', costPrice: 20, minSellingPrice: 30 });

//       expect(res.status).toBe(400);
//     });

//     it('should reject selling price < cost price', async () => {
//       const res = await request(app)
//         .post('/api/products')
//         .set('Authorization', `Bearer ${token}`)
//         .send({ name: 'Oil', costPrice: 100, minSellingPrice: 50 });

//       expect(res.status).toBe(400);
//     });

//     it('should allow adding multiple products (bulk entry flow)', async () => {
//       const names = ['p', 'q', 'r'];

//       for (const name of names) {
//         const res = await request(app)
//           .post('/api/products')
//           .set('Authorization', `Bearer ${token}`)
//           .send({ name, unit:'c', costPrice: 10, minSellingPrice: 15, currentStock: 20, minStockLevel: 5 }); 

//         expect(res.status).toBe(201);
//       }

//       const all = await Product.find({});
//       expect(all.length).toBe(3);
//     });
//   });

//   // ---------------------------------------------------------
//   // ✅ FLOW 3 — GET ALL PRODUCTS + SEARCH + LOW STOCK + PAGINATION
//   // ---------------------------------------------------------
//   describe('GET /api/products', () => {

//     beforeEach(async () => {
//       await createTestProduct({ name: 'Maggi', currentStock: 5, minStockLevel: 10 });
//       await createTestProduct({ name: 'Milk', currentStock: 50, minStockLevel: 10 });
//     });

//     it('should return all active products', async () => {
//       const res = await request(app)
//         .get('/api/products')
//         .set('Authorization', `Bearer ${token}`);

//       expect(res.status).toBe(200);
//       expect(res.body.data.length).toBe(2);
//     });

//     it('should filter by search term', async () => {
//       const res = await request(app)
//         .get('/api/products?search=mag')
//         .set('Authorization', `Bearer ${token}`);

//       expect(res.status).toBe(200);
//       expect(res.body.data.length).toBe(1);
//       expect(res.body.data[0].name).toBe('Maggi');
//     });

//     it('should return only low-stock products', async () => {
//       const res = await request(app)
//         .get('/api/products?lowstock=true')
//         .set('Authorization', `Bearer ${token}`);

//       expect(res.body.data.length).toBe(1);
//       expect(res.body.data[0].name).toBe('Maggi');
//     });

//     it('should support pagination', async () => {
//       await createTestProduct({ name: 'Item1' });
//       await createTestProduct({ name: 'Item2' });
//       await createTestProduct({ name: 'Item3' });

//       const res = await request(app)
//         .get('/api/products?page=1&limit=2')
//         .set('Authorization', `Bearer ${token}`);

//       expect(res.status).toBe(200);
//       expect(res.body.data.length).toBe(2);
//       console.log(res.body);
//       expect(res.body.pagination.total).toBe(5);
//     });
//   });

//   // ---------------------------------------------------------
//   // ✅ FLOW 5 — GET PRODUCT DETAILS
//   // ---------------------------------------------------------
//   describe('GET /api/products/:id', () => {

//     it('should return product by ID', async () => {
//       const prod = await createTestProduct({ name: 'Rice' });

//       const res = await request(app)
//         .get(`/api/products/${prod._id}`)
//         .set('Authorization', `Bearer ${token}`);

//       expect(res.status).toBe(200);
//       expect(res.body.data.name).toBe('Rice');
//       expect(res.body.data.isLowStock).toBeDefined();
//     });

//     it('should return 404 for non-existing product', async () => {
//       const fakeId = '674a8c8a8c8a8c8a8c8a8c8a';

//       const res = await request(app)
//         .get(`/api/products/${fakeId}`)
//         .set('Authorization', `Bearer ${token}`);

//       expect(res.status).toBe(404);
//     });
//   });

//   // ---------------------------------------------------------
//   // ✅ FLOW 4 — UPDATE PRODUCT
//   // ---------------------------------------------------------
//   describe('PUT /api/products/:id', () => {

//     it('should update allowed fields', async () => {
//       const prod = await createTestProduct({ name: 'Pepsi', unit: 'bottle' });

//       const res = await request(app)
//         .put(`/api/products/${prod._id}`)
//         .set('Authorization', `Bearer ${token}`)
//         .send({ unit: 'can' });

//       expect(res.status).toBe(200);
//       expect(res.body.data.unit).toBe('can');
//     });

//     it('should prevent manual editing of currentStock', async () => {
//       const prod = await createTestProduct({ name: 'Chips', currentStock: 20 });

//       const res = await request(app)
//         .put(`/api/products/${prod._id}`)
//         .set('Authorization', `Bearer ${token}`)
//         .send({ currentStock: 999 });

//       expect(res.status).toBe(200);
//       expect(res.body.data.currentStock).toBe(20);
//     });

//     it('should not allow renaming to duplicate name', async () => {
//       await createTestProduct({ name: 'Tea' });
//       const prod = await createTestProduct({ name: 'Coffee' });

//       const res = await request(app)
//         .put(`/api/products/${prod._id}`)
//         .set('Authorization', `Bearer ${token}`)
//         .send({ name: 'Tea' });

//       expect(res.status).toBe(400);
//     });
//   });

//   // ---------------------------------------------------------
//   // ✅ FLOW 6 — SOFT DELETE
//   // ---------------------------------------------------------
//   describe('DELETE /api/products/:id', () => {

//     it('should soft delete product', async () => {
//       const prod = await createTestProduct({ name: 'Bread' });

//       const res = await request(app)
//         .delete(`/api/products/${prod._id}`)
//         .set('Authorization', `Bearer ${token}`);

//       expect(res.status).toBe(200);

//       const deleted = await Product.findById(prod._id);
//       expect(deleted.isActive).toBe(false);
//     });

//     it('should hide inactive products from list', async () => {
//       const prod = await createTestProduct({ name: 'Paneer' });

//       await request(app)
//         .delete(`/api/products/${prod._id}`)
//         .set('Authorization', `Bearer ${token}`);

//       const res = await request(app)
//         .get('/api/products')
//         .set('Authorization', `Bearer ${token}`);

//       const names = res.body.data.map(p => p.name);
//       expect(names).not.toContain('Paneer');
//     });
//   });

// });

const request = require('supertest');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const Product = require('../../src/models/Product');

describe('Products API - Phase 2', () => {

  let token;
  let userId;

  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    token = auth.token;
    userId = auth.userId;
  });

  // ---------------------------------------------------------
  // ✅ CREATE PRODUCT - Phase 2
  // ---------------------------------------------------------
  // describe('POST /api/products', () => {

  //   // Valid product data helper
  //   const validProductData = {
  //     productName: 'Maggi',
  //     units: [
  //       { unitName: 'piece', isBase: true },
  //       { unitName: 'packet', isBase: false },
  //       { unitName: 'carton', isBase: false }
  //     ],
  //     variations: [
  //       { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece', minSellingPrice: 5 },
  //       { unitName: 'packet', containsQuantity: 24, containsUnit: 'piece', minSellingPrice: 120 },
  //       { unitName: 'carton', containsQuantity: 6, containsUnit: 'packet', minSellingPrice: 700 }
  //     ],
  //     minStockLevel: { value: 5, unit: 'carton' }
  //   };

  //   it('should create a product with valid multi-unit data', async () => {
  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(validProductData);

  //     expect(res.status).toBe(201);
  //     expect(res.body.success).toBe(true);
  //     expect(res.body.data.productName).toBe('Maggi');
  //     expect(res.body.data.units.length).toBe(3);
  //     expect(res.body.data.variations.length).toBe(3);
  //     expect(res.body.data.currentStock).toBe(0);
  //     expect(res.body.data.costPricePerBaseUnit).toBeNull();
  //   });

  //   it('should reject unauthenticated request', async () => {
  //     const res = await request(app)
  //       .post('/api/products')
  //       .send(validProductData);
      
  //     expect(res.status).toBe(401);
  //   });

  //   it('should not allow duplicate product names', async () => {
  //     // Create first product
  //     await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(validProductData);

  //     // Try to create duplicate
  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(validProductData);

  //     expect(res.status).toBe(400);
  //     expect(res.body.error).toContain('already exists');
  //   });

  //   it('should reject product without base unit', async () => {
  //     const invalidData = {
  //       ...validProductData,
  //       units: [
  //         { unitName: 'piece', isBase: false },  // No base unit!
  //         { unitName: 'packet', isBase: false }
  //       ]
  //     };

  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(invalidData);

  //     expect(res.status).toBe(400);
  //     expect(res.body.error).toContain('Base unit');
  //   });

  //   it('should reject product with multiple base units', async () => {
  //     const invalidData = {
  //       ...validProductData,
  //       units: [
  //         { unitName: 'piece', isBase: true },  // Two base units!
  //         { unitName: 'packet', isBase: true },
  //         { unitName: 'carton', isBase: false }
  //       ]
  //     };

  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(invalidData);

  //     expect(res.status).toBe(400);
  //     expect(res.body.error).toContain('Only one base unit');
  //   });

  //   it('should reject circular dependency in variations', async () => {
  //     const invalidData = {
  //       ...validProductData,
  //       variations: [
  //         { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },
  //         { unitName: 'packet', containsQuantity: 24, containsUnit: 'carton' },  // Circular!
  //         { unitName: 'carton', containsQuantity: 6, containsUnit: 'packet' }
  //       ]
  //     };

  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(invalidData);

  //     expect(res.status).toBe(400);
  //     expect(res.body.error).toContain('Circular dependency');
  //   });

  //   it('should calculate conversionToBase correctly', async () => {
  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(validProductData);

  //     expect(res.status).toBe(201);
      
  //     const product = res.body.data;
  //     const piece = product.variations.find(v => v.variationName === 'piece');
  //     const packet = product.variations.find(v => v.variationName === 'packet');
  //     const carton = product.variations.find(v => v.variationName === 'carton');

  //     expect(piece.conversionToBase).toBe(1);
  //     expect(packet.conversionToBase).toBe(24);
  //     expect(carton.conversionToBase).toBe(144);  // 6 × 24
  //   });

  //   it('should derive MSP for all variations when one is provided', async () => {
  //     const dataWithOneMSP = {
  //       ...validProductData,
  //       variations: [
  //         { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },  // No MSP
  //         { unitName: 'packet', containsQuantity: 24, containsUnit: 'piece' },  // No MSP
  //         { unitName: 'carton', containsQuantity: 6, containsUnit: 'packet', minSellingPrice: 700 }  // MSP provided
  //       ]
  //     };

  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(dataWithOneMSP);

  //     expect(res.status).toBe(201);
      
  //     const product = res.body.data;
  //     const piece = product.variations.find(v => v.variationName === 'piece');
  //     const packet = product.variations.find(v => v.variationName === 'packet');
  //     const carton = product.variations.find(v => v.variationName === 'carton');

  //     expect(carton.minSellingPrice).toBe(700);
  //     expect(packet.minSellingPrice).toBeCloseTo(116.67, 2);  // 700 ÷ 6
  //     expect(piece.minSellingPrice).toBeCloseTo(4.86, 2);  // 700 ÷ 144
  //   });

  //   it('should allow all variations with null MSP', async () => {
  //     const dataWithNoMSP = {
  //       ...validProductData,
  //       variations: [
  //         { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },
  //         { unitName: 'packet', containsQuantity: 24, containsUnit: 'piece' },
  //         { unitName: 'carton', containsQuantity: 6, containsUnit: 'packet' }
  //       ]
  //     };

  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(dataWithNoMSP);

  //     expect(res.status).toBe(201);
      
  //     const product = res.body.data;
  //     product.variations.forEach(v => {
  //       expect(v.minSellingPrice).toBeNull();
  //     });
  //   });

  //   it('should convert minStockLevel to base unit', async () => {
  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(validProductData);

  //     expect(res.status).toBe(201);
      
  //     const product = res.body.data;
  //     // minStockLevel = 5 cartons = 5 × 144 = 720 pieces
  //     expect(product.minStockLevel).toBe(720);
  //   });

  //   it('should allow minStockLevel to be null', async () => {
  //     const dataWithoutMinStock = {
  //       ...validProductData,
  //       minStockLevel: null
  //     };

  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(dataWithoutMinStock);

  //     expect(res.status).toBe(201);
  //     expect(res.body.data.minStockLevel).toBeNull();
  //   });

  //   it('should reject duplicate unit names', async () => {
  //     const invalidData = {
  //       ...validProductData,
  //       units: [
  //         { unitName: 'piece', isBase: true },
  //         { unitName: 'PIECE', isBase: false },  // Duplicate!
  //         { unitName: 'packet', isBase: false }
  //       ]
  //     };
    
  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(invalidData);
    
  //     expect(res.status).toBe(400);
  //     expect(res.body.error).toContain('Duplicate unit names');
  //   });

  //   it('should reject multiple variations for same unit', async () => {
  //     const invalidData = {
  //       ...validProductData,
  //       variations: [
  //         { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },
  //         { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },  // Duplicate!
  //         { unitName: 'packet', containsQuantity: 24, containsUnit: 'piece' }
  //       ]
  //     };
    
  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(invalidData);
    
  //     expect(res.status).toBe(400);
  //     expect(res.body.error).toContain('Each unit must have exactly one variation');
  //   });

  //   it('should reject variation with non-existent containsUnit', async () => {
  //     const invalidData = {
  //       ...validProductData,
  //       variations: [
  //         { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },
  //         { unitName: 'packet', containsQuantity: 24, containsUnit: 'box' }  // 'box' doesn't exist!
  //       ]
  //     };
    
  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send(invalidData);
    
  //     expect(res.status).toBe(400);
  //     expect(res.body.error).toContain('does not exist');
  //   });

  //   // it('should treat product names as case-insensitive for duplicates', async () => {
  //   //   // Create first product
  //   //   await request(app)
  //   //     .post('/api/products')
  //   //     .set('Authorization', `Bearer ${token}`)
  //   //     .send({ ...validProductData, productName: 'maggi' });
    
  //   //   // Try to create with different case
  //   //   const res = await request(app)
  //   //     .post('/api/products')
  //   //     .set('Authorization', `Bearer ${token}`)
  //   //     .send({ ...validProductData, productName: 'MAGGI' });
    
  //   //   expect(res.status).toBe(400);
  //   //   expect(res.body.error).toContain('already exists');
  //   // });

  //   it('should allow product names with special characters', async () => {
  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send({ 
  //         ...validProductData, 
  //         productName: 'Maggi (2-Min) [Value Pack]' 
  //       });
    
  //     expect(res.status).toBe(201);
  //     expect(res.body.data.productName).toBe('Maggi (2-Min) [Value Pack]');
  //   });

  //   it('should trim whitespace from product name', async () => {
  //     const res = await request(app)
  //       .post('/api/products')
  //       .set('Authorization', `Bearer ${token}`)
  //       .send({ 
  //         ...validProductData, 
  //         productName: '  Maggi  ' 
  //       });
    
  //     expect(res.status).toBe(201);
  //     expect(res.body.data.productName).toBe('Maggi');  // Trimmed
  //   });

  //   // it('should allow adding multiple products (bulk entry flow)', async () => {
  //   //   const products = ['Parle-G', 'Britannia', 'Sunfeast'];

  //   //   for (const productName of products) {
  //   //     const res = await request(app)
  //   //       .post('/api/products')
  //   //       .set('Authorization', `Bearer ${token}`)
  //   //       .send({ ...validProductData, productName });

  //   //     expect(res.status).toBe(201);
  //   //   }

  //   //   const all = await Product.find({ userId });
  //   //   expect(all.length).toBe(3);
  //   // });

  // });


  describe('GET /api/products/:id', () => {

    it('should get product by ID with complete details', async () => {
      // Create a product first
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(validProductData);
  
      const productId = createRes.body.data._id;
  
      // Get the product
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${token}`);
  
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(productId);
      expect(res.body.data.productName).toBe('Maggi');
      expect(res.body.data.units.length).toBe(3);
      expect(res.body.data.variations.length).toBe(3);
      expect(res.body.data.stockDisplay).toBeDefined();
      expect(res.body.data.stockStatus).toBeDefined();
    });
  
    it('should return 404 for non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';  // Valid ObjectId but doesn't exist
  
      const res = await request(app)
        .get(`/api/products/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
  
      expect(res.status).toBe(404);
    });
  
    it('should return 400 for invalid product ID format', async () => {
      const res = await request(app)
        .get('/api/products/invalid-id')
        .set('Authorization', `Bearer ${token}`);
  
      expect(res.status).toBe(400);
    });
  
    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app)
        .get('/api/products/507f1f77bcf86cd799439011');
  
      expect(res.status).toBe(401);
    });
  
    it('should return 403 when accessing another user\'s product', async () => {
      // Create product with first user
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(validProductData);
  
      const productId = createRes.body.data._id;
  
      // Create second user
      const auth2 = await createAuthenticatedUser('owner');
      const token2 = auth2.token;
  
      // Try to access first user's product with second user
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${token2}`);
  
      expect(res.status).toBe(403);
    });
  
    it('should display stock in all variations correctly', async () => {
      // Create product
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(validProductData);
  
      const productId = createRes.body.data._id;
  
      // Manually update stock to 1200 pieces for testing
      await Product.findByIdAndUpdate(productId, { currentStock: 1200 });
  
      // Get product
      const res = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${token}`);
  
      expect(res.status).toBe(200);
      
      // Stock: 1200 pieces
      // Cartons: 1200 ÷ 144 = 8
      // Packets: 1200 ÷ 24 = 50
      // Pieces: 1200 ÷ 1 = 1200
      expect(res.body.data.stockDisplay).toBe('8 carton | 50 packet | 1200 piece');
    });
  
  });

});