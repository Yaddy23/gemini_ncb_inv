# Book Inventory Management System - Complete Project Documentation

## Project Overview

A full-stack web-based **Book Inventory Management System** designed for bookstores, publishers, and educational institutions. Built with modern technologies featuring real-time barcode scanning (with an offline queue), JWT authentication, role-based access control, bulk import/export capabilities, a customer directory with autocomplete, dashboard analytics, and professional document generation — Delivery Receipts (DR), Sales Invoices (SI), and Evaluation Forms (EF) — with customizable Excel templates and a full draft → issue → cancel lifecycle.

---

## Key Features

### 1. Authentication & Authorization
- **JWT-based authentication** with secure token management
- **Role-based access control**: Admin (full access) vs Staff (all features except Admin Panel)
- **Password hashing** using bcryptjs (10 rounds)
- **Protected routes** with middleware validation

### 2. Inventory Management
- **Book CRUD operations** with rich metadata (ISBN, Title, Author, Edition, Year, Bind, Subject, Publisher, Price, QTY)
- **Real-time stock updates** with audit trail and low-stock threshold warnings
- **Per-book minimum quantity** (`MIN_QTY` field) driving low-stock alerts
- **Text search** across Title, Author, Subject, Publisher
- **Per-book transaction history** drill-down
- **Confirm dialog** before deleting a book

### 3. Barcode Scanning (Dual Mode)
- **Hardware Scanner Support**: Keyboard wedge input with auto-submit on Enter
- **Camera Scanner**: Browser-based continuous scanning using html5-qrcode library
- **Scan feedback**: beep sound (with toggle), visual pause after a successful scan, auto-focus/auto-add of the next ISBN row
- **Offline scan queue**: scans made while disconnected are stored in localStorage and synced later
- **Automatic book lookup** by ISBN with Open Library API fallback

### 4. Document Workflow: DR / SI / EF
- **Three document types**: Evaluation Form (EF) → Delivery Receipt (DR) → Sales Invoice (SI)
- **Conversion chain**: issuing an EF auto-creates a linked DR draft; issuing a DR decrements stock and auto-creates a linked SI draft; one-click "Generate DR"/"Generate SI" conversion buttons in the UI
- **Full lifecycle**: Draft → Issue → Cancel, with:
  - **Idempotent issue**: atomic status claim prevents double-click double-issue
  - **Cancel with stock restore**: cancelling an issued DR/SI writes an INBOUND transaction to restore stock and cascades to linked draft documents
  - **Draft autosave** to localStorage with an unsaved-changes guard
  - **Read-only preview modal** for issued documents
- **Documents can be created without a date** (date is optional)
- **Customizable fields**: Customer info (with autocomplete), PO number, discount percentage, marketing executive
- **Multi-currency ready** (currently Philippine Peso formatted)

### 5. Customer Directory
- **Auto-growing directory**: customers are recorded automatically whenever a DR/SI/EF is created or updated (case-insensitive dedupe, latest address wins)
- **Debounced autocomplete** on the document form's Customer Name field, with keyboard navigation and remembered-address fill
- **Per-customer document history** (DR/SI/EF matched by name)
- **Admin management**: create/update/delete customers; reads available to all authenticated users

### 6. Dashboard Analytics
- **Stat cards**: total books, total quantity, today's transactions, low-stock count
- **Stock movement chart**: daily inbound-vs-outbound bar chart (last 7–90 days) with a chart/table toggle and hover tooltips
- **Recent activity feed**: latest stock transactions with user attribution and relative timestamps
- **Quick Actions** using client-side navigation (no full page reloads)

### 7. Professional Document Export
- **Excel Export** using customizable templates (`DR_SI_NEW_TEMPLATE.xlsx`, `EF_FORM.xlsx`)
- **PDF Export** via Puppeteer (headless Chrome)
- **Row hiding**: empty line-item rows are hidden in exports (648 line-item rows per template)
- **Auto-calculated totals** with amount-in-words conversion
- **Discount support in exports** (SI): discount fraction written to helper cell K677, driving the template's LESS X% DISCOUNT and TOTAL NET AMOUNT formulas
- **Philippine Peso formatting** with centavos support

### 8. Bulk Import/Export
- **Excel/CSV import** with 3 duplicate handling strategies:
  - Skip duplicates
  - Update existing
  - Merge/increment stock
- **Full inventory export** to Excel
- **Column mapping** with validation
- **Progress tracking** for large imports

### 9. Stock Transaction Audit Trail
- **Complete transaction history**: INBOUND, OUTBOUND, ADJUSTMENT, BULK_IMPORT
- **Per-item tracking** with previous/new quantities
- **User attribution** for all changes
- **Low-stock warnings** when a stock change crosses the book's threshold
- **Date-range filtering**, per-ISBN history, and Excel export

### 10. User Activity Logging
- **Comprehensive audit log** covering auth, books, stock, import/export, and every DR/SI/EF action (CREATE/UPDATE/DELETE/ISSUE/CANCEL per document type)
- **IP + user-agent tracking**
- **Admin dashboard** for monitoring with filters by action, user, and date range
- **Export logs** to Excel

### 11. User & Marketing Executive Management (Admin Panel)
- **List users** with pagination, search, and role/status display
- **Create new users** with username, email, password, and role (Admin/Staff)
- **Toggle user status** (activate/deactivate)
- **Change user roles** (Admin ↔ Staff)
- **Delete users** (with self-protection)
- **Marketing executives**: CRUD with active/inactive status and filtering, used as the sales agent on documents

### 12. UX Polish
- **Toast notification system** replacing raw `alert()`/`confirm()` across all pages
- **Fully mobile-responsive** UI: every page renders card layouts on phones, table layouts on desktop, with 48px+ touch targets

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
│   │   ├── authController.js      # Login, register, profile, user mgmt
│   │   ├── bookController.js      # Book CRUD, search, stats, low-stock
│   │   ├── stockController.js     # Stock in/out, transactions, dashboard summary
│   │   └── userLogController.js   # Audit log queries + export
│   ├── middleware/
│   │   └── auth.js                # JWT verification, role checks
│   ├── models/
│   │   ├── Book.js                # Book schema with MIN_QTY threshold
│   │   ├── Customer.js            # Customer directory (case-insensitive unique)
│   │   ├── DeliveryReceipt.js     # DR schema (draft/issued/cancelled, efRef)
│   │   ├── EvaluationForm.js      # EF schema
│   │   ├── MarketingExecutive.js  # Sales agent schema
│   │   ├── SalesInvoice.js        # SI schema with discount support
│   │   ├── StockTransaction.js   # Audit trail schema
│   │   ├── User.js                # User schema with bcrypt
│   │   └── UserLog.js             # Activity log schema
│   ├── routes/
│   │   ├── auth.js                # /api/auth endpoints (incl. user mgmt)
│   │   ├── books.js               # /api/books endpoints
│   │   ├── customers.js           # /api/customers endpoints
│   │   ├── drsi.js                # /api/drsi/dr + /api/drsi/si endpoints
│   │   ├── ef.js                  # /api/ef endpoints
│   │   ├── marketingExecutive.js  # /api/marketing-executives endpoints
│   │   ├── stock.js               # /api/stock endpoints
│   │   └── userLog.js             # /api/user-logs endpoints
│   ├── services/
│   │   └── documentGenerator.js   # Excel/PDF generation engine (DR/SI/EF)
│   ├── utils/
│   │   └── fileUpload.js          # Multer configuration
│   ├── seed.js                    # Database seeding script
│   ├── server.js                  # Entry point
│   ├── DR_SI_NEW_TEMPLATE.xlsx    # Export template (DR1 & INV1 sheets)
│   ├── EF_FORM.xlsx               # Export template (EF)
│   ├── package.json
│   └── vercel.json                # Vercel deployment config
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── axios.js           # Configured axios instance
│   │   │   ├── customer.js        # Customer API calls
│   │   │   ├── drsi.js            # DR/SI API calls
│   │   │   ├── ef.js              # EF API calls
│   │   │   └── marketingExecutive.js # Marketing executive API calls
│   │   ├── components/
│   │   │   ├── NavBar.jsx         # Navigation with role-based links
│   │   │   ├── PrivateRoute.jsx   # Auth guard component
│   │   │   ├── Toast.jsx          # Global toast notifications
│   │   │   ├── dashboard/
│   │   │   │   └── StockMovementChart.jsx  # Inbound/outbound bar chart
│   │   │   └── drsi/
│   │   │       ├── CustomerAutocomplete.jsx # Debounced customer picker
│   │   │       ├── DocumentForm.jsx    # DR/SI/EF create/edit modal
│   │   │       ├── DocumentPreview.jsx # Read-only document viewer
│   │   │       └── LineItemsTable.jsx  # Dynamic line items grid
│   │   ├── pages/
│   │   │   ├── Login.jsx          # Authentication page
│   │   │   ├── Dashboard.jsx      # Stats, chart, activity feed
│   │   │   ├── Books.jsx          # Inventory management
│   │   │   ├── DeliveryReceipts.jsx  # DR list & actions
│   │   │   ├── SalesInvoices.jsx     # SI list & actions
│   │   │   ├── EvaluationForms.jsx   # EF list & actions
│   │   │   ├── Scan.jsx           # Barcode scanner + offline queue
│   │   │   ├── ImportExport.jsx   # Bulk operations
│   │   │   ├── AdminPanel.jsx     # Users + marketing executives
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
├── TASK_PLAN.md                   # Prioritized feature/bug roadmap
└── SALES_DOCUMENTATION.md         # This document
```

---

## API Endpoints Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/login` | User login, returns JWT | Public |
| GET | `/me` | Get current user profile | Authenticated |
| POST | `/register` | Create new user | Admin |
| PUT | `/change-password` | Change password | Authenticated |
| PUT | `/profile` | Update profile | Authenticated |
| POST | `/logout` | Logout user | Authenticated |
| GET | `/users` | List users with pagination/search | Admin |
| PUT | `/users/:id` | Update user role/status | Admin |
| DELETE | `/users/:id` | Delete user | Admin |

### Books (`/api/books`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Paginated list with search + sorting | Authenticated |
| GET | `/stats` | Totals for dashboard (books, quantity, today) | Authenticated |
| GET | `/low-stock` | Books at/below their MIN_QTY threshold | Authenticated |
| GET | `/lookup/:isbn` | Lookup by ISBN (Open Library fallback) | Authenticated |
| GET | `/:isbn/transactions` | Paginated transaction history for one book | Authenticated |
| POST | `/` | Create new book | Admin |
| PUT | `/:isbn` | Update book | Admin |
| DELETE | `/:isbn` | Delete book | Admin |

### Stock (`/api/stock`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| PATCH | `/:isbn/stock` | Stock in/out/adjustment (warns on threshold crossing) | Authenticated |
| GET | `/summary` | Daily inbound/outbound totals for dashboard chart (7–90 days) | Authenticated |
| GET | `/recent` | Recent transactions for activity feed | Authenticated |
| GET | `/transactions` | Transaction history with filters + search | Admin |
| GET | `/transactions/export` | Export transactions to Excel | Admin |
| POST | `/bulk-import` | Bulk import from Excel/CSV | Admin |
| GET | `/export` | Export inventory to Excel | Admin |

### Delivery Receipts (`/api/drsi/dr`) — Admin only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Paginated DR list with filters |
| POST | `/` | Create DR draft (date optional; records customer) |
| GET | `/:id` | Get DR by ID |
| PUT | `/:id` | Update DR draft |
| DELETE | `/:id` | Delete DR draft |
| POST | `/:id/issue` | Issue DR — idempotent; decrements stock, creates linked SI draft |
| POST | `/:id/cancel` | Cancel issued DR — restores stock, cascades to linked draft SI |
| GET | `/:id/export` | Export DR (PDF/XLSX) |

### Sales Invoices (`/api/drsi/si`) — Admin only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Paginated SI list with filters |
| POST | `/` | Create SI draft (date optional; records customer) |
| GET | `/:id` | Get SI by ID |
| PUT | `/:id` | Update SI draft |
| DELETE | `/:id` | Delete SI draft |
| POST | `/:id/issue` | Issue SI (idempotent) |
| POST | `/:id/cancel` | Cancel issued SI |
| GET | `/:id/export` | Export SI (PDF/XLSX, includes discount breakdown) |

### Evaluation Forms (`/api/ef`) — Admin only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Paginated EF list with filters |
| POST | `/` | Create EF draft (date optional; records customer) |
| GET | `/:id` | Get EF by ID |
| PUT | `/:id` | Update EF draft |
| DELETE | `/:id` | Delete EF draft |
| POST | `/:id/issue` | Issue EF — idempotent; creates linked DR draft (efRef) |
| POST | `/:id/cancel` | Cancel issued EF — cascades to linked draft DR/SI |
| GET | `/:id/export` | Export EF (PDF/XLSX) |

### Customers (`/api/customers`)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Search/paginate customers (name or address, clamped pagination) | Authenticated |
| GET | `/:id` | Get customer by ID | Authenticated |
| GET | `/:id/documents` | Customer's recent DR/SI/EF history (matched by name) | Authenticated |
| POST | `/` | Create customer | Admin |
| PUT | `/:id` | Update customer | Admin |
| DELETE | `/:id` | Delete customer (documents keep their own name copy) | Admin |

> Customers are also recorded automatically (upsert, case-insensitive, latest address wins) whenever a DR/SI/EF is created or updated.

### Marketing Executives (`/api/marketing-executives`) — Admin only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Paginated list with search + status filter |
| GET | `/active` | Active executives (for document form dropdowns) |
| GET | `/:id` | Get by ID |
| POST | `/` | Create |
| PUT | `/:id` | Update |
| DELETE | `/:id` | Delete |

### User Logs (`/api/user-logs`) — Admin only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Paginated activity logs (filter by action, user, date) |
| GET | `/export` | Export logs to Excel |
| GET | `/actions` | Distinct action types (for filter dropdown) |
| GET | `/users` | Distinct users who have log entries |

---

## Excel Export Templates

The system uses **`DR_SI_NEW_TEMPLATE.xlsx`** (DR1 + INV1 sheets) and **`EF_FORM.xlsx`** (EF). All templates support up to **648 line-item rows**, with empty rows hidden in the exported file.

### DR1 Sheet (Delivery Receipt)
| Row Range | Purpose |
|-----------|---------|
| Row 5 | Customer Name (E5) |
| Row 5 | Date MM/DD/YYYY (H5) |
| Row 6 | Customer Address (E6) |
| Rows 12-659 | Line Items (648 rows max) |
| Row 662 | Auto-calculated Totals (template formula) |

**Line Item Columns:**
- B: NO. (sequential)
- C: QTY
- D: "cps." if qty>1, "cpy." if qty=1
- E: ISBN/BARCODE
- F: TITLE / DESCRIPTION (Title / Edition / Bind / Year / by Author)
- G: UNIT PRICE
- H: AMOUNT

### INV1 Sheet (Sales Invoice)
| Row Range | Purpose |
|-----------|---------|
| Row 1 | "SALES INVOICE" (A1) |
| Row 3 | Customer Name (A3) |
| Row 4 | SI Number (B4), Date (E4), PO Number (H4) |
| Row 5 | Customer Address (B5) |
| Rows 23-670 | Line Items (648 rows max) |
| Rows 675-677 | Totals — subtotal, LESS X% DISCOUNT, TOTAL NET AMOUNT |

**Line Item Columns:**
- B: NO.
- C: ISBN/BARCODE
- D: (empty)
- E: TITLE / DESCRIPTION
- F: QTY
- G: (empty dup)
- H: UNIT PRICE
- I: AMOUNT

### EF Sheet (`EF_FORM.xlsx`)
| Row Range | Purpose |
|-----------|---------|
| Header | Preserved header image and formatting |
| Rows 12-659 | Line Items (648 rows max, empty rows hidden) |

### Pesos Sheet (Sheet "1")
- B3: Total Amount (referenced by template formulas)
- Row 7: Amount in Words (auto-generated)

---

## Discount System (Sales Invoice Only)

- **Database**: Discount percentage stored in `discountPercentage` field (0-100)
- **Auto-calculated**: `discountAmount = subtotal * discountPercentage / 100`
- **Total**: `totalAmount = subtotal - discountAmount`
- **Excel Export**: Discount fraction written to helper cell K677, which drives the template's LESS X% DISCOUNT (I676) and TOTAL NET AMOUNT (I677) formulas
- **PDF Export**: Discount row rendered inline when discount > 0
- **Frontend**: Visible in the SI form as "Discount %" and reflected in the live subtotal → discount → grand total breakdown

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

### Modifying DR/SI/EF Templates
1. Edit `backend/DR_SI_NEW_TEMPLATE.xlsx` or `backend/EF_FORM.xlsx`
2. Update `fillDR1Sheet()` / `fillINV1Sheet()` / `fillEFSheet()` in `documentGenerator.js`
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
- **Roadmap**: Prioritized backlog in `TASK_PLAN.md` (advanced filtering, sales reports, security hardening)

---

## Selling Points for Buyers

1. **Production-Ready**: Complete authentication, authorization, audit trails
2. **Complete Sales Workflow**: EF → DR → SI chain with stock control, cancellation, and restore
3. **Professional Documents**: Template-based Excel/PDF generation matching real business forms
4. **Barcode Scanning**: Works with $20 USB scanners AND phone cameras, even offline
5. **Bulk Operations**: Handles thousands of records with progress feedback
6. **Dashboard Analytics**: Live stock movement chart and activity feed
7. **Customer Intelligence**: Auto-built customer directory with address memory and history
8. **Modern Stack**: React 18, Vite, Tailwind - easy to maintain and extend
9. **Deployed**: Pre-configured for Render + Vercel (free tiers available)
10. **No Vendor Lock-in**: Standard MongoDB, plain React, Express
11. **Mobile Responsive**: Card-based layouts on phones, touch-friendly throughout
12. **Audit Compliant**: Full transaction and user-activity history for accounting requirements
13. **Open Source Stack**: Zero licensing costs for all dependencies

---

*Generated: 2026-10-07 · Updated: 2026-10-12*
*Version: 1.2.0*

---

## Recent Updates

### v1.2.0 (2026-10-12)
- **Evaluation Forms (EF)**: Third document type with its own template (`EF_FORM.xlsx`); issuing an EF auto-creates a linked DR draft, and DRs carry an EF Ref column
- **Marketing Executives**: Sales-agent directory (Admin Panel) used on all documents, with active-status filtering
- **Document lifecycle** (TASK_PLAN 2.x):
  - Cancel issued DR/SI/EF with automatic stock restore and cascade to linked drafts
  - Idempotent, atomic issue endpoints (double-click safe)
  - EF → DR → SI conversion buttons in the UI
  - Read-only document preview modal
  - Draft autosave + unsaved-changes guard
  - Documents can be created without a date
- **Customer directory** (TASK_PLAN 3.1): auto-recorded from documents, case-insensitive dedupe, debounced autocomplete on the document form with address fill, per-customer document history
- **Dashboard analytics** (TASK_PLAN 3.2): inbound-vs-outbound bar chart with table toggle, recent-activity feed, Quick Actions via client-side navigation
- **Quick wins** (TASK_PLAN 1.x): per-book transaction history drill-down, low-stock endpoint + per-book MIN_QTY thresholds, audit logging for all DR/SI/EF actions, cancellable debounced ISBN lookup, toast notification system
- **Bug fixes** (TASK_PLAN 0.x): double-create on "new document + Issue", constant-expression status codes, transactions search pagination, SI discount now shown in totals and Excel export
- **Scanning**: offline scan queue with localStorage sync, continuous camera scanning, beep toggle, post-scan pause, auto-focus next row
- **Mobile responsive**: every page (Dashboard, Books, DR/SI/EF lists, Scan, ImportExport, AdminPanel, Login, Profile) with card layouts and larger touch targets
- **Books**: confirm dialog before delete; duplicate-ISBN detection on DR/SI forms

### v1.1.0 (2026-10-07)
- **Admin Panel**: Added "Create New User" functionality with modal form
  - Fields: Username, Email, Password, Role (Admin/Staff)
  - Uses existing POST `/api/auth/register` endpoint
- **Excel Export Improvements**:
  - DR1: H7 cell cleared (date removed), H5 keeps date
  - INV1: H14/I14 cells cleared (template cleanup)
  - Year field added to format description: "Title / Edition / Bind / Year / by Author"
- **Sales Invoice List**: Fixed DR reference to show actual DR number (e.g., DR-20240101-001) instead of "Linked"
- **Line Items**: Year field now captured from book lookup and included in exports
