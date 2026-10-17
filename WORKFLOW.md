# How to Use the Website — Workflow Guide

A step-by-step guide for daily users of the Book Inventory Management System. Everything here describes the actual buttons and screens in the app. For developer/technical details, see [README.md](README.md).

**Roles:** every screen works for **Staff** and **Admin** unless marked *Admin only*.

---

## 1. Getting In

1. Open the site URL.
2. Log in with your **email** and **password**.
   - After **5 failed attempts** the account locks for **15 minutes**.
   - Sessions last 15 minutes per access token; the app silently refreshes so you normally never re-login during a workday.
3. Use the **moon/sun button** at the top of the sidebar to switch Light → Dark → System theme.
4. On desktop you can collapse the sidebar with the logo button.
5. **Install as an app (recommended for scanning):** in Chrome/Edge use the install icon in the address bar ("Install BookInventory" / Add to Home Screen on phones). It then works offline (see §9).

**Sidebar menu:**

| Menu item | Who sees it |
|---|---|
| Scan Books (home/dashboard) | Everyone |
| Book Catalog | Everyone |
| Import/Export | Admin only |
| Evaluation Forms | Everyone |
| Delivery Receipts | Everyone |
| Reservations | Admin only |
| Sales Invoices | Everyone |
| Admin Panel | Admin only |
| Profile | Everyone |

> Note: the first sidebar item ("Scan Books") opens the **Dashboard** — the stats page — which has a big **Scan Books** quick-action that takes you to the actual scanning screen.

---

## 2. Receiving Stock (Stock IN)

1. Sidebar → **Scan Books** → click the **Scan Books** card (or go straight to the scan screen).
2. Tap **Receive Stock (IN)**.
3. Scan the ISBN barcode on each book:
   - A **hardware USB scanner** works automatically — just scan; each beep adds **+1** to the list.
   - Or tap **Start Camera** and hold the barcode in view (the camera pauses briefly on each successful read).
   - No scanner? Type/paste the ISBN into the input box and press Enter.
4. Duplicates in one session are fine — quantities accumulate per ISBN.
5. When done, tap **Process Stock In**. Stock counts update immediately and every change is written to the transaction history.

## 3. Shipping Stock (Stock OUT)

Same as above but tap **Ship Stock (OUT)** — each scan removes **-1** — then **Process Stock Out**.

- ⚠️ **Reserved books are protected:** you cannot ship a book below its *reserved* quantity. If a draft Delivery Receipt has promised copies to a customer, the app blocks the outbound and tells you how many are available vs reserved.
- A **low stock warning** appears when a book's quantity drops to its minimum threshold.
- Bulk alternative: download the **stock-in / stock-out template** (Excel) from the scan screen, fill it, and import it — useful for large deliveries.

## 4. Adding / Editing Books

1. Sidebar → **Book Catalog**.
2. Click **Add New Book** (top right).
3. Fill in **ISBN** (required), **Title** (required), **Price** (required), quantity, and optionally Subject, Edition, Year, Author, Bind, Publisher. Typing an ISBN can auto-fill title details from Open Library if the book isn't in the catalog yet.
4. Save. The initial quantity is recorded as a stock adjustment.
5. To change details later, click the **Edit** (pencil) icon on the book's row.
6. Per-book history: click the **History** icon on a row to see every stock movement for that book.

**Admin only:**
- **Archive** (trash icon): hides a book from the catalog without destroying its history.
- Tick **Show Archived** above the list to see archived books and click **Restore** to bring them back.

## 5. The Sales Document Lifecycle (EF → DR → SI)

This is the core selling workflow. Documents go **Evaluation Form → Delivery Receipt → Sales Invoice**, and each document is a **draft** until you press **Issue**.

### Step 1 — Create and issue the Evaluation Form (EF)
1. Sidebar → **Evaluation Forms** → **New EF**.
2. In the form sheet:
   - **Requested By** — pick the Marketing Executive (managed in Admin Panel).
   - **Customer** — type to autocomplete from existing customers, or type a new name (it's saved automatically).
   - Add **line items**: ISBN, title, qty, unit price. Stock availability is validated as you go (only *unreserved* stock counts as available).
3. Footer buttons:
   - **Save Draft** — keep it as a draft to finish later.
   - **Issue** — ✅ finalizes the EF, **deducts the stock immediately**, and **auto-creates a linked DR draft** with the same data.
   - **Excel** (on saved drafts) — downloads the official EF workbook.
4. From the list you can **Preview** (eye icon) any document before exporting.

### Step 2 — Issue the Delivery Receipt (DR)
1. Sidebar → **Delivery Receipts**. The DR created from your EF is sitting there as a **draft**.
2. Open it (**Edit**) and press **Issue**.
   - A **DR linked from an EF** needs no stock action (stock already left at EF issue) — issuing just confirms delivery is pending.
   - A **standalone DR** (created directly from the Delivery Receipts page, skipping the EF) **reserves the stock as a draft** and, when issued, deducts it and moves to delivery. Reserving means nobody else can promise those copies.
   - Either way, issuing the DR **auto-creates a linked Sales Invoice draft**.
3. Editing a draft DR's quantities adjusts its reservation automatically; deleting a draft DR releases the reservation.

### Step 3 — Issue the Sales Invoice (SI)
1. Sidebar → **Sales Invoices** — the linked draft is waiting.
2. Open it, set the **P.O. #** and **Discount %** if needed (totals compute automatically), and press **Issue**. Issuing an SI has **no stock effect** — stock already moved at EF/DR issue.
3. **Excel** in the form footer downloads the official invoice workbook, including the amount written out in peso words.

### Delivery tracking (standalone DRs)
Issued standalone DRs go **out for delivery** automatically. From the Delivery Receipts list:
- **Delivered** — confirms the customer received it.
- **Return** — asks for a return reason and puts the copies **back into stock** (the linked SI is untouched).
- DRs that came from an EF skip delivery tracking entirely.

### Cancelling documents *(Admin only)*
- Press **Cancel** on an issued document; you'll be asked for a **cancellation reason**.
- Cancelling an **EF** also cancels its linked draft DR and that DR's draft SI.
- Cancelling an issued **DR** restores the stock to inventory.
- Cancels are blocked if the *next* document in the chain was already issued (e.g. can't cancel a DR whose SI is issued).
- Cancelled documents print with a red **\*\*\* CANCELLED \*\*\*** stamp in Excel exports.

**Rule of thumb:** issued documents can no longer be edited or deleted — only cancelled (Admin).

---

## 6. Reservations *(Admin only)*

When a standalone DR sits in draft, it is **holding** stock for a customer. The **Reservations** page lists every hold with its age in days.

- **Release** (on a hold's line) — give the stock back and remove that line. If it was the last line, the draft DR is deleted.
- **Expire stale (N)** — releases **all** holds older than the staleness threshold (default **60 days**). This is a manual button — nothing expires by itself, so check this page regularly.
- A red/stale flag tells you which holds have been waiting too long.

> Staff can also release a single line while editing the draft DR itself; the Reservations *page* is admin-only.

## 7. Bulk Import / Export *(Admin only)*

Sidebar → **Import/Export**.

### Import books
1. Click **Download Template** and fill the Excel/CSV file (columns: ISBN, TITLE, QTY, PRICE, plus optional SUBJECT, EDITION, YEAR, AUTHOR, BIND, PUBLISHER).
2. Choose the file.
3. Pick the **Import Mode**:
   - **Skip Duplicates** — rows whose ISBN already exists are ignored.
   - **Update Existing** — overwrites the book's details and sets its qty to the file's value.
   - **Merge (increment)** — updates details and **adds** the file's qty to the current stock.
4. Import and review the results panel (imported / skipped / updated / merged / errors).

### Export
- **Export Inventory** — downloads the whole catalog as Excel.
- **Export Transactions** — downloads the stock movement history (filterable by action, user, and date range on screen).

## 8. Admin Panel *(Admin only)*

Sidebar → **Admin Panel**. Five tabs across the top:

| Tab | What you can do |
|---|---|
| **User Management** | **Add New User**, edit roles/active status, **Reset Password** (also logs that user out everywhere), **Revoke** a user's sessions, delete a user |
| **Activity Logs** | Search/filter every security- and data-relevant action (logins, issues, cancels, imports…) by action, user, and date; export to Excel |
| **Marketing Executives** | Add/edit executives (the "Requested By" dropdown on documents); deleting is soft — they stay on old documents |
| **Books** | Browse **archived** books and restore them |
| **Sessions** | See every active login across users (filterable by day), **Revoke** one or **Revoke All Sessions** for a user |

## 9. Offline Scanning

The app is an installable PWA that keeps working with no signal — useful in the warehouse:

1. Open and use the app normally at least once while online — this caches the book catalog on the device.
2. Scan as usual; if you're offline, scans are **queued on the device** and marked *pending* (stock checks use the cached catalog).
3. When connectivity returns, the queue **syncs automatically** — including in the background, even if the page is closed (on supported browsers). A banner in the app shows your online/offline state.

## 10. Your Profile

Sidebar → **Profile**:
- Update your **Username** and **Email**.
- **Change Password** (minimum 8 characters with at least one letter and one number).

---

## Quick Reference

**Document statuses:** `draft` → `issued` → (`cancelled`, Admin only, with reason)

**Delivery status (standalone DRs):** `out_for_delivery` → `delivered` or `returned` (returned puts stock back)

**Stock rule:** available = quantity − reserved. Draft standalone DRs reserve; EF issue and DR issue (standalone) deduct; returns and DR cancels restore.

**Where things live:**

| I want to… | Go to |
|---|---|
| Add stock / remove stock | Scan Books → Receive/Ship Stock |
| Create or fix a book record | Book Catalog |
| Sell books (quote → deliver → invoice) | Evaluation Forms → Delivery Receipts → Sales Invoices |
| Track a shipment | Delivery Receipts → Delivered / Return |
| Free up promised stock | Reservations (Admin) |
| Load 500 books from Excel | Import/Export (Admin) |
| Reset someone's password | Admin Panel → User Management |
| Check who did what, when | Admin Panel → Activity Logs |
