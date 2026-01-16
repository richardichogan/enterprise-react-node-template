/**
 * Deep dive into PowerPoint XML structure to understand why extraction fails
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import JSZip from 'jszip';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

async function inspectPowerPoint() {
  const fileName = '2026-01-12T13-21-24-419Z_Gartner MQ & CC Cloud ERP Services Q1 2026  Kick Off.pptx';
  
  console.log('🔍 Deep XML inspection:', fileName);
  console.log('═'.repeat(60));
  
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
  
  // Get first slide
  const slidesFolder = zip.folder('ppt/slides');
  const slideFiles = Object.keys(zip.files)
    .filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'))
    .sort();
  
  console.log(`\n📄 Found ${slideFiles.length} slide files`);
  console.log('Inspecting:', slideFiles[0]);
  
  // Get the full file path from the zip
  const firstSlideFile = zip.file(slideFiles[0]);
  if (!firstSlideFile) {
    console.error('❌ Could not find slide file');
    return;
  }
  const content = await firstSlideFile.async('string');
  
  console.log('\n📏 Content length:', content.length);
  
  // Show raw XML snippet
  console.log('\n--- RAW XML (first 2000 chars) ---');
  console.log(content.substring(0, 2000));
  
  // Try to find any text patterns
  console.log('\n--- SEARCHING FOR TEXT PATTERNS ---');
  
  const patterns = [
    { name: '<a:t>', regex: /<a:t[^>]*>.*?<\/a:t>/gs },
    { name: '<p:txBody>', regex: /<p:txBody>.*?<\/p:txBody>/gs },
    { name: '<a:p>', regex: /<a:p[^>]*>.*?<\/a:p>/gs },
    { name: 'Any >text<', regex: />([^<]{5,100})</g }
  ];
  
  for (const {name, regex} of patterns) {
    const matches = content.match(regex) || [];
    console.log(`\n${name}: ${matches.length} matches`);
    if (matches.length > 0 && matches.length <= 5) {
      matches.forEach((m, i) => {
        console.log(`  [${i+1}]`, m.substring(0, 200));
      });
    }
  }
  
  // Look for the specific text we know is there
  console.log('\n--- SEARCHING FOR KNOWN TEXT ---');
  const searches = ['Key deliverables', 'Questionnaire', 'January', 'March', 'RFI', '2026', 'deadline'];
  for (const term of searches) {
    if (content.toLowerCase().includes(term.toLowerCase())) {
      console.log(`✅ Found: "${term}"`);
      // Show context
      const index = content.toLowerCase().indexOf(term.toLowerCase());
      console.log(`   Context: ...${content.substring(Math.max(0, index-50), index+50)}...`);
    } else {
      console.log(`❌ NOT found: "${term}"`);
    }
  }
}

inspectPowerPoint().catch(console.error);
