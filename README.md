# SmartKirana Backend

**Production-ready inventory management API for wholesale-retail kirana shops**

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-6+-success?logo=mongodb)
![Tests](https://img.shields.io/badge/Tests-60+-brightgreen)
![Coverage](https://img.shields.io/badge/Coverage-85%25-success)

[Live Demo](#) • [API Docs](#api-documentation) • [Architecture](#architecture)

</div>

---

## 🎯 What This Solves

**The Problem:** Wholesale-retail hybrid kirana shops lose ₹24-36k annually due to:
- Selling below cost (no real-time pricing checks)
- Stock wastage (manual tracking errors)
- Poor purchase decisions (no visibility into actual stock levels)

**Market Size:** 70,000-1,00,000 shops across tier 2/3/4 cities in India

**The Solution:** Transaction-safe inventory backend with:
- **Multi-unit conversion chains** (Piece → Packet → Carton)
- **3-tier price validation** (blocks below-cost sales, warns below MSP)
- **Automatic MSP review** when supplier costs change
- **Real-time stock tracking** through daily operations (no manual counting)

**Built with real constraints:**
- Non-blocking stock warnings (customer waiting ≠ refuse sale)
- Flexible pricing (owner controls, system protects margins)
- MongoDB transactions (atomic stock + billing operations)

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run development server
npm run dev

# Run tests
npm test
```

Server runs on `http://localhost:3000`

---

## 🏗️ Technical Highlights

### **1. Multi-Unit Inventory System**

```javascript
// Example: 1 Carton = 6 Packets = 144 Pieces
// Stock stored in base unit (Pieces): 1440
// Display as: 10 Cartons / 60 Packets / 1440 Pieces

// Sell 5 Packets → Deduct 120 pieces (5 × 24)
// Buy 10 Cartons → Add 1440 pieces (10 × 144)
```

**Why this matters:** Handles real-world complexity where same product sold in multiple units.

---

### **2. Transaction-Safe Operations**

```javascript
// MongoDB transactions ensure atomicity
await session.withTransaction(async () => {
  // 1. Validate stock
  // 2. Update product stock
  // 3. Create bill record
  // All succeed or all rollback
});
```

**60+ integration tests** covering transaction atomicity, price validation edge cases, and concurrent operations.

---

### **3. Intelligent Price Validation**

```javascript
// 3-tier validation logic:
if (sellingPrice < costPrice) {
  return { error: "BLOCKED: Cannot sell below cost" }
}
if (sellingPrice < MSP) {
  return { warning: "Below MSP. Proceed?" }
}
// Allow sale
```

**Business impact:** Prevents ₹24-36k annual losses from selling below cost.

---

### **4. Automatic MSP Review Workflow**

```javascript
// When cost increases during purchase:
if (newCost > currentMSP) {
  return {
    status: "MSP_REVIEW_REQUIRED",
    suggestedMSP: newCost * 1.10  // Auto-suggest 10% margin
  }
}
```

**Why:** Ensures margins maintained automatically when supplier costs change.

---

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Runtime** | Node.js 18+ |
| **Framework** | Express.js |
| **Database** | MongoDB 6+ (Mongoose ODM) |
| **Authentication** | JWT (jsonwebtoken) |
| **Testing** | Jest + Supertest (60+ tests) |
| **Architecture** | Repository Pattern + MVC |

---

## 📐 Architecture

```
┌──────────────┐
│   Express    │  Routes → Controllers → Services → Repositories
│   Routes     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Controllers  │  Request validation, Response formatting
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Services   │  Business logic, Transactions, MSP calculations
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Repositories │  Database operations, Queries
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   MongoDB    │  Products, Bills, Purchases, Users
└──────────────┘
```

**Key Design Decisions:**

✅ **Repository Pattern** → Clean separation, easy testing  
✅ **Stock in base unit** → Single source of truth, no conversion errors  
✅ **No separate StockMovement model** → Bills/Purchases already track history  
✅ **Non-blocking warnings** → System doesn't dictate business decisions  

---

## 🔌 Core APIs

### **Products**

```http
POST   /api/products              # Create multi-unit product
GET    /api/products              # List with pagination
GET    /api/products/:id          # Get details
PUT    /api/products/:id          # Update MSP
DELETE /api/products/:id          # Soft delete
```

### **Bills (Sales)**

```http
POST   /api/bills                 # Create bill with validation
POST   /api/bills/preview         # Preview before save
GET    /api/bills                 # List with filters
GET    /api/bills/:id             # Get bill details
DELETE /api/bills/:id             # Delete bill (restore stock)
```

### **Purchases**

```http
POST   /api/purchases             # Create purchase
POST   /api/purchases/retry       # Retry with updated MSP
GET    /api/purchases             # Purchase history
GET    /api/purchases/:id         # Purchase details
```

### **Dashboard**

```http
GET    /api/dashboard/summary     # Today's sales, low stock alerts
GET    /api/dashboard/stats       # Product & revenue stats
```

[**Full API Documentation →**](#api-documentation)

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific module
npm test tests/integration/product.test.js

# Coverage report
npm test -- --coverage
```

### **Test Coverage**

| Module | Tests | Coverage |
|--------|-------|----------|
| Products | 20+ | Multi-unit creation, MSP updates |
| Bills | 20+ | Price validation, stock warnings |
| Purchases | 20+ | MSP review, transaction atomicity |
| **Total** | **60+** | **85%+ coverage** |

**Key scenarios tested:**
- ✅ Transaction rollback on failures
- ✅ Price validation edge cases (cost/MSP boundaries)
- ✅ Multi-unit conversions accuracy
- ✅ Concurrent stock operations
- ✅ User data isolation

---

## 📊 Database Schema

<details>
<summary><b>Product Schema (Click to expand)</b></summary>

```javascript
{
  productName: "Maggi Noodles",
  units: [
    { unitName: "piece", isBaseUnit: true },
    { unitName: "packet", isBaseUnit: false },
    { unitName: "carton", isBaseUnit: false }
  ],
  variations: [
    {
      unitName: "piece",
      containsQuantity: 1,
      minSellingPrice: 5,
      currentStock: 1440  // Always in base unit
    },
    {
      unitName: "packet",
      containsQuantity: 24,  // 24 pieces
      minSellingPrice: 120
    },
    {
      unitName: "carton",
      containsQuantity: 6,   // 6 packets = 144 pieces
      minSellingPrice: 700
    }
  ],
  costPricePerBaseUnit: 4.17,
  minStockLevel: { value: 720, unit: "piece" },
  userId: ObjectId
}
```

</details>

<details>
<summary><b>Bill Schema (Click to expand)</b></summary>

```javascript
{
  billNumber: "BILL-20250208-001",
  customerName: "Ramesh Retailers",
  items: [
    {
      productId: ObjectId,
      variationId: ObjectId,
      variationName: "Packet",
      quantity: 10,
      pricePerUnit: 120,
      lineTotal: 1150,  // Negotiated
      costPerUnit: 100,
      stockBefore: 1440,
      stockAfter: 1200
    }
  ],
  subTotal: 1200,
  discount: -50,
  finalTotal: 1150,
  warnings: [
    { type: "BELOW_MSP", message: "..." }
  ],
  userId: ObjectId,
  createdAt: Date
}
```

</details>

<details>
<summary><b>Purchase Schema (Click to expand)</b></summary>

```javascript
{
  supplierName: "Nestle Distributor",
  items: [
    {
      productId: ObjectId,
      variationId: ObjectId,
      quantity: 10,
      costPerUnit: 720,  // New cost
      oldCostPerUnit: 600,
      stockBefore: 1440,
      stockAfter: 2880
    }
  ],
  totalCost: 7200,
  mspReviewRequired: true,
  mspUpdates: [
    { variationId: ObjectId, newMSP: 792 }
  ],
  userId: ObjectId
}
```

</details>

---

## 📂 Project Structure

```
smartkirana-backend/
├── src/
│   ├── models/              # Mongoose schemas
│   ├── controllers/         # Request handlers
│   ├── services/            # Business logic
│   ├── repositories/        # DB operations
│   ├── routes/              # API routes
│   ├── middleware/          # Auth, error handling
│   └── utils/               # Validators, helpers
├── tests/
│   ├── integration/         # API tests
│   └── helpers/             # Test utilities
├── .env.example
└── package.json
```

---

## 🔐 Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/smartkirana

# JWT
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRES_IN=7d

# CORS (Optional)
CORS_ORIGIN=http://localhost:5173
```

---

## 📖 API Documentation

### Authentication

<details>
<summary><b>POST /api/auth/register</b></summary>

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Ramesh Kumar",
  "email": "ramesh@example.com",
  "password": "securePass123",
  "role": "owner"
}

Response:
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "user": { ... }
  }
}
```

</details>

<details>
<summary><b>POST /api/auth/login</b></summary>

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "ramesh@example.com",
  "password": "securePass123"
}

Response:
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "user": { ... }
  }
}
```

</details>

### Products

<details>
<summary><b>POST /api/products - Create Multi-Unit Product</b></summary>

```http
POST /api/products
Authorization: Bearer {token}
Content-Type: application/json

{
  "productName": "Maggi Noodles",
  "units": [
    { "unitName": "piece", "isBaseUnit": true },
    { "unitName": "packet", "isBaseUnit": false },
    { "unitName": "carton", "isBaseUnit": false }
  ],
  "variations": [
    {
      "unitName": "piece",
      "variationName": "Piece",
      "containsQuantity": 1,
      "containsUnitName": "piece",
      "minSellingPrice": 5
    },
    {
      "unitName": "packet",
      "variationName": "Packet",
      "containsQuantity": 24,
      "containsUnitName": "piece",
      "minSellingPrice": 120
    },
    {
      "unitName": "carton",
      "variationName": "Carton",
      "containsQuantity": 6,
      "containsUnitName": "packet",
      "minSellingPrice": 700
    }
  ],
  "minStockLevel": { "value": 720, "unit": "piece" }
}

Response:
{
  "success": true,
  "data": {
    "productId": "...",
    "productName": "Maggi Noodles",
    "variations": [ ... ]
  }
}
```

</details>

<details>
<summary><b>GET /api/products - List Products</b></summary>

```http
GET /api/products?page=1&limit=10&search=maggi
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": [...products],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalProducts": 25,
    "limit": 10
  }
}
```

</details>

### Bills

<details>
<summary><b>POST /api/bills - Create Bill with Validation</b></summary>

```http
POST /api/bills
Authorization: Bearer {token}
Content-Type: application/json

{
  "customerName": "Ramesh Retailers",
  "items": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "variationId": "507f1f77bcf86cd799439012",
      "quantity": 10,
      "pricePerUnit": 120,
      "lineTotal": 1150
    }
  ],
  "discount": -50
}

Success Response:
{
  "success": true,
  "data": {
    "billId": "...",
    "billNumber": "BILL-20250208-001",
    "finalTotal": 1150
  },
  "warnings": [
    {
      "type": "BELOW_MSP",
      "message": "Price below MSP for Packet"
    }
  ]
}

Error Response (Below Cost):
{
  "success": false,
  "error": "Cannot sell below cost price"
}
```

</details>

### Purchases

<details>
<summary><b>POST /api/purchases - Create Purchase</b></summary>

```http
POST /api/purchases
Authorization: Bearer {token}
Content-Type: application/json

{
  "supplierName": "Nestle Distributor",
  "items": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "variationId": "507f1f77bcf86cd799439012",
      "quantity": 10,
      "costPerUnit": 720
    }
  ]
}

Success Response:
{
  "success": true,
  "data": {
    "purchaseId": "...",
    "totalCost": 7200,
    "stockUpdated": true
  }
}

MSP Review Required Response:
{
  "success": false,
  "status": "MSP_REVIEW_REQUIRED",
  "data": {
    "items": [
      {
        "productId": "...",
        "variationId": "...",
        "oldCost": 600,
        "newCost": 720,
        "currentMSP": 700,
        "suggestedMSP": 792
      }
    ]
  }
}
```

</details>

<details>
<summary><b>POST /api/purchases/retry - Retry with Updated MSP</b></summary>

```http
POST /api/purchases/retry
Authorization: Bearer {token}
Content-Type: application/json

{
  "supplierName": "Nestle Distributor",
  "items": [ ... ],
  "mspUpdates": [
    {
      "variationId": "507f1f77bcf86cd799439012",
      "newMSP": 792
    }
  ]
}

Response:
{
  "success": true,
  "data": {
    "purchaseId": "...",
    "mspUpdated": true
  }
}
```

</details>

---

## 🚀 Business Logic Examples

### Example 1: Multi-Unit Stock Calculation

```javascript
// Current Stock: 1440 pieces
// Display options:
- As Pieces: 1440 Pieces
- As Packets: 60 Packets (1440 / 24)
- As Cartons: 10 Cartons (1440 / 144)

// Billing:
- Sell 5 Packets → Deduct 120 pieces (5 × 24)
- Sell 2 Cartons → Deduct 288 pieces (2 × 144)

// Purchase:
- Buy 10 Cartons → Add 1440 pieces (10 × 144)
```

### Example 2: Price Validation Flow

```javascript
// User sells 10 Packets @ ₹110 each

Step 1: Calculate cost per packet
  costPerUnit = costPricePerBaseUnit × conversionToBase
  = ₹4.17 × 24 = ₹100.08

Step 2: Validate
  if (110 < 100.08) → ❌ BLOCK "Cannot sell below cost"
  if (110 < 120) → ⚠️ WARN "Below MSP. Proceed?"
  else → ✅ ALLOW

Step 3: Process bill
  - Deduct stock: 10 × 24 = 240 pieces
  - Create bill record
  - Return warnings array
```

### Example 3: MSP Review Workflow

```javascript
// Scenario: Cost increased

Before:
  Cost per Carton: ₹600
  MSP per Carton: ₹700
  Margin: ₹100 (16.7%)

Purchase with new cost:
  New Cost per Carton: ₹720
  Problem: MSP (₹700) < New Cost (₹720) ❌

Backend Response:
  {
    status: "MSP_REVIEW_REQUIRED",
    suggestedMSP: 792  // ₹720 × 1.10
  }

After User Updates MSP:
  New MSP: ₹792
  New Margin: ₹72 (10%)
  ✅ Purchase completes
```

---

## 🎯 Key Features Demonstrated

### **1. Production-Ready Code**
- ✅ Repository Pattern for clean architecture
- ✅ MongoDB transactions for data integrity
- ✅ Comprehensive error handling
- ✅ Input validation on all endpoints
- ✅ JWT authentication with role-based access

### **2. Business Logic Complexity**
- ✅ Multi-unit conversion chains
- ✅ 3-tier price validation (cost/MSP/negotiation)
- ✅ Automatic MSP review workflow
- ✅ Non-blocking stock warnings
- ✅ Line-item and bill-level discount validation

### **3. Testing & Quality**
- ✅ 60+ integration tests
- ✅ Transaction atomicity verified
- ✅ Edge cases covered (negative stock, concurrent ops)
- ✅ User isolation tested
- ✅ 85%+ code coverage

### **4. Real-World Thinking**
- ✅ Handles actual operational constraints
- ✅ Non-blocking warnings (customer waiting scenario)
- ✅ Flexible pricing with cost protection
- ✅ Automatic margin maintenance
- ✅ Built for 70k+ potential users

---

## 🔄 Status & Roadmap

### **Current Status: Production-Ready Backend** ✅

✅ Complete Phase 2 Implementation:
- Multi-unit inventory system
- Variation-based billing
- Price validation (cost/MSP)
- MSP review workflow
- Stock warnings
- Temporary products
- Comprehensive testing

### **Future Enhancements** 🔜

- [ ] **Voice-based operations** (Hindi voice commands for billing)
- [ ] **Festival mode intelligence** (demand spike predictions)
- [ ] **Multi-location inventory** (chain store support)
- [ ] **Market price intelligence** (competitor price tracking)
- [ ] **AI-powered features**:
  - Predictive reordering (stock-out prevention)
  - Smart defaults (frequently bought together)
  - Sales trends & insights

---

## 👨‍💻 Author

**Mayank Mehta**

Backend Developer specializing in Node.js, Express.js, and MongoDB

- 💻 Building production-grade systems that solve real operational problems
- 🎯 650+ LeetCode problems solved (1772 rating, top 8.72%)
- 📧 [mayankmehta1327@gmail.com](mailto:mayankmehta1327@gmail.com)
- 🔗 [GitHub](https://github.com/mayank1327) • [LeetCode](https://leetcode.com/u/mayank1327)

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

Built with these excellent tools:
- **MongoDB** & Mongoose for robust data management
- **Express.js** for scalable API framework
- **JWT** for secure authentication
- **Jest** & Supertest for comprehensive testing

---

<div align="center">

**Built to solve real problems for 70,000+ kirana shops across India** 🇮🇳

[⬆ Back to Top](#smartkirana-backend)

</div>
