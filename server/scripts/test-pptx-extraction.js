/**
 * Test PowerPoint extraction on the smaller file first
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { extractDocumentText } from '../services/documentProcessor.js';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

async function testExtraction() {
  const fileName = '2026-01-12T13-21-24-419Z_Gartner MQ & CC Cloud ERP Services Q1 2026  Kick Off.pptx';
  
  console.log('🧪 Testing PowerPoint extraction on:', fileName);
  console.log('═'.repeat(60));
  
  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  );
  
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(fileName);
  
  console.log('📥 Downloading...');
  const downloadResponse = await blobClient.download();
  
  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  console.log(`✅ Downloaded: ${(buffer.length / 1024).toFixed(1)} KB`);
  
  console.log('\n📝 Extracting text with aggressive extraction...');
  const text = await extractDocumentText(fileName, buffer);
  
  if (text) {
    console.log('\n✅ SUCCESS! Extracted text:');
    console.log('Length:', text.length, 'characters');
    console.log('\n--- First 1000 characters ---');
    console.log(text.substring(0, 1000));
    console.log('\n--- Search for key phrases from screenshot ---');
    if (text.includes('Key deliverables')) console.log('✅ Found: "Key deliverables"');
    if (text.includes('Questionnaire')) console.log('✅ Found: "Questionnaire"');
    if (text.includes('January 19th')) console.log('✅ Found: "January 19th"');
    if (text.includes('March 2026')) console.log('✅ Found: "March 2026"');
  } else {
    console.log('\n❌ FAILED - No text extracted');
  }
}

testExtraction().catch(console.error);
