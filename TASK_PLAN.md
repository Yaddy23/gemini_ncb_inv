# Task Plan — gemini_ncb_inv

Generated from a full codebase audit (backend + frontend), 2026-10-10.
Each task lists priority, estimated effort, and the files it touches.

---

## Phase 0 — Bugs (fix before any new work)

- [x] **0.1 Fix "new document + Issue" double-create bug** ⚠️ HIGH
  - Creating a doc with the Issue button calls `createDR/createSI/createEF` twice → duplicate documents, second one gets issued.
  - Files: `frontend/src/pages/DeliveryReceipts.jsx` (~L49-55), `SalesInvoices.jsx` (~L52-58), `EvaluationForms.jsx` (~L52-59)
  - Fix: reuse the first create's response, or add a `POST /dr?issue=true` endpoint.
  - Effort: minutes

- [x] **0.2 Fix `res.status(400 || ...)` constant-expression bug** ⚠️ HIGH
  - Always returns HTTP 400 regardless of error type.
  - Files: `backend/controllers/stockController.js` (L73, L242)
  - Effort: minutes

- [x] **0.3 Fix transactions search pagination**
  - ISBN/user search filter runs AFTER limit/skip → later pages can be empty; `total` ignores search.
  - Files: `backend/controllers/stockController.js` (`getTransactions`)
  - Fix: aggregation join, or denormalize book title onto the transaction.
  - Effort: small

- [x] **0.4 Show SI discount in totals row** (also fixed in Excel export: generator now writes discount % to template helper cell K677, driving the LESS X% DISCOUNT / TOTAL NET AMOUNT formulas)
  - Discount % is collected and sent but not reflected in client-side totals.
  - Files: `frontend/src/components/drsi/LineItemsTable.jsx`, `DocumentForm.jsx`
  - Fix: subtotal → discount → grand total breakdown.
  - Effort: small

---

## Phase 1 — Quick wins (small endpoints over data you already collect)

- [x] **1.1 Per-book transaction history**
  - `GET /api/books/:isbn/transactions` (paginated) + "History" drill-down on Books page.
  - Note: `{ISBN, timestamp}` index already exists in `StockTransaction` — no route uses it.
  - Files: `backend/routes/books.js`, `backend/controllers/bookController.js`, `frontend/src/pages/Books.jsx`
  - Effort: small

- [x] **1.2 Low-stock endpoint + per-book threshold**
  - `GET /api/books/low-stock`; `MIN_QTY` field on Book schema (5 is currently hardcoded);
    dashboard low-stock widget; warn on threshold crossing in `updateStock`.
  - Files: `backend/models/Book.js`, `bookController.js`, `stockController.js`, `frontend/src/pages/Dashboard.jsx`
  - Effort: small–medium

- [ ] **1.3 Auto-generate document numbers** *(skipped — not needed for now)*
  - `GET /api/drsi/dr/next-number` so users don't hand-type `DR-YYYYMMDD-NNN`.
  - Also fixes fragile EF→DR→SI string-replacement numbering; enforce prefix format.
  - Files: `backend/routes/drsi.js`, `backend/routes/ef.js`, `frontend/src/components/drsi/DocumentForm.jsx`
  - Effort: small–medium

- [x] **1.4 UserLog coverage for DR/SI/EF**
  - Document create/update/delete/issue is invisible in the audit log.
  - Add `CREATE_DR`, `ISSUE_DR`, etc. to the action enum and log them.
  - Files: `backend/models/UserLog.js`, `backend/routes/drsi.js`, `backend/routes/ef.js`, `backend/controllers/userLogController.js`
  - Effort: small

- [x] **1.5 Cancellable, debounced ISBN lookup in LineItemsTable**
  - Every keystroke past 8 chars fires a request with no cancellation → slow responses overwrite newer edits.
  - Also: allow manual title entry when lookup fails (unlisted books currently block submit).
  - Files: `frontend/src/components/drsi/LineItemsTable.jsx`
  - Effort: small

- [x] **1.6 Toast notification system**
  - Replace raw `alert()` / `window.confirm()` across all pages.
  - Files: new `frontend/src/components/Toast.jsx`, `App.jsx`, all pages
  - Effort: small–medium

---

## Phase 2 — Document lifecycle (biggest workflow improvement)

- [x] **2.1 Void/cancel issued documents with stock restore**
  - `status: 'cancelled'` flow → write an INBOUND `StockTransaction` to restore stock; cascade to linked SI/EF.
  - Files: `backend/models/{DeliveryReceipt,SalesInvoice,EvaluationForm}.js`, `backend/routes/drsi.js`, `backend/routes/ef.js`, three list pages
  - Effort: medium

- [x] **2.2 Transactional + idempotent DR issue**
  - DR issue decrements stock in a loop with no DB session (partial failure = inconsistent stock) and no idempotency guard (double-click = double decrement).
  - Fix: Mongoose session + `findOneAndUpdate({_id, status: 'draft'})`.
  - Files: `backend/routes/drsi.js`
  - Effort: medium

- [x] **2.3 EF → DR → SI conversion buttons in UI**
  - Backend already auto-creates linked DR/SI on issue, but frontend has no "Generate DR from EF" / "Generate SI from DR" action (page subtitles promise it).
  - Files: three list pages, `frontend/src/api/drsi.js`, `frontend/src/api/ef.js`
  - Effort: medium

- [x] **2.4 Read-only document preview modal**
  - Issued docs can only be exported, never inspected in-app (`Eye` icon imported but unused).
  - Files: three list pages, `DocumentForm.jsx`
  - Effort: small–medium

- [x] **2.5 Draft autosave + unsaved-changes guard**
  - Long form sessions lost on overlay click / refresh; save drafts to localStorage keyed by doc type; confirm before closing.
  - Files: `frontend/src/components/drsi/DocumentForm.jsx`
  - Effort: medium

---

## Phase 3 — Data & reporting

- [x] **3.1 Customer entity + autocomplete**
  - Customer is free-text everywhere; Customer model enables address memory, history, reporting.
  - Files: new `backend/models/Customer.js` + routes, `DocumentForm.jsx`
  - Effort: medium

- [x] **3.2 Dashboard charts + activity feed**
  - Add inbound-vs-outbound bar chart, low-stock widget, recent-transactions feed (existing endpoints).
  - Also fix Quick Actions using `window.location.href` full reloads.
  - Files: `frontend/src/pages/Dashboard.jsx`
  - Effort: medium

- [ ] **3.3 Advanced book filtering + sortable columns**
  - Subject/publisher/year/price-range/in-stock filters; backend supports `sortBy/sortOrder` but UI never uses it.
  - Files: `frontend/src/pages/Books.jsx`, `backend/controllers/bookController.js`
  - Effort: medium

- [ ] **3.4 Sales reports page**
  - Revenue by period / executive / customer; top-selling ISBNs; delivered-but-not-invoiced docs.
  - Data already exists in issued SIs/DRs.
  - Files: new `backend/routes/reports.js`, new `frontend/src/pages/Reports.jsx`, `NavBar.jsx`
  - Effort: medium–large

---

## Phase 4 — Security & robustness

- [ ] **4.1 Login rate limiting + account lockout**
  - No brute-force protection on `POST /api/auth/login`; add `express-rate-limit` + failed-attempt lockout + password-strength check.
  - Files: `backend/server.js`, `backend/routes/auth.js`, `backend/controllers/authController.js`
  - Effort: small–medium

- [ ] **4.2 Soft delete / archive for books + executives**
  - `deleteBook` hard-deletes and cascades transaction deletion (destroys audit trail); executive delete leaves dangling refs.
  - Add `isArchived` flags — hidden from lists, history preserved.
  - Files: `backend/models/Book.js`, `MarketingExecutive.js`, `bookController.js`, `backend/routes/marketingExecutive.js`
  - Effort: medium

- [ ] **4.3 Refresh tokens + session revocation**
  - Logout only writes a log entry; JWTs valid 30 days.
  - Add short-lived access tokens, `POST /api/auth/refresh`, session list with revoke in Admin Panel.
  - Files: `backend/middleware/auth.js`, `backend/routes/auth.js`, `frontend/src/pages/AdminPanel.jsx`
  - Effort: large

---

## Phase 5 — Big projects (optional / future)

- [x] **5.1 Stock reservations** — Reserve stock at DR draft so two drafts can't promise the same books; optional multi-location (warehouse/shelf/bin) QTY.
  - Files: `Book.js`, `StockTransaction.js`, `backend/routes/drsi.js`, `backend/routes/stock.js`
- [ ] **5.2 Email document to customer** — "Send PDF" action on DR/SI/EF (nodemailer + existing puppeteer PDF generation).
  - Files: `backend/services/documentGenerator.js`, new mail service, list pages
- [x] **5.3 PWA + global offline indicator** — vite-plugin-pwa (injectManifest, custom `src/sw.js`): precached app shell, installable, Background Sync replay of queued stock scans (Chromium; page-driven flush elsewhere). Scan queue moved to IndexedDB with claim-guarded drain (no double-replay); offline scans validate against a cached book catalog (`GET /api/books/catalog`); global online/offline banner via `OnlineContext`. Placeholder icons via `scripts/generate-icons.cjs`; nginx `sw.js`/manifest no-cache. Also fixed `numberToWords` const-reassignment crash.

---

## Suggested order

1. **Phase 0** — real bugs, minutes to fix, do first
2. **Phase 1** — small endpoints over data you already collect
3. **Phase 2** — document lifecycle work; most improves the core DR/SI/EF workflow
4. **Phase 3 → 4** — reporting and hardening
5. **Phase 5** — as capacity allows
