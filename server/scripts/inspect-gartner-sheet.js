/**
 * Inspect a specific Gartner sheet to understand Q&A structure
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

async function inspectGartnerSheet() {
  const fileName = 'Microsoft MQ & CC_Cloud-ERP-Services_IBM_05-Dec-2025.xlsx';
  const sheetName = 'Product or Service H'; // First content sheet
  
  console.log(`🔍 Inspecting Gartner Sheet: "${sheetName}"\n`);
  
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
  const sheet = workbook.Sheets[sheetName];
  
  if (!sheet) {
    console.log(`❌ Sheet "${sheetName}" not found`);
    return;
  }
  
  const range = XLSX.utils.decode_range(sheet['!ref']);
  
  console.log('═'.repeat(80));
  console.log(`📋 SHEET: "${sheetName}"\n`);
  console.log(`Dimensions: ${range.e.r + 1} rows × ${range.e.c + 1} columns\n`);
  
  // Find header row (usually row 1 or 2)
  console.log('First 3 rows to identify structure:\n');
  for (let row = 0; row <= Math.min(2, range.e.r); row++) {
    console.log(`${'─'.repeat(80)}`);
    console.log(`ROW ${row + 1}:\n`);
    for (let col = 0; col <= Math.min(10, range.e.c); col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddress];
      if (cell && cell.v) {
        const value = String(cell.v).trim();
        if (value) {
          const preview = value.length > 100 ? value.substring(0, 100) + '...' : value;
          console.log(`[${XLSX.utils.encode_col(col)}] ${preview}`);
        }
      }
    }
    console.log('');
  }
  
  // Assume row 6 is header (0-indexed row 5)
  console.log('═'.repeat(80));
  console.log('📌 COLUMN HEADERS (Row 6):\n');
  const headerRow = 5;
  const headers = [];
  for (let col = 0; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
    const cell = sheet[cellAddress];
    const value = cell ? String(cell.v).trim() : '';
    headers[col] = value;
    if (value) {
      console.log(`[${XLSX.utils.encode_col(col)}] ${value}`);
    }
  }
  
  // Show sample Q&A rows
  console.log('\n' + '═'.repeat(80));
  console.log('📝 SAMPLE Q&A ENTRIES (Rows 3-8)\n');
  
  for (let row = headerRow + 1; row <= Math.min(headerRow + 6, range.e.r); row++) {
    console.log(`${'─'.repeat(80)}`);
    console.log(`ROW ${row + 1}:\n`);
    
    for (let col = 0; col <= range.e.c; col++) {
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
  
  console.log('═'.repeat(80));
  console.log('💡 KEY OBSERVATIONS:\n');
  
  // Look for common column patterns
  const questionCol = headers.findIndex(h => h.toLowerCase().includes('question'));
  const responseCol = headers.findIndex(h => h.toLowerCase().includes('response'));
  const answerCol = headers.findIndex(h => h.toLowerCase().includes('answer'));
  
  console.log('Question column:', questionCol >= 0 ? `Column ${XLSX.utils.encode_col(questionCol)}` : 'Not found');
  console.log('Response column:', responseCol >= 0 ? `Column ${XLSX.utils.encode_col(responseCol)}` : 'Not found');
  console.log('Answer column:', answerCol >= 0 ? `Column ${XLSX.utils.encode_col(answerCol)}` : 'Not found');
  
  console.log('\n✅ Inspection complete!');
}

inspectGartnerSheet().catch(console.error);
