/**
 * Search all slides for the "Key deliverables" text
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import JSZip from 'jszip';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

async function findKeyDeliverablesSlide() {
  const fileName = '2026-01-12T13-21-24-419Z_Gartner MQ & CC Cloud ERP Services Q1 2026  Kick Off.pptx';
  
  console.log('🔍 Searching for "Key deliverables" slide...\n');
  
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
  
  const zip = await JSZip.loadAsync(buffer);
  
  const slideFiles = Object.keys(zip.files)
    .filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'))
    .sort();
  
  console.log(`Searching ${slideFiles.length} slides...\n`);
  
  for (const slideFile of slideFiles) {
    const file = zip.file(slideFile);
    const content = await file.async('string');
    
    if (content.toLowerCase().includes('key deliverables') || 
        content.toLowerCase().includes('questionnaire') ||
        content.toLowerCase().includes('january 19')) {
      console.log(`✅ FOUND IN: ${slideFile}\n`);
      
      // Extract all <a:t> tags
      const textMatches = content.match(/<a:t>([^<]+)<\/a:t>/g) || [];
      console.log('Text content from this slide:');
      textMatches.forEach((match, i) => {
        const text = match.replace(/<\/?a:t>/g, '');
        if (text.trim()) {
          console.log(`  ${i+1}. "${text}"`);
        }
      });
      
      console.log('\n' + '─'.repeat(60) + '\n');
    }
  }
}

findKeyDeliverablesSlide().catch(console.error);
