import React, { useState } from 'react';
import api from '../api/axios';
import { Upload, CheckCircle, AlertTriangle, Loader, Trash, Edit, Loader as LoaderIcon } from 'lucide-react';
import { AlertBanner } from '../components/ui';
import * as XLSX from 'xlsx';

const ImportExport = ({ user }) => {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [previewError, setPreviewError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [mode, setMode] = useState('skip'); // skip, update, merge
  const [exporting, setExporting] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      setFile(null);
      setPreviewData([]);
      setPreviewError(null);
      return;
    }

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!validTypes.includes(selectedFile.type)) {
      setPreviewError('Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setPreviewError(null);
    previewFile(selectedFile);
  };

  const previewFile = (file) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const contents = e.target.result;
        let data;

        if (file.name.endsWith('.csv')) {
          // Parse CSV
          const lines = contents.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim());
          data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index] !== undefined ? values[index] : '';
            });
            return row;
          });
        } else {
          // Parse Excel
          const workbook = XLSX.read(contents, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          data = XLSX.utils.sheet_to_json(worksheet);
        }

        // Validate required fields
        const requiredFields = ['ISBN', 'TITLE', 'QTY', 'PRICE'];
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
          setPreviewError(`Found ${invalidRows.length} invalid row(s). Please check your data.`);
          console.log('Invalid rows:', invalidRows);
        }

        setPreviewData(validatedData);
      } catch (err) {
        setPreviewError('Error parsing file. Please ensure it\'s a valid Excel or CSV file.');
        console.error('File parsing error:', err);
      }
    };

    reader.onerror = () => {
      setPreviewError('Error reading file.');
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center space-x-3">
          <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Import/Export Books
        </h1>
        <p className="mt-2 text-gray-600">Bulk import books from Excel/CSV files or export current inventory</p>
      </div>

      {/* Import Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Import Books</h2>

        <div className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
            <div className="flex flex-col space-y-2">
              <label className="flex items-center justify-center space-x-3 px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary hover:bg-gray-50 transition-colors cursor-pointer touch-manipulation min-h-[56px]">
                <input
                  type="file"
                  id="file-input"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="flex flex-col items-center text-center">
                  <Upload className="w-6 h-6 text-primary mb-1" />
                  <span className="text-sm font-medium text-gray-700">Click to upload or drag and drop</span>
                </span>
              </label>
              <p className="text-xs text-gray-500 text-center">
                Supported: .xlsx, .xls, .csv | Required: ISBN, TITLE, QTY, PRICE<br />
                Optional: SUBJECT, EDITION, YEAR, AUTHOR, BIND, PUBLISHER
              </p>
            </div>
          </div>

          {file && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Import Mode</label>
              <div className="space-y-2 sm:space-y-3">
                <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer touch-manipulation min-h-[44px]">
                  <input
                    type="radio"
                    name="mode"
                    value="skip"
                    checked={mode === 'skip'}
                    onChange={(e) => setMode(e.target.value)}
                    className="form-radio h-4 w-4 text-primary mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Skip Duplicates</p>
                    <p className="text-xs text-gray-500 mt-0.5">Skip rows where ISBN already exists</p>
                  </div>
                </label>
                <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer touch-manipulation min-h-[44px]">
                  <input
                    type="radio"
                    name="mode"
                    value="update"
                    checked={mode === 'update'}
                    onChange={(e) => setMode(e.target.value)}
                    className="form-radio h-4 w-4 text-primary mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Update Existing</p>
                    <p className="text-xs text-gray-500 mt-0.5">Update book metadata and replace quantity</p>
                  </div>
                </label>
                <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer touch-manipulation min-h-[44px]">
                  <input
                    type="radio"
                    name="mode"
                    value="merge"
                    checked={mode === 'merge'}
                    onChange={(e) => setMode(e.target.value)}
                    className="form-radio h-4 w-4 text-primary mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Merge / Increment Stock</p>
                    <p className="text-xs text-gray-500 mt-0.5">Update metadata and increase quantity by imported amount</p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Preview Section */}
        {file && previewData.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Data Preview</h2>
            <p className="text-sm text-gray-500 mb-2">
              Showing {previewData.length} valid row(s){previewError ? ` (${previewError})` : ''}
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISBN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.slice(0, 10).map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{row.ISBN}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 max-w-xs truncate">{row.TITLE}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.AUTHOR || 'N/A'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">{row.QTY}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">₱{row.PRICE.toFixed(2)}</td>
                    </tr>
                  ))}
                  {previewData.length > 10 && (
                    <tr>
                      <td className="px-4 py-3 text-center text-gray-500" colSpan="5">
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
                ? 'w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-gray-200 text-gray-500 hover:bg-gray-300 rounded-lg transition-colors disabled:opacity-50 touch-manipulation min-h-[48px] min-w-[180px]'
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Import Results</h2>
          {importSuccess && (
            <AlertBanner tone="success">{importSuccess}</AlertBanner>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="flex items-center space-x-3 p-3 sm:p-4 bg-primary/5 rounded-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Successfully Imported</p>
                <p className="text-xl sm:text-2xl font-bold text-primary">{importResults.succeeded}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 sm:p-4 bg-primary/5 rounded-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Skipped (Duplicates)</p>
                <p className="text-xl sm:text-2xl font-bold text-primary">{importResults.skipped}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 sm:p-4 bg-primary/5 rounded-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <LoaderIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Updated</p>
                <p className="text-xl sm:text-2xl font-bold text-primary">{importResults.updated}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 sm:p-4 bg-primary/5 rounded-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Merged</p>
                <p className="text-xl sm:text-2xl font-bold text-primary">{importResults.merged}</p>
              </div>
            </div>
          </div>
          {importResults.errors && importResults.errors.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Errors ({importResults.errors.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISBN</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {importResults.errors.map((error, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600">{error.row}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 max-w-md truncate">{error.message}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600">{error.data.ISBN || 'N/A'}</td>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <AlertBanner tone="error">{importError}</AlertBanner>
        </div>
      )}

      {/* Export Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Export Inventory</h2>
        <p className="text-gray-600 mb-4">
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