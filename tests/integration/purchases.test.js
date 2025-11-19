const request = require('supertest');
const app = require('../../src/app');

const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createTestProduct } = require('../helpers/testDb');

const Product = require('../../src/models/Product');
const Purchase = require('../../src/models/Purchase');
const StockMovement = require('../../src/models/StockMovement');

describe('Purchase API (Updated for New User Flows)', () => {

  let token, user, productA, productB, productC;

  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;

    // Create test products
    productA = await createTestProduct({
      name: 'Maggi Masala 10-pack',
      costPrice: 8,
      currentStock: 93
    });

    productB = await createTestProduct({
      name: 'Aashirvaad Atta 10kg',
      costPrice: 35,
      currentStock: 130
    });

    productC = await createTestProduct({
      name: 'Fortune Oil 1L',
      costPrice: 150,
      currentStock: 45
    });
  });

  // --------------------------------------------------------
  // FLOW 1: Create Purchase (Happy Path)
  // --------------------------------------------------------

  describe('POST /api/purchases — New Purchase Flow', () => {

    it('should create a multi-item purchase and increase stock atomically', async () => {

      const response = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierName: "XYZ Distributors",
          items: [
            { productId: productA._id,quantity: 100, unitCost: 8 , minSellingPrice: 10, productName: productA.name, unit: productA.unit},
            { productId: productB._id, quantity: 50, unitCost: 35 , minSellingPrice: 40, productName: productB.name, unit: productB.unit}, 
            { productId: productC._id, quantity: 20, unitCost: 150 , minSellingPrice: 180, productName: productC.name, unit: productC.unit},
          ],
          paymentMode: 'UPI',
        });

        console.log(response.body);

      expect(response.status).toBe(201);
      const data = response.body.data;

      // Purchase basics
      expect(data.totalAmount).toBe(5550); // 800 + 1750 + 3000

      // Stock updates
      const updatedA = await Product.findById(productA._id);
      const updatedB = await Product.findById(productB._id);
      const updatedC = await Product.findById(productC._id);

      expect(updatedA.currentStock).toBe(193);
      expect(updatedB.currentStock).toBe(180);
      expect(updatedC.currentStock).toBe(65);

      // Cost price updated
      expect(updatedA.costPrice).toBe(8);
      expect(updatedB.costPrice).toBe(35);
      expect(updatedC.costPrice).toBe(150);

      // Stock movement exists
      const movements = await StockMovement.find({ reason: 'purchase' });
      expect(movements.length).toBe(3);
    });

    it('should allow purchase with NO supplier (optional)', async () => {
      const response = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplierName: null, // Optional
          items: [
            { productId: productA._id, quantity: 10, unitCost: 8, minSellingPrice: 10, productName: productA.name, unit: productA.unit }
          ],
           paymentMode: 'cash',
        });
        console.log(response.body);
      expect(response.status).toBe(201);
    });

    it('should reject if any item has non-positive quantity', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { productId: productA._id, quantity: 0, unitCost: 8, minSellingPrice: 10, productName: productA.name, unit: productA.unit }
          ]
        });

        console.log(res.body);

      expect(res.status).toBe(400);
    });

    it('should reject if item unitCost <= 0', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { productId: productA._id, quantity: 10, unitCost: -1 }
          ]
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing items', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          supplier: { name: "Test" },
          items: []
        });

      expect(res.status).toBe(400);
    });

    it('create product if not exist', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { productId: "507f1f77bcf86cd799439011", quantity: 10, unitCost: 10, minSellingPrice: 12, productName: "NonExistent", unit: "pcs" }
          ]
        });

        console.log(res.body);

       expect(res.status).toBe(201);
    });

    // it('should reject unauthenticated request', async () => {
    //   const res = await request(app)
    //     .post('/api/purchases')
    //     .send({
    //       items: [{ productId: productA._id, quantity: 10, unitCost: 8}]
    //     });

    //   expect(res.status).toBe(401);
    // });
  });

//   // --------------------------------------------------------
//   // FLOW 2 + FLOW 3: Purchase History & Filter
//   // --------------------------------------------------------

//   describe('GET /api/purchases — Purchase History Flow', () => {

//     beforeEach(async () => {
//       await Purchase.create({
//         purchaseNumber: "PURCHASE_001",
//         supplierName: "XYZ",
//         items: [
//           { product: productA._id, quantity: 100, unitCost: 8, minSellingPrice: 10, productName: productA.name, unit: productA.unit , lineTotal : 800 }
//         ],
//         totalAmount: 800,
//         purchasedBy: user._id
//       });

//       await Purchase.create({
//         purchaseNumber: "PURCHASE_002",
//         supplierName: "ABC Traders",
//         items: [
//           { product: productA._id, quantity: 150, unitCost: 8,minSellingPrice: 10, productName: productA.name, unit: productA.unit ,lineTotal : 1200 }
//         ],
//         totalAmount: 1200,
//         purchasedBy: user._id
//       });
//     });

//     it('should fetch all purchases', async () => {
//       const res = await request(app)
//         .get('/api/purchases')
//         .set('Authorization', `Bearer ${token}`);

//       expect(res.status).toBe(200);
//       expect(res.body.data.length).toBe(2);
//     });

//     it('should filter purchases by supplier name', async () => {
//       const res = await request(app)
//         .get('/api/purchases?supplierName=XYZ')
//         .set('Authorization', `Bearer ${token}`);
//         console.log(res.body);
//       expect(res.status).toBe(200);

//       expect(res.body.data.length).toBe(1);
//       expect(res.body.data[0].supplierName).toBe("XYZ");
//     });

//     it('should filter by product name', async () => {
//       const res = await request(app)
//         .get('/api/purchases?productName=Maggi')
//         .set('Authorization', `Bearer ${token}`);
//       console.log(res.body);
//       expect(res.status).toBe(200);
//       expect(res.body.data.length).toBeGreaterThan(0);
//     });

//     it('should filter by date range', async () => {
//       const res = await request(app)
//         .get('/api/purchases?startDate=2025-11-19&endDate=2025-11-20')
//         .set('Authorization', `Bearer ${token}`);
//         console.log(res.body);
//       expect(res.status).toBe(200);
//       expect(res.body.data.length).toBe(2);
//     });
//   });
});