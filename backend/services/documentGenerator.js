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

// Helper: Format date as MM/DD/YYYY (empty string when there is no date)
function formatDate(date) {
  if (!date) return '';
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

  // Date in G5/H5 (overwrite TODAY() formula with the EF's date - blank if none)
  const dateValue = formatDate(data.date);
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

  if (data.status === 'cancelled') stampCancelled(sheet);
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

// Stamp CANCELLED marker into A7 (empty header cell in all templates - text overflows
// across the empty adjacent cells) so voided documents are unmistakable on re-export
function stampCancelled(sheet) {
  const cell = setCellValue(sheet, 'A7', '*** CANCELLED ***');
  cell.font = { bold: true, size: 14, color: { argb: 'FF9C0006' } };
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

  if (data.status === 'cancelled') stampCancelled(sheet);
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

  // Write discount fraction to helper cell K677 - drives template formulas H676 (label), I676 (discount), I677 (net total)
  setCellValue(sheet, 'K677', (data.discountPercentage || 0) / 100);

  if (data.status === 'cancelled') stampCancelled(sheet);
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

async function generate(templateSheetName, data, format = 'xlsx') {
  return generateExcel(templateSheetName, data);
}

// Generate EF document (Excel only)
async function generateEF(data, format = 'xlsx') {
  return generateEFExcel(data);
}

module.exports = { generate, generateEF, numberToWords, formatDate };