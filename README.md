<div align="center">

# SmartKirana — Backend

### _Stock clarity for wholesale-first kirana shops_

> My family runs a Level 5 kirana — 70% wholesale, 30% retail, 300+ products, zero stock clarity.
> SmartKirana is what I built to fix that. Every design decision traces back to something real.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-5.x-000000?style=flat-square&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-120%2B%20passing-brightgreen?style=flat-square&logo=jest)
![JWT](https://img.shields.io/badge/Auth-JWT-orange?style=flat-square)
![Status](https://img.shields.io/badge/Status-Production%20Ready-blue?style=flat-square)

**[API Docs (Swagger)](#api-documentation) · [Architecture](#architecture) · [Business Logic](#business-logic-that-matters) · [Quick Start](#quick-start)**

</div>

---

## The Problem

India's kirana supply chain has 6–7 levels. Level 5 — the wholesale + retail hybrid — is the most complex and the most underserved. These shops run 70% wholesale (selling to smaller retailers) and 30% retail (walk-in consumers), manage 200–500 products, operate with 2–3 people total, and earn ₹15,000–30,000 monthly profit. Too complex for pen-paper. Too small for enterprise software.

**Our addressable market within Level 5:** ~70,000–1,00,000 shops that match all of: 200+ products, ₹5L+ monthly turnover, tech-comfortable owner aged 25–40, smartphone-first. Even 1% capture = 700–1,000 paying customers.

**Every single day looks like this:**

```
Morning  → Owner opens shop. No idea of exact stock levels.
           "Maggi khatam hua ya nahi?" — physical check required.

Day      → Wholesale customer arrives. Bill created on paper.
           Stock? Not tracked. Evening stock levels — unknown.

Purchase → Supplier delivers 100 Maggi packets.
           No record of when it'll run out. Next order = pure guesswork.

Night    → No summary of what sold. Same confusion tomorrow.
```

**This creates real financial damage:**

| Problem | Impact |
|---|---|
| Stock-outs on wholesale orders | Lost sale + disappointed retailer customer |
| Over-ordering from suppliers | ₹ stuck in slow-moving inventory |
| Selling below cost (manual mental math) | Direct revenue leakage |
| 3–4 hours/day on registers | Time that can't be recovered |
| **Total monthly loss** | **₹2,000–3,000 (10–15% of monthly profit)** |

The core issue: pen-paper breaks completely when you're managing 200–500 SKUs across dual business models. The human brain cannot track this complexity reliably.

---

## The Solution

**SmartKirana automates stock tracking through daily billing and purchase operations — no separate manual counting needed.**

```
SALE HAPPENS           PURCHASE HAPPENS
      ↓                       ↓
 Create bill            Record purchase
      ↓                       ↓
Stock AUTO-deducts     Stock AUTO-adds
      ↓                       ↓
Know exact stock       Know exact stock
     anytime               anytime
```

**Core value delivered:**
- Know exact stock levels anytime, across any unit (piece / packet / carton)
- Make data-driven purchase decisions — not guesswork
- Prevent selling below cost automatically
- Low-stock alerts before stock-outs happen

**Status:** Built, not yet deployed. Production-ready backend with 120+ integration tests. Customer pilots pending.

---

## Architecture

4-layer clean architecture with explicit Middleware and Model layers

```
Client Request
      │
      ▼
┌─────────────────────────────────────────┐
│  Express Routes                         │  ← Route definition only. No logic here.
│  /auth  /products  /bills  /purchases   │
│  /temporary-products  /reports          │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Middleware                             │  ← Runs before every protected route
│  auth.js      → JWT verify             │
│  validate.js  → Joi schema guard        │
│  errorHandler → Centralized AppError   │
│  notFound     → 404 catch-all          │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Controllers  (thin layer)              │  ← Only: extract req data, call service, send response
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Services  (all business logic)         │  ← Transactions, price validation, MSP logic
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Repositories  (Mongoose abstraction)   │  ← Singleton pattern. Session-aware. DB-swap ready.
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  Models  (Mongoose schemas)             │
│  User · Product · Bill · Purchase       │
│  TemporaryProduct                       │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│  MongoDB                                │
└─────────────────────────────────────────┘
```

**Why this matters:** Controllers have zero business logic. Services have zero HTTP awareness. Everything is independently testable and swappable.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 18+ | Non-blocking I/O — right choice for billing-heavy concurrent ops |
| Framework | Express.js 5.x | Minimal, composable, async error handling built-in |
| Database | MongoDB + Mongoose | Flexible schema for variable product unit hierarchies |
| Validation | Joi | Schema-level request guards with clean error maps |
| Auth | JWT + bcrypt | Stateless auth — no session storage needed |
| Testing | Jest + Supertest | 120+ integration tests with in-memory MongoDB replica set |
| Security | Helmet + CORS | HTTP headers hardened by default |

---

## Business Logic That Matters

This is where SmartKirana diverges from generic inventory tools. These decisions were made with ground-reality in mind.

### 1. Multi-Unit Stock Storage

Stock is always stored in **base units** (e.g., pieces). Displayed in any variation — no conversion errors possible.

```
Product: Maggi Noodles
  Base unit: Piece

  1 Packet  = 24 Pieces   → conversionToBase: 24
  1 Carton  = 6 Packets   → conversionToBase: 144

Database stores: 1440 pieces

Display:
  10 Carton | 60 Packet | 1440 Piece   ← all correct, always

Billing (sell 5 Packets):
  Deduct = 5 × 24 = 120 pieces         ← single source of truth
```

### 2. Price Validation on Every Bill Item

```
User enters: 10 Packets @ ₹110 each

Step 1 — Effective price:
  If lineTotal edited → effectivePrice = lineTotal ÷ qty
  Else                → effectivePrice = pricePerUnit

Step 2 — Cost check:
  costPerPacket = costPerBaseUnit × conversionToBase
                = ₹4 × 24 = ₹96

Step 3 — Decision:
  ₹110 > ₹96 (cost)    ✅ ALLOW
  ₹110 < ₹120 (MSP)    ⚠️  WARN — price below minimum, but not blocked

Result: Sale goes through with warning in response.
Block only happens when price < cost. Owner keeps full control above that.
```

### 3. Non-Blocking Stock Warnings (Intentional Design)

```
Scenario: Wholesale customer wants 15 Cartons.
Available stock: 1440 pieces = 10 Cartons only.

❌ What generic software does: BLOCK the sale.
✅ What SmartKirana does:
  → Warn: "Only 10 Cartons available. Stock will go negative."
  → Allow sale anyway.

Why? Real ground reality:
  Customer is waiting. Supplier is coming tomorrow.
  Owner knows the situation. Software should not block business.
  Stock shows -720 pieces → owner knows they have a pending order to receive.
```

### 4. MSP Review Workflow on Cost Change

```
Before: Cost per Carton = ₹600, MSP = ₹700

New purchase at: ₹720 per Carton (supplier raised price)

Problem: MSP (₹700) < New Cost (₹720) → selling at loss

SmartKirana flow:
  1. Detects cost change on purchase
  2. Requires MSP update for ALL variations before completing purchase
  3. Validates: new MSP must be > new cost for every variation
  4. Suggests: newCost × 1.10 as starting point
  5. Only then: updates cost + MSP + adds stock (atomic transaction)
```

### 5. Temporary Products — Rush Hour Billing

When a product isn't in the system yet and a customer is waiting:

```javascript
// Bill item can be flagged as temporary
{ isTemporary: true, productName: "New Biscuit XYZ", quantity: 5, pricePerUnit: 20 }

// System creates a TemporaryProduct record tracking revenue + bill history
// Owner converts it to a full product later (setup flow)
// Bills that referenced it remain intact — no history broken
```

### 6. Bill-Level Discount with Cost Floor

```
10 Packets @ ₹120 = ₹1,200 (subTotal)
Cost of goods sold  = ₹960

Discount: -₹500 → Final: ₹700  ✅ above cost, ALLOWED
Discount: -₹300 → Final: ₹900  ✅ above cost, ALLOWED
Discount: -₹350 → Final: ₹850  ❌ below cost ₹960, BLOCKED
```

---

## Features

### Authentication
- JWT stateless auth with 30-day tokens
- bcrypt password hashing (12 rounds)
- User enumeration attack prevention (same error for wrong email + wrong password)
- Token expiry detection with clear messaging

### Product Management
- Multi-unit hierarchy with recursive conversion chain calculation
- Circular dependency detection in variation chains
- Soft delete (`isActive: false`) — billing history stays intact
- Case-insensitive duplicate name prevention
- Optional MSP at creation — set on first purchase
- Compound indexes: `userId + productName (unique)`, `userId + isActive`, `userId + currentStock`

### Billing / Sales
- Variation-based item selection (sell in any unit)
- Atomic bill creation — stock deduction + bill record in single MongoDB transaction
- Same-product deductions aggregated before write (prevents concurrent conflicts)
- Temporary product tracking auto-updates on bill creation
- Line-total negotiation with effective price calculation
- Non-blocking oversell with detailed warning payload

### Purchase Management
- Variation-based purchasing — buy in any unit
- Cost change detection on every purchase
- Forced MSP review when cost increases (blocks purchase until resolved)
- Auto-suggested MSP at 10% margin above new cost
- Atomic purchase + stock + MSP update in single transaction

### Reports & Dashboard
- Today's revenue + bill count
- Weekly purchases summary
- Low stock alerts (below `minStockLevel`)
- Out-of-stock count
- Pending temporary products count

---

## Quick Start

**Prerequisites:** Node.js 18+, MongoDB 6+ (or Atlas URI)

```bash
# Clone
git clone https://github.com/mayank1327/smartkirana.git
cd smartkirana

# Install
npm install

# Environment setup
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET (min 32 chars)

# Run dev server
npm run dev
# → http://localhost:3000

# Health check
curl http://localhost:3000/api/health

# Run full test suite (120+ integration tests)
npm test
```

---

## API Documentation

Full interactive docs available via Swagger UI (being added).

### Core Endpoints

| Module | Method | Endpoint | Description |
|---|---|---|---|
| Auth | POST | `/api/auth/register` | Register shop owner |
| Auth | POST | `/api/auth/login` | Login, get JWT token |
| Products | GET | `/api/products` | List products with stock display |
| Products | POST | `/api/products` | Create multi-unit product |
| Products | PUT | `/api/products/:id` | Update name / MSP / minStock |
| Products | DELETE | `/api/products/:id` | Soft delete |
| Bills | POST | `/api/bills` | Create bill → auto-deducts stock |
| Bills | GET | `/api/bills` | List bills (filter by date, customer) |
| Bills | GET | `/api/bills/:id` | Full bill detail |
| Purchases | POST | `/api/purchases` | Record purchase → auto-adds stock |
| Purchases | GET | `/api/purchases` | Purchase history with filters |
| Temp Products | GET | `/api/temporary-products` | Pending setup list |
| Temp Products | POST | `/api/temporary-products/:id/setup` | Convert to real product |
| Reports | GET | `/api/reports/dashboard` | Stock alerts + today summary |
| Reports | GET | `/api/reports/low-stock` | Low stock + out-of-stock report |
| Reports | GET | `/api/reports/today-bills` | Today's bill list + revenue |
| Reports | GET | `/api/reports/weekly-purchases` | This week's purchases |

All routes except `/auth` require `Authorization: Bearer <token>` header.

---

## Environment Variables

```env
PORT=3000
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/smartkirana
# Or Atlas: mongodb+srv://user:pass@cluster.mongodb.net/smartkirana

JWT_SECRET=your_secret_min_32_chars_here
JWT_EXPIRE=30d
```

---

## Testing

```bash
npm test                          # Full suite with coverage
npm run test:integration          # Integration only
npm run test:watch                # Watch mode

# Module-specific
npx jest tests/integration/Bill.test.js
npx jest tests/integration/products.test.js
npx jest tests/integration/purchases.test.js
```

**Test infrastructure:** In-memory MongoDB Replica Set (supports transactions in tests), isolated per-test user data, no external dependencies required.

| Module | Tests | Coverage |
|---|---|---|
| Authentication | 13 | Register, login, validation, edge cases |
| Products | 25 | CRUD, multi-unit, conversion chain, soft delete |
| Bills | 35+ | Price validation, stock warnings, temp products, atomicity |
| Purchases | 25+ | Cost change, MSP review, atomicity, validation |
| Reports | 15+ | Dashboard, low-stock, today bills, weekly purchases |
| Temp Products | 12+ | Setup flow, pending list, delete, user isolation |
| **Total** | **120+** | Full integration coverage, isolated per-test DB |

---

## Key Design Decisions

**Why stock in base units only?**
Any other approach creates sync bugs. When a product is sold in packets and cartons on the same bill, both deductions must reduce the same value. One source of truth eliminates conversion drift.

**Why soft delete?**
Bills reference products by ID. Hard-deleting a product breaks historical bill records — a shopkeeper can never reconcile past sales. `isActive: false` keeps data integrity intact while removing the product from active flows.

**Why MongoDB transactions for billing?**
A bill that saves but fails to deduct stock is worse than no bill. These two writes must be atomic. If either fails, the transaction rolls back completely — no partial state ever persists.

**Why no StockMovement model?**
Bills and purchases already store `stockBefore`, `stockAfter`, and quantity per item. Adding a third model creates redundancy and a sync problem. The answer to "what happened to stock?" is always in the Bill or Purchase document itself.

**Why non-blocking overselling?**
A real kirana owner who says "I have stock coming tomorrow" should not be blocked by software. The system warns loudly but respects owner judgment. Negative stock is a visible signal, not a system failure.

---

## Project Structure

```
smartkirana-backend/
├── src/
│   ├── models/         # Mongoose schemas (Product, Bill, Purchase, User, TemporaryProduct)
│   ├── controllers/    # Thin HTTP layer — extract, delegate, respond
│   ├── services/       # All business logic — validation, transactions, calculations
│   ├── repositories/   # DB abstraction — singleton pattern, session-aware
│   ├── routes/         # Express routers with Joi middleware
│   ├── middleware/      # auth.js, validate.js, errorHandler.js, notFound.js
│   ├── validators/     # Joi schemas per module
│   ├── utils/          # AppError, jwt, stockUtils, healthCheck
│   └── config/         # DB connect, env validation (fails fast on missing secrets)
├── tests/
│   ├── integration/    # Full API tests — auth, products, bills, purchases, reports
│   └── helpers/        # authHelper, productHelper (Maggi + Parle-G fixtures)
├── .env.example
└── server.js
```

---

## Roadmap

**Current (complete):**
- [x] Multi-unit product system with recursive conversion
- [x] Atomic billing with price + stock validation
- [x] MSP review workflow on cost change
- [x] Temporary products for rush-hour billing
- [x] Dashboard + low-stock reports
- [x] 120+ integration tests

**Planned (post-MVP validation):**
- [ ] React frontend dashboard — mobile-first, works on owner's phone browser
- [ ] Voice-based operations — quick billing by speaking product names
- [ ] Festival Mode Intelligence — demand surge detection, auto-suggested bulk ordering
- [ ] Multi-location inventory — single owner, multiple shop branches
- [ ] Market Price Intelligence — track competitor pricing trends
- [ ] AI Smart Alerts
  - [ ] Predictive reordering — alert before stock-out, not after
  - [ ] Smart defaults — auto-fill prices based on purchase history
  - [ ] Sales trends & insights — slow-movers, fast-movers, seasonal patterns

---

## Author

**Mayank Mehta** — B.Tech ECE, UIT RGPV Bhopal

I grew up watching my family run a Level 5 kirana — wholesale to local retailers by day, retail to walk-in customers in between. Stock was tracked in memory and on paper. Purchase orders were guesswork. Every month, money was leaking in ways no one could measure.

SmartKirana started as a hackathon idea built from that reality. Every feature in this system — the non-blocking oversell, the MSP review workflow, the temporary product flow — traces back to an actual conversation I've had in that shop.

- GitHub: [@mayank1327](https://github.com/mayank1327)
- Email: mayankmehta1327@gmail.com
- LinkedIn: [linkedin.com/in/mayank1327](https://linkedin.com/in/mayank1327)
- Medium: [medium.com/@mayank1327](https://medium.com/@mayank1327)

---

<div align="center">

**For the Level 5 kirana owner managing 200-500 SKUs on paper, guessing purchase orders, and losing ₹ every month without knowing why.** 🇮🇳
</div>