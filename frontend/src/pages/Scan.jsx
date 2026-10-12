import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../api/axios';
import * as XLSX from 'xlsx';
import { Barcode, ShoppingBag, Loader, CheckCircle, AlertTriangle, Trash2, RotateCcw, Camera, X, Volume2, VolumeX, Upload, Download, FileText, PlusCircle, MinusCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useOnline } from '../context/OnlineContext';
import { enqueueScan, getPendingItems, drainQueue, registerBackgroundSync } from '../lib/offlineQueue';
import { lookupLocal, adjustLocalStock, refreshCatalog } from '../lib/bookCatalog';

const Scan = ({ user }) => {
  const { toast } = useToast();
  const { isOnline, registerDrainHandler } = useOnline();
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
  const [isCameraPaused, setIsCameraPaused] = useState(false); // Camera pause after scan in fullscreen

  // Offline queue state - source of truth is IndexedDB (shared with the
  // service worker); this list is the UI view of pending items.
  // Online state comes from OnlineContext (shared with the global banner).
  const [scanQueue, setScanQueue] = useState([]);
  const [flushing, setFlushing] = useState(false);

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
  const fullscreenContainerRef = useRef(null); // Ref for fullscreen parent container
  const scanQueueRef = useRef(scanQueue); // Latest queue, so stock checks see scans not yet flushed
  scanQueueRef.current = scanQueue;
  const flushQueueRef = useRef(null); // Latest flushQueue, for the stable drain-handler registration

  // Mobile detection for responsive UI
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   window.innerWidth <= 768;

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
      // Reset fullscreen and camera states
      setIsFullscreen(false);
      setIsCameraActive(false);

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
      setCameraScanner(null);
      setIsCameraActive(false);
      setIsFullscreen(false);
    }
  }, [scanMethod, mode]);

  // Fullscreen handling for mobile camera (CSS-based, no Fullscreen API)
  // No event listeners needed - isFullscreen state is controlled directly

  // Clear scan result when mode or scan method changes
  useEffect(() => {
    setScanResult(null);
  }, [mode, scanMethod]);

  // Load pending queue items from IndexedDB. Re-loaded whenever the queue
  // changes anywhere (own enqueues, page drains, or service-worker
  // Background Sync drains) via the 'offline-queue-changed' event.
  const reloadQueueFromIdb = useCallback(async () => {
    try {
      const items = await getPendingItems();
      setScanQueue(items.map(item => ({
        id: item.id,
        isbn: item.meta.isbn,
        mode: item.meta.mode,
        qty: item.meta.qty || 1,
        timestamp: item.meta.timestamp
      })));
    } catch (err) {
      console.warn('Failed to load offline queue:', err);
    }
  }, []);

  useEffect(() => {
    reloadQueueFromIdb();
    window.addEventListener('offline-queue-changed', reloadQueueFromIdb);
    return () => window.removeEventListener('offline-queue-changed', reloadQueueFromIdb);
  }, [reloadQueueFromIdb]);

  // Flush queue when mode is selected (in case queue has items from previous session)
  useEffect(() => {
    if (mode && scanQueue.length > 0 && !flushing && isOnline) {
      flushQueueRef.current?.();
    }
  }, [mode]);

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
    setError(null);
    setScanResult(null); // Clear previous scan result

    // Clear ISBN immediately so camera can scan next barcode
    setIsbn('');

    // Look up the book to check stock status BEFORE adding to queue.
    // Online: live lookup from the server. Offline: the locally cached
    // catalog (synced whenever the app last had connectivity).
    let book;
    try {
      if (isOnline) {
        const lookupResponse = await api.get(`/books/lookup/${code}`);

        if (!lookupResponse.data || !lookupResponse.data.ISBN) {
          throw new Error('Book not found in inventory');
        }

        book = lookupResponse.data;
      } else {
        book = await lookupLocal(code);
        if (!book) {
          throw new Error('Not found in offline catalog - connect once to sync the book catalog');
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error(`⛔ ${msg}`);
      setScanResult({
        type: 'error',
        message: msg,
        scannedIsbn: code
      });
      return; // Don't add to queue on error
    }

    // For outbound scans, check if book is out of stock or fully reserved
    if (mode === 'outbound') {
      const reservedQty = book.reservedQty || 0;
      const availableStock = book.QTY - reservedQty;
      // Outbound scans still pending in the queue will also ship this book,
      // so they reduce what is still available right now
      const pendingOutQty = scanQueueRef.current
        .filter(q => q.mode === 'outbound' && q.isbn === code)
        .reduce((sum, q) => sum + (q.qty || 1), 0);
      const remainingAvailable = availableStock - pendingOutQty;

      if (book.QTY === 0) {
        toast.error(`⛔ "${book.TITLE}" is OUT OF STOCK - cannot ship`);
        setScanResult({
          type: 'error',
          message: `"${book.TITLE}" is OUT OF STOCK (0 available)`,
          scannedIsbn: code
        });
        return; // Block the scan - don't add to queue
      } else if (remainingAvailable <= 0) {
        const reason = availableStock <= 0
          ? `FULLY RESERVED (${reservedQty} reserved, 0 available)`
          : `NO AVAILABLE STOCK LEFT (${reservedQty} reserved, ${pendingOutQty} already queued for shipping)`;
        toast.error(`⛔ "${book.TITLE}" is ${reason} - cannot ship`);
        setScanResult({
          type: 'error',
          message: `"${book.TITLE}" is ${reason}`,
          scannedIsbn: code
        });
        return; // Block the scan - don't add to queue
      } else if (reservedQty > 0) {
        // Warn but allow (some stock available)
        toast.info(`⚠️ "${book.TITLE}" has ${reservedQty} reserved (${remainingAvailable} available)`);
      }
    }

      // Enqueue the scan for sync (persisted to IndexedDB; drained by the
      // page flush or the service worker's Background Sync)
      const queued = await enqueueScan({
        apiBase: api.defaults.baseURL || '/api',
        token: localStorage.getItem('token'),
        isbn: code,
        title: book.TITLE,
        mode,
        qty: 1
      });
      setScanQueue(prev => [...prev, {
        id: queued.id,
        isbn: code,
        mode,
        qty: 1,
        timestamp: queued.meta.timestamp
      }]);

      // Keep the offline catalog in step so repeated offline scans still
      // hit the stock validation
      adjustLocalStock(code, mode === 'inbound' ? 1 : -1).catch(() => {});

      // Optimistically add to recent scans with 'pending' flag
      setRecentScans(prev => [
        {
          id: queued.id,
          isbn: code,
          mode,
          qty: 1,
          timestamp: queued.meta.timestamp,
          title: book.TITLE,
          action: mode === 'inbound' ? 'IN' : 'OUT',
          newStock: mode === 'inbound' ? (book.QTY + 1) : (book.QTY - 1),
          pending: true
        },
        ...prev.slice(0, 19)
      ]);

      // Set scan result for camera view display (pending)
      setScanResult({
        type: 'pending',
        scannedIsbn: code,
        bookTitle: book.TITLE
      });

    // Re-focus input for next scan
    setTimeout(() => {
      if (isbnInputRef.current) {
        isbnInputRef.current.focus();
      }
    }, 50);

    // If online, try to flush immediately. Offline: ask the service worker
    // to sync when connectivity returns, even if the page is closed by
    // then (Chromium browsers; elsewhere it syncs on next app open).
    if (isOnline && !flushing) {
      flushQueue();
    } else {
      registerBackgroundSync();
    }
  };

  // Flush offline scan queue to server.
  // The queue itself lives in IndexedDB and the drain logic is shared with
  // the service worker (offlineQueue.drainQueue) - this adds the per-item
  // UI updates on top (recent scans, book info, toasts).
  const flushQueue = async () => {
    if (flushing || !isOnline) return;

    setFlushing(true);

    try {
      const summary = await drainQueue(async (result) => {
        const { status, item, book, message } = result;
        const meta = item.meta;

        if (status === 'ok') {
          // Add to recent scans (queue item already removed by the drain)
          setRecentScans(prev => [
            {
              isbn: meta.isbn,
              title: book?.TITLE || meta.title,
              action: meta.mode === 'inbound' ? 'IN' : 'OUT',
              qty: meta.qty || 1,
              newStock: book?.QTY,
              timestamp: new Date().toLocaleTimeString()
            },
            ...prev.slice(0, 19)
          ]);
          // Update book info display for the last successful scan
          if (book) setBookInfo(book);
        } else {
          // Dropped (not found / rejected / auth) - remove the optimistic
          // pending entry so it doesn't linger
          setRecentScans(prev => prev.filter(s => !(s.isbn === meta.isbn && s.pending)));
          if (status === 'not-found') {
            toast.error(`⛔ Queued scan dropped for ${meta.isbn}: ${message}`);
          } else if (status === 'rejected') {
            toast.error(`⛔ Scan rejected for ${meta.isbn}: ${message}`);
          } else if (status === 'auth') {
            toast.error('⛔ Session expired - queued scan dropped, please log in again');
          }
        }
      });

      // Server stock moved - refresh the offline catalog so subsequent
      // offline scans validate against current numbers
      if (summary.ok > 0) {
        refreshCatalog().catch(() => {});
      }

      // If items remain (server/network error mid-flush), ask the service
      // worker to retry when connectivity next changes
      if (summary.remaining > 0) {
        await registerBackgroundSync();
      }
    } finally {
      setFlushing(false);
    }
  };

  // While this page is mounted it owns queue draining (OnlineContext
  // delegates to this so per-item UI updates happen)
  useEffect(() => {
    const unregister = registerDrainHandler(() => flushQueueRef.current?.());
    return unregister;
  }, [registerDrainHandler]);
  flushQueueRef.current = flushQueue;

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
            setTimeout(() => setLastScannedIsbn(null), 2000);

            // Set global scan cooldown for 0.5 seconds
            setScanCooldown(true);
            setTimeout(() => setScanCooldown(false), 500);

            // Pause camera feed in fullscreen mode for visual feedback (1s)
            if (isFullscreen) {
              setIsCameraPaused(true);
              setTimeout(() => setIsCameraPaused(false), 1000);
            }

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

      // Use CSS fullscreen layout on mobile/tablet (no Fullscreen API to avoid white screen on back)
      if (isMobile) {
        setIsFullscreen(true);
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

      oscillator.type = 'square'; // Square wave is louder/more piercing
      oscillator.frequency.setValueAtTime(1000, ctx.currentTime); // Higher pitch = more noticeable
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime); // Louder (0.5 vs 0.3)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2); // Slightly longer

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
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
      <div className="w-full max-w-3xl space-y-5 sm:space-y-6 mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center space-x-2 sm:space-x-3">
              <Barcode className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <span>Barcode Stock Scanner</span>
            </h1>
          </div>

          {/* Mode Selection - Only shown when no mode selected */}
          {!mode && (
            <div className="space-y-3 sm:space-y-4">
              <p className="text-center text-gray-600 text-base sm:text-lg">Select operation mode to begin scanning</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <button
                  onClick={() => setModeAndFocus('inbound')}
                  className="flex flex-col items-center justify-center p-5 sm:p-6 bg-green-50 border-2 border-green-200 rounded-xl hover:bg-green-100 hover:border-green-400 transition-all min-h-[120px] sm:min-h-[140px] touch-manipulation"
                >
                  <ShoppingBag className="w-10 h-10 sm:w-12 sm:h-12 text-green-600 mb-2 sm:mb-3" />
                  <span className="text-lg sm:text-xl font-bold text-green-800">Receive Stock (IN)</span>
                  <span className="text-xs sm:text-sm text-green-600 mt-1">Scan books to add +1 qty</span>
                </button>

                <button
                  onClick={() => setModeAndFocus('outbound')}
                  className="flex flex-col items-center justify-center p-5 sm:p-6 bg-red-50 border-2 border-red-200 rounded-xl hover:bg-red-100 hover:border-red-400 transition-all min-h-[120px] sm:min-h-[140px] touch-manipulation"
                >
                  <Trash2 className="w-10 h-10 sm:w-12 sm:h-12 text-red-600 mb-2 sm:mb-3" />
                  <span className="text-lg sm:text-xl font-bold text-red-800">Ship Stock (OUT)</span>
                  <span className="text-xs sm:text-sm text-red-600 mt-1">Scan books to remove -1 qty</span>
                </button>
              </div>

              <p className="text-center text-xs sm:text-sm text-gray-500">
                Hardware barcode scanners work automatically - just scan ISBN barcodes
              </p>
            </div>
          )}

          {/* Active Scanning Mode */}
          {mode && (
            <div className="space-y-3 sm:space-y-4">
              {/* Mode Header */}
              <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-xl gap-3 ${
                mode === 'inbound' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    mode === 'inbound' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {mode === 'inbound' ? (
                      <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                    ) : (
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className={`font-bold text-base sm:text-lg ${mode === 'inbound' ? 'text-green-800' : 'text-red-800'}`}>
                      {mode === 'inbound' ? 'Receive Stock Mode' : 'Ship Stock Mode'}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Scans will automatically {mode === 'inbound' ? 'add +1' : 'remove -1'} qty
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowImport(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors touch-manipulation min-h-[44px]"
                    title="Bulk import from Excel/CSV"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">Import</span>
                    <span className="sm:hidden">⬇</span>
                  </button>
                  <button
                    onClick={clearMode}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors touch-manipulation min-h-[44px]"
                  >
                    <RotateCcw className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700 hidden sm:inline">Change Mode</span>
                    <span className="sm:hidden">↺</span>
                  </button>
                </div>
              </div>

              {/* Scan Method Selector */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Scan Method
                </label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    onClick={() => handleScanMethodChange('manual')}
                    className={`flex items-center justify-center space-x-2 px-3 py-3.5 rounded-lg border-2 transition-all touch-manipulation min-h-[48px] ${
                      scanMethod === 'manual'
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="text-lg">⌨</span>
                    <span className="font-medium text-sm sm:text-base">Text Input</span>
                  </button>
                  <button
                    onClick={() => handleScanMethodChange('camera')}
                    className={`flex items-center justify-center space-x-2 px-3 py-3.5 rounded-lg border-2 transition-all touch-manipulation min-h-[48px] ${
                      scanMethod === 'camera'
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    <span className="font-medium text-sm sm:text-base">Camera Scan</span>
                  </button>
                </div>
                <p className="mt-2 text-xs sm:text-sm text-gray-500 text-center">
                  {scanMethod === 'camera'
                    ? 'Point camera at ISBN barcode • Auto-stops after scan'
                    : 'Type or scan with hardware scanner • Auto-focuses after each scan'}
                </p>
              </div>

              {/* Bulk Import Section */}
              {showImport && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 sm:mb-4">
                    <label className="block text-sm sm:text-base font-medium text-gray-700">
                      Bulk Import
                    </label>
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center justify-center space-x-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors touch-manipulation min-h-[44px]"
                      title="Download Excel template"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Download Template</span>
                      <span className="sm:hidden">⬇</span>
                    </button>
                  </div>

                  {!importFile ? (
                  // Initial state - show upload button
                  <div className="text-center py-6 sm:py-8">
                    <input
                      type="file"
                      id="import-file-input"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="import-file-input"
                      className="flex flex-col items-center justify-center space-y-3 px-4 py-6 sm:px-6 sm:py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary hover:bg-blue-50 cursor-pointer transition-colors touch-manipulation"
                    >
                      <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
                      <span className="text-base sm:text-lg text-gray-600">Click to upload or drag and drop</span>
                      <p className="text-xs sm:text-sm text-gray-500">
                        Excel (.xlsx, .xls) or CSV with ISBN column
                      </p>
                    </label>
                  </div>
                ) : (
                  // File selected - show preview and actions
                  <div className="space-y-3 sm:space-y-4">
                    {importError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex flex-col sm:flex-row items-start sm:items-center space-x-2 gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">{importError}</span>
                        <button
                          onClick={() => {
                            setImportFile(null);
                            setImportPreview([]);
                            setImportError(null);
                            setShowImport(false);
                          }}
                          className="flex-shrink-0 px-3 py-1.5 text-red-600 hover:underline text-sm bg-red-50 rounded-lg touch-manipulation min-h-[44px]"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    {importPreview.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-700">
                            {importPreview.length} ISBN(s) ready to process
                          </p>
                          <button
                            onClick={() => {
                              setImportFile(null);
                              setImportPreview([]);
                              setShowImport(false);
                            }}
                            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 bg-gray-50 rounded-lg touch-manipulation min-h-[44px]"
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
                          className={`w-full flex items-center justify-center space-x-2 px-4 py-3.5 rounded-lg transition-colors touch-manipulation min-h-[48px] ${
                            importing
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-primary text-white hover:bg-primary/90'
                          }`}
                        >
                          {importing ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              <span className="font-medium">Processing...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              <span className="font-medium">Process {mode === 'inbound' ? 'Stock In' : 'Stock Out'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {importResults && (
                      <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border-t border-gray-200 space-y-3">
                        <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          <span>Import Results</span>
                        </h3>
                        <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
                          <div className="bg-green-50 p-3 rounded-lg">
                            <p className="text-xl sm:text-2xl font-bold text-green-600">{importResults.succeeded}</p>
                            <p className="text-xs sm:text-sm text-green-700">Succeeded</p>
                          </div>
                          <div className="bg-red-50 p-3 rounded-lg">
                            <p className="text-xl sm:text-2xl font-bold text-red-600">{importResults.failed}</p>
                            <p className="text-xs sm:text-sm text-red-700">Failed</p>
                          </div>
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-xl sm:text-2xl font-bold text-blue-600">{importResults.details.length}</p>
                            <p className="text-xs sm:text-sm text-blue-700">Total</p>
                          </div>
                        </div>

                        {importResults.errors.length > 0 && (
                          <div className="border-t border-gray-200 pt-3">
                            <h4 className="text-sm font-medium text-red-700 mb-2">Errors:</h4>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {importResults.errors.slice(0, 5).map((err, index) => (
                                <div key={index} className="text-xs sm:text-sm text-red-600 bg-red-50 p-2 rounded">
                                  ISBN: {err.isbn} - {err.message}
                                </div>
                              ))}
                              {importResults.errors.length > 5 && (
                                <p className="text-xs sm:text-sm text-gray-500">And {importResults.errors.length - 5} more errors...</p>
                              )}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={clearImport}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 touch-manipulation min-h-[44px]"
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
                          className="flex-shrink-0 px-3 py-1.5 text-red-600 hover:underline text-sm bg-red-50 rounded-lg touch-manipulation min-h-[44px]"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {/* Camera view container - always relative, becomes fixed fullscreen when isFullscreen */}
                    <div
                      ref={fullscreenContainerRef}
                      className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-black rounded-none flex flex-col' : ''}`}
                    >
                      {/* Close button (X) - ALWAYS visible when camera is active, top-right of camera area */}
                      {isCameraActive && (
                        <button
                          onClick={() => handleScanMethodChange('manual')}
                          className={`absolute top-3 right-3 z-60 p-2.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center shadow-lg ${
                            isFullscreen ? 'top-4 right-4' : 'top-3 right-3'
                          }`}
                          aria-label="Close camera"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      )}

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
                        className={`w-full overflow-hidden ${isFullscreen ? 'flex-1 flex items-center justify-center rounded-none' : 'rounded-lg'}`}
                        style={{
                          aspectRatio: isFullscreen ? undefined : '16/9',
                          maxHeight: isFullscreen ? 'calc(100vh - 260px)' : '500px',
                          backgroundColor: '#000'
                        }}
                      />

                      {/* Scan frame overlay - only when no result and camera active */}
                      {isCameraActive && !scanResult && !isCameraPaused && (
                        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                          {/* Scan frame - matches qrbox proportion: 2.5:1, white border for better visibility */}
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-[320px] h-auto aspect-[2.5/1] border-2 border-white/90 rounded-lg">
                            {/* Corner markers - white */}
                            <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-white" />
                            <div className="absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 border-white" />
                            <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 border-white" />
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-white" />
                            {/* Center line for barcode alignment */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-px bg-white/50" />
                          </div>
                          {/* Instruction text */}
                          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center text-white/90 text-sm font-medium bg-black/40 px-3 py-1 rounded">
                            Align ISBN barcode within frame
                          </div>
                        </div>
                      )}

                      {/* Camera pause overlay - shown after successful scan in fullscreen */}
                      {isCameraPaused && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 pointer-events-none" aria-live="polite">
                          <div className="w-16 h-16 bg-green-500/90 rounded-full flex items-center justify-center mb-4 animate-pulse">
                            <CheckCircle className="w-8 h-8 text-white" />
                          </div>
                          <p className="text-white text-lg font-semibold text-center px-4">
                            Scanned! Preparing next scan...
                          </p>
                        </div>
                      )}

                                          </div>

                    {/* Camera controls - shown in both fullscreen and normal mode */}
                    {isCameraActive && (
                      <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 text-sm sm:text-base ${
                        isFullscreen ? 'text-white' : 'text-gray-500'
                      }`}>
                        <span className="flex items-center space-x-1 w-full sm:w-auto text-center sm:text-left">
                          {isFullscreen ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                          <span>{scanCooldown ? 'Cooldown (0.5s)...' : 'Camera active - Point at ISBN barcode'}</span>
                        </span>
                        {scanCooldown && (
                          <span className="flex items-center space-x-1 w-full sm:w-auto text-center sm:text-left">
                            <Loader className="w-4 h-4 animate-spin" />
                            <span>{isFullscreen ? 'Wait...' : 'Wait...'}</span>
                          </span>
                        )}
                        <div className="flex items-center space-x-2 w-full sm:w-auto justify-center sm:justify-end">
                          <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            className={`flex items-center justify-center space-x-2 px-4 py-2.5 transition-colors touch-manipulation min-h-[44px] min-w-[44px] ${
                              isFullscreen
                                ? 'text-white hover:text-gray-300 bg-white/10 hover:bg-white/20'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                            title={soundEnabled ? 'Disable beep sound' : 'Enable beep sound'}
                          >
                            {soundEnabled ? (
                              <Volume2 className="w-5 h-5" />
                            ) : (
                              <VolumeX className="w-5 h-5" />
                            )}
                            <span className="hidden sm:inline text-sm">{soundEnabled ? 'Sound ON' : 'Sound OFF'}</span>
                          </button>
                          <button
                            onClick={() => handleScanMethodChange('manual')}
                            className={`flex items-center justify-center space-x-2 px-4 py-2.5 touch-manipulation min-h-[44px] ${
                              isFullscreen
                                ? 'text-white hover:text-gray-300 bg-white/10 hover:bg-white/20'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            <X className="w-5 h-5" />
                            <span className="text-sm font-medium hidden sm:inline">Stop Camera</span>
                          </button>
                        </div>
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
                      className="w-full px-4 py-4 text-lg sm:text-xl border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50 touch-manipulation"
                      autoComplete="off"
                      spellCheck="false"
                      disabled={loading}
                      inputMode="numeric"
                    />
                    <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                    {loading && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Loader className="w-5 h-5 text-primary animate-spin" />
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-2 text-xs sm:text-sm text-gray-500 text-center">
                  {scanMethod === 'camera'
                    ? 'Auto-stops after successful scan • Switch to text input if needed'
                    : (mode === 'inbound' ? '📦 Scanning adds +1 to stock' : '📤 Scanning removes -1 from stock') + ' • Auto-focuses after each scan'}
                </p>
              </div>

              {/* Current Book Display */}
              {bookInfo && (
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border-l-4 border-primary">
                  <div className="flex items-start space-x-3 sm:space-x-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">{bookInfo.TITLE}</h3>
                      <p className="text-xs sm:text-sm text-gray-600">by {bookInfo.AUTHOR || 'Unknown Author'}</p>
                      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 mt-2 text-xs sm:text-sm">
                        <span className="font-medium text-gray-700">ISBN: {bookInfo.ISBN}</span>
                        <span className={`font-bold text-lg ${mode === 'inbound' ? 'text-green-600' : 'text-red-600'}`}>
                          Stock: {bookInfo.QTY}
                        </span>
                        {(bookInfo.reservedQty && bookInfo.reservedQty > 0) && (
                          <>
                            <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs">
                              Reserved: {bookInfo.reservedQty}
                            </span>
                            <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs">
                              Available: {bookInfo.QTY - bookInfo.reservedQty}
                            </span>
                          </>
                        )}
                        {bookInfo.SUBJECT && <span className="text-gray-500">{bookInfo.SUBJECT}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-3 sm:p-4 rounded-r-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center space-x-3 gap-2 sm:gap-0">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-700 flex-1">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 bg-red-50 rounded-lg touch-manipulation min-h-[44px]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border-l-4 border-green-400 p-3 sm:p-4 rounded-r-lg">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center space-x-3 gap-2 sm:gap-0">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <p className="text-sm text-green-700 flex-1">{success}</p>
                    <button
                      onClick={() => setSuccess(null)}
                      className="px-3 py-1.5 text-sm text-green-600 hover:text-green-800 bg-green-50 rounded-lg touch-manipulation min-h-[44px]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Pending Queue - shows scans waiting to sync */}
              {scanQueue.length > 0 && (
                <div className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 overflow-hidden">
                  <div className="px-3 sm:px-4 py-3 border-b border-yellow-200 bg-yellow-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="font-semibold text-yellow-900 flex items-center space-x-2">
                      <Loader className={`w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 ${flushing ? 'animate-spin' : ''}`} />
                      <span>Pending Sync ({scanQueue.length})</span>
                    </h3>
                    {!isOnline && (
                      <span className="text-xs text-yellow-700 bg-yellow-200 px-2 py-1 rounded-full">
                        Offline — will sync when connected
                      </span>
                    )}
                    {isOnline && !flushing && scanQueue.length > 0 && (
                      <button
                        onClick={flushQueue}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-lg touch-manipulation min-h-[44px]"
                      >
                        Retry Sync
                      </button>
                    )}
                  </div>
                  <div className="divide-y divide-yellow-100 max-h-48 overflow-y-auto">
                    {scanQueue.map((item, index) => (
                      <div key={item.id} className="px-3 sm:px-4 py-3 hover:bg-yellow-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-yellow-900 truncate">ISBN: {item.isbn}</p>
                          <p className="text-xs text-yellow-700">
                            {item.mode === 'inbound' ? 'Receive' : 'Ship'} • {item.timestamp}
                            {flushing && <span className="ml-2 text-yellow-600">Syncing...</span>}
                          </p>
                        </div>
                        <span className={`px-2 py-1.5 text-xs font-bold rounded-full ${
                          item.mode === 'inbound' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {item.mode === 'inbound' ? '+1' : '-1'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Scans History */}
              {recentScans.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-3 sm:px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                      <Barcode className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                      <span>Recent Scans ({recentScans.filter(s => !s.pending).length})</span>
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {recentScans.filter(s => !s.pending).map((scan, index) => (
                      <div key={index} className="px-3 sm:px-4 py-3 hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{scan.title}</p>
                          <p className="text-xs text-gray-500">ISBN: {scan.isbn} • {scan.timestamp}</p>
                        </div>
                        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-end">
                          <span className={`px-2 py-1.5 text-xs font-bold rounded-full ${
                            scan.action === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {scan.action === 'IN' ? '+1' : '-1'}
                          </span>
                          <span className="text-sm font-medium text-gray-700 w-14 sm:w-16 text-right">
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

        {/* Instructions - collapsible on mobile */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-sm text-gray-600">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-gray-900">
              <span className="flex items-center space-x-2">
                <Barcode className="w-4 h-4 text-primary" />
                <span>How to Use</span>
              </span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
              </span>
            </summary>
            <ul className="mt-3 space-y-2 list-disc list-inside text-sm sm:text-base">
              <li>Select <strong>Receive Stock</strong> to add inventory or <strong>Ship Stock</strong> to remove</li>
              <li>Point your barcode scanner at a book's ISBN barcode</li>
              <li>Each scan automatically updates stock by <strong>±1</strong></li>
              <li>Input auto-focuses after each scan - just keep scanning</li>
              <li>Recent scans are shown below with new stock levels</li>
              <li>Tap "Change Mode" to switch between Receive/Ship</li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
};

export default Scan;