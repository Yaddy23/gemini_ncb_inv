# Book Inventory Management System

A full-stack web-based Book Inventory Management System with real-time barcode scanning, JWT authentication, role-based access control, and bulk import capabilities.

## Features

- **User Authentication**: Secure JWT-based authentication with role-based access control (Admin vs Staff)
- **Barcode Scanning**: Dual-input scanning (hardware scanner & camera) with automatic book lookup
- **Inventory Management**: Real-time stock updates with audit logging
- **Bulk Operations**: Excel/CSV import with duplicate handling strategies (skip, update, merge)
- **Export Functionality**: Export inventory to Excel format
- **Responsive Design**: Modern UI built with React and Tailwind CSS

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

### Book Management
- `GET /api/books` - Get paginated list of books with search
- `GET /api/books/lookup/:isbn` - Lookup book by ISBN (with Open Library fallback)
- `POST /api/books` - Create new book (Admin only)
- `PATCH /api/books/:isbn/stock` - Update book stock (inbound/outbound)

### Bulk Operations
- `POST /api/books/bulk-import` - Import books from Excel/CSV (Admin only)
- `GET /api/books/export` - Export inventory to Excel (Admin only)

## Usage Guide

### For Staff Users
1. Login with staff credentials
2. Use the scanner to scan book barcodes
3. View current inventory in the Books section
4. Perform stock in/out operations

### For Admin Users
1. All staff capabilities plus:
2. Manage users and roles
3. Perform bulk imports/exports
4. Create new book records
5. View complete audit logs

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

## License

MIT License

## Acknowledgments

- Open Library API for book data fallback
- Lucide Icons for beautiful icon set
- Tailwind CSS for utility-first CSS framework