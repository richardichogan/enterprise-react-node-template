// Test CORRECT way to import and use pdf-parse
import pdfParseModule from 'pdf-parse/lib/pdf-parse.js';

console.log('Type:', typeof pdfParseModule);
console.log('Is function?', typeof pdfParseModule === 'function');
console.log('Keys:', Object.keys(pdfParseModule));

// Try using it
const dummyPDF = Buffer.from('%PDF-1.4');
try {
  const data = await pdfParseModule(dummyPDF);
  console.log('✅ Works!');
} catch (err) {
  console.log('❌ Error:', err.message);
}
