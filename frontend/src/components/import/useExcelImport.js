import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';

// Shared file handling for the two Excel/CSV import surfaces (Scan's bulk
// stock import and ImportExport's book import). Everything common lives
// here: file-type validation, CSV vs Excel parsing, reader errors. The
// page-specific row rules are passed in as `validateRows`, which receives
// the parsed rows and returns `{ rows, error }` — both may be set at once
// (ImportExport shows valid rows alongside an "N invalid rows" notice).
const VALID_FILE_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv'
];

const parseRows = (contents, fileName) => {
  if (fileName.endsWith('.csv')) {
    // Parse CSV
    const lines = contents.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] !== undefined ? values[index] : '';
      });
      return row;
    });
  }
  // Parse Excel
  const workbook = XLSX.read(contents, { type: 'binary' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

export const useExcelImport = ({ validateRows }) => {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  const clear = useCallback(() => {
    setFile(null);
    setRows([]);
    setError(null);
  }, []);

  const handleFileChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      clear();
      return;
    }

    // Validate file type
    if (!VALID_FILE_TYPES.includes(selectedFile.type)) {
      setFile(null);
      setRows([]);
      setError('Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    setFile(selectedFile);
    setError(null);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = parseRows(e.target.result, selectedFile.name);
        const validated = validateRows(data);
        setRows(validated.rows);
        setError(validated.error);
      } catch (err) {
        setRows([]);
        setError('Error parsing file. Please ensure it\'s a valid Excel or CSV file.');
        console.error('File parsing error:', err);
      }
    };

    reader.onerror = () => {
      setRows([]);
      setError('Error reading file.');
    };

    if (selectedFile.name.endsWith('.csv')) {
      reader.readAsText(selectedFile);
    } else {
      reader.readAsBinaryString(selectedFile);
    }
  }, [clear, validateRows]);

  return { file, rows, error, clear, handleFileChange };
};
