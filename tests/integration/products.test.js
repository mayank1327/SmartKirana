const request = require('supertest');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const Product = require('../../src/models/Product');

describe('Products API', () => {

  let token;
  let userId;

  beforeEach(async () => {
    const auth = await createAuthenticatedUser();
    token = auth.token;
    userId = auth.user._id;
  });

  const validProductData = {
              productName: 'Maggi',
              units: [
                { unitName: 'piece', isBase: true },
                { unitName: 'packet', isBase: false },
                { unitName: 'carton', isBase: false }
              ],
              variations: [
                { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece', minSellingPrice: 5 },
                { unitName: 'packet', containsQuantity: 24, containsUnit: 'piece', minSellingPrice: 120 },
                { unitName: 'carton', containsQuantity: 6, containsUnit: 'packet', minSellingPrice: 700 }
              ],
              minStockLevel: { value: 5, unit: 'carton' }
  };

  describe('POST /api/products', () => {

    it('should create a product with valid multi-unit data', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(validProductData);
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.productName).toBe('Maggi');
      expect(res.body.data.units.length).toBe(3);
      expect(res.body.data.variations.length).toBe(3);
      expect(res.body.data.currentStock).toBe(0);
      expect(res.body.data.costPricePerBaseUnit).toBeNull();
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/products')
        .send(validProductData);
      
      expect(res.status).toBe(401);
    });

    it('should not allow duplicate product names', async () => {
      // Create first product
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(validProductData);


      // Try to create duplicate
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(validProductData);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('should reject product without base unit', async () => {
      const invalidData = {
        ...validProductData,
        units: [
          { unitName: 'piece', isBase: false },  // No base unit!
          { unitName: 'packet', isBase: false }
        ]
      };

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Base unit');
    });

    it('should reject product with multiple base units', async () => {
      const invalidData = {
        ...validProductData,
        units: [
          { unitName: 'piece', isBase: true },  // Two base units!
          { unitName: 'packet', isBase: true },
          { unitName: 'carton', isBase: false }
        ]
      };

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Only one base unit');
    });

    it('should reject circular dependency in variations', async () => {
      const invalidData = {
        ...validProductData,
        variations: [
          { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },
          { unitName: 'packet', containsQuantity: 24, containsUnit: 'carton' },  // Circular!
          { unitName: 'carton', containsQuantity: 6, containsUnit: 'packet' }
        ]
      };

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Circular dependency');
    });

    it('should calculate conversionToBase correctly', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(validProductData);

      expect(res.status).toBe(201);
      
      const product = res.body.data;
      const piece = product.variations.find(v => v.variationName === 'piece');
      const packet = product.variations.find(v => v.variationName === 'packet');
      const carton = product.variations.find(v => v.variationName === 'carton');

      expect(piece.conversionToBase).toBe(1);
      expect(packet.conversionToBase).toBe(24);
      expect(carton.conversionToBase).toBe(144);  // 6 × 24
    });

    it('should keep other variations MSP as null when only one is provided', async () => {
      const dataWithOneMSP = {
        ...validProductData,
        variations: [
          { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },
          { unitName: 'packet', containsQuantity: 24, containsUnit: 'piece' },
          { unitName: 'carton', containsQuantity: 6, containsUnit: 'packet', minSellingPrice: 700 }
        ]
      };
    
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(dataWithOneMSP);
    
      expect(res.status).toBe(201);
      
      const product = res.body.data;
      const piece = product.variations.find(v => v.variationName === 'piece');
      const packet = product.variations.find(v => v.variationName === 'packet');
      const carton = product.variations.find(v => v.variationName === 'carton');
    
      expect(carton.minSellingPrice).toBe(700);
      expect(packet.minSellingPrice).toBeNull();
      expect(piece.minSellingPrice).toBeNull();
    });

    it('should allow all variations with null MSP', async () => {
      const dataWithNoMSP = {
        ...validProductData,
        variations: [
          { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },
          { unitName: 'packet', containsQuantity: 24, containsUnit: 'piece' },
          { unitName: 'carton', containsQuantity: 6, containsUnit: 'packet' }
        ]
      };

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(dataWithNoMSP);

      expect(res.status).toBe(201);
      
      const product = res.body.data;
      product.variations.forEach(v => {
        expect(v.minSellingPrice).toBeNull();
      });
    });

    it('should convert minStockLevel to base unit', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(validProductData);

      expect(res.status).toBe(201);
      
      const product = res.body.data;
      // minStockLevel = 5 cartons = 5 × 144 = 720 pieces
      expect(product.minStockLevel).toBe(720);
    });

    it('should allow minStockLevel to be null', async () => {
      const dataWithoutMinStock = {
        ...validProductData,
        minStockLevel: null
      };

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(dataWithoutMinStock);

      expect(res.status).toBe(201);
      expect(res.body.data.minStockLevel).toBeNull();
    });

    it('should reject duplicate unit names', async () => {
      const invalidData = {
        ...validProductData,
        units: [
          { unitName: 'piece', isBase: true },
          { unitName: 'PIECE', isBase: false },  // Duplicate!
          { unitName: 'packet', isBase: false }
        ]
      };
    
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData);
    
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Duplicate unit names');
    });

    it('should reject multiple variations for same unit', async () => {
      const invalidData = {
        ...validProductData,
        variations: [
          { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },
          { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },  // Duplicate!
          { unitName: 'packet', containsQuantity: 24, containsUnit: 'piece' }
        ]
      };
    
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData);
    
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Each unit must have exactly one variation');
    });

    it('should reject variation with non-existent containsUnit', async () => {
      const invalidData = {
        ...validProductData,
        variations: [
          { unitName: 'piece', containsQuantity: 1, containsUnit: 'piece' },
          { unitName: 'packet', containsQuantity: 24, containsUnit: 'box' }  // 'box' doesn't exist!
        ]
      };
    
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData);
    
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('does not exist');
    });

    it('should treat product names as case-insensitive for duplicates', async () => {
      // Create first product
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validProductData, productName: 'maggi' });
    
      // Try to create with different case
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validProductData, productName: 'MAGGI' });
    
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('should allow product names with special characters', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          ...validProductData, 
          productName: 'Maggi (2-Min) [Value Pack]' 
        });
    
      expect(res.status).toBe(201);
      expect(res.body.data.productName).toBe('Maggi (2-Min) [Value Pack]');
    });

    it('should trim whitespace from product name', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          ...validProductData, 
          productName: '  Maggi  ' 
        });
    
      expect(res.status).toBe(201);
      expect(res.body.data.productName).toBe('Maggi');  // Trimmed
    });
  });

  describe('GET /api/products', () => {

      it('should return empty list when no products exist', async () => {
        const res = await request(app)
          .get('/api/products')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual([]);
        expect(res.body.count).toBe(0);
      });

      it('should return all products for authenticated user', async () => {
        // Create 2 products
        await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...validProductData, productName: 'Parle-G' });

        const res = await request(app)
          .get('/api/products')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(2);
        expect(res.body.data.length).toBe(2);
      });

      it('should return stockDisplay and stockStatus for each product', async () => {
        await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const res = await request(app)
          .get('/api/products')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const product = res.body.data[0];
        expect(product.stockDisplay).toBeDefined();
        expect(product.stockStatus).toBeDefined();
        // New product — stock 0 — status red
        expect(product.stockStatus).toBe('out_of_stock');
      });

      it('should not return products of other users', async () => {
        // First user creates product
        await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        // Second user — different token
        const auth2 = await createAuthenticatedUser('owner');

        const res = await request(app)
          .get('/api/products')
          .set('Authorization', `Bearer ${auth2.token}`);

        expect(res.status).toBe(200);
        // Second user has no products
        expect(res.body.count).toBe(0);
        expect(res.body.data).toEqual([]);
      });

      it('should search products by name', async () => {
        await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData); // Maggi

        await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...validProductData, productName: 'Parle-G' });

        // Search for maggi
        const res = await request(app)
          .get('/api/products?search=maggi')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].productName).toBe('Maggi');
      });

      it('should filter low stock products', async () => {
        // Create product
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;

        // minStockLevel = 720 (5 cartons)
        // Set stock below minStockLevel
        await Product.findByIdAndUpdate(productId, { currentStock: 500 });

        const res = await request(app)
          .get('/api/products?lowStock=true')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.data[0].productName).toBe('Maggi');
      });

      it('should paginate results', async () => {
        // Create 3 products
        const names = ['Maggi', 'Parle-G', 'Britannia'];
        for (const name of names) {
          await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...validProductData, productName: name });
        }

        // Page 1, limit 2
        const res = await request(app)
          .get('/api/products?page=1&limit=2')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(2);
        expect(res.body.pagination.current).toBe(1);
        expect(res.body.pagination.total).toBe(3);
        expect(res.body.pagination.pages).toBe(2);
      });

      it('should not return soft deleted products', async () => {
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;

        // Soft delete
        await request(app)
          .delete(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`);

        // Get all — deleted product should not appear
        const res = await request(app)
          .get('/api/products')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
      });

      it('should return 401 for unauthenticated request', async () => {
        const res = await request(app)
          .get('/api/products');

        expect(res.status).toBe(401);
      });

  });

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
      
          expect(res.status).toBe(404); // yha pr 403 tha but humne 404 return karne ka decision liya hai for security reasons (to not reveal existence of resource)
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

  describe('PUT /api/products/:id', () => {

      it('should update product name successfully', async () => {
        // Create product first
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;

        // Update name
        const res = await request(app)
          .put(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ productName: 'Maggi Updated' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.productName).toBe('Maggi Updated');
      });

      it('should update MSP for variations', async () => {
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;
        const product = createRes.body.data;
        const packetVariation = product.variations.find(v => v.variationName === 'packet');

        const res = await request(app)
          .put(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            variations: [
              {
                variationId: packetVariation._id,
                minSellingPrice: 150  // Updated from 120
              }
            ]
          });
         
        expect(res.status).toBe(200);

        // Verify MSP updated in DB
        const getRes = await request(app)
          .get(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`);

        const updatedPacket = getRes.body.data.variations.find(
          v => v.variationName === 'packet'
        );
        expect(updatedPacket.minSellingPrice).toBe(150);
      });

      it('should update minStockLevel', async () => {
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;

        const res = await request(app)
          .put(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ minStockLevel: { value: 10, unit: 'carton' } });
        
        expect(res.status).toBe(200);

        // Verify in DB
        const getRes = await request(app)
          .get(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`);

          expect(getRes.body.data.minStockLevel).toBe(1440);
      });

      it('should reject update with no fields provided', async () => {
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;

        const res = await request(app)
          .put(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({});  // Empty body

        expect(res.status).toBe(400);
      });

      it('should reject update from different user', async () => {
        // Create product with first user
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;

        // Second user tries to update
        const auth2 = await createAuthenticatedUser('owner');

        const res = await request(app)
          .put(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${auth2.token}`)
          .send({ productName: 'Hacked Name' });

        expect(res.status).toBe(404); // 404 to not reveal existence of resource
      });

      it('should return 404 for non-existent product', async () => {
        const fakeId = '507f1f77bcf86cd799439011';

        const res = await request(app)
          .put(`/api/products/${fakeId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ productName: 'Test' });

        expect(res.status).toBe(404);
      });

      it('should return 400 for invalid product ID format', async () => {
        const res = await request(app)
          .put('/api/products/invalid-id')
          .set('Authorization', `Bearer ${token}`)
          .send({ productName: 'Test' });

        expect(res.status).toBe(400);
      });

      it('should reject unauthenticated request', async () => {
        const res = await request(app)
          .put('/api/products/507f1f77bcf86cd799439011')
          .send({ productName: 'Test' });

        expect(res.status).toBe(401);
      });
  });

  describe('DELETE /api/products/:id', () => {


      it('should soft delete product successfully', async () => {
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;

        const res = await request(app)
          .delete(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('deleted');
      });

      it('should not appear in product list after soft delete', async () => {
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;

        // Delete
        await request(app)
          .delete(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`);

        // Get all — should not appear
        const listRes = await request(app)
          .get('/api/products')
          .set('Authorization', `Bearer ${token}`);

        expect(listRes.status).toBe(200);
        const found = listRes.body.data.find(p => p._id === productId);
        expect(found).toBeUndefined();
      });

      it('should return 404 when accessing soft deleted product', async () => {
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;

        // Delete
        await request(app)
          .delete(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`);

        // Try to get — should 404
        const getRes = await request(app)
          .get(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(getRes.status).toBe(404);
      });

      it('should set isActive to false in database', async () => {
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;

        await request(app)
          .delete(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`);

        // Check DB directly
        const product = await Product.findById(productId);
        expect(product).toBeDefined();      // Still exists in DB
        expect(product.isActive).toBe(false); // But marked inactive
      });

      it('should reject delete from different user', async () => {
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);

        const productId = createRes.body.data._id;

        const auth2 = await createAuthenticatedUser('owner');

        const res = await request(app)
          .delete(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${auth2.token}`);

        expect(res.status).toBe(404); // 404 to not reveal existence of resource

        // Verify not deleted
        const product = await Product.findById(productId);
        expect(product.isActive).toBe(true);
      });

      it('should return 404 for non-existent product', async () => {
        const fakeId = '507f1f77bcf86cd799439011';

        const res = await request(app)
          .delete(`/api/products/${fakeId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
      });

      it('should return 400 for invalid product ID format', async () => {
        const res = await request(app)
          .delete('/api/products/invalid-id')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(400);
      });

      it('should reject unauthenticated request', async () => {
        const res = await request(app)
          .delete('/api/products/507f1f77bcf86cd799439011');

        expect(res.status).toBe(401);
      });

      it('should return 404 when deleting already deleted product', async () => {
        const createRes = await request(app)
          .post('/api/products')
          .set('Authorization', `Bearer ${token}`)
          .send(validProductData);
      
        const productId = createRes.body.data._id;
      
        // Pehli baar delete
        await request(app)
          .delete(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`);
      
        // Doosri baar delete
        const res = await request(app)
          .delete(`/api/products/${productId}`)
          .set('Authorization', `Bearer ${token}`);
      
        expect(res.status).toBe(404);
      });

  });

});