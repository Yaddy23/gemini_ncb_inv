import React, { useState } from 'react';
import api from '../api/axios';
import { Upload, CheckCircle, AlertTriangle, Loader, Trash, Edit, Loader as LoaderIcon, Download } from 'lucide-react';
import { AlertBanner } from '../components/ui';
import { ExcelImport, useExcelImport } from '../components/import';
import * as XLSX from 'xlsx';

// Row rules for the book inventory import: ISBN/TITLE/QTY/PRICE required,
// QTY/PRICE must be non-negative numbers. Valid rows are normalized; invalid
// ones are dropped and reported as a count. Passed to useExcelImport.
const validateBookRows = (data) => {
  const invalidRows = [];

  const validatedData = data.map((row, index) => {
    const rowNum = index + 1;
    const {
      ISBN, SUBJECT, TITLE, EDITION, YEAR, AUTHOR, BIND, QTY, PRICE, PUBLISHER
    } = row;

    // Check required fields
    if (!ISBN || !TITLE || QTY === undefined || PRICE === undefined) {
      invalidRows.push({
        row: rowNum,
        message: 'Missing required fields: ISBN, TITLE, QTY, or PRICE',
        data: row
      });
      return null;
    }

    // Validate numeric fields
    if (isNaN(Number(QTY)) || Number(QTY) < 0) {
      invalidRows.push({
        row: rowNum,
        message: 'QTY must be a non-negative number',
        data: row
      });
      return null;
    }

    if (isNaN(Number(PRICE)) || Number(PRICE) < 0) {
      invalidRows.push({
        row: rowNum,
        message: 'PRICE must be a non-negative number',
        data: row
      });
      return null;
    }

    return {
      ISBN: String(ISBN).trim(),
      SUBJECT: String(SUBJECT || '').trim(),
      TITLE: String(TITLE).trim(),
      EDITION: String(EDITION || '').trim(),
      YEAR: String(YEAR || '').trim(),
      AUTHOR: String(AUTHOR || '').trim(),
      BIND: String(BIND || '').trim(),
      QTY: Number(QTY),
      PRICE: Number(PRICE),
      PUBLISHER: String(PUBLISHER || '').trim()
    };
  }).filter(Boolean); // Remove null rows

  if (invalidRows.length > 0) {
    console.log('Invalid rows:', invalidRows);
  }

  return {
    rows: validatedData,
    error: invalidRows.length > 0
      ? `Found ${invalidRows.length} invalid row(s). Please check your data.`
      : null
  };
};

const ImportExport = ({ user }) => {
  const {
    file,
    rows: previewData,
    error: previewError,
    handleFileChange
  } = useExcelImport({ validateRows: validateBookRows });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [mode, setMode] = useState('skip'); // skip, update, merge
  const [exporting, setExporting] = useState(false);

  // Download Excel template with the columns the import expects
  // (ISBN, TITLE, QTY, PRICE required; the rest optional)
  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const templateData = [
      {
        ISBN: '9781234567890', SUBJECT: 'Mathematics', TITLE: 'Example Book Title',
        EDITION: '1st', YEAR: '2024', AUTHOR: 'Jane Doe', BIND: 'Paperback',
        QTY: 10, PRICE: 250, PUBLISHER: 'Academic Publishing'
      },
      {
        ISBN: '9781234567891', SUBJECT: 'Science', TITLE: 'Another Example Book',
        EDITION: '2nd', YEAR: '2023', AUTHOR: 'John Smith', BIND: 'Hardcover',
        QTY: 5, PRICE: 395.5, PUBLISHER: 'Science Press'
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 16 }, { wch: 14 }, { wch: 28 }, { wch: 8 }, { wch: 8 },
      { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Book Import');
    XLSX.writeFile(workbook, 'book-import-template.xlsx');
  };

  const handleImport = async () => {
    if (!file) {
      setImportError('Please select a file to import.');
      return;
    }

    if (previewData.length === 0) {
      setImportError('No valid data found in the file.');
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    setImportResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);

      const response = await api.post('/stock/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportSuccess('Import completed successfully!');
      setImportResults(response.data.results);
    } catch (err) {
      setImportError(err.response?.data?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (byCategory = false) => {
    setExporting(true);
    try {
      const url = byCategory ? '/stock/export?byCategory=true' : '/stock/export';
      const response = await api.get(url, { responseType: 'blob' });

      // Create a blob from the response data
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', byCategory ? 'books-inventory-by-category.xlsx' : 'books-inventory.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      setImportError(err.response?.data?.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center space-x-3">
          <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-primary dark:text-blue-400" />
          Import/Export Books
        </h1>
        <p className="mt-2 text-gray-600 dark:text-slate-400">Bulk import books from Excel/CSV files or export current inventory</p>
      </div>

      {/* Import Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100">Import Books</h2>
          <button
            onClick={downloadTemplate}
            className="flex items-center justify-center space-x-1 px-3 py-2 text-sm bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-colors touch-manipulation min-h-[44px]"
            title="Download Excel template with the expected columns"
          >
            <Download className="w-4 h-4" />
            <span>Download Template</span>
          </button>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Select File</label>
            <div className="flex flex-col space-y-2">
              <ExcelImport
                id="file-input"
                onChange={handleFileChange}
                labelClassName="flex items-center justify-center space-x-3 px-4 py-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg hover:border-primary dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer touch-manipulation min-h-[56px]"
              >
                <span className="flex flex-col items-center text-center">
                  <Upload className="w-6 h-6 text-primary dark:text-blue-400 mb-1" />
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Click to upload or drag and drop</span>
                </span>
              </ExcelImport>
              <p className="text-xs text-gray-500 dark:text-slate-400 text-center">
                Supported: .xlsx, .xls, .csv | Required: ISBN, TITLE, QTY, PRICE<br />
                Optional: SUBJECT, EDITION, YEAR, AUTHOR, BIND, PUBLISHER
              </p>
            </div>
          </div>

          {file && (
            <div className="border-t dark:border-slate-800 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Import Mode</label>
              <div className="space-y-2 sm:space-y-3">
                <label className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-slate-800 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer touch-manipulation min-h-[44px]">
                  <input
                    type="radio"
                    name="mode"
                    value="skip"
                    checked={mode === 'skip'}
                    onChange={(e) => setMode(e.target.value)}
                    className="form-radio h-4 w-4 text-primary dark:text-blue-400 mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-slate-100">Skip Duplicates</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Skip rows where ISBN already exists</p>
                  </div>
                </label>
                <label className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-slate-800 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer touch-manipulation min-h-[44px]">
                  <input
                    type="radio"
                    name="mode"
                    value="update"
                    checked={mode === 'update'}
                    onChange={(e) => setMode(e.target.value)}
                    className="form-radio h-4 w-4 text-primary dark:text-blue-400 mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-slate-100">Update Existing</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Update book metadata and replace quantity</p>
                  </div>
                </label>
                <label className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-slate-800 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer touch-manipulation min-h-[44px]">
                  <input
                    type="radio"
                    name="mode"
                    value="merge"
                    checked={mode === 'merge'}
                    onChange={(e) => setMode(e.target.value)}
                    className="form-radio h-4 w-4 text-primary dark:text-blue-400 mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-slate-100">Merge / Increment Stock</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Update metadata and increase quantity by imported amount</p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Preview Section */}
        {file && previewData.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-3">Data Preview</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">
              Showing {previewData.length} valid row(s){previewError ? ` (${previewError})` : ''}
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">ISBN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Author</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Price</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                  {previewData.slice(0, 10).map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">{row.ISBN}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300 max-w-xs truncate">{row.TITLE}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{row.AUTHOR || 'N/A'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100 font-medium">{row.QTY}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">₱{row.PRICE.toFixed(2)}</td>
                    </tr>
                  ))}
                  {previewData.length > 10 && (
                    <tr>
                      <td className="px-4 py-3 text-center text-gray-500 dark:text-slate-400" colSpan="5">
                        And {previewData.length - 10} more row(s)...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {previewError && (
          <div className="mt-4">
            <AlertBanner tone="error">{previewError}</AlertBanner>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleImport}
            disabled={!file || importing || previewData.length === 0}
            className={
              !file || previewData.length === 0
                ? 'w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-300 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 touch-manipulation min-h-[48px] min-w-[180px]'
                : 'w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 touch-manipulation min-h-[48px] min-w-[180px]'
            }
          >
            {importing ? (
              <>
                <LoaderIcon className="mr-2 w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 w-4 h-4" />
                Import Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* Import Results */}
      {importResults && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100 mb-3 sm:mb-4">Import Results</h2>
          {importSuccess && (
            <AlertBanner tone="success">{importSuccess}</AlertBanner>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="flex items-center space-x-3 p-3 sm:p-4 bg-primary/5 dark:bg-blue-500/15 rounded-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 dark:bg-blue-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300">Successfully Imported</p>
                <p className="text-xl sm:text-2xl font-bold text-primary dark:text-blue-400">{importResults.succeeded}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 sm:p-4 bg-primary/5 dark:bg-blue-500/15 rounded-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 dark:bg-blue-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-primary dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300">Skipped (Duplicates)</p>
                <p className="text-xl sm:text-2xl font-bold text-primary dark:text-blue-400">{importResults.skipped}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 sm:p-4 bg-primary/5 dark:bg-blue-500/15 rounded-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 dark:bg-blue-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <LoaderIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300">Updated</p>
                <p className="text-xl sm:text-2xl font-bold text-primary dark:text-blue-400">{importResults.updated}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 sm:p-4 bg-primary/5 dark:bg-blue-500/15 rounded-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 dark:bg-blue-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-primary dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300">Merged</p>
                <p className="text-xl sm:text-2xl font-bold text-primary dark:text-blue-400">{importResults.merged}</p>
              </div>
            </div>
          </div>
          {importResults.errors && importResults.errors.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">Errors ({importResults.errors.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                  <thead className="bg-gray-50 dark:bg-slate-800/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Row</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Message</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">ISBN</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {importResults.errors.map((error, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 dark:text-red-400">{error.row}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 dark:text-red-400 max-w-md truncate">{error.message}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 dark:text-red-400">{error.data.ISBN || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Error */}
      {importError && !importResults && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 sm:p-6 mb-4 sm:mb-6">
          <AlertBanner tone="error">{importError}</AlertBanner>
        </div>
      )}

      {/* Export Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100 mb-3 sm:mb-4">Export Inventory</h2>
        <p className="text-gray-600 dark:text-slate-400 mb-4">
          Export your current book inventory to an Excel file. Includes all book details and current stock quantities.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <button
            onClick={() => handleExport(false)}
            disabled={exporting}
            className={`flex-1 flex items-center justify-center px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 touch-manipulation min-h-[48px] min-w-[160px]`}
          >
            {exporting ? (
              <>
                <LoaderIcon className="mr-2 w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Upload className="mr-2 w-4 h-4" />
                Export to Excel (Single Sheet)
              </>
            )}
          </button>
          <button
            onClick={() => handleExport(true)}
            disabled={exporting}
            className={`flex-1 flex items-center justify-center px-4 py-3 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50 touch-manipulation min-h-[48px] min-w-[160px]`}
          >
            {exporting ? (
              <>
                <LoaderIcon className="mr-2 w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Upload className="mr-2 w-4 h-4" />
                Export by Category (Multi-Sheet)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportExport;