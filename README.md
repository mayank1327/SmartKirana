# 🏪 SmartKirana - Backend (Phase 2)

**Multi-Unit Inventory Management System for Kirana Stores**

A complete backend solution for small retail stores with advanced multi-unit product management, variation-based billing, and intelligent MSP review workflow.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Business Logic](#-business-logic)
- [Testing](#-testing)
- [Project Structure](#-project-structure)
- [Environment Variables](#-environment-variables)

---

## ✨ Features

### **Core Modules**

#### 🔐 **Authentication**
- JWT-based authentication
- Role-based access (Owner, Staff)
- Secure password hashing (bcrypt)
- Token validation middleware

#### 📦 **Product Management (Phase 2 Multi-Unit)**
- **Multi-unit hierarchy**: Piece → Packet → Carton
- **Conversion chains**: 1 Carton = 6 Packets = 144 Pieces
- **Variation-based selling**: Sell in any unit
- **Stock tracking**: Always in base unit (pieces)
- **MSP auto-derivation**: Set one MSP, others auto-calculate
- **Cost price tracking**: Per base unit

#### 💰 **Billing / Sales (Phase 2)**
- **Variation selection**: Choose which unit to sell
- **Real-time stock warnings**: Non-blocking overselling alerts
- **Price validation**: 
  - ❌ Block if price < cost
  - ⚠️ Warn if price < MSP
- **Line total negotiation**: Edit total, effective price auto-calculates
- **Bill-level discount**: With cost protection
- **Temporary products**: Quick add for rush hour
- **Stock deduction**: Automatic in base unit

#### 📥 **Purchase Management (Phase 2)**
- **Variation-based purchasing**: Buy in any unit
- **Cost change detection**: Automatic MSP review workflow
- **MSP review modal**: When cost increases
- **Suggested MSP**: Auto-calculated with margin
- **Stock addition**: Automatic in base unit
- **Purchase history**: Complete audit trail

#### 📊 **Dashboard & Reports**
- Today's sales summary
- Low stock alerts
- Product statistics
- Revenue tracking

---

## 🛠 Tech Stack

### **Backend**
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT (jsonwebtoken)
- **Password**: bcrypt
- **Validation**: Express validator
- **Testing**: Jest + Supertest

### **Architecture Pattern**
- **MVC Architecture**
- **Repository Pattern**
- **Service Layer**
- **Transaction Management**

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (React)                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Express Routes                          │
│  /api/auth  /api/products  /api/bills  /api/purchases   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Controllers                            │
│   (Request validation, Response formatting)              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Services                              │
│  (Business logic, Transactions, MSP calculations)        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Repositories                            │
│         (Database operations, Queries)                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    MongoDB                               │
│  Products | Bills | Purchases | Users | TempProducts    │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Installation

### **Prerequisites**
- Node.js v18+
- MongoDB v6+
- npm or yarn

### **Steps**

1. **Clone Repository**
```bash
git clone https://github.com/yourusername/smartkirana-backend.git
cd smartkirana-backend
```

2. **Install Dependencies**
```bash
npm install
```

3. **Setup Environment**
```bash
cp .env.example .env
# Edit .env with your values
```

4. **Start MongoDB**
```bash
# Local MongoDB
mongod

# Or use MongoDB Atlas (connection string in .env)
```

5. **Run Development Server**
```bash
npm run dev
```

6. **Run Tests**
```bash
npm test
```

Server runs on: `http://localhost:3000`

---

## 📡 API Documentation

### **Authentication**

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Ramesh Kumar",
  "email": "ramesh@example.com",
  "password": "securePass123",
  "role": "owner"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "ramesh@example.com",
  "password": "securePass123"
}

Response: { "token": "jwt_token_here", "user": {...} }
```

---

### **Products (Phase 2)**

#### Create Product (Multi-Unit)
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
```

#### Get All Products
```http
GET /api/products
Authorization: Bearer {token}

Response: {
  "data": [...products],
  "pagination": { "current": 1, "pages": 1, "total": 10 }
}
```

#### Get Product by ID
```http
GET /api/products/:id
Authorization: Bearer {token}
```

#### Update Product MSP
```http
PUT /api/products/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "mspUpdates": [
    { "variationId": "...", "newMSP": 125 },
    { "variationId": "...", "newMSP": 720 }
  ]
}
```

---

### **Bills / Sales (Phase 2)**

#### Create Bill
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

Response: {
  "success": true,
  "data": {
    "billId": "...",
    "billNumber": "BILL-20250208-001",
    "finalTotal": 1100,
    "stockUpdates": [...],
    "warnings": [...]
  }
}
```

#### Get Today's Bills
```http
GET /api/bills/today
Authorization: Bearer {token}

Response: {
  "data": {
    "summary": {
      "totalBills": 5,
      "totalRevenue": 5000,
      "totalItems": 25
    },
    "bills": [...]
  }
}
```

#### Get Temporary Products
```http
GET /api/bills/temporary-products
Authorization: Bearer {token}

Response: {
  "data": [
    {
      "productName": "New Biscuit",
      "totalQuantitySold": 50,
      "totalRevenue": 500,
      "billIds": [...]
    }
  ]
}
```

---

### **Purchases (Phase 2)**

#### Create Purchase
```http
POST /api/purchases
Authorization: Bearer {token}
Content-Type: application/json

{
  "supplierName": "XYZ Distributors",
  "supplierBillNumber": "INV-2025-001",
  "items": [
    {
      "productId": "507f1f77bcf86cd799439011",
      "variationId": "507f1f77bcf86cd799439012",
      "quantity": 10,
      "costPricePerUnit": 600
    }
  ]
}

# If cost changed, returns:
{
  "code": "MSP_REVIEW_REQUIRED",
  "details": {
    "mspSuggestions": [
      {
        "productId": "...",
        "productName": "Maggi Noodles",
        "variations": [
          {
            "variationId": "...",
            "variationName": "Carton",
            "oldCost": 600,
            "newCost": 720,
            "currentMSP": 700,
            "suggestedMSP": 792,
            "status": "below_cost"
          }
        ]
      }
    ]
  }
}
```

#### Create Purchase with MSP Update
```http
POST /api/purchases
Authorization: Bearer {token}
Content-Type: application/json

{
  "supplierName": "XYZ Distributors",
  "items": [...],
  "costPriceChanges": [
    {
      "productId": "...",
      "variations": [
        { "variationId": "...", "newMinSellingPrice": 800 }
      ]
    }
  ]
}
```

#### Get Purchase History
```http
GET /api/purchases
Authorization: Bearer {token}

Query params:
  ?supplierName=XYZ
  &productName=Maggi
  &startDate=2025-01-01
  &endDate=2025-12-31
  &page=1
  &limit=10
```

---

## 🗄 Database Schema

### **Product Schema**
```javascript
{
  productName: String,
  
  baseUnit: {
    _id: ObjectId,
    unitName: String  // "piece"
  },
  
  units: [{
    _id: ObjectId,
    unitName: String,     // "piece", "packet", "carton"
    isBaseUnit: Boolean
  }],
  
  variations: [{
    _id: ObjectId,
    unitId: ObjectId,
    variationName: String,      // "Packet"
    containsQuantity: Number,   // 24
    containsUnitId: ObjectId,
    conversionToBase: Number,   // 24
    minSellingPrice: Number     // 120
  }],
  
  costPricePerBaseUnit: Number,  // 4.17
  currentStock: Number,           // 1440 (always in base unit)
  minStockLevel: Number,          // 720
  
  isActive: Boolean,
  userId: ObjectId,
  
  timestamps: true
}
```

### **Bill Schema**
```javascript
{
  billNumber: String,      // "BILL-20250208-001"
  billDate: Date,
  customerName: String,
  
  items: [{
    productId: ObjectId,
    productName: String,
    variationId: ObjectId,
    variationName: String,
    quantity: Number,
    pricePerUnit: Number,
    effectivePricePerUnit: Number,
    lineTotal: Number,
    stockBefore: Number,
    stockAfter: Number,
    stockDeducted: Number
  }],
  
  subTotal: Number,
  discount: Number,         // Can be negative (discount) or positive (charge)
  finalTotal: Number,
  
  userId: ObjectId,
  timestamps: true
}
```

### **Purchase Schema**
```javascript
{
  purchaseNumber: String,  // "PUR-20250208-001"
  purchaseDate: Date,
  supplierName: String,
  supplierBillNumber: String,
  
  items: [{
    productId: ObjectId,
    productName: String,
    variationId: ObjectId,
    variationName: String,
    quantity: Number,
    costPricePerUnit: Number,
    lineTotal: Number,
    stockBefore: Number,
    stockAfter: Number,
    stockAdded: Number
  }],
  
  totalAmount: Number,
  costPriceUpdated: Boolean,
  
  userId: ObjectId,
  timestamps: true
}
```

### **TemporaryProduct Schema**
```javascript
{
  productName: String,
  totalQuantitySold: Number,
  totalRevenue: Number,
  billIds: [ObjectId],
  isPendingSetup: Boolean,
  userId: ObjectId,
  timestamps: true
}
```

---

## 🧠 Business Logic

### **1. Multi-Unit Conversion System**

**Concept**: Stock always stored in base unit (pieces)

```
Product: Maggi Noodles
- Base Unit: Piece
- 1 Packet = 24 Pieces
- 1 Carton = 6 Packets = 144 Pieces

Stock: 1440 pieces (in database)

Display:
- As Pieces: 1440 Pieces
- As Packets: 60 Packets (1440 / 24)
- As Cartons: 10 Cartons (1440 / 144)

Billing:
- Sell 5 Packets → Deduct 120 pieces (5 × 24)
- Sell 2 Cartons → Deduct 288 pieces (2 × 144)

Purchase:
- Buy 10 Cartons → Add 1440 pieces (10 × 144)
```

### **2. Price Validation (Bills)**

```
Flow:
1. User enters: Qty = 10 Packets, Price = ₹110

2. Calculate effective price:
   - If lineTotal edited: effectivePrice = lineTotal / quantity
   - Else: effectivePrice = pricePerUnit

3. Get cost per variation:
   - costPerUnit = costPricePerBaseUnit × conversionToBase
   - For Packet: ₹4.17 × 24 = ₹100.08

4. Validate:
   - If effectivePrice < costPerUnit → ❌ BLOCK (error)
   - If effectivePrice < MSP → ⚠️ WARN (allow)
   - Else → ✅ ALLOW

5. Response:
   - Block: { error: "Cannot sell below cost" }
   - Warn: { warnings: [{ type: "BELOW_MSP", ... }] }
```

### **3. Stock Warning (Non-blocking)**

```
Flow:
1. User wants: 15 Cartons
2. Available stock: 1440 pieces = 10 Cartons
3. Required stock: 15 × 144 = 2160 pieces

4. Check: 2160 > 1440 → Insufficient

5. Response:
   ⚠️ Warning: "Only 10 Cartons available. Will create negative stock."
   
6. Allow sale → Stock becomes: -720 pieces

Why allow? Real-world scenario: Customer waiting, supplier coming tomorrow
```

### **4. MSP Review Workflow (Purchases)**

```
Scenario: Cost increased

Before:
- Cost per Carton: ₹600 (₹4.17/piece)
- MSP per Carton: ₹700

Purchase:
- New cost per Carton: ₹720 (₹5/piece)

Problem:
- MSP (₹700) < New Cost (₹720) ❌
- Cannot sell at loss!

Solution:
1. Backend detects cost change
2. Returns: MSP_REVIEW_REQUIRED
3. Frontend shows modal with:
   - Old cost vs New cost
   - Current MSP vs Suggested MSP
   - Editable new MSP fields
4. User updates MSPs
5. Retry purchase with updated MSPs

Auto-suggestion:
- Suggested MSP = New Cost × 1.10 (10% margin)
- For Carton: ₹720 × 1.10 = ₹792
```

### **5. Bill-Level Discount Validation**

```
Items:
- 10 Cartons @ ₹700 = ₹7000
Sub Total: ₹7000

Cost:
- 10 Cartons × ₹600 = ₹6000

User enters discount: -₹500
Final Total: ₹6500

Validation:
- Final Total (₹6500) > Total Cost (₹6000) ✅ ALLOW

User enters discount: -₹1500
Final Total: ₹5500

Validation:
- Final Total (₹5500) < Total Cost (₹6000) ❌ BLOCK
- Error: "Total below cost! Reduce discount."
```

---

## 🧪 Testing

### **Run Tests**
```bash
# All tests
npm test

# Specific module
npm test tests/integration/product.test.js
npm test tests/integration/bill.test.js
npm test tests/integration/purchase.test.js

# Coverage
npm test -- --coverage
```

### **Test Coverage**
```
Products:   20+ tests (Create, List, Detail, Edit, Delete)
Bills:      20+ tests (Create, Preview, Warnings, Validation)
Purchases:  20+ tests (Create, MSP Review, History)
Total:      60+ tests
```

### **Key Test Scenarios**
- ✅ Multi-unit product creation
- ✅ Variation-based billing
- ✅ Price validation (cost/MSP)
- ✅ Stock warnings (non-blocking)
- ✅ Line total negotiation
- ✅ Bill-level discount
- ✅ MSP review workflow
- ✅ Transaction atomicity
- ✅ User isolation

---

## 📂 Project Structure

```
smartkirana-backend/
├── src/
│   ├── models/
│   │   ├── User.js
│   │   ├── Product.js          # Phase 2 multi-unit
│   │   ├── Bill.js              # Phase 2 variation-based
│   │   ├── Purchase.js          # Phase 2 MSP review
│   │   └── TemporaryProduct.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── billController.js
│   │   └── purchaseController.js
│   │
│   ├── services/
│   │   ├── authService.js
│   │   ├── productService.js    # Multi-unit logic
│   │   ├── billService.js       # Price validation
│   │   └── purchaseService.js   # MSP review
│   │
│   ├── repositories/
│   │   ├── userRepository.js
│   │   ├── productRepository.js
│   │   ├── billRepository.js
│   │   └── purchaseRepository.js
│   │
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── productRoutes.js
│   │   ├── billRoutes.js
│   │   └── purchaseRoutes.js
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── errorHandler.js
│   │
│   ├── utils/
│   │   └── validators.js
│   │
│   ├── config/
│   │   └── database.js
│   │
│   └── app.js
│
├── tests/
│   ├── integration/
│   │   ├── product.test.js
│   │   ├── bill.test.js
│   │   └── purchase.test.js
│   │
│   └── helpers/
│       ├── authHelper.js
│       └── productHelper.js
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 🔧 Environment Variables

Create `.env` file:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/smartkirana
# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/smartkirana

# JWT
JWT_SECRET=your_super_secret_key_here_min_32_chars
JWT_EXPIRES_IN=7d

# CORS (Optional)
CORS_ORIGIN=http://localhost:5173
```

---

## 🚦 Status & Roadmap

### **Phase 2 - COMPLETE** ✅
- [x] Multi-unit product system
- [x] Variation-based billing
- [x] Price validation (cost/MSP)
- [x] MSP review workflow
- [x] Stock warnings
- [x] Temporary products
- [x] Comprehensive tests

### **Future Enhancements** 🔜
- [ ] Barcode scanning
- [ ] Reports & Analytics
- [ ] Supplier management
- [ ] Expense tracking
- [ ] Employee management
- [ ] Mobile app (React Native)

---

## 📝 Key Decisions & Why

### **Why No StockMovement Model?**
- Bill & Purchase records already contain movement history
- Each item has: stockBefore, stockAfter, quantity
- Single source of truth
- Less complexity, easier debugging

### **Why Stock in Base Unit?**
- Consistency: One source of truth
- Simplicity: No conversion errors
- Flexibility: Display in any unit easily
- Accuracy: Exact stock tracking

### **Why Non-blocking Stock Warnings?**
- Real-world: Customer waiting, can't refuse sale
- Trust: Owner knows overselling, supplier coming
- Flexibility: System doesn't dictate business

### **Why MSP Review on Cost Change?**
- Prevents selling at loss
- Auto-suggests profitable MSP
- Maintains margins automatically
- Reduces manual errors

---

## 🤝 Contributing

```bash
1. Fork repository
2. Create feature branch: git checkout -b feature/amazing
3. Commit changes: git commit -m 'Add amazing feature'
4. Push branch: git push origin feature/amazing
5. Open Pull Request
```

---

## 📄 License

MIT License - See LICENSE file

---

## 👨‍💻 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- MongoDB for excellent ODM (Mongoose)
- Express.js for robust framework
- JWT for secure authentication
- Jest for comprehensive testing

---

## 📞 Support

**Issues?** Open GitHub issue
**Questions?** Email: support@smartkirana.com
**Docs?** [Full Documentation](https://docs.smartkirana.com)

---

**Built with ❤️ for Kirana store owners across India** 🇮🇳

---

## Quick Start Commands

```bash
# Install
npm install

# Development
npm run dev

# Production
npm start

# Test
npm test

# Test Coverage
npm run test:coverage

# Lint
npm run lint
```

**Happy Coding! 🚀**
