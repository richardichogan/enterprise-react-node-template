/**
 * Test Gartner RFI extraction before indexing
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { extractGartnerRFI } from '../services/documentProcessor.js';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

async function testGartnerExtraction() {
  const fileName = 'Microsoft MQ & CC_Cloud-ERP-Services_IBM_05-Dec-2025.xlsx';
  
  console.log('🧪 Testing Gartner RFI Extraction\n');
  console.log('═'.repeat(70));
  
  // Download file
  console.log(`📥 Downloading: ${fileName}...`);
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
  console.log(`✅ Downloaded: ${(buffer.length / 1024).toFixed(1)} KB\n`);
  
  // Extract Q&A entries
  console.log('🔍 Extracting Q&A entries...\n');
  const qaEntries = await extractGartnerRFI(buffer);
  
  if (!qaEntries || qaEntries.length === 0) {
    console.log('❌ No Q&A entries extracted');
    return;
  }
  
  console.log('═'.repeat(70));
  console.log('📊 EXTRACTION RESULTS\n');
  console.log(`Total Q&A entries extracted: ${qaEntries.length}\n`);
  
  // Show breakdown by section
  const sectionCounts = {};
  qaEntries.forEach(qa => {
    sectionCounts[qa.section] = (sectionCounts[qa.section] || 0) + 1;
  });
  
  console.log('Questions per section:');
  Object.entries(sectionCounts).forEach(([section, count]) => {
    console.log(`  • ${section}: ${count} questions`);
  });
  
  console.log('\n' + '═'.repeat(70));
  console.log('📝 SAMPLE Q&A ENTRIES (First 3)\n');
  
  qaEntries.slice(0, 3).forEach((qa, idx) => {
    console.log(`${idx + 1}. ${qa.section} - Question ${qa.questionNo}`);
    console.log(`   Title: ${qa.questionTitle.substring(0, 100)}${qa.questionTitle.length > 100 ? '...' : ''}`);
    console.log(`   Has Response: ${qa.response ? 'Yes' : 'No'} (${qa.response?.length || 0} chars)`);
    console.log(`   Has 2024 Response: ${qa.response2024 ? 'Yes' : 'No'}`);
    console.log(`   Sub-rows: ${qa.subRows?.length || 0}`);
    console.log('');
  });
  
  // Show one complete example
  console.log('═'.repeat(70));
  console.log('📄 COMPLETE EXAMPLE (Question 1)\n');
  const example = qaEntries[0];
  console.log(`Section: ${example.section}`);
  console.log(`Subsection: ${example.subsection || 'N/A'}`);
  console.log(`Question No: ${example.questionNo}`);
  console.log(`Question Title:\n  ${example.questionTitle}\n`);
  console.log(`Guidance:\n  ${example.guidance?.substring(0, 200) || 'N/A'}${example.guidance?.length > 200 ? '...' : ''}\n`);
  console.log(`Response:\n  ${example.response?.substring(0, 300) || 'N/A'}${example.response?.length > 300 ? '...' : ''}\n`);
  console.log(`Character Count: ${example.charCount || 'N/A'}`);
  console.log(`Sub-rows: ${example.subRows?.length || 0}`);
  
  console.log('\n✅ Extraction test complete!');
}

testGartnerExtraction().catch(console.error);
