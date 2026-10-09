# Book Inventory Management System

A full-stack web-based Book Inventory Management System with real-time barcode scanning, JWT authentication, role-based access control, and bulk import capabilities.

## Features

- **User Authentication**: Secure JWT-based authentication with role-based access control (Admin vs Staff)
- **Barcode Scanning**: Dual-input scanning (hardware scanner & camera) with automatic book lookup
- **Inventory Management**: Real-time stock updates with audit logging
- **Bulk Operations**: Excel/CSV import with duplicate handling strategies (skip, update, merge)
- **Export Functionality**: Export inventory to Excel format
- **Responsive Design**: Modern UI built with React and Tailwind CSS
- **Delivery Receipts & Sales Invoices**: Professional document generation with customizable Excel templates
- **Evaluation Forms (EF)**: Evaluation form workflow linked to Delivery Receipts
- **Marketing Executive Management**: Admin-only dropdown for "Requested By" field in EF/DR/SI creation, appears in exports
- **Real-time Duplicate Detection**: Visual warnings and confirmation dialogs for duplicate ISBN entries
- **Auto-scan Workflow**: Automatic row addition and focus after barcode scanning for continuous scanning

## Tech Stack

### Frontend
- React (Vite)
- Tailwind CSS
- Lucide Icons
- html5-qrcode (camera scanning)
- XLSX (SheetJS) for file handling
- Axios for HTTP requests

### Backend
- Node.js with Express.js
- MongoDB with Mongoose ODM
- JWT for authentication
- bcryptjs for password hashing
- Multer for file uploads
- ExcelJS for Excel file generation
- Puppeteer for PDF generation

## Setup Instructions

### Prerequisites
- Node.js (v16+)
- MongoDB (v4+)
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd book-inventory-system
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
   PORT=5000
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   NODE_ENV=development
   ```

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
   Server will run on http://localhost:5000

2. **Start the frontend development server**
```bash
cd ../frontend
npm run dev
```
   Application will be available at http://localhost:3000

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and receive JWT token
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/register` - Register new user (Admin only)

### Books
- `GET /api/books` - Get paginated list of books with search
- `GET /api/books/lookup/:isbn` - Lookup book by ISBN (with Open Library fallback)
- `POST /api/books` - Create new book (Admin only)
- `PATCH /api/books/:isbn/stock` - Update book stock (inbound/outbound)

### Marketing Executives (Admin Only)
- `GET /api/marketing-executives` - List all with pagination, search, status filter
- `GET /api/marketing-executives/active` - Get active executives for dropdown
- `POST /api/marketing-executives` - Create new marketing executive
- `PUT /api/marketing-executives/:id` - Update marketing executive
- `DELETE /api/marketing-executives/:id` - Delete marketing executive

### Delivery Receipts (`/api/drsi/dr`)
- `GET /` - Paginated DR list with filters
- `POST /` - Create DR draft (includes marketingExecutive)
- `GET /:id` - Get DR by ID
- `PUT /:id` - Update DR draft
- `DELETE /:id` - Delete DR draft
- `POST /:id/issue` - Issue DR (decrement stock, create SI)
- `GET /:id/export` - Export DR (PDF/XLSX)

### Sales Invoices (`/api/drsi/si`)
- `GET /` - Paginated SI list with filters
- `POST /` - Create SI draft (includes marketingExecutive)
- `GET /:id` - Get SI by ID
- `PUT /:id` - Update SI draft
- `DELETE /:id` - Delete SI draft
- `POST /:id/issue` - Issue SI
- `GET /:id/export` - Export SI (PDF/XLSX)

### Evaluation Forms (`/api/ef`)
- `GET /` - Paginated EF list with filters
- `POST /` - Create EF draft (includes marketingExecutive)
- `GET /:id` - Get EF by ID
- `PUT /:id` - Update EF draft
- `DELETE /:id` - Delete EF draft
- `POST /:id/issue` - Issue EF (creates linked DR draft)
- `GET /:id/export` - Export EF (PDF/XLSX)

### Bulk Operations
- `POST /api/books/bulk-import` - Import books from Excel/CSV (Admin only)
- `GET /api/books/export` - Export inventory to Excel (Admin only)

### Stock Transactions (`/api/stock`)
- `GET /transactions` - Transaction history with filters
- `GET /transactions/:isbn` - Transactions for specific ISBN

### User Logs (`/api/logs`)
- `GET /` - Paginated activity logs (Admin only)

### Admin User Management (`/api/auth/users`)
- `GET /users` - List users with pagination/search (Admin only)
- `PUT /users/:id` - Update user role/status (Admin only)
- `DELETE /users/:id` - Delete user (Admin only)

## Usage Guide

### For Staff Users
1. Login with staff credentials
2. Use the scanner to scan book barcodes
3. View current inventory in the Books section
4. Perform stock in/out operations

### For Admin Users
1. All staff capabilities plus:
2. Manage users and roles
3. Manage Marketing Executives (Admin Panel)
4. Perform bulk imports/exports
5. Create new book records
6. Create and manage Evaluation Forms, Delivery Receipts, Sales Invoices
7. View complete audit logs

## Document Workflows

### Evaluation Form → Delivery Receipt → Sales Invoice
1. **Create EF**: Fill evaluation form with line items, select "Requested By" (Marketing Executive)
2. **Issue EF**: Creates a linked DR draft with same data, marks EF as issued
3. **Issue DR**: Decrements stock, creates linked SI draft
4. **Issue SI**: Finalizes the sales invoice

### Export Templates
- **EF**: Uses `EF_FORM.xlsx` template with header image, EF Number in G3 (28pt bold), date in G5, Marketing Executive in G4
- **DR**: Uses `DR_SI_NEW_TEMPLATE.xlsx` (DR1 sheet), Marketing Executive in G4, date in H5 (MM/DD/YYYY)
- **SI**: Uses `DR_SI_NEW_TEMPLATE.xlsx` (INV1 sheet), Marketing Executive in H14, date in H15 (MM/DD/YYYY), Customer in E15, Address in E17, P.O.# in E19

### Row Hiding
All templates support up to 648 rows with automatic hiding of empty rows after the last item entry.

## Bulk Import Format

Supported file formats: `.xlsx`, `.xls`, `.csv`

Required columns:
- ISBN (string)
- TITLE (string)
- QTY (number)
- PRICE (number)

Optional columns:
- SUBJECT (string)
- EDITION (string)
- YEAR (string)
- AUTHOR (string)
- BIND (string)
- PUBLISHER (string)

Import Modes:
- **Skip Duplicates**: Skip rows where ISBN already exists
- **Update Existing**: Update book metadata and set QTY to imported value
- **Merge / Increment Stock**: Update metadata and increment existing QTY by imported QTY

## Barcode Scanning

The system supports two input methods:

1. **Hardware Scanner**: Treated as keyboard input. Scan a barcode and press Enter to submit.
2. **Camera Scanner**: Click the "Start Scan" button to activate your device's camera for scanning.

**Auto-scan workflow**: After scanning an ISBN, a new row is automatically added and focused for continuous scanning without mouse interaction.

## Duplicate ISBN Handling

Three-layer duplicate protection:
1. **Real-time visual warnings** in the line items table (yellow highlight)
2. **Pre-submit confirmation dialog** asking to proceed or remove duplicates
3. **Backend validation** with 409 response on duplicate submission

## License

MIT License

## Acknowledgments

- Open Library API for book data fallback
- Lucide Icons for beautiful icon set
- Tailwind CSS for utility-first CSS framework