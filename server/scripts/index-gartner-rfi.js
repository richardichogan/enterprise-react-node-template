/**
 * Index Gartner MQ & CC RFI Excel file
 * Specialized indexer that preserves Q&A structure
 */

import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { extractGartnerRFI } from '../services/documentProcessor.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT;
const searchKey = process.env.AZURE_SEARCH_API_KEY;
const indexName = process.env.AZURE_SEARCH_INDEX_NAME || 'rfi-documents';

// Generate unique document ID
function generateChunkId(fileName, questionNo, section) {
  const baseId = `${fileName}-${section}-Q${questionNo}`;
  return crypto.createHash('md5').update(baseId).digest('hex');
}

// Generate embedding for text
async function generateEmbedding(text) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deploymentName = process.env.AZURE_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';

  const url = `${endpoint}/openai/deployments/${deploymentName}/embeddings?api-version=${apiVersion}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        input: text.substring(0, 8000) // Limit to 8k chars for embedding
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('❌ Embedding generation failed:', error.message);
    throw error;
  }
}

async function indexGartnerRFI() {
  const fileName = 'Microsoft MQ & CC_Cloud-ERP-Services_IBM_05-Dec-2025.xlsx';
  
  console.log('📊 Indexing Gartner MQ & CC RFI');
  console.log('═'.repeat(70));
  console.log('');
  
  // Download file from blob storage
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
  
  // Initialize Azure Search client
  const searchClient = new SearchClient(
    searchEndpoint,
    indexName,
    new AzureKeyCredential(searchKey)
  );
  
  console.log('📝 Indexing Q&A entries...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const qa of qaEntries) {
    try {
      // Build structured content for this Q&A
      let content = `Section: ${qa.section}\n\n`;
      
      if (qa.subsection) {
        content += `Subsection: ${qa.subsection}\n\n`;
      }
      
      content += `Question ${qa.questionNo}: ${qa.questionTitle}\n\n`;
      
      if (qa.guidance) {
        content += `Guidance: ${qa.guidance}\n\n`;
      }
      
      if (qa.response) {
        content += `IBM Response (2025): ${qa.response}\n\n`;
      }
      
      if (qa.subRows && qa.subRows.length > 0) {
        content += `Additional Data:\n${qa.subRows.join('\n')}\n\n`;
      }
      
      if (qa.additionalInfo) {
        content += `Additional Information: ${qa.additionalInfo}\n\n`;
      }
      
      if (qa.response2024) {
        content += `Previous Response (2024): ${qa.response2024}\n\n`;
      }
      
      // Generate embedding
      const embedding = await generateEmbedding(content);
      
      // Create document for indexing (without metadata field)
      const document = {
        id: generateChunkId(fileName, qa.questionNo, qa.section),
        content: content,
        contentVector: embedding,
        fileName: fileName,
        title: `${qa.section} - Q${qa.questionNo}`,
        indexedAt: new Date().toISOString()
      };
      
      // Index the document
      const result = await searchClient.uploadDocuments([document]);
      
      if (result.results[0].succeeded) {
        successCount++;
        process.stdout.write(`✅ Indexed: ${qa.section} Q${qa.questionNo}\r`);
      } else {
        errorCount++;
        console.log(`\n❌ Failed: ${qa.section} Q${qa.questionNo} - ${result.results[0].errorMessage}`);
      }
      
    } catch (error) {
      errorCount++;
      console.log(`\n❌ Error indexing ${qa.section} Q${qa.questionNo}:`, error.message);
    }
  }
  
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('📊 Indexing Summary:');
  console.log(`   Total Q&A entries: ${qaEntries.length}`);
  console.log(`   ✅ Successfully indexed: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log('═'.repeat(70));
  console.log('');
  
  if (successCount === qaEntries.length) {
    console.log('🎉 Gartner RFI indexed successfully!');
  } else {
    console.log('⚠️  Some entries failed to index');
  }
}

indexGartnerRFI().catch(console.error);
