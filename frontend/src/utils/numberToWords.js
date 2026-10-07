// Convert number to Philippine Peso words
export function numberToWords(num) {
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

export function formatDate(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

export function formatCurrency(num) {
  return Number(num).toFixed(2);
}