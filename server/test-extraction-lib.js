import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

console.log('🧪 Testing extraction libraries...\n');

// Test 1: What does mammoth.extractRawText return?
console.log('Test 1: Mammoth return value structure');
try {
  const dummyBuffer = Buffer.from('PK'); // ZIP file signature
  const result = await mammoth.extractRawText({ buffer: dummyBuffer });
  console.log('✅ mammoth.extractRawText result keys:', Object.keys(result));
  console.log('   - result.value:', typeof result.value);
  console.log('   - result.value is:', result.value?.substring?.(0, 50) || '[empty or not string]');
  console.log('   - result.messages:', result.messages?.length || 0, 'messages');
} catch (err) {
  console.log('❌ Error:', err.message.substring(0, 100));
}

console.log('\n---\n');

// Test 2: Does PDFParse return data.text?
console.log('Test 2: PDFParse return value structure');
try {
  const dummyPDF = Buffer.from('%PDF-1.4'); // PDF header
  const data = await PDFParse(dummyPDF);
  console.log('✅ PDFParse result keys:', Object.keys(data));
  console.log('   - data.text:', typeof data.text);
  console.log('   - data.text is:', data.text?.substring?.(0, 50) || '[empty or not string]');
} catch (err) {
  console.log('❌ Error:', err.message.substring(0, 100));
}

console.log('\n---\n');

// Test 3: Check if mammoth.extractRawText exists and is callable
console.log('Test 3: Function existence');
console.log('mammoth.extractRawText:', typeof mammoth.extractRawText);
console.log('PDFParse:', typeof PDFParse);

// Test 4: Can we extract from actual DOCX-like zip?
console.log('\nTest 4: Check if mammoth works with valid Office files');
import { createReadStream } from 'fs';
import { readdir } from 'fs/promises';
const files = await readdir('./data').catch(() => []);
const docxFiles = files.filter(f => f.endsWith('.docx'));
const pptxFiles = files.filter(f => f.endsWith('.pptx'));
const pdfFiles = files.filter(f => f.endsWith('.pdf'));

console.log('Found test files:');
console.log('  DOCX:', docxFiles.length, docxFiles.slice(0,2));
console.log('  PPTX:', pptxFiles.length, pptxFiles.slice(0,2));
console.log('  PDF:', pdfFiles.length, pdfFiles.slice(0,2));
