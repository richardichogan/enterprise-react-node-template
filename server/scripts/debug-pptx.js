/**
 * Debug PowerPoint Extraction
 * Inspect PPTX structure to understand why text extraction failed
 */

import { BlobServiceClient } from '@azure/storage-blob';
import JSZip from 'jszip';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

async function debugPowerPoint(fileName) {
  try {
    console.log(`\n🔍 Debugging: ${fileName}`);
    console.log('═'.repeat(60));
    
    // Download the file
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      { accountKey }
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
    
    // Unzip and inspect structure
    const zip = await JSZip.loadAsync(buffer);
    
    console.log('\n📂 ZIP Structure:');
    Object.keys(zip.files).forEach(path => {
      if (path.includes('slide') && !path.endsWith('/')) {
        console.log(`   ${path}`);
      }
    });
    
    // Check slides folder
    const slidesFolder = zip.folder('ppt/slides');
    if (!slidesFolder) {
      console.log('\n⚠️  No ppt/slides folder found!');
      return;
    }
    
    const slideFiles = Object.keys(slidesFolder.files);
    console.log(`\n📊 Found ${slideFiles.length} files in ppt/slides`);
    
    // Inspect first slide in detail
    const xmlSlides = slideFiles.filter(f => f.endsWith('.xml'));
    console.log(`📝 XML slides: ${xmlSlides.length}`);
    
    if (xmlSlides.length > 0) {
      const firstSlide = xmlSlides[0];
      console.log(`\n🔍 Inspecting first slide: ${firstSlide}`);
      
      const slideEntry = slidesFolder.file(firstSlide);
      const content = await slideEntry.async('string');
      
      console.log(`   Content length: ${content.length} chars`);
      
      // Try different text extraction patterns
      const patterns = {
        'a:t tags': /<a:t>([^<]+)<\/a:t>/g,
        'a:p tags': /<a:p[^>]*>(.*?)<\/a:p>/gs,
        't tags': /<t>([^<]+)<\/t>/g,
        'Any text between >...< ': />([^<]{10,})</g
      };
      
      console.log('\n🔎 Testing extraction patterns:');
      for (const [name, pattern] of Object.entries(patterns)) {
        const matches = content.match(pattern) || [];
        console.log(`   ${name}: ${matches.length} matches`);
        if (matches.length > 0 && matches.length <= 3) {
          console.log(`      Sample: ${matches[0].substring(0, 100)}...`);
        }
      }
      
      // Show a snippet of raw XML
      console.log('\n📄 Raw XML snippet (first 500 chars):');
      console.log(content.substring(0, 500));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Debug both problematic files
const files = [
  '2026-01-12T13-21-24-419Z_Gartner MQ & CC Cloud ERP Services Q1 2026  Kick Off.pptx',
  '2026-01-12T13-34-54-775Z_MQ - 2024 - Cloud ERP Services Submission 6-21-24 (FINAL).pptx'
];

for (const file of files) {
  await debugPowerPoint(file);
}

console.log('\n✅ Debug complete!');
