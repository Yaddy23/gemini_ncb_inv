# Book Inventory Management System

A full-stack, installable (PWA) Book Inventory Management System with real-time barcode scanning (online and offline), JWT authentication with refresh tokens and session management, role-based access control, a full document lifecycle (Evaluation Forms → Delivery Receipts → Sales Invoices) with delivery tracking, stock reservations with expiry, dark mode, and bulk import/export — built with React and Express on MongoDB. Deployed on Render.

> **Using the app?** See [WORKFLOW.md](WORKFLOW.md) — a step-by-step guide to every workflow (stock in/out, EF → DR → SI, reservations, admin tasks) with the actual buttons to press.

## Features

### Authentication & Security
- **JWT authentication** with short-lived access tokens and refresh tokens
- **Session management**: users can view and revoke their own sessions; Admins can view all active sessions (filterable by day), and revoke any user's sessions
- **Role-based access control** (Admin vs Staff)
- **Admin password reset** with automatic revocation of the user's sessions, plus last-login tracking in the Users tab
- **Login rate limiting** and bcrypt password hashing
- **Activity audit log** of security- and data-relevant actions (user logs, filterable and exportable by Admin)

### Inventory
- **Book catalog** with search, filters (subject, publisher, year, price range, in/low/out of stock), sorting and pagination
- **Book lookup by ISBN** with Open Library API fallback for titles not yet in the catalog
- **Stock movements**: inbound, outbound and adjustments — every change writes a stock transaction (previous/new quantity, performed by)
- **Stock reservation**: DR drafts reserve stock (RESERVE/RELEASE transactions) so the same units can't be promised twice
- **Reserved stock protection**: outbound is refused if it would drop stock below zero or below the reserved quantity, so reserved copies can't be shipped out from under a customer order
- **Reservations dashboard** (Admin): every draft-DR hold with age, plus per-line release and a bulk "expire stale" release for Admins. Holds older than `RESERVATION_EXPIRY_DAYS` (default 60; `0` disables staleness) are flagged — releasing them is a manual action; there is no background auto-expiry job
- **Per-book transaction history**
- **Soft archive/restore** of books (Admin only) — archives keep the audit trail intact

### Barcode Scanning (PWA)
- **Dual input**: hardware scanner (keyboard wedge) and camera scanning (html5-qrcode)
- **Auto-scan workflow**: rows auto-add and auto-focus for continuous scanning
- **Offline scanning**: the app is an installable PWA with a precached app shell; scans made offline queue in IndexedDB and replay automatically via Background Sync when connectivity returns
- **Offline book catalog cache** for ISBN/stock lookups without a network
- **Real-time duplicate detection**: inline warnings, pre-submit confirmation, and backend 409 validation

### Documents: EF → DR → SI Lifecycle
- **Evaluation Forms (EF)** → **Delivery Receipts (DR)** → **Sales Invoices (SI)** with linked documents and full draft → issued → cancelled lifecycle
- **Issue EF**: decrements stock and creates a linked DR draft; **Issue DR**: standalone DRs decrement their reserved stock and enter delivery tracking, while both standalone and EF-linked DRs create a linked SI draft; **Issue SI**: finalizes the invoice
- **Delivery tracking** on issued standalone DRs: `out_for_delivery → delivered / returned` with dates — returned DRs restore stock exactly once and don't touch the linked SI (DRs linked from an EF skip delivery tracking and stay `pending`)
- **Cancellation with cascade and reason**: cancelling an EF cascades to its linked draft DR (and that DR's draft SI); cancelling an issued DR restores stock. Cancelled documents are stamped `*** CANCELLED ***` in exports
- **Professional Excel exports** from templated workbooks (header images, formatted totals, amount-in-words)
- **Document previews** before export
- Staff can create, edit, issue and export all document types; cancelling issued documents is Admin-only

### Dashboard
- Stat cards: total titles, total units, today's transactions, accurate out-of-stock count
- 14-day stock movement chart (inbound vs outbound)
- Recent activity feed with per-action icons

### UI
- **Dark mode** — light / dark / follow-system theme with persistence
- **Motion polish** — animated modals/drawer/toasts, skeleton loaders on every list, `prefers-reduced-motion` respected globally

### Admin Panel
- **Users** — create/manage users and roles, revoke a user's sessions, reset a user's password (revokes their sessions), last-login column
- **Activity Logs** — paginated, filterable audit log with export
- **Marketing Executives** — CRUD for the "Requested By" dropdown used across EF/DR/SI
- **Archived Books** — view and restore archived books
- **Sessions** — all active sessions across users, filterable by day, with revocation

### Bulk Operations (Admin only)
- **Import** from `.xlsx` / `.xls` / `.csv` with three duplicate strategies (skip, update, merge/increment)
- **Export** the full inventory to Excel
- **Transaction history export**

## Tech Stack

### Frontend
- React 18 (Vite) + React Router
- Tailwind CSS
- Lucide Icons
- html5-qrcode (camera scanning)
- XLSX (SheetJS) for client-side file handling
- vite-plugin-pwa + Workbox (service worker, Background Sync)
- Axios

### Backend
- Node.js with Express.js
- MongoDB with Mongoose ODM
- JWT (access + refresh tokens)
- bcryptjs for password hashing
- express-rate-limit
- Multer for file uploads
- ExcelJS for Excel file generation

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- MongoDB (v4+)
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd gemini_ncb_inv
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Install frontend dependencies**
```bash
cd ../frontend
npm install
```

4. **Environment Configuration**
   - Create a `.env` file in the backend directory based on the example below:
   ```
   MONGODB_URI=mongodb://localhost:27017/book-inventory
   PORT=8080
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   NODE_ENV=development
   CLIENT_URL=http://localhost:3000
   RESERVATION_EXPIRY_DAYS=60
   ```
   - `CLIENT_URL` is added to the CORS allowlist (production); localhost origins are always allowed in development.
   - `RESERVATION_EXPIRY_DAYS` sets how old a draft-DR reservation must be before it's flagged stale on the Reservations dashboard (default 60; `0` disables staleness entirely).

5. **Seed the Database (Optional)**
```bash
cd backend
node seed.js
```
   This will create sample data and default users:
   - Admin: admin@bookinventory.com / admin123
   - Staff: staff@bookinventory.com / staff123

### Running the Application

1. **Start the backend server**
```bash
cd backend
npm run dev
```
   Server will run on http://localhost:8080

2. **Start the frontend development server**
```bash
cd ../frontend
npm run dev
```
   Application will be available at http://localhost:3000 (the Vite dev server proxies `/api` to the backend).

### Production
- Dockerfiles and a `docker-compose.yml` are provided for both apps as a containerized deployment option.
- The production instance is deployed on Render.

## API Endpoints

### Authentication (`/api/auth`)
- `POST /login` — Login (rate limited: 10 attempts / 15 min / IP; the account locks for 15 minutes after 5 failed attempts). Access tokens last 15 minutes, refresh tokens 7 days
- `POST /refresh` — Rotate refresh token
- `GET /me` — Current user profile
- `PUT /profile` — Update profile
- `PUT /change-password` — Change password
- `POST /logout` — Logout (logs the event and prunes expired sessions; revoke the refresh token via the session endpoints)
- `GET /sessions` — List own sessions
- `DELETE /sessions` / `DELETE /sessions/:sessionId` — Revoke sessions
- `POST /register` — Register user (Admin only)
- `GET /users` — List users (Admin only)
- `PUT /users/:id` — Update user role/status (Admin only)
- `PUT /users/:id/password` — Reset a user's password (revokes all their sessions) (Admin only)
- `DELETE /users/:id` — Delete user (Admin only)
- `DELETE /users/:id/sessions` — Revoke a user's sessions (Admin only)
- `GET /admin/sessions` — All active sessions (Admin only)

### Books (`/api/books`)
- `GET /` — Paginated list with search, filters, sorting (`archived=true` shows only archived books, Admin only)
- `GET /stats` — Dashboard stats (totals, low/out-of-stock counts, today's transactions)
- `GET /out-of-stock` — Accurate out-of-stock count + list
- `GET /catalog` — Minimal catalog for the offline PWA cache
- `GET /lookup/:isbn` — ISBN lookup (Open Library fallback)
- `GET /:isbn/transactions` — Per-book transaction history
- `POST /` — Create book (Admin only)
- `PUT /:isbn` — Update book (Admin only)
- `DELETE /:isbn` — Archive book (Admin only)
- `PUT /:isbn/restore` — Restore archived book (Admin only)

### Stock (`/api/stock`)
- `PATCH /:isbn/stock` — Stock movement (INBOUND / OUTBOUND)
- `GET /summary` — Movement summary per day (drives the dashboard chart)
- `GET /recent` — Recent transactions (dashboard activity feed)
- `POST /bulk-import` — Excel/CSV import (Admin only)
- `GET /export` — Inventory export (Admin only)
- `GET /transactions` — Transaction history with filters (Admin only)
- `GET /transactions/export` — Transaction export (Admin only)

### Reservations (`/api/stock/reservations`)
- `GET /` — All draft-DR stock holds with age and stale flags (Admin only)
- `POST /expire-stale` — Release all stale reservations (returns stock, deletes the draft DRs) (Admin only)
- `POST /release-item` — Release a single line item from a reservation (Staff and Admin)

### Delivery Receipts (`/api/drsi/dr`)
- `GET /` — Paginated DR list with filters (search, status, delivery status, linked EF)
- `POST /` — Create DR draft (reserves stock)
- `GET /:id` / `PUT /:id` / `DELETE /:id` — Draft management
- `POST /:id/issue` — Issue DR (decrement stock, create linked SI draft)
- `POST /:id/deliver` — Mark an out-for-delivery DR as delivered
- `POST /:id/return` — Mark a DR returned (restores stock) 
- `POST /:id/cancel` — Cancel issued DR (restores stock) — Admin only
- `GET /:id/export` — Export DR to Excel

### Sales Invoices (`/api/drsi/si`)
- `GET /` — Paginated SI list with filters (search, status, linked DR)
- `POST /` — Create SI draft
- `GET /:id` / `PUT /:id` / `DELETE /:id` — Draft management
- `POST /:id/issue` — Issue SI
- `POST /:id/cancel` — Cancel issued SI — Admin only
- `GET /:id/export` — Export SI to Excel

### Evaluation Forms (`/api/ef`)
- `GET /` — Paginated EF list with filters
- `POST /` — Create EF draft
- `GET /:id` / `PUT /:id` / `DELETE /:id` — Draft management
- `POST /:id/issue` — Issue EF (creates linked DR draft)
- `POST /:id/cancel` — Cancel issued EF (cascades to linked drafts) — Admin only
- `GET /:id/export` — Export EF to Excel

### Marketing Executives (`/api/marketing-executives`)
- `GET /` — List with pagination, search, status filter
- `GET /active` — Active executives (for document dropdowns)
- `GET /:id` — Get by ID
- `POST /` / `PUT /:id` / `DELETE /:id` — Create/update/deactivate (Admin only)

### Customers (`/api/customers`)
- `GET /` — Paginated list with search
- `GET /:id` — Customer detail
- `GET /:id/documents` — All EF/DR/SI documents for a customer
- `POST /` / `PUT /:id` / `DELETE /:id` — Manage customers (Admin only)

### User Logs (`/api/user-logs`) — Admin only
- `GET /` — Paginated activity logs with filters
- `GET /export` — Export logs
- `GET /actions` / `GET /users` — Filter option lists

### Health
- `GET /health` — Health check

## Role Permissions

| Capability | Staff | Admin |
|---|---|---|
| Dashboard, Books (view), Scanning (incl. offline) | ✓ | ✓ |
| Reservations dashboard (view holds, release lines, expire stale) | — | ✓ |
| Release a single reservation line (`release-item`) | ✓ | ✓ |
| EF/DR/SI: create, edit drafts, issue, delete drafts, preview, Excel export | ✓ | ✓ |
| Cancel issued documents | — | ✓ |
| Create/edit book records, archive/restore | — | ✓ |
| Stock movements (inbound/outbound) | ✓ | ✓ |
| Import/Export page (bulk import, inventory & transaction exports) | — | ✓ |
| Admin Panel (users, logs, executives, archived books, sessions) | — | ✓ |
| Manage customers & marketing executives | — | ✓ |
| View/revoke own sessions | ✓ | ✓ |
| View/revoke all users' sessions | — | ✓ |

## Document Workflows

### Evaluation Form → Delivery Receipt → Sales Invoice
1. **Create EF**: fill the evaluation form with line items (stock availability is validated against unreserved stock), select "Requested By" (Marketing Executive)
2. **Issue EF**: stock is decremented immediately (OUTBOUND transactions) and a linked DR draft is created with the same data
3. **Issue DR**:
   - **Standalone DR** (created directly in the DR tab): reserves stock as a draft; issuing decrements stock and moves it to `out_for_delivery`
   - **EF-linked DR**: no further stock movement (stock left at EF issue); delivery stays `pending`
   - Both automatically create a linked SI draft (number derived from the DR number)
4. **Issue SI**: finalizes the sales invoice (no stock impact)
5. **Delivery tracking** (standalone DRs): `out_for_delivery → delivered`, or `→ returned` (a return restores stock; the linked SI is untouched)
6. **Cancel** (Admin only, reason required): an EF cancel cascades to its linked draft DR and that DR's draft SI; cancelling an issued DR restores stock and cancels its linked draft SI. Cancels are blocked upward if the linked document is already issued. Cancelled documents are stamped in exports

### Export Templates
- **EF**: `EF_FORM.xlsx` — header image, EF number in G3 (28pt bold), Marketing Executive in G4, date in G5
- **DR**: `DR_SI_NEW_TEMPLATE.xlsx` (DR1 sheet) — customer in E5/E6, Marketing Executive in G4, date in H5 (MM/DD/YYYY)
- **SI**: `DR_SI_NEW_TEMPLATE.xlsx` (INV1 sheet) — customer in E15, address in E17, P.O.# in E19, Marketing Executive in H14, date in H15, discount in K677, total in B3
- Empty rows after the last item are hidden automatically in all templates

## Bulk Import Format

Supported file formats: `.xlsx`, `.xls`, `.csv`

Required columns:
- ISBN (string)
- TITLE (string)
- QTY (number)
- PRICE (number)

Optional columns:
- SUBJECT, EDITION, YEAR, AUTHOR, BIND, PUBLISHER

Import Modes:
- **Skip Duplicates**: skip rows whose ISBN already exists
- **Update Existing**: update metadata and set QTY to the imported value
- **Merge / Increment Stock**: update metadata and increment existing QTY by the imported QTY

## Offline Scanning

The app is an installable PWA (Add to Home Screen). Offline behavior:

1. The app shell is precached, so it opens without a network
2. Scans made offline are queued in IndexedDB and marked pending
3. When connectivity returns, the queue drains automatically (Background Sync where supported — works even if the page is closed; page-driven flush on the `online` event as fallback)
4. The book catalog is cached locally for offline ISBN/stock lookups

## Duplicate ISBN Handling

Three-layer duplicate protection:
1. Real-time visual warnings in the line items table
2. Pre-submit confirmation dialog asking to proceed or remove duplicates
3. Backend validation with 409 response on duplicate submission

## License

MIT License

## Acknowledgments

- Open Library API for book data fallback
- Lucide Icons for the icon set
- Tailwind CSS for utility-first CSS
- Workbox / vite-plugin-pwa for offline support
