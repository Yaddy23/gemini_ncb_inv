const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Try multiple possible paths for the template file (handles different Render working directories)
// NEW template takes priority
const possiblePaths = [
  path.join(__dirname, '..', 'DR_SI_NEW_TEMPLATE.xlsx'),        // backend/DR_SI_NEW_TEMPLATE.xlsx (standard)
  path.join(__dirname, '..', 'DR_SI_TEMPLATE.xlsx'),            // fallback to old template
  path.join(__dirname, '..', '..', 'backend', 'DR_SI_NEW_TEMPLATE.xlsx'), // if running from repo root
  path.join(process.cwd(), 'backend', 'DR_SI_NEW_TEMPLATE.xlsx'), // if cwd is repo root
  path.join(process.cwd(), 'DR_SI_NEW_TEMPLATE.xlsx'), // if cwd is backend
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

// EF Form template path
const efTemplatePaths = [
  path.join(__dirname, '..', 'EF_FORM.xlsx'),
  path.join(__dirname, '..', '..', 'backend', 'EF_FORM.xlsx'),
  path.join(process.cwd(), 'backend', 'EF_FORM.xlsx'),
  path.join(process.cwd(), 'EF_FORM.xlsx'),
];

let EF_TEMPLATE_PATH = null;
for (const p of efTemplatePaths) {
  if (fs.existsSync(p)) {
    EF_TEMPLATE_PATH = p;
    console.log(`[documentGenerator] Found EF template at: ${EF_TEMPLATE_PATH}`);
    break;
  }
}

if (!EF_TEMPLATE_PATH) {
  console.error('[documentGenerator] EF Template not found. Tried paths:', efTemplatePaths);
  EF_TEMPLATE_PATH = efTemplatePaths[0];
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
  // Load the template workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  if (templateSheetName === 'DR1') {
    await fillDR1Sheet(workbook, data);
  } else if (templateSheetName === 'INV1') {
    await fillINV1Sheet(workbook, data);
  } else {
    throw new Error(`Unknown template sheet: ${templateSheetName}`);
  }

  // Fill Pesos sheet with total amount
  const total = data.totalAmount || data.subtotal || 0;
  await fillPesosSheet(workbook, total);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Generate EF Excel using EF_FORM.xlsx template
async function generateEFExcel(data) {
  // Load the EF template workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EF_TEMPLATE_PATH);

  // Fill EF sheet (DR1 sheet in EF template)
  await fillEFSheet(workbook, data);

  // Fill Pesos sheet with total amount
  const total = data.totalAmount || data.subtotal || 0;
  await fillPesosSheet(workbook, total);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Fill EF sheet (DR1 sheet in EF template)
async function fillEFSheet(workbook, data) {
  const sheet = workbook.getWorksheet('DR1');
  if (!sheet) throw new Error('DR1 sheet not found in EF template');

  const items = data.items || [];

  // Fill header info
  // EF Number in G3 with font size 28, bold (replaces the "E.F.#: 102" placeholder)
  const efNumberCell = setCellValue(sheet, 'G3', data.efNumber || '');
  efNumberCell.font = { bold: true, size: 28, color: { argb: 'FF000000' }, name: 'Arial Narrow', family: 2 };
  efNumberCell.alignment = { horizontal: 'center' };

  // Marketing Executive in G4 (on top of date)
  if (data.marketingExecutive) {
    const meName = data.marketingExecutive.name || data.marketingExecutive;
    setCellValue(sheet, 'G4', meName);
  }

  // Date in G5/H5 (overwrite TODAY() formula with actual EF date)
  const dateValue = data.date ? formatDate(data.date) : formatDate(new Date());
  const g5Cell = setCellValue(sheet, 'G5', dateValue);
  g5Cell.numFmt = 'mm/dd/yyyy';
  const h5Cell = setCellValue(sheet, 'H5', dateValue);
  h5Cell.numFmt = 'mm/dd/yyyy';

  // NOTE: Keep template's header content in E5/E6 (company name/address)
  // Do NOT overwrite E5 ("Manila Central University") and E6 ("Metro Manila")

  // Fill line items (rows 12-659, 648 rows max)
  // Columns: B=NO., C=QTY., D=cps./cpy., E=ISBN, F=TITLE, G=UNIT PRICE, H=AMOUNT
  const startRow = 12;
  const maxRow = 659; // 648 rows (12-659)

  items.forEach((item, index) => {
    const row = startRow + index;
    if (row > maxRow) return; // Template has 648 rows (12-659)

    setCellValue(sheet, `B${row}`, index + 1);           // B: NO.
    setCellValue(sheet, `C${row}`, item.qty);            // C: QTY.
    // D: "cps." if qty > 1 else "cpy."
    setCellValue(sheet, `D${row}`, item.qty > 1 ? 'cps.' : 'cpy.');
    setCellValue(sheet, `E${row}`, item.isbn || '');     // E: ISBN / BARCODE
    setCellValue(sheet, `F${row}`, formatDescription(item)); // F: TITLE / DESCRIPTION
    setCellValue(sheet, `G${row}`, item.unitPrice);      // G: UNIT PRICE
    setCellValue(sheet, `H${row}`, item.amount);         // H: AMOUNT
  });

  // Hide empty rows after the last item (where C-H have no values)
  // The template has row numbers in B12:B659, but we only show rows with actual items
  const lastItemRow = startRow + items.length - 1;
  for (let row = lastItemRow + 1; row <= maxRow; row++) {
    const rowObj = sheet.getRow(row);
    rowObj.hidden = true;
  }

  // Template handles totals at row 662 automatically - no need to add totals rows
}

// Helper to clear cell formula and set value
// Accepts either address string ('A1') or (row, col, value)
function setCellValue(sheet, arg1, arg2, arg3) {
  let cell;
  if (typeof arg1 === 'string') {
    // Address string like 'A1'
    cell = sheet.getCell(arg1);
    cell.value = arg2;
  } else {
    // Row, col, value
    cell = sheet.getCell(arg1, arg2);
    cell.value = arg3;
  }
  // Clear any existing formula
  try { delete cell.formula; } catch (e) {}
  try { delete cell.sharedFormula; } catch (e) {}
  return cell;
}

// Load template and fill DR1 sheet
async function fillDR1Sheet(workbook, data) {
  const sheet = workbook.getWorksheet('DR1');
  if (!sheet) throw new Error('DR1 sheet not found in template');

  const items = data.items || [];

  // Fill header info
  setCellValue(sheet, 'E5', data.customerName || '');

  // Marketing Executive in G4 (on top of date in H5)
  if (data.marketingExecutive) {
    const meName = data.marketingExecutive.name || data.marketingExecutive;
    setCellValue(sheet, 'G4', meName);
  }

  const h5Cell = setCellValue(sheet, 'H5', formatDate(data.date));
  h5Cell.numFmt = 'mm/dd/yyyy';
  setCellValue(sheet, 'E6', data.customerAddress || '');

  // Fill line items (rows 12-659, 648 rows max)
  // Columns: B=NO., C=QTY., D=cps./cpy., E=ISBN, F=TITLE, G=UNIT PRICE, H=AMOUNT
  const startRow = 12;
  const maxRow = 659; // 648 rows (12-659)

  items.forEach((item, index) => {
    const row = startRow + index;
    if (row > maxRow) return; // Template has 648 rows (12-659)

    setCellValue(sheet, `B${row}`, index + 1);           // B: NO.
    setCellValue(sheet, `C${row}`, item.qty);            // C: QTY.
    // D: "cps." if qty > 1 else "cpy."
    setCellValue(sheet, `D${row}`, item.qty > 1 ? 'cps.' : 'cpy.');
    setCellValue(sheet, `E${row}`, item.isbn || '');     // E: ISBN / BARCODE
    setCellValue(sheet, `F${row}`, formatDescription(item)); // F: TITLE / DESCRIPTION
    setCellValue(sheet, `G${row}`, item.unitPrice);      // G: UNIT PRICE
    setCellValue(sheet, `H${row}`, item.amount);         // H: AMOUNT
  });

  // Hide empty rows after the last item (where C-H have no values)
  // The template has row numbers in B12:B659, but we only show rows with actual items
  const lastItemRow = startRow + items.length - 1;
  for (let row = lastItemRow + 1; row <= maxRow; row++) {
    const rowObj = sheet.getRow(row);
    rowObj.hidden = true;
  }

  // Template handles totals at row 662 automatically - no need to add totals rows
}

// Load template and fill INV1 sheet
async function fillINV1Sheet(workbook, data) {
  const sheet = workbook.getWorksheet('INV1');
  if (!sheet) throw new Error('INV1 sheet not found in template');

  const items = data.items || [];

  // Fill header info (directly, not relying on DR1 cross-sheet formulas)
  // NOTE: Per user requirements, do NOT write to A1 (SALES INVOICE) or B4 (SI Number)

  // Marketing Executive in H14 (on top of date)
  if (data.marketingExecutive) {
    const meName = data.marketingExecutive.name || data.marketingExecutive;
    setCellValue(sheet, 'H14', meName);
  }

  // Date in H15 (as per user requirement)
  const h15Cell = setCellValue(sheet, 'H15', formatDate(data.date));
  h15Cell.numFmt = 'mm/dd/yyyy';

  // Customer Name in E15
  setCellValue(sheet, 'E15', data.customerName || '');
  // Address in E17
  setCellValue(sheet, 'E17', data.customerAddress || '');
  // P.O.# in E19 with "P.O.#: " prefix
  setCellValue(sheet, 'E19', data.poNumber ? `P.O.#: ${data.poNumber}` : '');

  // Clear H14/I14 (template has unwanted data in these cells) - but don't clear H14 if marketing executive is set
  if (!data.marketingExecutive) {
    setCellValue(sheet, 'H14', '');
  }
  setCellValue(sheet, 'I14', '');

  // Fill line items (rows 23-670, 648 rows max)
  // Columns: B=NO., C=ISBN/BARCODE, D=(empty), E=TITLE, F=QTY., G=(dup), H=UNIT PRICE, I=AMOUNT
  const startRow = 23;
  const maxRow = 670; // 648 rows (23-670)

  items.forEach((item, index) => {
    const row = startRow + index;
    if (row > maxRow) return; // Template has 648 rows (23-670)

    setCellValue(sheet, `B${row}`, index + 1);           // B: NO.
    setCellValue(sheet, `C${row}`, item.isbn || '');     // C: ISBN/BARCODE
    setCellValue(sheet, `D${row}`, '');                  // D: (empty)
    setCellValue(sheet, `E${row}`, formatDescription(item)); // E: TITLE / DESCRIPTION
    setCellValue(sheet, `F${row}`, item.qty);            // F: QTY.
    setCellValue(sheet, `G${row}`, '');                  // G: QTY. (dup)
    setCellValue(sheet, `H${row}`, item.unitPrice);      // H: UNIT PRICE
    setCellValue(sheet, `I${row}`, item.amount);         // I: AMOUNT
  });

  // Hide empty rows after the last item (where C-I have no values)
  // The template has row numbers in B23:B670, but we only show rows with actual items
  const lastItemRow = startRow + items.length - 1;
  for (let row = lastItemRow + 1; row <= maxRow; row++) {
    const rowObj = sheet.getRow(row);
    rowObj.hidden = true;
  }

  // Template handles totals at row 675/677 automatically
  // Discount is only for DB recording, not for Excel export
}

// Fill Pesos sheet (sheet "1")
async function fillPesosSheet(workbook, totalAmount) {
  const sheet = workbook.getWorksheet('1');
  if (!sheet) return; // Sheet might not exist

  // Write total amount at B3 (referenced by formulas)
  setCellValue(sheet, 'B3', totalAmount);
  // Write amount in words at row 7
  const words = numberToWords(totalAmount);
  for (let col = 2; col <= 9; col++) {
    setCellValue(sheet, 7, col, words);
  }
}

// Helper to format description: "Title / Edition / Bind / Year / by Author"
function formatDescription(item) {
  const parts = [];
  if (item.rawTitle) parts.push(item.rawTitle);
  else if (item.title) parts.push(item.title); // fallback to title if rawTitle not present
  if (item.edition) parts.push(item.edition);
  if (item.bind) parts.push(item.bind);
  if (item.year) parts.push(item.year);
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

  // Marketing Executive HTML (if present)
  const marketingExecHtml = data.marketingExecutive
    ? `<div class="marketing-exec">${data.marketingExecutive.name || data.marketingExecutive}</div>`
    : '';

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
    .marketing-exec { margin-bottom: 10px; font-weight: bold; }
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
    ${marketingExecHtml}
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

  // Marketing Executive HTML (if present)
  const marketingExecHtml = data.marketingExecutive
    ? `<div class="marketing-exec">${data.marketingExecutive.name || data.marketingExecutive}</div>`
    : '';

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
    .marketing-exec { grid-column: span 4; margin-bottom: 10px; font-weight: bold; }
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
    ${marketingExecHtml}
    <div class="info-grid">
      <div><span class="info-label">Customer:</span> ${data.customerName || ''}</div>
      <div><span class="info-label">Date:</span> ${dateStr}</div>
      <div><span class="info-label">P.O. #:</span> ${data.poNumber ? `P.O.#: ${data.poNumber}` : ''}</div>
      <div style="grid-column: span 2;"><span class="info-label">Address:</span> ${data.customerAddress || ''}</div>
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

// Generate EF document (Excel only for now)
async function generateEF(data, format = 'xlsx') {
  if (format === 'xlsx') {
    return generateEFExcel(data);
  } else {
    // For PDF, we could implement a PDF version later
    // For now, fall back to Excel
    return generateEFExcel(data);
  }
}

module.exports = { generate, generateEF, numberToWords, formatDate };