const request = require('supertest');
const app = require('../../src/app');
const { createAuthenticatedUser } = require('../helpers/authHelper');
const { createTestProduct } = require('../helpers/testDb');
const Product = require('../../src/models/Product');
const Sale = require('../../src/models/Sale');
const StockMovement = require('../../src/models/StockMovement');

describe('Sales API (Billing Module)', () => {
  let token, user, maggi, parle, soap;

  beforeEach(async () => {
    const auth = await createAuthenticatedUser('owner');
    user = auth.user;
    token = auth.token;

    maggi = await createTestProduct({
      name: 'Maggi Masala 10-pack',
      currentStock: 145,
      minSellingPrice: 9,
      costPrice: 8,
    });

    parle = await createTestProduct({
      name: 'Parle-G',
      currentStock: 80,
      minSellingPrice: 5,
      costPrice: 4
    });

    soap = await createTestProduct({
      name: 'Lifebuoy Soap',
      currentStock: 50,
      minSellingPrice: 25,
      costPrice: 20
    });
  });


  // -----------------------------------------------------------
  // ✅ FLOW 1: CREATE SALE — HAPPY PATH (3 ITEMS)
  // -----------------------------------------------------------
  describe('POST /api/sales - Happy Path', () => {
    it('should create sale with 3 items and deduct stock atomically', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: "Ramesh Retailers",
          paymentMethod: "cash",
         
          items: [
            { productId: maggi._id.toString(), quantity: 50, unitPrice: 10 },
            { productId: parle._id.toString(), quantity: 20, unitPrice: 5 },
            { productId: soap._id.toString(), quantity: 10, unitPrice: 25 }
          ],

        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.saleNumber).toBeDefined();

      // stock checks
      const m = await Product.findById(maggi._id);
      const p = await Product.findById(parle._id);
      const s = await Product.findById(soap._id);

      expect(m.currentStock).toBe(95);  // 145 - 50
      expect(p.currentStock).toBe(60);  // 80 - 20
      expect(s.currentStock).toBe(40);  // 50 - 10

    });
  });



  // -----------------------------------------------------------
  // ✅ FLOW 3: INSUFFICIENT STOCK ERROR
  // // -----------------------------------------------------------
  describe('POST /api/sales - Stock Validation', () => {
    it('should reject sale when quantity > stock and rollback', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [{
            productId: maggi._id.toString(),
            quantity: 200,  // > 145
            unitPrice: 20
          }],
          paymentMethod: 'cash'
        });

      expect(res.status).toBe(400);
      console.log(res.body);
      expect(res.body.error).toContain('Insufficient stock');

      const unchanged = await Product.findById(maggi._id);
      expect(unchanged.currentStock).toBe(145); // ✅ no deduction

      const movements = await StockMovement.find({ product: maggi._id });
      expect(movements.length).toBe(0); // ✅ no movement created
    });
  });


  // -----------------------------------------------------------
  // ✅ MULTI-ITEM ATOMICITY (ONE FAIL → ALL FAIL)
  // -----------------------------------------------------------
  describe('POST /api/sales - Transaction Atomicity', () => {
    it('should rollback entire sale if any one item fails', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { productId: maggi._id.toString(), quantity: 10, unitPrice: 10 },
            { productId: soap._id.toString(), quantity: 999, unitPrice: 25 } // FAIL
          ],
          paymentMethod: 'cash'
        });

      expect(res.status).toBe(400);

      // All stocks unchanged
      const m = await Product.findById(maggi._id);
      const s = await Product.findById(soap._id);
      expect(m.currentStock).toBe(145);
      expect(s.currentStock).toBe(50);

      // No stock movements
      const movements = await StockMovement.find({});
      expect(movements.length).toBe(0);
    });
  });


  // -----------------------------------------------------------
  // ✅ FLOW 5: VIEW PAST BILLS
  // -----------------------------------------------------------
  describe('GET /api/sales/:saleId - Past Bill Fetch', () => {
    it('should fetch a previously created sale with items', async () => {
      const sale = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: "Test Customer",
          paymentMethod: "cash",
          items: [
            { productId: maggi._id.toString(), quantity: 5, unitPrice: 10 }
          ]
        });

      const saleId = sale.body.data._id;
      console.log(saleId);
      const res = await request(app)
        .get(`/api/sales/${saleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].quantity).toBe(5);
    });
  });


  // -----------------------------------------------------------
  // ✅ BAD INPUTS & VALIDATION ERRORS
  // -----------------------------------------------------------
  describe("POST /api/sales - Validation Errors", () => {
    it("should reject sale with missing items array", async () => {
      const res = await request(app)
        .post('/api/sales')
        .set("Authorization", `Bearer ${token}`)
        .send({ paymentMethod: "cash" });

      expect(res.status).toBe(400);
    });

    it("should reject negative selling price", async () => {
      const res = await request(app)
        .post('/api/sales')
        .set("Authorization", `Bearer ${token}`)
        .send({
          items: [
            { productId: maggi._id.toString(), quantity: 5, sellingPrice: -10 }
          ],
          paymentMethod: "cash"
        });

      expect(res.status).toBe(400);
    });

    it("should reject quantity <= 0", async () => {
      const res = await request(app)
        .post('/api/sales')
        .set("Authorization", `Bearer ${token}`)
        .send({
          items: [
            { productId: maggi._id.toString(), quantity: 0, sellingPrice: 10 }
          ],
          paymentMethod: "cash"
        });

      expect(res.status).toBe(400);
    });
  });
//   -----------------------------------------------------------
// ✅ QUICK ACCESS ROUTES
// -----------------------------------------------------------
describe("GET /api/sales/today - Today's Sales", () => {
  it("should return today's sales summary", async () => {
    // create one sale
    await request(app)
      .post('/api/sales')
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [
          { productId: maggi._id.toString(), quantity: 2, unitPrice: 10 }
        ],
        paymentMethod: "cash"
      });

    const res = await request(app)
      .get('/api/sales/today')
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // summary comes directly as `summary`
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.totalSales).toBeGreaterThanOrEqual(1);

    // sales list should exist
    expect(Array.isArray(res.body.sales)).toBe(true);
    expect(res.body.sales.length).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/sales/daily - Daily Sales", () => {
  it("should return sales for a valid date", async () => {
    const today = new Date().toISOString().substring(0, 10);

    const res = await request(app)
      .get(`/api/sales/daily?date=${today}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.date).toBe(today);
  });

  it("should return validation error for bad date format", async () => {
    const res = await request(app)
      .get(`/api/sales/daily?date=invalid-date`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe("GET /api/sales/analytics - Sales Analytics", () => {
  it("should return analytics data for valid range", async () => {
    const res = await request(app)
      .get('/api/sales/analytics?days=7')
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it("should reject invalid analytics range", async () => {
    const res = await request(app)
      .get(`/api/sales/analytics?days=invalid`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});
});

