import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../api/axios';
import * as XLSX from 'xlsx';
import { Barcode, ShoppingBag, Loader, CheckCircle, AlertTriangle, Trash2, RotateCcw, Camera, X, Volume2, VolumeX, Upload, Download, FileText, PlusCircle, MinusCircle } from 'lucide-react';

const Scan = ({ user }) => {
  const [mode, setMode] = useState(null); // 'inbound' | 'outbound' | null
  const [isbn, setIsbn] = useState('');
  const [bookInfo, setBookInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [scanMethod, setScanMethod] = useState('manual'); // 'manual' | 'camera'
  const [cameraScanner, setCameraScanner] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedIsbn, setLastScannedIsbn] = useState(null); // Cooldown tracker (per-ISBN)
  const [scanCooldown, setScanCooldown] = useState(false); // Global 0.5s cooldown after ANY scan
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { type: 'success'|'error', book?, message? }

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importError, setImportError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

  const cameraContainerRef = useRef(null);
  const isbnInputRef = useRef(null);
  const audioContextRef = useRef(null);
  const cameraScannerRef = useRef(null); // Ref for live scanner instance
  const fullscreenElementRef = useRef(null); // Ref for fullscreen element

  // Keep ref in sync with state
  useEffect(() => {
    cameraScannerRef.current = cameraScanner;
  }, [cameraScanner]);

  // Auto-focus the ISBN input on mount and when mode changes
  useEffect(() => {
    if (isbnInputRef.current && scanMethod === 'manual') {
      isbnInputRef.current.focus();
    }
  }, [mode, scanMethod]);

  // Camera scanner cleanup on unmount - uses ref for live instance
  useEffect(() => {
    return () => {
      if (cameraScannerRef.current) {
        cameraScannerRef.current.stop().catch(() => {});
        // Also force-stop any active media streams
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
          stream.getTracks().forEach(track => track.stop());
        }).catch(() => {});
      }
    };
  }, []);

  // Clean up camera when method changes or mode changes
  useEffect(() => {
    if (scanMethod !== 'camera' && cameraScannerRef.current) {
      cameraScannerRef.current.stop().catch(() => {});
      // Exit fullscreen if active
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setCameraScanner(null);
      setIsCameraActive(false);
    }
  }, [scanMethod, mode]);

  // Fullscreen handling for mobile camera
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = document.fullscreenElement !== null;
      setIsFullscreen(isFull);
      if (!isFull && scanMethod === 'camera') {
        // User exited fullscreen manually, stop camera
        handleScanMethodChange('manual');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [scanMethod]);

  // Clear scan result when mode or scan method changes
  useEffect(() => {
    setScanResult(null);
  }, [mode, scanMethod]);

  // Auto-lookup and process when ISBN changes (for scanner input)
  useEffect(() => {
    if (!mode || !isbn || isbn.length < 8) return; // Need mode and valid ISBN
    if (scanCooldown) return; // Global cooldown prevents any scan

    const delay = scanMethod === 'camera' ? 0 : 100; // No debounce for camera, 100ms for manual
    const timer = setTimeout(() => {
      processScan(isbn);
    }, delay);

    return () => clearTimeout(timer);
  }, [isbn, mode, scanMethod, scanCooldown]);

  const processScan = async (code) => {
    setLoading(true);
    setError(null);
    setScanResult(null); // Clear previous scan result

    // Clear ISBN immediately so camera can scan next barcode
    setIsbn('');

    try {
      // First lookup the book
      const lookupResponse = await api.get(`/books/lookup/${code}`);

      if (!lookupResponse.data || !lookupResponse.data.ISBN) {
        throw new Error('Book not found in inventory');
      }

      const book = lookupResponse.data;

      // Then process stock action (always qty = 1)
      const stockResponse = await api.patch(`/stock/${book.ISBN}/stock`, {
        action: mode === 'inbound' ? 'INBOUND' : 'OUTBOUND',
        qtyChanged: 1
      });

      const updatedBook = stockResponse.data;

      // Add to recent scans
      setRecentScans(prev => [
        {
          isbn: book.ISBN,
          title: book.TITLE,
          action: mode === 'inbound' ? 'IN' : 'OUT',
          qty: 1,
          newStock: updatedBook.QTY,
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 19) // Keep last 20
      ]);

      // Update book info display
      setBookInfo(updatedBook);

      // Success message
      const successMsg = `${mode === 'inbound' ? 'Added' : 'Removed'} 1 unit to "${book.TITLE}" (Stock: ${updatedBook.QTY})`;
      setSuccess(successMsg);

      // Set scan result for camera view display
      setScanResult({
        type: 'success',
        book: updatedBook,
        action: mode === 'inbound' ? 'IN' : 'OUT'
      });

      // Re-focus input for next scan
      setTimeout(() => {
        if (isbnInputRef.current) {
          isbnInputRef.current.focus();
        }
      }, 50);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      const errorMsg = `Failed to ${mode === 'inbound' ? 'receive' : 'ship'} stock: ${msg}`;
      setError(errorMsg);

      // Set scan result for camera view display
      setScanResult({
        type: 'error',
        message: msg,
        scannedIsbn: code
      });

      // Still clear ISBN so user can scan next
      setIsbn('');
      setTimeout(() => {
        if (isbnInputRef.current) {
          isbnInputRef.current.focus();
        }
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  const setModeAndFocus = (newMode) => {
    setMode(newMode);
    setIsbn('');
    setBookInfo(null);
    setError(null);
    setSuccess(null);
    setTimeout(() => {
      if (isbnInputRef.current) {
        isbnInputRef.current.focus();
      }
    }, 100);
  };

  const clearMode = () => {
    setMode(null);
    setIsbn('');
    setBookInfo(null);
    setError(null);
    setSuccess(null);
    setRecentScans([]);
    setScanMethod('manual');
    setTimeout(() => {
      if (isbnInputRef.current) {
        isbnInputRef.current.focus();
      }
    }, 100);
  };

  const startCameraScanner = async () => {
    if (!cameraContainerRef.current) return;

    setCameraError(null);

    // Stop any existing scanner first
    if (cameraScanner) {
      await stopCameraScanner();
    }

    let permissionStream = null;

    try {
      const container = cameraContainerRef.current;

      // Force layout and get explicit dimensions
      await new Promise(resolve => requestAnimationFrame(resolve));
      const rect = container.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        throw new Error('Camera container has no dimensions');
      }

      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      const html5Qrcode = new Html5Qrcode('camera-reader');

      // Explicitly request camera permission first
      permissionStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: width },
          height: { ideal: height }
        }
      });
      // Stop the test stream - we just wanted to trigger permission
      permissionStream.getTracks().forEach(track => track.stop());
      permissionStream = null;

      // Calculate qrbox based on container dimensions to match visual overlay
      // Visual overlay: w-[70%] max-w-[280px] aspect-[2.5/1]
      const qrboxWidth = Math.min(Math.floor(width * 0.7), 280);
      const qrboxHeight = Math.floor(qrboxWidth / 2.5); // 2.5:1 aspect ratio

      await html5Qrcode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: qrboxWidth, height: qrboxHeight }
        },
        (decodedText) => {
          if (decodedText && decodedText.length >= 8) {
            // Global 0.5s cooldown - prevent ANY scan during cooldown
            if (scanCooldown) return;

            // Prevent re-scanning same ISBN within 2 seconds (per-ISBN cooldown)
            if (decodedText === lastScannedIsbn) return;

            setLastScannedIsbn(decodedText);
            // Clear per-ISBN cooldown after 2 seconds
            setTimeout(() => setLastScannedIsbn(null), 500);

            // Set global scan cooldown for 2 seconds
            setScanCooldown(true);
            setTimeout(() => setScanCooldown(false), 500);

            setIsbn(decodedText);
            playBeep();
          }
        },
        (errorMessage) => {
          // Ignore scan errors
        }
      );

      setCameraScanner(html5Qrcode);
      cameraScannerRef.current = html5Qrcode;
      setIsCameraActive(true);

      // Request fullscreen on mobile/tablet for better scanning experience
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                       window.innerWidth <= 768;
      if (isMobile && cameraContainerRef.current) {
        try {
          await cameraContainerRef.current.requestFullscreen({ navigationUI: 'hide' });
        } catch (fsErr) {
          console.warn('Fullscreen request failed:', fsErr);
        }
      }
    } catch (err) {
      console.error('Camera start error:', err);
      // Ensure permission stream is cleaned up on error
      if (permissionStream) {
        permissionStream.getTracks().forEach(track => track.stop());
      }
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please allow camera access in browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found. Please connect a camera.');
      } else if (err.name === 'OverconstrainedError') {
        setCameraError('Camera does not support required resolution.');
      } else {
        setCameraError('Could not access camera: ' + err.message);
      }
      setIsCameraActive(false);
    }
  };

  const stopCameraScanner = async () => {
    const scanner = cameraScannerRef.current;
    if (scanner) {
      try {
        await scanner.stop();
      } catch (err) {
        console.warn('Camera stop error:', err);
      }
      // Force stop all video tracks as fallback
      navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop());
      }).catch(() => {});
    }

    // Exit fullscreen if active
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.warn('Exit fullscreen failed:', err);
      }
    }

    setCameraScanner(null);
    setIsCameraActive(false);
  };

  // Beep sound using Web Audio API
  const playBeep = () => {
    if (!soundEnabled) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, ctx.currentTime); // 800 Hz beep
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (err) {
      console.warn('Beep sound failed:', err);
    }
  };

  const handleScanMethodChange = (method) => {
    setScanMethod(method);
    setIsbn('');
    setError(null);
    setSuccess(null);
    setBookInfo(null);
    setCameraError(null);

    if (method === 'camera') {
      // Delay to allow DOM to update
      setTimeout(() => startCameraScanner(), 100);
    } else {
      stopCameraScanner();
      setTimeout(() => {
        if (isbnInputRef.current) {
          isbnInputRef.current.focus();
        }
      }, 100);
    }
  };

  // Download Excel template for bulk import
  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const templateData = [
      { ISBN: '9781234567890', QTY: 1 },
      { ISBN: '9781234567891', QTY: 2 },
      { ISBN: '9781234567892', QTY: 1 },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    // Set column widths
    worksheet['!cols'] = [{ wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Import');
    XLSX.writeFile(workbook, `${mode === 'inbound' ? 'stock-in' : 'stock-out'}-template.xlsx`);
  };

  // Handle file selection for import
  const handleImportFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setImportFile(null);
      setImportPreview([]);
      setImportError(null);
      return;
    }

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!validTypes.includes(file.type)) {
      setImportError('Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV file.');
      setImportFile(null);
      return;
    }

    setImportFile(file);
    setImportError(null);
    previewImportFile(file);
  };

  // Preview the import file
  const previewImportFile = (file) => {
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

        // Validate ISBN column exists
        const hasISBN = data.some(row => row.ISBN !== undefined);
        if (!hasISBN) {
          setImportError('File must contain an ISBN column.');
          setImportPreview([]);
          return;
        }

        // Validate and prepare data
        const validatedData = data.map((row, index) => {
          const rowNum = index + 1;
          const isbn = row.ISBN ? String(row.ISBN).trim() : '';
          const qty = row.QTY !== undefined && row.QTY !== '' && !isNaN(Number(row.QTY))
            ? Math.max(1, Number(row.QTY))
            : 1;

          if (!isbn) {
            return null;
          }

          return {
            row: rowNum,
            isbn,
            qty,
            originalRow: row
          };
        }).filter(Boolean);

        if (validatedData.length === 0) {
          setImportError('No valid ISBNs found in the file.');
          setImportPreview([]);
          return;
        }

        setImportPreview(validatedData);
      } catch (err) {
        setImportError('Error parsing file. Please ensure it\'s a valid Excel or CSV file.');
        console.error('File parsing error:', err);
      }
    };

    reader.onerror = () => {
      setImportError('Error reading file.');
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  // Process bulk import
  const processBulkImport = async () => {
    if (!importPreview.length || !mode) {
      setImportError('No data to import or mode not selected.');
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportResults(null);

    const results = {
      succeeded: 0,
      failed: 0,
      errors: [],
      details: []
    };

    try {
      for (const item of importPreview) {
        try {
          const response = await api.patch(`/stock/${item.isbn}/stock`, {
            action: mode === 'inbound' ? 'INBOUND' : 'OUTBOUND',
            qtyChanged: item.qty
          });

          results.succeeded++;
          results.details.push({
            isbn: item.isbn,
            title: response.data.TITLE,
            action: mode === 'inbound' ? 'IN' : 'OUT',
            qty: item.qty,
            newStock: response.data.QTY,
            timestamp: new Date().toLocaleTimeString()
          });
        } catch (err) {
          results.failed++;
          results.errors.push({
            isbn: item.isbn,
            message: err.response?.data?.message || err.message
          });
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Add to recent scans
      if (results.details.length > 0) {
        setRecentScans(prev => [
          ...results.details.reverse(),
          ...prev.slice(0, 20 - results.details.length)
        ]);
      }

      setImportResults(results);

      if (results.failed > 0) {
        setImportError(`${results.failed} item(s) failed. Check details below.`);
      } else {
        setSuccess(`Successfully processed ${results.succeeded} item(s) via bulk import!`);
      }
    } catch (err) {
      setImportError('Bulk import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Clear import state
  const clearImport = () => {
    setShowImport(false);
    setImportFile(null);
    setImportPreview([]);
    setImportError(null);
    setImporting(false);
    setImportResults(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-3xl space-y-6 mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-3">
              <Barcode className="w-6 h-6 text-primary" />
              <span>Barcode Stock Scanner</span>
            </h1>
          </div>

          {/* Mode Selection - Only shown when no mode selected */}
          {!mode && (
            <div className="space-y-4">
              <p className="text-center text-gray-600 text-lg">Select operation mode to begin scanning</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setModeAndFocus('inbound')}
                  className="flex flex-col items-center justify-center p-6 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 hover:border-green-400 transition-all"
                >
                  <ShoppingBag className="w-12 h-12 text-green-600 mb-3" />
                  <span className="text-xl font-bold text-green-800">Receive Stock (IN)</span>
                  <span className="text-sm text-green-600 mt-1">Scan books to add +1 qty</span>
                </button>

                <button
                  onClick={() => setModeAndFocus('outbound')}
                  className="flex flex-col items-center justify-center p-6 bg-red-50 border-2 border-red-200 rounded-xl hover:bg-red-100 hover:border-red-400 transition-all"
                >
                  <Trash2 className="w-12 h-12 text-red-600 mb-3" />
                  <span className="text-xl font-bold text-red-800">Ship Stock (OUT)</span>
                  <span className="text-sm text-red-600 mt-1">Scan books to remove -1 qty</span>
                </button>
              </div>

              <p className="text-center text-xs text-gray-500">
                Hardware barcode scanners work automatically - just scan ISBN barcodes
              </p>
            </div>
          )}

          {/* Active Scanning Mode */}
          {mode && (
            <div className="space-y-4">
              {/* Mode Header */}
              <div className={`flex items-center justify-between p-4 rounded-xl ${
                mode === 'inbound' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    mode === 'inbound' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {mode === 'inbound' ? (
                      <ShoppingBag className="w-5 h-5 text-green-600" />
                    ) : (
                      <Trash2 className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <h2 className={`font-bold text-lg ${mode === 'inbound' ? 'text-green-800' : 'text-red-800'}`}>
                      {mode === 'inbound' ? 'Receive Stock Mode' : 'Ship Stock Mode'}
                    </h2>
                    <p className="text-sm text-gray-600">
                      Scans will automatically {mode === 'inbound' ? 'add +1' : 'remove -1'} qty
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowImport(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                    title="Bulk import from Excel/CSV"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">Import</span>
                  </button>
                  <button
                    onClick={clearMode}
                    className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Change Mode</span>
                  </button>
                </div>
              </div>

              {/* Scan Method Selector */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Scan Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleScanMethodChange('manual')}
                    className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 transition-all ${
                      scanMethod === 'manual'
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="text-lg">⌨</span>
                    <span className="font-medium">Text Input</span>
                  </button>
                  <button
                    onClick={() => handleScanMethodChange('camera')}
                    className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 transition-all ${
                      scanMethod === 'camera'
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    <span className="font-medium">Camera Scan</span>
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  {scanMethod === 'camera'
                    ? 'Point camera at ISBN barcode • Auto-stops after scan'
                    : 'Type or scan with hardware scanner • Auto-focuses after each scan'}
                </p>
              </div>

              {/* Bulk Import Section */}
              {showImport && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Bulk Import
                    </label>
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Download Excel template"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Template</span>
                    </button>
                  </div>

                  {!importFile ? (
                  // Initial state - show upload button
                  <div className="text-center py-6">
                    <input
                      type="file"
                      id="import-file-input"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="import-file-input"
                      className="flex flex-col items-center justify-center space-y-3 px-6 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <Upload className="w-10 h-10 text-gray-400" />
                      <span className="text-gray-600">Click to upload or drag and drop</span>
                      <p className="text-xs text-gray-500">
                        Excel (.xlsx, .xls) or CSV with ISBN column
                      </p>
                    </label>
                  </div>
                ) : (
                  // File selected - show preview and actions
                  <div className="space-y-4">
                    {importError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">{importError}</span>
                        <button
                          onClick={() => {
                            setImportFile(null);
                            setImportPreview([]);
                            setImportError(null);
                            setShowImport(false);
                          }}
                          className="flex-shrink-0 text-red-600 hover:underline text-sm"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    {importPreview.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-700">
                            {importPreview.length} ISBN(s) ready to process
                          </p>
                          <button
                            onClick={() => {
                              setImportFile(null);
                              setImportPreview([]);
                              setShowImport(false);
                            }}
                            className="text-sm text-gray-500 hover:text-gray-700"
                          >
                            Clear
                          </button>
                        </div>

                        <div className="overflow-x-auto max-h-48">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISBN</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {importPreview.slice(0, 10).map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.row}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{item.isbn}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{item.qty}</td>
                                </tr>
                              ))}
                              {importPreview.length > 10 && (
                                <tr>
                                  <td className="px-3 py-2 text-center text-gray-500" colSpan="3">
                                    And {importPreview.length - 10} more...
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        <button
                          onClick={processBulkImport}
                          disabled={importing}
                          className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg transition-colors ${
                            importing
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-primary text-white hover:bg-primary/90'
                          }`}
                        >
                          {importing ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span>Process {mode === 'inbound' ? 'Stock In' : 'Stock Out'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {importResults && (
                      <div className="bg-gray-50 rounded-lg p-4 border-t border-gray-200 space-y-3">
                        <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                          <FileText className="w-5 h-5 text-primary" />
                          Import Results
                        </h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="bg-green-50 p-3 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">{importResults.succeeded}</p>
                            <p className="text-xs text-green-700">Succeeded</p>
                          </div>
                          <div className="bg-red-50 p-3 rounded-lg">
                            <p className="text-2xl font-bold text-red-600">{importResults.failed}</p>
                            <p className="text-xs text-red-700">Failed</p>
                          </div>
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">{importResults.details.length}</p>
                            <p className="text-xs text-blue-700">Total</p>
                          </div>
                        </div>

                        {importResults.errors.length > 0 && (
                          <div className="border-t border-gray-200 pt-3">
                            <h4 className="text-sm font-medium text-red-700 mb-2">Errors:</h4>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {importResults.errors.slice(0, 5).map((err, index) => (
                                <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                  ISBN: {err.isbn} - {err.message}
                                </div>
                              ))}
                              {importResults.errors.length > 5 && (
                                <p className="text-xs text-gray-500">And {importResults.errors.length - 5} more errors...</p>
                              )}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={clearImport}
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

              {/* Scan Input - Manual or Camera */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {scanMethod === 'camera' ? 'Camera Scanner' : 'Scan ISBN Barcode'}
                </label>

                {scanMethod === 'camera' ? (
                  // Camera Scanner View
                  <div className="space-y-3">
                    {cameraError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">{cameraError}</span>
                        <button
                          onClick={startCameraScanner}
                          className="flex-shrink-0 text-red-600 hover:underline text-sm"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-black rounded-none' : ''}`}>
                      {/* Loading indicator - React-managed, OUTSIDE library container */}
                      {!isCameraActive && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-4 rounded-lg bg-black" style={{ zIndex: 10 }}>
                          <Loader className="w-8 h-8 animate-spin text-primary mb-2" />
                          <p className="text-center">Starting camera...</p>
                        </div>
                      )}

                      {/* Camera feed container - managed by library, NO React children */}
                      <div
                        ref={cameraContainerRef}
                        id="camera-reader"
                        className={`w-full overflow-hidden ${isFullscreen ? 'h-screen rounded-none' : 'rounded-lg'}`}
                        style={{
                          aspectRatio: isFullscreen ? undefined : '16/9',
                          maxHeight: isFullscreen ? '100vh' : '500px',
                          backgroundColor: '#000'
                        }}
                      />

                      {/* Overlay - managed by React, sibling to camera container */}
                      {isCameraActive && !scanResult && (
                        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                          {/* Scan frame - matches qrbox proportion: 2.5:1 */}
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] max-w-[280px] h-auto aspect-[2.5/1] border-2 border-primary/90 rounded-lg">
                            {/* Corner markers */}
                            <div className="absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 border-primary" />
                            <div className="absolute -top-2 -right-2 w-6 h-6 border-t-2 border-r-2 border-primary" />
                            <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-2 border-l-2 border-primary" />
                            <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 border-primary" />
                            {/* Center line for barcode alignment */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-px bg-primary/50" />
                          </div>
                          {/* Instruction text */}
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-white/90 text-sm font-medium bg-black/30 px-3 py-1 rounded">
                            Align ISBN barcode within frame
                          </div>
                        </div>
                      )}

                      {/* Scan Result Display - shows after scan in camera feed area */}
                      {isCameraActive && scanResult && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-black/80" style={{ zIndex: 20 }}>
                          {scanResult.type === 'success' ? (
                            <div className="max-w-xs w-full">
                              <div className="bg-green-500/20 border border-green-500 rounded-xl p-6 backdrop-blur-sm">
                                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-green-300 mb-1">
                                  {scanResult.action === 'IN' ? 'Stock Received' : 'Stock Shipped'}
                                </h3>
                                <p className="text-white font-medium text-xl mb-2 truncate">{scanResult.book.TITLE}</p>
                                <p className="text-gray-300 text-sm mb-1">by {scanResult.book.AUTHOR || 'Unknown Author'}</p>
                                <div className="flex flex-wrap justify-center gap-3 mt-3 text-sm">
                                  <span className="bg-gray-800 px-3 py-1 rounded-full text-gray-200">ISBN: {scanResult.book.ISBN}</span>
                                  <span className={`px-3 py-1 rounded-full text-white font-bold ${
                                    scanResult.action === 'IN' ? 'bg-green-600' : 'bg-red-600'
                                  }`}>
                                    {scanResult.action === 'IN' ? '+1' : '-1'} Stock: {scanResult.book.QTY}
                                  </span>
                                  {scanResult.book.SUBJECT && (
                                    <span className="bg-gray-800 px-3 py-1 rounded-full text-gray-300">{scanResult.book.SUBJECT}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => setScanResult(null)}
                                className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                              >
                                Scan Another
                              </button>
                            </div>
                          ) : (
                            <div className="max-w-xs w-full">
                              <div className="bg-red-500/20 border border-red-500 rounded-xl p-6 backdrop-blur-sm">
                                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-red-300 mb-1">Book Not Found</h3>
                                <p className="text-white font-mono text-lg mb-2">{scanResult.scannedIsbn}</p>
                                <p className="text-gray-300 text-sm mb-4">{scanResult.message}</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                  <button
                                    onClick={() => setScanResult(null)}
                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                                  >
                                    Try Again
                                  </button>
                                  <button
                                    onClick={() => handleScanMethodChange('manual')}
                                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                                  >
                                    Manual Entry
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Camera controls - hidden in fullscreen, shown below on desktop */}
                    {!isFullscreen && isCameraActive && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500">
                        <span className="flex items-center space-x-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>{scanCooldown ? 'Cooldown (0.5s)...' : 'Camera active - Point at ISBN barcode'}</span>
                        </span>
                        {scanCooldown && (
                          <span className="flex items-center space-x-1 text-yellow-600">
                            <Loader className="w-4 h-4 animate-spin" />
                            <span>Wait...</span>
                          </span>
                        )}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className="flex items-center space-x-1 px-3 py-1 text-gray-600 hover:text-gray-800 transition-colors"
                            title={soundEnabled ? 'Disable beep sound' : 'Enable beep sound'}
                          >
                            {soundEnabled ? (
                              <Volume2 className="w-4 h-4" />
                            ) : (
                              <VolumeX className="w-4 h-4" />
                            )}
                            <span className="text-xs hidden sm:inline">{soundEnabled ? 'Sound ON' : 'Sound OFF'}</span>
                          </button>
                          <button
                            onClick={() => handleScanMethodChange('manual')}
                            className="flex items-center space-x-1 px-3 py-1 text-gray-600 hover:text-gray-800"
                          >
                            <X className="w-4 h-4" />
                            <span>Stop Camera</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Fullscreen exit hint */}
                    {isFullscreen && isCameraActive && (
                      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm" style={{ zIndex: 60 }}>
                        Tap "Scan Another" to continue or use browser gesture to exit fullscreen
                      </div>
                    )}
                  </div>
                ) : (
                  // Manual Input View
                  <div className="relative">
                    <input
                      ref={isbnInputRef}
                      type="text"
                      value={isbn}
                      onChange={(e) => setIsbn(e.target.value)}
                      placeholder={loading ? "Processing..." : "Scan barcode or type ISBN..."}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50"
                      autoComplete="off"
                      spellCheck="false"
                      disabled={loading}
                    />
                    <Barcode className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                    {loading && (
                      <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <Loader className="w-5 h-5 text-primary animate-spin" />
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500 text-center">
                  {scanMethod === 'camera'
                    ? 'Auto-stops after successful scan • Switch to text input if needed'
                    : (mode === 'inbound' ? '📦 Scanning adds +1 to stock' : '📤 Scanning removes -1 from stock') + ' • Auto-focuses after each scan'}
                </p>
              </div>

              {/* Current Book Display */}
              {bookInfo && (
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-primary">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{bookInfo.TITLE}</h3>
                      <p className="text-sm text-gray-600">by {bookInfo.AUTHOR || 'Unknown Author'}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm">
                        <span className="font-medium text-gray-700">ISBN: {bookInfo.ISBN}</span>
                        <span className={`font-bold text-lg ${mode === 'inbound' ? 'text-green-600' : 'text-red-600'}`}>
                          Stock: {bookInfo.QTY}
                        </span>
                        {bookInfo.SUBJECT && <span className="text-gray-500">{bookInfo.SUBJECT}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-700 flex-1">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <p className="text-sm text-green-700 flex-1">{success}</p>
                    <button
                      onClick={() => setSuccess(null)}
                      className="text-sm text-green-600 hover:text-green-800 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Recent Scans History */}
              {recentScans.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                      <Barcode className="w-5 h-5 text-gray-500" />
                      Recent Scans ({recentScans.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {recentScans.map((scan, index) => (
                      <div key={index} className="px-4 py-3 hover:bg-gray-50 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{scan.title}</p>
                          <p className="text-xs text-gray-500">ISBN: {scan.isbn} • {scan.timestamp}</p>
                        </div>
                        <div className="flex items-center space-x-3 ml-4">
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            scan.action === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {scan.action === 'IN' ? '+1' : '-1'}
                          </span>
                          <span className="text-sm font-medium text-gray-700 w-16 text-right">
                            {scan.newStock}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow p-4 text-sm text-gray-600">
          <h4 className="font-semibold text-gray-900 mb-2 flex items-center space-x-2">
            <Barcode className="w-4 h-4 text-primary" />
            How to Use
          </h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>Select <strong>Receive Stock</strong> to add inventory or <strong>Ship Stock</strong> to remove</li>
            <li>Point your barcode scanner at a book's ISBN barcode</li>
            <li>Each scan automatically updates stock by <strong>±1</strong></li>
            <li>Input auto-focuses after each scan - just keep scanning</li>
            <li>Recent scans are shown below with new stock levels</li>
            <li>Click "Change Mode" to switch between Receive/Ship</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Scan;