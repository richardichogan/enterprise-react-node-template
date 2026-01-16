/**
 * Re-index the two PowerPoint files that were previously skipped
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { indexDocument } from '../services/azureSearchService.js';
import { extractDocumentText } from '../services/documentProcessor.js';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

// The two PowerPoint files to re-index
const pptxFiles = [
  '2026-01-12T13-21-24-419Z_Gartner MQ & CC Cloud ERP Services Q1 2026  Kick Off.pptx',
  '2026-01-12T13-34-54-775Z_MQ - 2024 - Cloud ERP Services Submission 6-21-24 (FINAL).pptx'
];

function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start = end - overlap;
    
    if (start + overlap >= text.length) break;
  }
  
  return chunks;
}

/**
 * Generate a unique ID for a document chunk
 */
function generateChunkId(fileName, chunkIndex) {
  const baseId = `${fileName}-chunk-${chunkIndex}`;
  return crypto.createHash('md5').update(baseId).digest('hex');
}

async function reindexPowerPoint() {
  try {
    console.log('📦 Re-indexing PowerPoint Files');
    console.log('═'.repeat(60));
    
    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential
    );
    
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    let successCount = 0;
    let totalChunks = 0;
    
    for (const fileName of pptxFiles) {
      console.log(`\n📄 Processing: ${fileName}`);
      
      try {
        // Download blob
        const blobClient = containerClient.getBlobClient(fileName);
        const downloadResponse = await blobClient.download();
        
        const chunks = [];
        for await (const chunk of downloadResponse.readableStreamBody) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        console.log(`   Downloaded: ${(buffer.length / 1024).toFixed(1)} KB`);
        
        // Extract text with enhanced extraction
        const text = await extractDocumentText(fileName, buffer);
        
        if (!text) {
          console.log('   ⚠️  Still no text extracted');
          continue;
        }
        
        console.log(`   Extracted: ${text.length} characters`);
        
        // Chunk the text
        const textChunks = chunkText(text, 1000, 200);
        console.log(`   Created: ${textChunks.length} chunks`);
        
        // Index each chunk
        for (let i = 0; i < textChunks.length; i++) {
          const chunkDoc = {
            id: generateChunkId(fileName, i),
            fileName: fileName,
            title: path.basename(fileName, path.extname(fileName)),
            content: textChunks[i],
            pageNumber: i + 1
          };
          
          await indexDocument(chunkDoc);
          process.stdout.write('.');
        }
        
        console.log(`\n   ✅ Indexed ${textChunks.length} chunks from ${fileName}`);
        successCount++;
        totalChunks += textChunks.length;
        
      } catch (error) {
        console.error(`   ❌ Error processing ${fileName}:`, error.message);
      }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Re-indexing Summary:');
    console.log(`   Files processed: ${pptxFiles.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   📝 Total chunks indexed: ${totalChunks}`);
    console.log('═'.repeat(60));
    
    if (successCount > 0) {
      console.log('\n🎉 PowerPoint files indexed successfully!');
      console.log('Test with: node scripts/test-search.js');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

reindexPowerPoint();
