import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

console.log('🧪 Testing pdfjs-dist PDF extraction...\n');

// Create a minimal valid PDF
const minimalPDF = Buffer.from(
  `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Hello World) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000261 00000 n
0000000355 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
444
%%EOF`
);

try {
  console.log('PDF buffer size:', minimalPDF.length);
  console.log('Converting Buffer to Uint8Array...');
  const uint8Array = new Uint8Array(minimalPDF);
  console.log('Calling pdfjsLib.getDocument...');
  
  const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  
  console.log('✅ PDF loaded successfully');
  console.log('   Number of pages:', pdfDoc.numPages);
  
  const pages = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    console.log(`   Extracting page ${i}...`);
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    console.log(`   Page ${i} text:`, pageText);
    pages.push(pageText);
  }
  
  const fullText = pages.join('\n\n');
  console.log('\n✅ SUCCESS! Extracted text:', fullText);
  
} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.error('Stack:', error.stack);
}
