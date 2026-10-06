import React, { useState } from 'react';
import axios from 'axios';
import { Upload, CheckCircle, AlertTriangle, Loader, Trash, Edit, Loader as LoaderIcon } from 'lucide-react';
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

      const config = {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      };

      const response = await axios.post('/api/stock/bulk-import', formData, config);
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
      const config = {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        responseType: 'blob' // Important for downloading files
      };

      const url = byCategory ? '/api/stock/export?byCategory=true' : '/api/stock/export';
      const response = await axios.get(url, config);

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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-3">
          <Upload className="w-5 h-5 text-primary" />
          Import/Export Books
        </h1>
        <p className="mt-2 text-gray-600">Bulk import books from Excel/CSV files or export current inventory</p>
      </div>

      {/* Import Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Import Books</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
            <div className="flex flex-col space-y-2">
              <label className="flex items-center space-x-3 px-4 py-2 border border-gray-300 rounded-md hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  id="file-input"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="flex-1">
                  Click to upload or drag and drop
                </span>
                <Upload className="w-5 h-5 text-primary" />
              </label>
              <p className="text-xs text-gray-500">
                Supported formats: .xlsx, .xls, .csv<br />
                Required columns: ISBN, TITLE, QTY, PRICE<br />
                Optional columns: SUBJECT, EDITION, YEAR, AUTHOR, BIND, PUBLISHER
              </p>
            </div>
          </div>

          {file && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Import Mode</label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="mode"
                    value="skip"
                    checked={mode === 'skip'}
                    onChange={(e) => setMode(e.target.value)}
                    className="form-radio h-4 w-4 text-primary"
                  />
                  <span>Skip Duplicates</span>
                  <p className="text-xs text-gray-500 ml-6">Skip rows where ISBN already exists</p>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="mode"
                    value="update"
                    checked={mode === 'update'}
                    onChange={(e) => setMode(e.target.value)}
                    className="form-radio h-4 w-4 text-primary"
                  />
                  <span>Update Existing</span>
                  <p className="text-xs text-gray-500 ml-6">Update book metadata and replace quantity</p>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="mode"
                    value="merge"
                    checked={mode === 'merge'}
                    onChange={(e) => setMode(e.target.value)}
                    className="form-radio h-4 w-4 text-primary"
                  />
                  <span>Merge / Increment Stock</span>
                  <p className="text-xs text-gray-500 ml-6">Update metadata and increase quantity by imported amount</p>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISBN</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.slice(0, 10).map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.ISBN}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.TITLE}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.AUTHOR || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{row.QTY}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱{row.PRICE.toFixed(2)}</td>
                    </tr>
                  ))}
                  {previewData.length > 10 && (
                    <tr>
                      <td className="px-6 py-4 text-center text-gray-500" colSpan="5">
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
          <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{previewError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleImport}
            disabled={!file || importing || previewData.length === 0}
            className={`w-flex items-center justify-center px-6 py-3 ${
              !file || previewData.length === 0 ? 'bg-gray-200 text-gray-500' : 'bg-primary text-white'
            } hover:${!file || previewData.length === 0 ? 'bg-gray-300' : 'bg-primary/90'} rounded-lg transition-colors disabled:opacity-50`}
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
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Import Results</h2>
          {importSuccess && (
            <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-400">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{importSuccess}</p>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Successfully Imported</p>
                <p className="text-2xl font-bold text-primary">{importResults.succeeded}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Skipped (Duplicates)</p>
                <p className="text-2xl font-bold text-primary">{importResults.skipped}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <LoaderIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Updated</p>
                <p className="text-2xl font-bold text-primary">{importResults.updated}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Merged</p>
                <p className="text-2xl font-bold text-primary">{importResults.merged}</p>
              </div>
            </div>
            {importResults.errors && importResults.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Errors ({importResults.errors.length})</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISBN</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {importResults.errors.map((error, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{error.row}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{error.message}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{error.data.ISBN || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Error */}
      {importError && !importResults && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{importError}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Export Inventory</h2>
        <p className="text-gray-600 mb-4">
          Export your current book inventory to an Excel file. Includes all book details and current stock quantities.
        </p>

        <div className="flex items-center space-x-3 flex-wrap">
          <button
            onClick={() => handleExport(false)}
            disabled={exporting}
            className={`flex items-center justify-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50`}
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
            className={`flex items-center justify-center px-6 py-3 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50`}
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