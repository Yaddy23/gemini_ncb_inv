// Offline book catalog: a minimal copy of the book table in IndexedDB so
// scans can be looked up and stock-validated while offline.
// Page-only module (uses axios) - the service worker never touches this.

import api from '../api/axios';
import { STORE_CATALOG, idbReplaceAll, idbGet, idbPut } from './idb';

// Fetch the minimal catalog from the server and replace the local copy.
// Called on app open and whenever connectivity returns.
export async function refreshCatalog() {
  const response = await api.get('/books/catalog');
  const books = Array.isArray(response.data) ? response.data : [];
  await idbReplaceAll(STORE_CATALOG, books.map(b => ({
    ISBN: b.ISBN,
    TITLE: b.TITLE || '',
    QTY: b.QTY || 0,
    reservedQty: b.reservedQty || 0
  })));
  return books.length;
}

// Look up a book by ISBN in the local catalog (for offline scanning)
export async function lookupLocal(isbn) {
  const book = await idbGet(STORE_CATALOG, isbn);
  if (!book) return null;
  return { ...book, ISBN: isbn };
}

// Optimistically adjust local stock after a scan so repeated offline scans
// still hit the out-of-stock / reserved validation
export async function adjustLocalStock(isbn, delta) {
  const book = await idbGet(STORE_CATALOG, isbn);
  if (!book) return;
  book.QTY = Math.max(0, (book.QTY || 0) + delta);
  await idbPut(STORE_CATALOG, book);
}
