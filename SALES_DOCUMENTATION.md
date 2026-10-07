# Book Inventory Management System - Complete Project Documentation

## Project Overview

A full-stack web-based **Book Inventory Management System** designed for bookstores, publishers, and educational institutions. Built with modern technologies featuring real-time barcode scanning, JWT authentication, role-based access control, bulk import/export capabilities, and professional document generation (Delivery Receipts & Sales Invoices) with customizable Excel templates.

---

## Key Features

### 1. Authentication & Authorization
- **JWT-based authentication** with secure token management
- **Role-based access control**: Admin (full access) vs Staff (limited operations)
- **Password hashing** using bcryptjs (10 rounds)
- **Protected routes** with middleware validation

### 2. Inventory Management
- **Book CRUD operations** with rich metadata (ISBN, Title, Author, Edition, Year, Bind, Subject, Publisher, Price, QTY)
- **Real-time stock updates** with audit trail
- **Text search** across Title, Author, Subject, Publisher
- **Low stock alerts** and inventory reporting

### 3. Barcode Scanning (Dual Mode)
- **Hardware Scanner Support**: Keyboard wedge input with auto-submit on Enter
- **Camera Scanner**: Browser-based scanning using html5-qrcode library
- **Automatic book lookup** by ISBN with Open Library API fallback
- **Scan history** and batch scanning support

### 4. Delivery Receipts (DR) & Sales Invoices (SI)
- **Complete workflow**: Draft → Issue → Export
- **Linked DR-SI creation**: Issue DR auto-creates linked SI draft
- **Stock decrement** on DR issue with transaction logging
- **Customizable fields**: Customer info, PO number, discount percentage
- **Multi-currency ready** (currently Philippine Peso formatted)

### 5. Professional Document Export
- **Excel Export** using customizable templates (`DR_SI_NEW_TEMPLATE.xlsx`)
- **PDF Export** via Puppeteer (headless Chrome)
- **Template-based generation** for consistent formatting
- **Auto-calculated totals** with amount-in-words conversion
- **Philippine Peso formatting** with centavos support

### 6. Bulk Import/Export
- **Excel/CSV import** with 3 duplicate handling strategies:
  - Skip duplicates
  - Update existing
  - Merge/increment stock
- **Full inventory export** to Excel
- **Column mapping** with validation
- **Progress tracking** for large imports

### 7. Stock Transaction Audit Trail
- **Complete transaction history**: INBOUND, OUTBOUND, ADJUSTMENT, BULK_IMPORT
- **Per-item tracking** with previous/new quantities
- **User attribution** for all changes
- **Date-range filtering** and reporting

### 8. User Activity Logging
- **Comprehensive audit log** of all user actions
- **Action categorization**: LOGIN, CREATE, UPDATE, DELETE, EXPORT, IMPORT, SCAN
- **IP tracking** and session management
- **Admin dashboard** for monitoring

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI Framework |
| Vite | 4.4.5 | Build Tool & Dev Server |
| Tailwind CSS | 3.3.3 | Styling |
| React Router | 6.15.0 | Routing |
| Axios | 1.5.0 | HTTP Client |
| html5-qrcode | 2.3.0 | Camera Barcode Scanning |
| Lucide React | 1.52.0 | Icons |
| XLSX (SheetJS) | 0.18.5 | File Parsing |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 16+ | Runtime |
| Express.js | 4.18.2 | Web Framework |
| MongoDB/Mongoose | 7.5.0 | Database & ODM |
| JWT | 9.0.2 | Authentication |
| bcryptjs | 2.4.3 | Password Hashing |
| ExcelJS | 4.4.0 | Excel Generation |
| Puppeteer | 25.12.0 | PDF Generation |
| Multer | 1.4.5 | File Uploads |
| CORS | 2.8.5 | Cross-Origin Requests |

---

## Project Structure

```
gemini_ncb_inv/
├── backend/
│   ├── controllers/
│   │   ├── authController.js      # Login, register, profile
│   │   ├── bookController.js      # Book CRUD, search, bulk ops
│   │   ├── stockController.js     # Stock in/out, transactions
│   │   └── userLogController.js   # Audit log queries
│   ├── middleware/
│   │   └── auth.js                # JWT verification, role checks
│   ├── models/
│   │   ├── Book.js                # Book schema with text indexes
│   │   ├── DeliveryReceipt.js     # DR schema with pre-save hooks
│   │   ├── SalesInvoice.js        # SI schema with discount support
│   │   ├── StockTransaction.js    # Audit trail schema
│   │   ├── User.js                # User schema with bcrypt
│   │   └── UserLog.js             # Activity log schema
│   ├── routes/
│   │   ├── auth.js                # /api/auth endpoints
│   │   ├── books.js               # /api/books endpoints
│   │   ├── drsi.js                # /api/drsi endpoints
│   │   ├── stock.js               # /api/stock endpoints
│   │   └── userLog.js             # /api/logs endpoints
│   ├── services/
│   │   └── documentGenerator.js   # Excel/PDF generation engine
│   ├── utils/
│   │   └── fileUpload.js          # Multer configuration
│   ├── seed.js                    # Database seeding script
│   ├── server.js                  # Entry point
│   ├── DR_SI_NEW_TEMPLATE.xlsx    # Export template (DR1 & INV1 sheets)
│   ├── package.json
│   └── vercel.json                # Vercel deployment config
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── axios.js           # Configured axios instance
│   │   │   └── drsi.js            # DR/SI API calls
│   │   ├── components/
│   │   │   ├── NavBar.jsx         # Navigation with role-based links
│   │   │   ├── PrivateRoute.jsx   # Auth guard component
│   │   │   └── drsi/
│   │   │       ├── DocumentForm.jsx    # DR/SI create/edit modal
│   │   │       └── LineItemsTable.jsx  # Dynamic line items grid
│   │   ├── pages/
│   │   │   ├── Login.jsx          # Authentication page
│   │   │   ├── Dashboard.jsx      # Overview with stats
│   │   │   ├── Books.jsx          # Inventory management
│   │   │   ├── DeliveryReceipts.jsx  # DR list & actions
│   │   │   ├── SalesInvoices.jsx     # SI list & actions
│   │   │   ├── Scan.jsx           # Barcode scanner
│   │   │   ├── ImportExport.jsx   # Bulk operations
│   │   │   ├── AdminPanel.jsx     # User management
│   │   │   └── Profile.jsx        # User profile
│   │   ├── utils/
│   │   │   └── numberToWords.js   # PHP Peso to words converter
│   │   ├── App.jsx                # Root component with routes
│   │   └── main.jsx               # Entry point
│   ├── vite.config.js             # Vite config with API proxy
│   ├── tailwind.config.js         # Tailwind customization
│   ├── package.json
│   └── vercel.json                # Vercel deployment config
│
└── README.md
```

---

## API Endpoints Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/login` | User login, returns JWT | Public |
| GET | `/me` | Get current user profile | Authenticated |
| POST | `/register` | Create new user | Admin |

### Books (`/api/books`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Paginated list with search | Authenticated |
| GET | `/lookup/:isbn` | Lookup by ISBN (Open Library fallback) | Authenticated |
| POST | `/` | Create new book | Admin |
| PATCH | `/:isbn/stock` | Stock in/out/adjustment | Authenticated |
| POST | `/bulk-import` | Bulk import from Excel/CSV | Admin |
| GET | `/export` | Export inventory to Excel | Admin |

### Delivery Receipts (`/api/drsi/dr`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Paginated DR list with filters | Admin |
| POST | `/` | Create DR draft | Admin |
| GET | `/:id` | Get DR by ID | Admin |
| PUT | `/:id` | Update DR draft | Admin |
| DELETE | `/:id` | Delete DR draft | Admin |
| POST | `/:id/issue` | Issue DR (decrement stock, create SI) | Admin |
| GET | `/:id/export` | Export DR (PDF/XLSX) | Admin |

### Sales Invoices (`/api/drsi/si`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Paginated SI list with filters | Admin |
| POST | `/` | Create SI draft | Admin |
| GET | `/:id` | Get SI by ID | Admin |
| PUT | `/:id` | Update SI draft | Admin |
| DELETE | `/:id` | Delete SI draft | Admin |
| POST | `/:id/issue` | Issue SI | Admin |
| GET | `/:id/export` | Export SI (PDF/XLSX) | Admin |

### Stock (`/api/stock`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/transactions` | Transaction history with filters | Admin |
| GET | `/transactions/:isbn` | Transactions for specific ISBN | Admin |

### User Logs (`/api/logs`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Paginated activity logs | Admin |

---

## Excel Export Templates

The system uses **`DR_SI_NEW_TEMPLATE.xlsx`** with two sheets:

### DR1 Sheet (Delivery Receipt)
| Row Range | Purpose |
|-----------|---------|
| Row 5 | Customer Name (E5) |
| Row 5 | Date MM/DD/YYYY (H5) |
| Row 6 | Customer Address (E6) |
| Rows 12-50 | Line Items (39 rows max) |
| Row 662 | Auto-calculated Totals (template formula) |

**Line Item Columns:**
- B: NO. (sequential)
- C: QTY
- D: "cps." if qty>1, "cpy." if qty=1
- E: ISBN/BARCODE
- F: TITLE / DESCRIPTION
- G: UNIT PRICE
- H: AMOUNT

### INV1 Sheet (Sales Invoice)
| Row Range | Purpose |
|-----------|---------|
| Row 1 | "SALES INVOICE" (A1) |
| Row 3 | Customer Name (A3) |
| Row 4 | SI Number (B4), Date (E4), PO Number (H4) |
| Row 5 | Customer Address (B5) |
| Rows 23-50 | Line Items (28 rows max) |
| Row 675/677 | Auto-calculated Totals (template formula) |

**Line Item Columns:**
- B: NO.
- C: ISBN/BARCODE
- D: (empty)
- E: TITLE / DESCRIPTION
- F: QTY
- G: (empty dup)
- H: UNIT PRICE
- I: AMOUNT

### Pesos Sheet (Sheet "1")
- B3: Total Amount (referenced by template formulas)
- Row 7: Amount in Words (auto-generated)

---

## Discount System (Sales Invoice Only)

- **Database Only**: Discount percentage stored in `discountPercentage` field (0-100)
- **Auto-calculated**: `discountAmount = subtotal * discountPercentage / 100`
- **Total**: `totalAmount = subtotal - discountAmount`
- **Not in Excel Export**: Discount is for internal recording only; template handles totals automatically
- **Frontend Input**: Visible in SI form as "Discount %" field

---

## Deployment

### Render (Backend) + Vercel (Frontend) - Recommended

**Backend (Render):**
1. Connect GitHub repo
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Environment Variables:
   - `MONGODB_URI` - MongoDB Atlas connection string
   - `JWT_SECRET` - Strong random string
   - `NODE_ENV=production`
   - `PORT=8080` (Render default)

**Frontend (Vercel):**
1. Connect GitHub repo
2. Framework: Vite
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Environment Variables:
   - `VITE_API_URL=https://your-backend.onrender.com`

### Docker (Alternative)
```dockerfile
# Backend
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

---

## Default Credentials (After Seeding)

Run `cd backend && node seed.js` to create:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bookinventory.com | admin123 |
| Staff | staff@bookinventory.com | staff123 |

---

## Customization Guide

### Adding New Fields to Books
1. Update `backend/models/Book.js` schema
2. Update `backend/controllers/bookController.js` validation
3. Update `frontend/src/pages/Books.jsx` form
4. Update import/export column mapping

### Modifying DR/SI Template
1. Edit `backend/DR_SI_NEW_TEMPLATE.xlsx`
2. Update `fillDR1Sheet()` / `fillINV1Sheet()` in `documentGenerator.js`
3. Test with `node testExport.js`

### Adding New User Roles
1. Update `User.js` enum: `['Admin', 'Staff', 'Manager']`
2. Update `auth.js` middleware role checks
3. Update frontend `PrivateRoute.jsx` and nav visibility

---

## License

MIT License - Free for commercial use, modification, and distribution.

---

## Support & Maintenance

- **Code Quality**: ESLint + Prettier configured
- **Error Handling**: Try-catch with structured error responses
- **Logging**: Console logs for debugging (production-ready)
- **Extensible**: Modular architecture for easy feature additions
- **Documented**: Comprehensive inline code comments

---

## Selling Points for Buyers

1. **Production-Ready**: Complete authentication, authorization, audit trails
2. **Professional Documents**: Template-based Excel/PDF generation matching real business forms
3. **Barcode Scanning**: Works with $20 USB scanners AND phone cameras
4. **Bulk Operations**: Handles thousands of records with progress feedback
5. **Modern Stack**: React 18, Vite, Tailwind - easy to maintain and extend
6. **Deployed**: Pre-configured for Render + Vercel (free tiers available)
7. **No Vendor Lock-in**: Standard MongoDB, plain React, Express
8. **Mobile Responsive**: Works on tablets for warehouse scanning
9. **Audit Compliant**: Full transaction history for accounting requirements
10. **Open Source Stack**: Zero licensing costs for all dependencies

---

*Generated: 2026-10-07*
*Version: 1.0.0*