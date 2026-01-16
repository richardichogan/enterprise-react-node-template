/**
 * Index Existing Documents from Azure Blob Storage
 * Downloads all documents from blob storage and indexes them in Azure AI Search
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { indexDocument } from '../services/azureSearchService.js';
import { extractDocumentText } from '../services/documentProcessor.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

console.log('📦 Indexing Existing Documents from Blob Storage\n');
console.log('═══════════════════════════════════════════════════════════\n');

if (!ACCOUNT_NAME || !ACCOUNT_KEY) {
  console.error('❌ Missing Azure Storage credentials');
  console.error('Please set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY');
  process.exit(1);
}

// Initialize blob client
const credential = new StorageSharedKeyCredential(ACCOUNT_NAME, ACCOUNT_KEY);
const blobServiceClient = new BlobServiceClient(
  `https://${ACCOUNT_NAME}.blob.core.windows.net`,
  credential
);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

/**
 * Chunk text into smaller pieces for better retrieval
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.substring(start, end);
    
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
    
    start += chunkSize - overlap;
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

async function indexExistingDocuments() {
  try {
    console.log(`📋 Listing documents in container: ${CONTAINER_NAME}\n`);
    
    const blobs = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      blobs.push(blob.name);
    }
    
    if (blobs.length === 0) {
      console.log('⚠️  No documents found in blob storage');
      console.log('Upload documents through the RFI Helper UI first');
      return;
    }
    
    console.log(`✅ Found ${blobs.length} document(s)\n`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    let successCount = 0;
    let failCount = 0;
    let totalChunks = 0;
    
    for (const blobName of blobs) {
      console.log(`\n📄 Processing: ${blobName}`);
      
      try {
        // Download blob
        const blobClient = containerClient.getBlobClient(blobName);
        const downloadResponse = await blobClient.download(0);
        const buffer = await streamToBuffer(downloadResponse.readableStreamBody);
        
        console.log(`   Downloaded: ${(buffer.length / 1024).toFixed(1)} KB`);
        
        // Extract text
        const text = await extractDocumentText(blobName, buffer);
        
        if (!text || text.length === 0) {
          console.log(`   ⚠️  No text extracted, skipping`);
          failCount++;
          continue;
        }
        
        console.log(`   Extracted: ${text.length} characters`);
        
        // Chunk the text
        const chunks = chunkText(text);
        console.log(`   Created: ${chunks.length} chunks`);
        
        // Index each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunkId = generateChunkId(blobName, i);
          
          const document = {
            id: chunkId,
            content: chunks[i],
            fileName: blobName,
            title: blobName.replace(/\.[^/.]+$/, ''), // Remove extension
            pageNumber: i + 1
          };
          
          const indexed = await indexDocument(document);
          
          if (indexed) {
            totalChunks++;
            process.stdout.write('.');
          } else {
            process.stdout.write('✗');
          }
        }
        
        console.log(`\n   ✅ Indexed ${chunks.length} chunks from ${blobName}`);
        successCount++;
        
      } catch (error) {
        console.error(`\n   ❌ Failed to process ${blobName}:`, error.message);
        failCount++;
      }
    }
    
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 Indexing Summary:\n');
    console.log(`   Documents processed: ${blobs.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📝 Total chunks indexed: ${totalChunks}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (successCount > 0) {
      console.log('🎉 Indexing complete!');
      console.log('Your Azure AI Search is now ready to use.');
      console.log('\nTest it with: node scripts/test-search.js\n');
    }
    
  } catch (error) {
    console.error('\n❌ Indexing failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

/**
 * Helper to convert stream to buffer
 */
async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

indexExistingDocuments();
