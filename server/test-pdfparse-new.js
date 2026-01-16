import { PDFParse } from 'pdf-parse';

console.log('🧪 Testing PDFParse with real syntax...\n');

// Test with dummy PDF header
const dummyPDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');

try {
  console.log('Trying: new PDFParse(buffer)');
  const parser = new PDFParse(dummyPDF);
  console.log('✅ Created parser:', typeof parser);
  console.log('Parser properties:', Object.keys(parser).slice(0, 5));
  
  // Wait if it's async
  const data = await parser;
  console.log('✅ Result:', data);
} catch (err) {
  console.log('❌ Error:', err.message);
}
