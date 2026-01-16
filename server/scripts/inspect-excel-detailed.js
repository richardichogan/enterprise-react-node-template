/**
 * Detailed inspection of Excel Q&A structure
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

async function inspectExcelDetailed() {
  const fileName = 'Microsoft MQ & CC_Cloud-ERP-Services_IBM_05-Dec-2025.xlsx';
  
  console.log('🔍 Detailed Excel Q&A Structure Analysis\n');
  
  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  );
  
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(fileName);
  const downloadResponse = await blobClient.download();
  
  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets['Questionnaire'];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  
  console.log('═'.repeat(80));
  console.log('📋 QUESTIONNAIRE SHEET - COMPLETE STRUCTURE\n');
  
  // From inspection, headers seem to be in row 6 (index 5)
  // Let's get all column headers from row 6
  console.log('Column Headers (Row 6):\n');
  const headerRow = 5; // 0-indexed, so row 6
  const headers = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
    const cell = sheet[cellAddress];
    const value = cell ? String(cell.v).trim() : '';
    headers[col] = value;
    if (value) {
      console.log(`  [${XLSX.utils.encode_col(col)}] ${value}`);
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('📝 SAMPLE Q&A ENTRIES (Rows 7-12)\n');
  
  // Show rows 7-12 (after header row)
  for (let row = headerRow + 1; row <= Math.min(headerRow + 6, range.e.r); row++) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`ROW ${row + 1}:\n`);
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddress];
      if (cell && cell.v) {
        const value = String(cell.v).trim();
        if (value) {
          const colName = headers[col] || XLSX.utils.encode_col(col);
          const preview = value.length > 200 ? value.substring(0, 200) + '...' : value;
          console.log(`${colName}:`);
          console.log(`  ${preview}\n`);
        }
      }
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('📊 RECOMMENDED INDEXING STRATEGY:\n');
  
  // Analyze what columns likely contain questions vs answers
  const colB = headers.indexOf('Evaluation Criteria');
  const colC = headers.indexOf('Criteria Explanation');
  const colD = headers.indexOf('Additional Response Instructions');
  const colG = headers.indexOf('Vendor Response');
  
  console.log('Based on the structure, we should index each row as:');
  console.log('  • Question: Column B (Evaluation Criteria)');
  console.log('  • Context: Column C (Criteria Explanation) + Column D (Instructions)');
  console.log('  • Answer: Column G (Vendor Response)');
  console.log('  • Metadata: Char count, Owner, Status, Comments\n');
  
  console.log('Suggested chunk format:');
  console.log('  "Question: [Evaluation Criteria]"');
  console.log('  "Explanation: [Criteria Explanation]"');
  console.log('  "Instructions: [Additional Response Instructions]"');
  console.log('  "Response: [Vendor Response]"');
  
  console.log('\n✅ Analysis complete!');
}

inspectExcelDetailed().catch(console.error);
