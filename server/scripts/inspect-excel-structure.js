/**
 * Inspect Excel file structure to understand how Q&A data is organized
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

async function inspectExcelStructure() {
  const fileName = 'Microsoft MQ & CC_Cloud-ERP-Services_IBM_05-Dec-2025.xlsx';
  
  console.log('🔍 Inspecting Excel file structure\n');
  console.log('═'.repeat(70));
  
  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  );
  
  const containerClient = blobServiceClient.getContainerClient(containerName);
  
  // List all blobs to find the Excel file (might have timestamp prefix)
  console.log('📋 Finding file in blob storage...\n');
  let actualFileName = null;
  for await (const blob of containerClient.listBlobsFlat()) {
    if (blob.name.includes(fileName) || blob.name.endsWith('.xlsx')) {
      console.log(`Found: ${blob.name}`);
      actualFileName = blob.name;
    }
  }
  
  if (!actualFileName) {
    console.log('❌ Excel file not found in blob storage');
    return;
  }
  
  console.log(`\n📥 Downloading: ${actualFileName}...`);
  const blobClient = containerClient.getBlobClient(actualFileName);
  const downloadResponse = await blobClient.download();
  
  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  console.log(`✅ Downloaded: ${(buffer.length / 1024).toFixed(1)} KB\n`);
  
  // Parse Excel file
  console.log('📊 Parsing Excel structure...\n');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  console.log('📑 SHEETS:\n');
  workbook.SheetNames.forEach((name, i) => {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;
    console.log(`  ${i + 1}. "${name}"`);
    console.log(`     Rows: ${rowCount}, Columns: ${colCount}`);
  });
  
  // Inspect first sheet in detail
  console.log('\n' + '═'.repeat(70));
  console.log('📋 DETAILED INSPECTION OF FIRST SHEET\n');
  
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  
  console.log(`Sheet: "${firstSheetName}"\n`);
  
  // Get headers (first row)
  console.log('📌 COLUMN HEADERS (First Row):\n');
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headers = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
    const cell = sheet[cellAddress];
    const header = cell ? String(cell.v) : '';
    headers.push(header);
    if (header) {
      console.log(`  Column ${XLSX.utils.encode_col(col)}: "${header}"`);
    }
  }
  
  // Show sample rows
  console.log('\n📝 SAMPLE ROWS (First 5 rows):\n');
  for (let row = range.s.r; row <= Math.min(range.s.r + 5, range.e.r); row++) {
    console.log(`Row ${row + 1}:`);
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddress];
      if (cell && cell.v) {
        const value = String(cell.v);
        const preview = value.length > 100 ? value.substring(0, 100) + '...' : value;
        console.log(`  ${headers[col] || XLSX.utils.encode_col(col)}: ${preview}`);
      }
    }
    console.log('');
  }
  
  // Look for patterns that indicate Q&A structure
  console.log('═'.repeat(70));
  console.log('🔍 LOOKING FOR Q&A PATTERNS\n');
  
  const patterns = {
    questionColumns: [],
    answerColumns: [],
    idColumns: []
  };
  
  headers.forEach((header, idx) => {
    const lower = header.toLowerCase();
    if (lower.includes('question') || lower.includes('prompt') || lower.includes('inquiry')) {
      patterns.questionColumns.push({ col: idx, name: header });
    }
    if (lower.includes('answer') || lower.includes('response') || lower.includes('reply')) {
      patterns.answerColumns.push({ col: idx, name: header });
    }
    if (lower.includes('id') || lower.includes('number') || lower.includes('#')) {
      patterns.idColumns.push({ col: idx, name: header });
    }
  });
  
  console.log('Potential Question columns:', patterns.questionColumns.length > 0 ? 
    patterns.questionColumns.map(p => `"${p.name}"`).join(', ') : 'None found');
  console.log('Potential Answer columns:', patterns.answerColumns.length > 0 ? 
    patterns.answerColumns.map(p => `"${p.name}"`).join(', ') : 'None found');
  console.log('Potential ID columns:', patterns.idColumns.length > 0 ? 
    patterns.idColumns.map(p => `"${p.name}"`).join(', ') : 'None found');
  
  console.log('\n✅ Inspection complete!');
}

inspectExcelStructure().catch(console.error);
