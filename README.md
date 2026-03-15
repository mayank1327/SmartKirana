<div align="center">

# 🏪 SmartKirana Backend

### Multi-Unit Inventory Management System for Wholesale-Retail Kirana Shops

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Jest](https://img.shields.io/badge/Jest-Testing-C21325?style=flat-square&logo=jest&logoColor=white)](https://jestjs.io)
[![Swagger](https://img.shields.io/badge/Swagger-API%20Docs-85EA2D?style=flat-square&logo=swagger&logoColor=black)](https://swagger.io)

**Built to solve a real problem — daily operational chaos in 70,000+ wholesale-retail hybrid kirana shops across tier 2/3 cities in India**

[API Docs](#-api-documentation) · [Architecture](#-architecture) · [Business Logic](#-business-logic) · [Quick Start](#-quick-start)

</div>

---

## 🎯 The Problem This Solves

My family runs a wholesale kirana shop. Every day I watched the same chaos — stock mismatches, selling below cost, ordering based on memory, losing ₹24-36k annually to financial leakage that a proper system would prevent.

**SmartKirana automates what pen-paper can't:**

| Problem | Solution |
|---------|----------|
| "How much Maggi do I have?" | Real-time stock in any unit — pieces, packets, cartons |
| Selling below cost accidentally | Hard block at billing — system prevents loss |
| MSP forgotten after cost increase | Automatic MSP review triggered on every cost change |
| Rush hour — unknown product | Temporary products — bill now, register later |
| Stock-out surprises | Dashboard alerts — low stock, out of stock |

---

## ✨ What Makes This Different

### 1. Multi-Unit Conversion System
Most inventory systems store stock in one unit. SmartKirana handles real kirana complexity:

```
Maggi Noodles
├── Base Unit: Piece (stored in DB)
├── 1 Packet = 24 Pieces  (conversionToBase: 24)
└── 1 Carton = 6 Packets = 144 Pieces  (conversionToBase: 144)

Stock in DB: 1440 pieces
Display:
  → 1440 Pieces  OR
  → 60 Packets   OR  
  → 10 Cartons
```

### 2. Phase 1/2 Separation — Validate Then Write
Every critical operation (billing, purchase) validates everything first before touching the database. One failure = zero changes.

```
Phase 1 (Read-only)          Phase 2 (DB Writes)
─────────────────────        ─────────────────────
✓ Validate all items    →    Stock deduct/add
✓ Check prices              Cost price update
✓ MSP review               MSP update
✓ Stock availability        Purchase record create
         ↑
    If ANY fails here,
    Phase 2 never runs
    (MongoDB Transaction rollback)
```

### 3. Business-Aware Price Protection

```
Selling Price < Cost Price  →  ❌ BLOCKED (prevents loss)
Selling Price < MSP         →  ⚠️  WARNING (owner decides)
Stock < Required            →  ⚠️  WARNING (allow — customer waiting)
```

---

## 🏗 Architecture

```
Routes → Middleware → Controller → Service → Repository → MongoDB
                                                              ↓
User   ←  Response  ← Controller ← Service ← Repository ← Model
```

**4-Layer Architecture:**

```
src/
├── routes/          # Express routes + Swagger docs
├── controllers/     # Thin layer — extract, pass, respond
├── services/        # Business logic, transactions, validations
├── repositories/    # MongoDB operations, query abstraction
├── models/          # Mongoose schemas, indexes, hooks
├── middleware/       # auth, validate, errorHandler
├── validators/      # Joi schemas per feature
├── utils/           # AppError, formatStockDisplay, jwt
└── config/          # DB connection, Swagger spec
```

**Key Patterns:**
- **Repository Pattern** — Singleton instances, session-aware queries
- **MongoDB Transactions** — `withTransaction` for atomic multi-document writes
- **AppError** — Centralized error class, consistent HTTP codes
- **Joi Validation** — Request validation before controller, cleaned data passed forward
- **Security** — `findOne({ _id, userId, isActive })` everywhere — data isolation by design

---

## 🧠 Business Logic

### Billing Flow
```
User selects: Product → Variation → Quantity → Price
                                                  ↓
              Phase 1: Validate all items
              ├── Product exists & belongs to user?
              ├── Variation valid?
              ├── Price >= Cost?  (BLOCK if not)
              ├── Price >= MSP?   (WARN if not)
              └── Stock sufficient? (WARN if not — allow overselling)
                                                  ↓
              Phase 2: DB Writes (MongoDB Transaction)
              ├── Deduct stock (base unit)
              ├── Create bill document
              └── Update TemporaryProduct records
```

### Purchase Flow — MSP Review
```
User records purchase: Variation → Quantity → Cost Price
                                                  ↓
              hasCostPriceChanged?
              ├── NO  → Add stock, done
              └── YES → MSP Review Required
                        ├── User provides new MSP for all variations
                        ├── System validates: MSP > Cost (each variation)
                        └── Update cost + MSP + stock (one transaction)
```

### Stock Display
```
DB: currentStock = 1440 pieces

formatStockDisplay():
  sorted variations by conversionToBase (desc)
  → "10 Carton | 60 Packet | 1440 Piece"
  
Each variation independent — system doesn't assume packaging
```

---

## 📦 Features

### 🔐 Authentication
- JWT-based, `protect` middleware on all non-auth routes
- `select: false` on password field
- Same error for wrong email/password — prevents user enumeration

### 📦 Products
- Multi-unit hierarchy with variation chain validation
- Circular dependency detection in variations
- Case-insensitive duplicate name prevention (ReDoS-safe regex)
- Soft delete — data preserved for billing history
- Compound indexes: `userId + isActive`, `userId + productName (unique)`

### 💰 Billing
- Regular + Temporary product items in same bill
- Line total negotiation — effective price auto-calculated
- Bill-level discount with cost protection
- Non-blocking stock warnings — real shops can oversell
- Automatic `TemporaryProduct` record creation for unregistered items
- `BILL-YYYYMMDD-XXX` auto-generated bill numbers

### 📥 Purchases
- Variation-based purchasing in any unit
- Duplicate product detection in single purchase
- Cost change detection — exact integer comparison
- MSP review — user provides all variation MSPs when cost changes
- `PUR-YYYYMMDD-XXX` auto-generated purchase numbers

### 🔖 Temporary Products
- Created automatically during billing
- Usage tracking — `billIds`, `totalRevenue`, `lastSoldDate`
- One-click setup — converts to real product (transaction-safe)
- `isPendingSetup` flag — dashboard shows pending count

### 📊 Reports
- Dashboard — 4 cards in single API call
- Low stock — separate out-of-stock and low-stock lists
- Today's bills — count + revenue + bill list
- Weekly purchases — count + purchase list

---

## 🧪 Testing

**Integration tests only** — full HTTP request → DB → response cycle.

```bash
npm test                          # All tests
npm test -- --coverage            # With coverage report
npm test tests/integration/bills  # Specific module
```

**Coverage:**

| Module | Tests | Key Scenarios |
|--------|-------|---------------|
| Auth | 10+ | Register, login, validation, duplicate email |
| Products | 17+ | CRUD, multi-unit, conversion chain, MSP derive |
| Bills | 20+ | Happy path, price validation, stock warnings, atomicity |
| Purchases | 20+ | Cost change, MSP review, rollback, duplicate product |
| Temporary Products | 15+ | CRUD, aggregation, setup flow |
| Reports | 15+ | Dashboard, low stock, today bills, weekly purchases |

**Key test patterns:**
```javascript
// beforeEach — DB clean slate
beforeEach(async () => { await User.deleteMany({}); });

// DB verification — not just HTTP status
const productAfter = await Product.findById(productId);
expect(productAfter.currentStock).toBe(2880);

// Transaction atomicity
expect(purchaseCount).toBe(0);      // Rolled back
expect(maggiAfter.currentStock).toBe(1440); // Unchanged
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB v6+ (local or Atlas)

### Setup

```bash
# Clone
git clone https://github.com/mayank1327/smartkirana-backend.git
cd smartkirana-backend

# Install
npm install

# Environment
cp .env.example .env
# Fill in MONGODB_URI and JWT_SECRET

# Run
npm run dev          # Development (nodemon)
npm start            # Production
npm test             # Tests
```

### Environment Variables

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/smartkirana
JWT_SECRET=your_32_char_minimum_secret_here
JWT_EXPIRES_IN=7d
```

---

## 📡 API Documentation

Interactive Swagger docs available at:
```
http://localhost:3000/api/docs
```

### Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/products` | List products (search, lowStock, pagination) |
| POST | `/api/products` | Create multi-unit product |
| GET | `/api/products/:id` | Product detail |
| PUT | `/api/products/:id` | Update name, minStock, MSP |
| DELETE | `/api/products/:id` | Soft delete |
| GET | `/api/bills` | List bills (date range, customer filter) |
| POST | `/api/bills` | Create bill (stock auto-deducts) |
| GET | `/api/bills/:billId` | Bill detail |
| GET | `/api/purchases` | List purchases |
| POST | `/api/purchases` | Record purchase (stock adds, MSP review) |
| GET | `/api/purchases/:purchaseId` | Purchase detail |
| GET | `/api/temporary-products` | Pending setup list |
| POST | `/api/temporary-products/:id/setup` | Convert to real product |
| DELETE | `/api/temporary-products/:id` | Dismiss |
| GET | `/api/reports/dashboard` | 4-card dashboard stats |
| GET | `/api/reports/low-stock` | Low + out of stock products |
| GET | `/api/reports/today-bills` | Today's bills summary |
| GET | `/api/reports/weekly-purchases` | This week's purchases |

### Example — Create Bill

```json
POST /api/bills
Authorization: Bearer <token>

{
  "customerName": "Ramesh Retailers",
  "items": [
    {
      "productId": "64abc123",
      "variationId": "64abc456",
      "quantity": 10,
      "pricePerUnit": 120,
      "lineTotal": 1150
    },
    {
      "isTemporary": true,
      "productName": "Lays Classic",
      "quantity": 5,
      "pricePerUnit": 20
    }
  ],
  "discount": -50
}
```

```json
Response 201:
{
  "success": true,
  "data": {
    "billNumber": "BILL-20240115-001",
    "finalTotal": 1200,
    "warnings": [
      {
        "type": "BELOW_MSP",
        "message": "Selling Maggi Noodles (Packet) below minimum price",
        "details": { "msp": 120, "soldAt": 115 }
      }
    ],
    "stockUpdates": [
      {
        "productName": "Maggi Noodles",
        "variationName": "Packet",
        "stockBefore": 1440,
        "stockAfter": 1200,
        "stockAdded": -240
      }
    ]
  }
}
```

---

## 🗄 Database Schema Overview

```
Users          Products            Bills
─────          ────────            ─────
_id            _id                 _id
name           productName         billNumber
email          baseUnit{}          billDate
password*      units[]             customerName
               variations[]        items[]
               costPricePerBase    subTotal
               currentStock        discount
               minStockLevel       finalTotal
               isActive            userId
               userId

Purchases      TemporaryProducts
─────────      ─────────────────
_id            _id
purchaseNumber productName
supplierName   totalRevenue
items[]        billIds[]
totalAmount    isPendingSetup
userId         convertedProductId
               userId
```

**Indexes (multi-tenant aware):**
```javascript
{ userId: 1, isActive: 1 }           // Product queries
{ userId: 1, productName: 1 }  unique // Duplicate prevention
{ userId: 1, billDate: -1 }           // Bill history
{ userId: 1, purchaseDate: -1 }       // Purchase history
{ userId: 1, isPendingSetup: 1 }      // Temp products dashboard
```

---

## 🔑 Key Engineering Decisions

**Why stock in base unit only?**
One source of truth. No conversion errors. Display in any unit at read time.

**Why non-blocking stock warnings?**
Real shops can't refuse a customer because "the system says no." Owner knows their business — system warns, doesn't block.

**Why MSP review on every cost change?**
Selling below cost is a silent killer for small shops. System forces MSP reconsideration automatically.

**Why soft delete?**
Billing history references products. Hard delete breaks historical records. `isActive: false` preserves integrity.

**Why `findOne({ _id, userId })` everywhere?**
Data isolation by design. A user can never access another user's data — even with a valid ID — without separate authorization logic.

**Why Phase 1/2 separation?**
Validate everything before writing anything. Partial states are worse than no change. MongoDB transactions handle atomicity.

---

## 🏆 Achievements

- 🥉 3rd Place — Central India Hackathon 3.0
- 🥉 3rd Place Nationally — Build for Bharat 2025 (853 teams)

---

## 👨‍💻 Author

**Mayank Mehta**
Final year B.Tech ECE @ UIT RGPV Bhopal

[![GitHub](https://img.shields.io/badge/GitHub-mayank1327-181717?style=flat-square&logo=github)](https://github.com/mayank1327)
[![LeetCode](https://img.shields.io/badge/LeetCode-650%2B%20solved-FFA116?style=flat-square&logo=leetcode&logoColor=black)](https://leetcode.com)
[![Email](https://img.shields.io/badge/Email-mayankmehta1327%40gmail.com-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:mayankmehta1327@gmail.com)

---

<div align="center">

**Built with real domain knowledge, for a real problem, with production-grade engineering.**

*SmartKirana is not a tutorial project — it's a system designed to handle the daily operational reality of Indian kirana shops.*

</div>