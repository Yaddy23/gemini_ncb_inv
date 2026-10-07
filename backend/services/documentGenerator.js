const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Try multiple possible paths for the template file (handles different Render working directories)
const possiblePaths = [
  path.join(__dirname, '..', 'DR_SI_TEMPLATE.xlsx'),        // backend/DR_SI_TEMPLATE.xlsx (standard)
  path.join(__dirname, '..', '..', 'backend', 'DR_SI_TEMPLATE.xlsx'), // if running from repo root
  path.join(process.cwd(), 'backend', 'DR_SI_TEMPLATE.xlsx'), // if cwd is repo root
  path.join(process.cwd(), 'DR_SI_TEMPLATE.xlsx'), // if cwd is backend
];

let TEMPLATE_PATH = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    TEMPLATE_PATH = p;
    console.log(`[documentGenerator] Found template at: ${TEMPLATE_PATH}`);
    break;
  }
}

if (!TEMPLATE_PATH) {
  console.error('[documentGenerator] Template not found. Tried paths:', possiblePaths);
  TEMPLATE_PATH = possiblePaths[0]; // fallback to first path, will error later with clear message
}

// Helper: Convert number to Philippine peso words
function numberToWords(num) {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertHundreds(n) {
    let result = '';
    if (n >= 100) {
      result += units[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n >= 10) {
      result += teens[n - 10] + ' ';
      n = 0;
    }
    if (n > 0) {
      result += units[n] + ' ';
    }
    return result.trim();
  }

  if (num === 0) return 'Zero Pesos Only';

  let pesos = Math.floor(num);
  const centavos = Math.round((num - pesos) * 100);

  let words = '';
  if (pesos >= 1000000) {
    words += convertHundreds(Math.floor(pesos / 1000000)) + ' Million ';
    pesos %= 1000000;
  }
  if (pesos >= 1000) {
    words += convertHundreds(Math.floor(pesos / 1000)) + ' Thousand ';
    pesos %= 1000;
  }
  if (pesos > 0) {
    words += convertHundreds(pesos) + ' ';
  }
  words = words.trim() + ' Pesos';

  if (centavos > 0) {
    words += ' and ' + convertHundreds(centavos) + ' Centavos';
  }

  return words + ' Only';
}

// Helper: Format date as MM/DD/YYYY
function formatDate(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

async function generateExcel(templateSheetName, data) {
  const workbook = new ExcelJS.Workbook();

  // Define styles to match template
  const headerStyle = {
    font: { bold: true, size: 10 },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } }
  };

  const cellStyle = {
    font: { size: 9 },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  };

  const leftAlignStyle = {
    ...cellStyle,
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true }
  };

  const rightAlignStyle = {
    ...cellStyle,
    alignment: { horizontal: 'right', vertical: 'middle' },
    numFmt: '#,##0.00'
  };

  const boldRightStyle = {
    ...rightAlignStyle,
    font: { bold: true, size: 9 }
  };

  const titleStyle = {
    font: { bold: true, size: 14 },
    alignment: { horizontal: 'center' }
  };

  const subtitleStyle = {
    font: { bold: true, size: 10 },
    alignment: { horizontal: 'left' }
  };

  const normalStyle = {
    font: { size: 10 },
    alignment: { horizontal: 'left' }
  };

  if (templateSheetName === 'DR1') {
    await createDR1Sheet(workbook, data, {
      headerStyle, cellStyle, leftAlignStyle, rightAlignStyle, boldRightStyle,
      titleStyle, subtitleStyle, normalStyle
    });
  } else if (templateSheetName === 'INV1') {
    await createINV1Sheet(workbook, data, {
      headerStyle, cellStyle, leftAlignStyle, rightAlignStyle, boldRightStyle,
      titleStyle, subtitleStyle, normalStyle
    });
  } else {
    throw new Error(`Unknown template sheet: ${templateSheetName}`);
  }

  // Also create the "Pesos Only" sheet (sheet '1') with amount in words
  const wordsSheet = workbook.addWorksheet('1');
  const total = data.totalAmount || data.subtotal || 0;
  wordsSheet.getCell('A7').value = numberToWords(total);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function createDR1Sheet(workbook, data, styles) {
  const sheet = workbook.addWorksheet('DR1');

  // Set column widths to match template
  sheet.columns = [
    { width: 10 },  // A: CODE
    { width: 8 },   // B: NO.
    { width: 8 },   // C: QTY
    { width: 8 },   // D: QTY (dup)
    { width: 18 },  // E: ISBN/BARCODE
    { width: 45 },  // F: TITLE/DESCRIPTION
    { width: 14 },  // G: UNIT PRICE
    { width: 16 }   // H: AMOUNT
  ];

  // Row 3: Company header (merged)
  sheet.mergeCells('A3:H3');
  sheet.getCell('A3').value = 'DELIVERY RECEIPT';
  sheet.getCell('A3').style = styles.titleStyle;

  // Row 5: Customer name (col E), Date (col H) - drNumber is just a DB reference
  sheet.getCell('E5').value = data.customerName || '';
  sheet.getCell('E5').style = styles.subtitleStyle;
  sheet.getCell('H5').value = formatDate(data.date);
  sheet.getCell('H5').style = styles.normalStyle;

  // Row 6: Address (col E)
  sheet.getCell('E6').value = data.customerAddress || '';
  sheet.getCell('E6').style = styles.normalStyle;

  // Row 7: Date (col H)
  sheet.getCell('H7').value = formatDate(data.date);
  sheet.getCell('H7').style = styles.normalStyle;

  // Row 10: Headers
  const headers = ['CODE', 'NO.', 'QTY.', 'QTY.', 'ISBN / BARCODE', 'TITLE / DESCRIPTION', 'UNIT PRICE', 'AMOUNT'];
  headers.forEach((header, i) => {
    const cell = sheet.getCell(10, i + 1);
    cell.value = header;
    cell.style = styles.headerStyle;
  });

  // Line items start at row 12
  const startRow = 12;
  const items = data.items || [];

  items.forEach((item, index) => {
    const row = startRow + index;
    // Col A: CODE - blank
    sheet.getCell(row, 1).value = '';
    sheet.getCell(row, 1).style = styles.cellStyle;
    // Col B: NO.
    sheet.getCell(row, 2).value = index + 1;
    sheet.getCell(row, 2).style = styles.cellStyle;
    // Col C: QTY
    sheet.getCell(row, 3).value = item.qty;
    sheet.getCell(row, 3).style = styles.cellStyle;
    // Col D: QTY (dup) - blank
    sheet.getCell(row, 4).value = '';
    sheet.getCell(row, 4).style = styles.cellStyle;
    // Col E: ISBN/BARCODE
    sheet.getCell(row, 5).value = item.isbn || '';
    sheet.getCell(row, 5).style = styles.cellStyle;
    // Col F: TITLE/DESCRIPTION
    sheet.getCell(row, 6).value = formatDescription(item);
    sheet.getCell(row, 6).style = styles.leftAlignStyle;
    // Col G: UNIT PRICE
    sheet.getCell(row, 7).value = item.unitPrice;
    sheet.getCell(row, 7).style = styles.rightAlignStyle;
    // Col H: AMOUNT
    sheet.getCell(row, 8).value = item.amount;
    sheet.getCell(row, 8).style = styles.rightAlignStyle;
  });

  // Add empty rows to fill template (up to row 50 for 39 items)
  const emptyRows = 39 - items.length;
  for (let i = 0; i < Math.max(0, emptyRows); i++) {
    const row = startRow + items.length + i;
    for (let col = 1; col <= 8; col++) {
      sheet.getCell(row, col).style = styles.cellStyle;
    }
  }

  // Totals
  const totalRow = startRow + items.length + 1;
  const subtotal = data.subtotal || items.reduce((sum, i) => sum + i.amount, 0);

  // Subtotal row
  sheet.mergeCells(totalRow, 1, totalRow, 7);
  sheet.getCell(totalRow, 1).value = 'SUBTOTAL:';
  sheet.getCell(totalRow, 1).style = { ...styles.boldRightStyle, alignment: { horizontal: 'right', vertical: 'middle' } };
  sheet.getCell(totalRow, 8).value = subtotal;
  sheet.getCell(totalRow, 8).style = styles.boldRightStyle;

  // Total row
  const totalRow2 = totalRow + 1;
  sheet.mergeCells(totalRow2, 1, totalRow2, 7);
  sheet.getCell(totalRow2, 1).value = 'TOTAL:';
  sheet.getCell(totalRow2, 1).style = { ...styles.boldRightStyle, alignment: { horizontal: 'right', vertical: 'middle' } };
  sheet.getCell(totalRow2, 8).value = subtotal;
  sheet.getCell(totalRow2, 8).style = styles.boldRightStyle;

  // Amount in words row
  const wordsRow = totalRow2 + 2;
  sheet.mergeCells(wordsRow, 1, wordsRow, 8);
  sheet.getCell(wordsRow, 1).value = `Amount in Words: ${numberToWords(subtotal)}`;
  sheet.getCell(wordsRow, 1).style = { font: { italic: true, size: 10 }, alignment: { horizontal: 'left' } };

  // Signatures
  const sigRow = wordsRow + 3;
  ['Prepared By', 'Received By', 'Date'].forEach((label, i) => {
    const col = i * 3 + 1;
    sheet.mergeCells(sigRow, col, sigRow, col + 1);
    sheet.getCell(sigRow, col).value = label;
    sheet.getCell(sigRow, col).style = { font: { size: 10 }, alignment: { horizontal: 'center' }, border: { bottom: { style: 'thin' } } };
  });
}

async function createINV1Sheet(workbook, data, styles) {
  const sheet = workbook.addWorksheet('INV1');

  // Set column widths to match template
  sheet.columns = [
    { width: 15 },  // A: BATCH/DR
    { width: 8 },   // B: NO.
    { width: 18 },  // C: ISBN/BARCODE
    { width: 8 },   // D: (empty)
    { width: 40 },  // E: TITLE/DESCRIPTION
    { width: 10 },  // F: QTY
    { width: 10 },  // G: QTY (dup)
    { width: 14 },  // H: UNIT PRICE
    { width: 16 }   // I: AMOUNT
  ];

  // Row 1: Title
  sheet.mergeCells('A1:I1');
  sheet.getCell('A1').value = 'SALES INVOICE';
  sheet.getCell('A1').style = styles.titleStyle;

  // Row 3-7: Header info
  sheet.mergeCells('A3:I3');
  sheet.getCell('A3').value = data.customerName || '';
  sheet.getCell('A3').style = styles.subtitleStyle;

  // Row 4: SI Number, Date, PO
  sheet.getCell('A4').value = 'SI No.:';
  sheet.getCell('A4').style = { ...styles.normalStyle, font: { bold: true, size: 9 } };
  sheet.getCell('B4').value = data.siNumber || '';
  sheet.getCell('B4').style = styles.normalStyle;

  sheet.getCell('D4').value = 'Date:';
  sheet.getCell('D4').style = { ...styles.normalStyle, font: { bold: true, size: 9 } };
  sheet.getCell('E4').value = formatDate(data.date);
  sheet.getCell('E4').style = styles.normalStyle;

  sheet.getCell('G4').value = 'P.O. #:';
  sheet.getCell('G4').style = { ...styles.normalStyle, font: { bold: true, size: 9 } };
  sheet.getCell('H4').value = data.poNumber || '';
  sheet.getCell('H4').style = styles.normalStyle;

  // Row 5: Address
  sheet.getCell('A5').value = 'Address:';
  sheet.getCell('A5').style = { ...styles.normalStyle, font: { bold: true, size: 9 } };
  sheet.mergeCells('B5:I5');
  sheet.getCell('B5').value = data.customerAddress || '';
  sheet.getCell('B5').style = styles.normalStyle;

  // Row 7: Headers (row 7 to match template-ish)
  const headers = ['BATCH / DR', 'NO.', 'ISBN/BARCODE', '', 'TITLE / DESCRIPTION', 'QTY.', 'QTY.', 'UNIT PRICE', 'AMOUNT'];
  headers.forEach((header, i) => {
    const cell = sheet.getCell(7, i + 1);
    cell.value = header;
    cell.style = styles.headerStyle;
  });

  // Line items start at row 8
  const startRow = 8;
  const items = data.items || [];

  items.forEach((item, index) => {
    const row = startRow + index;
    // Col A: BATCH/DR - blank
    sheet.getCell(row, 1).value = '';
    sheet.getCell(row, 1).style = styles.cellStyle;
    // Col B: NO.
    sheet.getCell(row, 2).value = index + 1;
    sheet.getCell(row, 2).style = styles.cellStyle;
    // Col C: ISBN/BARCODE
    sheet.getCell(row, 3).value = item.isbn || '';
    sheet.getCell(row, 3).style = styles.cellStyle;
    // Col D: empty
    sheet.getCell(row, 4).value = '';
    sheet.getCell(row, 4).style = styles.cellStyle;
    // Col E: TITLE/DESCRIPTION
    sheet.getCell(row, 5).value = formatDescription(item);
    sheet.getCell(row, 5).style = styles.leftAlignStyle;
    // Col F: QTY
    sheet.getCell(row, 6).value = item.qty;
    sheet.getCell(row, 6).style = styles.cellStyle;
    // Col G: QTY (dup) - blank
    sheet.getCell(row, 7).value = '';
    sheet.getCell(row, 7).style = styles.cellStyle;
    // Col H: UNIT PRICE
    sheet.getCell(row, 8).value = item.unitPrice;
    sheet.getCell(row, 8).style = styles.rightAlignStyle;
    // Col I: AMOUNT
    sheet.getCell(row, 9).value = item.amount;
    sheet.getCell(row, 9).style = styles.rightAlignStyle;
  });

  // Add empty rows (up to 28 items)
  const emptyRows = 28 - items.length;
  for (let i = 0; i < Math.max(0, emptyRows); i++) {
    const row = startRow + items.length + i;
    for (let col = 1; col <= 9; col++) {
      sheet.getCell(row, col).style = styles.cellStyle;
    }
  }

  // Totals
  const totalRow = startRow + items.length + 1;
  const subtotal = data.subtotal || items.reduce((sum, i) => sum + i.amount, 0);
  const discountPercentage = data.discountPercentage || 0;
  const discountAmount = data.discountAmount || (subtotal * discountPercentage) / 100;
  const total = data.totalAmount || (subtotal - discountAmount);

  // Subtotal row
  sheet.mergeCells(totalRow, 1, totalRow, 8);
  sheet.getCell(totalRow, 1).value = 'SUBTOTAL:';
  sheet.getCell(totalRow, 1).style = { ...styles.boldRightStyle, alignment: { horizontal: 'right', vertical: 'middle' } };
  sheet.getCell(totalRow, 9).value = subtotal;
  sheet.getCell(totalRow, 9).style = styles.boldRightStyle;

  // Discount row (if discount > 0)
  let currentRow = totalRow;
  if (discountAmount > 0) {
    currentRow++;
    sheet.mergeCells(currentRow, 1, currentRow, 8);
    sheet.getCell(currentRow, 1).value = `LESS: DISCOUNT (${discountPercentage}%):`;
    sheet.getCell(currentRow, 1).style = { ...styles.boldRightStyle, alignment: { horizontal: 'right', vertical: 'middle' } };
    sheet.getCell(currentRow, 9).value = discountAmount;
    sheet.getCell(currentRow, 9).style = styles.boldRightStyle;
  }

  // Total row
  const totalRow2 = currentRow + 1;
  sheet.mergeCells(totalRow2, 1, totalRow2, 8);
  sheet.getCell(totalRow2, 1).value = 'TOTAL:';
  sheet.getCell(totalRow2, 1).style = { ...styles.boldRightStyle, alignment: { horizontal: 'right', vertical: 'middle' } };
  sheet.getCell(totalRow2, 9).value = total;
  sheet.getCell(totalRow2, 9).style = styles.boldRightStyle;

  // Amount in words
  const wordsRow = totalRow2 + 2;
  sheet.mergeCells(wordsRow, 1, wordsRow, 9);
  sheet.getCell(wordsRow, 1).value = `Amount in Words: ${numberToWords(total)}`;
  sheet.getCell(wordsRow, 1).style = { font: { italic: true, size: 10 }, alignment: { horizontal: 'left' } };

  // Signatures
  const sigRow = wordsRow + 3;
  ['Prepared By', 'Approved By', 'Received By'].forEach((label, i) => {
    const col = i * 3 + 1;
    sheet.mergeCells(sigRow, col, sigRow, col + 1);
    sheet.getCell(sigRow, col).value = label;
    sheet.getCell(sigRow, col).style = { font: { size: 10 }, alignment: { horizontal: 'center' }, border: { bottom: { style: 'thin' } } };
  });
}

// Helper to format description: "Title / Edition / Bind / by Author"
function formatDescription(item) {
  const parts = [];
  if (item.rawTitle) parts.push(item.rawTitle);
  else if (item.title) parts.push(item.title); // fallback to title if rawTitle not present
  if (item.edition) parts.push(item.edition);
  if (item.bind) parts.push(item.bind);
  if (item.author) parts.push(`by ${item.author}`);
  return parts.join(' / ');
}

async function generatePDF(templateSheetName, data) {
  // For PDF, we'll generate HTML that replicates the template and use puppeteer
  const html = generateHTML(templateSheetName, data);

  // Dynamic import puppeteer (may not be installed)
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    throw new Error('PDF generation requires puppeteer. Install with: npm install puppeteer');
  }

  // Use puppeteer launch args compatible with Render/serverless environments
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }).catch(err => {
    throw new Error(`Failed to launch Chrome for PDF: ${err.message}. On Render, ensure Chrome is installed or use puppeteer-core with @sparticuz/chromium.`);
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function generateHTML(templateSheetName, data) {
  const items = data.items || [];
  const subtotal = data.subtotal || items.reduce((sum, i) => sum + i.amount, 0);
  const discountPercentage = data.discountPercentage || 0;
  const discountAmount = data.discountAmount || (subtotal * discountPercentage) / 100;
  const total = data.totalAmount || (subtotal - discountAmount);
  const amountWords = numberToWords(total);
  const dateStr = formatDate(data.date);

  if (templateSheetName === 'DR1') {
    return generateDR1HTML(data, items, subtotal, total, amountWords, dateStr);
  } else {
    return generateINV1HTML(data, items, subtotal, discountPercentage, discountAmount, total, amountWords, dateStr);
  }
}

function generateDR1HTML(data, items, subtotal, total, amountWords, dateStr) {
  const rows = items.map((item, i) => `
    <tr>
      <td></td>
      <td style="text-align: center;">${i + 1}</td>
      <td style="text-align: center;">${item.qty}</td>
      <td></td>
      <td>${item.isbn || ''}</td>
      <td>${formatDescription(item)}</td>
      <td style="text-align: right;">${Number(item.unitPrice).toFixed(2)}</td>
      <td style="text-align: right;">${Number(item.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  // Add empty rows to fill template (39 rows total per template)
  const emptyRows = Array(Math.max(0, 39 - items.length)).fill(0).map(() => `
    <tr>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 10mm; size: A4; }
    body { font-family: 'Arial', sans-serif; font-size: 10px; }
    .header { margin-bottom: 20px; }
    .company { font-size: 14px; font-weight: bold; }
    .address { font-size: 10px; }
    .dr-info { float: right; margin-top: -40px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #000; padding: 4px; font-size: 9px; }
    th { background: #f0f0f0; font-weight: bold; text-align: center; }
    .totals { margin-top: 10px; }
    .total-row { display: flex; justify-content: flex-end; gap: 50px; margin: 5px 0; }
    .amount-words { margin-top: 20px; font-style: italic; }
    .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
    .sig-line { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">DELIVERY RECEIPT</div>
    <div class="company">${data.customerName || ''}</div>
    <div class="address">${data.customerAddress || ''}</div>
    <div class="dr-info">
      <strong>DR No.:</strong> ${data.drNumber || ''}<br>
      <strong>Date:</strong> ${dateStr}<br>
      <strong>Code:</strong> ${data.drNumber || ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 8%;">CODE</th>
        <th style="width: 5%;">NO.</th>
        <th style="width: 6%;">QTY.</th>
        <th style="width: 5%;"></th>
        <th style="width: 15%;">ISBN / BARCODE</th>
        <th style="width: 35%;">TITLE / DESCRIPTION</th>
        <th style="width: 12%;">UNIT PRICE</th>
        <th style="width: 14%;">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${emptyRows}
      <tr style="font-weight: bold;">
        <td colspan="7" style="text-align: right;">SUBTOTAL:</td>
        <td style="text-align: right;">${subtotal.toFixed(2)}</td>
      </tr>
      <tr style="font-weight: bold;">
        <td colspan="7" style="text-align: right;">TOTAL:</td>
        <td style="text-align: right;">${total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="amount-words">
    <strong>Amount in Words:</strong> ${amountWords}
  </div>

  <div class="signatures">
    <div class="sig-line">Prepared By</div>
    <div class="sig-line">Received By</div>
    <div class="sig-line">Date</div>
  </div>
</body>
</html>`;
}

function generateINV1HTML(data, items, subtotal, discountPercentage, discountAmount, total, amountWords, dateStr) {
  const rows = items.map((item, i) => `
    <tr>
      <td></td>
      <td style="text-align: center;">${i + 1}</td>
      <td>${item.isbn || ''}</td>
      <td></td>
      <td>${formatDescription(item)}</td>
      <td style="text-align: center;">${item.qty}</td>
      <td></td>
      <td style="text-align: right;">${Number(item.unitPrice).toFixed(2)}</td>
      <td style="text-align: right;">${Number(item.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  const emptyRows = Array(Math.max(0, 28 - items.length)).fill(0).map(() => `
    <tr>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    </tr>
  `).join('');

  // Discount row HTML (if discount > 0)
  const discountRow = discountAmount > 0 ? `
      <tr style="font-weight: bold;">
        <td colspan="8" style="text-align: right;">LESS: DISCOUNT (${discountPercentage}%):</td>
        <td style="text-align: right;">${discountAmount.toFixed(2)}</td>
      </tr>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 10mm; size: A4; }
    body { font-family: 'Arial', sans-serif; font-size: 10px; }
    .header { margin-bottom: 20px; }
    .title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; font-size: 9px; }
    .info-label { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #000; padding: 3px; font-size: 8px; }
    th { background: #f0f0f0; font-weight: bold; text-align: center; }
    .totals { margin-top: 10px; text-align: right; }
    .amount-words { margin-top: 20px; font-style: italic; }
    .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
    .sig-line { border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 5px; font-size: 9px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">SALES INVOICE</div>
    <div class="info-grid">
      <div><span class="info-label">Customer:</span> ${data.customerName || ''}</div>
      <div><span class="info-label">SI No.:</span> ${data.siNumber || ''}</div>
      <div><span class="info-label">Date:</span> ${dateStr}</div>
      <div><span class="info-label">P.O. #:</span> ${data.poNumber || ''}</div>
      <div style="grid-column: span 2;"><span class="info-label">Address:</span> ${data.customerAddress || ''}</div>
      <div><span class="info-label">Contact:</span> </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 12%;">BATCH / DR</th>
        <th style="width: 5%;">NO.</th>
        <th style="width: 15%;">ISBN/BARCODE</th>
        <th style="width: 5%;"></th>
        <th style="width: 30%;">TITLE / DESCRIPTION</th>
        <th style="width: 7%;">QTY.</th>
        <th style="width: 5%;"></th>
        <th style="width: 12%;">UNIT PRICE</th>
        <th style="width: 14%;">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      ${emptyRows}
      <tr style="font-weight: bold;">
        <td colspan="8" style="text-align: right;">SUBTOTAL:</td>
        <td style="text-align: right;">${subtotal.toFixed(2)}</td>
      </tr>
      ${discountRow}
      <tr style="font-weight: bold;">
        <td colspan="8" style="text-align: right;">TOTAL:</td>
        <td style="text-align: right;">${total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="amount-words">
    <strong>Amount in Words:</strong> ${amountWords}
  </div>

  <div class="signatures">
    <div class="sig-line">Prepared By</div>
    <div class="sig-line">Approved By</div>
    <div class="sig-line">Received By</div>
  </div>
</body>
</html>`;
}

async function generate(templateSheetName, data, format = 'pdf') {
  if (format === 'xlsx') {
    return generateExcel(templateSheetName, data);
  } else {
    return generatePDF(templateSheetName, data);
  }
}

module.exports = { generate, numberToWords, formatDate };