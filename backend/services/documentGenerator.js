const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'DR_SI_TEMPLATE.xlsx');

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

  const pesos = Math.floor(num);
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
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const sheet = workbook.getWorksheet(templateSheetName);

  if (!sheet) {
    throw new Error(`Template sheet "${templateSheetName}" not found`);
  }

  if (templateSheetName === 'DR1') {
    fillDR1Template(sheet, data);
  } else if (templateSheetName === 'INV1') {
    fillINV1Template(sheet, data);
  }

  // Also fill the "Pesos Only" sheet (sheet '1') with amount in words
  const wordsSheet = workbook.getWorksheet('1');
  if (wordsSheet) {
    const total = data.totalAmount || data.subtotal || 0;
    wordsSheet.getCell('A7').value = numberToWords(total);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
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

function fillDR1Template(sheet, data) {
  // Header fields (based on template analysis)
  // Row 5: Company name (col E=5), Code (col H=8)
  sheet.getCell('E5').value = data.customerName || '';
  sheet.getCell('H5').value = data.drNumber || '';

  // Row 6: Address (col E=5)
  sheet.getCell('E6').value = data.customerAddress || '';

  // Line items start at row 12 (row 10 is header, row 11 empty)
  const startRow = 12;
  const items = data.items || [];

  items.forEach((item, index) => {
    const row = startRow + index;
    // Col B=2: CODE - leave blank as per user request
    sheet.getCell(`B${row}`).value = '';
    // Col C=3: NO.
    sheet.getCell(`C${row}`).value = index + 1;
    // Col D=4: QTY
    sheet.getCell(`D${row}`).value = item.qty;
    // Col F=6: ISBN/BARCODE
    sheet.getCell(`F${row}`).value = item.isbn || '';
    // Col G=7: TITLE/DESCRIPTION - formatted
    sheet.getCell(`G${row}`).value = formatDescription(item);
    // Col H=8: UNIT PRICE
    sheet.getCell(`H${row}`).value = item.unitPrice;
    // Col I=9: AMOUNT (formula or value)
    sheet.getCell(`I${row}`).value = item.amount;
  });

  // Totals - find the row after last item
  const totalRow = startRow + items.length + 1;
  const subtotal = data.subtotal || items.reduce((sum, i) => sum + i.amount, 0);
  sheet.getCell(`I${totalRow}`).value = subtotal;
  sheet.getCell(`I${totalRow + 1}`).value = subtotal; // Total (no VAT)
}

function fillINV1Template(sheet, data) {
  // Header fields (based on template analysis)
  // Row 14: Customer name (col H=8)
  sheet.getCell('H14').value = data.customerName || '';

  // Row 15: Company name (col E=5), Code (col H=8), ? (col K=11)
  sheet.getCell('E15').value = data.customerName || ''; // Or company name if different
  sheet.getCell('H15').value = data.siNumber || '';
  sheet.getCell('K15').value = ''; // Unknown field

  // Row 16: Address (col E=5)
  sheet.getCell('E16').value = data.customerAddress || '';

  // Row 17: Contact (col H=8), Date (col K=11)
  sheet.getCell('H17').value = ''; // Contact person
  sheet.getCell('K17').value = formatDate(data.date);

  // Row 19: P.O.# (col E=5)
  sheet.getCell('E19').value = data.poNumber || '';

  // Line items start at row 23 (row 22 is header)
  const startRow = 23;
  const items = data.items || [];

  items.forEach((item, index) => {
    const row = startRow + index;
    // Col B=2: BATCH/DR - leave blank as per user request
    sheet.getCell(`B${row}`).value = '';
    // Col C=3: NO.
    sheet.getCell(`C${row}`).value = index + 1;
    // Col E=5: ISBN/BARCODE
    sheet.getCell(`E${row}`).value = item.isbn || '';
    // Col F=6: TITLE/DESCRIPTION - formatted
    sheet.getCell(`F${row}`).value = formatDescription(item);
    // Col G=7: QTY
    sheet.getCell(`G${row}`).value = item.qty;
    // Col I=9: UNIT PRICE
    sheet.getCell(`I${row}`).value = item.unitPrice;
    // Col J=10: AMOUNT
    sheet.getCell(`J${row}`).value = item.amount;
  });

  // Totals
  const totalRow = startRow + items.length + 1;
  const subtotal = data.subtotal || items.reduce((sum, i) => sum + i.amount, 0);
  sheet.getCell(`J${totalRow}`).value = subtotal;
  sheet.getCell(`J${totalRow + 1}`).value = subtotal;
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

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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
  const total = subtotal; // No VAT
  const amountWords = numberToWords(total);
  const dateStr = formatDate(data.date);

  if (templateSheetName === 'DR1') {
    return generateDR1HTML(data, items, subtotal, total, amountWords, dateStr);
  } else {
    return generateINV1HTML(data, items, subtotal, total, amountWords, dateStr);
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

function generateINV1HTML(data, items, subtotal, total, amountWords, dateStr) {
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