import 'dotenv/config';
import { BlobServiceClient } from '@azure/storage-blob';
import { enrichDocumentMetadata } from './metadataSchemaService.js';

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents';

// Validate configuration
if (!accountName || !accountKey) {
  console.warn('⚠️  Azure Blob Storage not configured. Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY in .env');
}

/**
 * Get Azure Blob Service Client
 * @returns {BlobServiceClient|null}
 */
function getBlobServiceClient() {
  if (!accountName || !accountKey) {
    return null;
  }
  
  const connectionString = `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
  return BlobServiceClient.fromConnectionString(connectionString);
}

/**
 * Upload a file to Azure Blob Storage with auto-detected metadata
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string|null} userMetadataOverride - Optional user-provided document type (rfi_response, briefing_deck, etc.)
 * @param {string} analyst - Analyst name (Gartner, Forrester, etc.)
 * @returns {Promise<Object>} Upload result with URL, metadata, and detection info
 */
export async function uploadDocument(fileBuffer, fileName, mimeType, userMetadataOverride = null, analyst = 'Unknown') {
  const blobServiceClient = getBlobServiceClient();
  
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage not configured. Check .env file.');
  }

  try {
    // Enrich metadata with auto-detection
    const enrichedMetadata = await enrichDocumentMetadata(
      fileBuffer, 
      fileName, 
      mimeType, 
      userMetadataOverride
    );

    // Get container client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Ensure container exists (defaults to private access)
    await containerClient.createIfNotExists();

    // Generate unique blob name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blobName = `${timestamp}_${fileName}`;
    
    // Get blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Build blob metadata for Azure storage
    const blobMetadata = {
      originalName: enrichedMetadata.originalName,
      uploadDate: enrichedMetadata.uploadDate,
      size: enrichedMetadata.size.toString(),
      documentType: enrichedMetadata.documentType,
      confidence: enrichedMetadata.confidence,
      priority: enrichedMetadata.priority,
      sourceCategory: enrichedMetadata.sourceCategory,
      isPrimaryContent: enrichedMetadata.isPrimaryContent.toString(),
      retrievalWeight: enrichedMetadata.retrievalWeight.toString(),
      detectionMethod: enrichedMetadata.detectionMethod,
      analysis: enrichedMetadata.analysis,
      analyst: analyst,
      version: '1.0'
    };
    
    // Upload file
    const uploadResponse = await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: mimeType
      },
      metadata: blobMetadata
    });

    console.log(`✅ Uploaded document: ${fileName} → ${blobName}`);
    console.log(`   Type: ${enrichedMetadata.documentType} (${enrichedMetadata.confidence})`);
    console.log(`   Priority: ${enrichedMetadata.priority} | Weight: ${enrichedMetadata.retrievalWeight}`);

    return {
      success: true,
      blobName,
      originalName: enrichedMetadata.originalName,
      url: blockBlobClient.url,
      size: enrichedMetadata.size,
      mimeType,
      uploadDate: enrichedMetadata.uploadDate,
      etag: uploadResponse.etag,
      // Include metadata for frontend display
      metadata: {
        documentType: enrichedMetadata.documentType,
        confidence: enrichedMetadata.confidence,
        priority: enrichedMetadata.priority,
        sourceCategory: enrichedMetadata.sourceCategory,
        isPrimaryContent: enrichedMetadata.isPrimaryContent,
        retrievalWeight: enrichedMetadata.retrievalWeight,
        detectionMethod: enrichedMetadata.detectionMethod,
        analysis: enrichedMetadata.analysis,
        analyst,
        version: '1.0'
      }
    };
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    throw new Error(`Failed to upload document: ${error.message}`);
  }
}

/**
 * List all documents in the container
 * @returns {Promise<Array>} List of documents with metadata
 */
export async function listDocuments() {
  const blobServiceClient = getBlobServiceClient();
  
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage not configured. Check .env file.');
  }

  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const documents = [];

    // List all blobs
    for await (const blob of containerClient.listBlobsFlat({ includeMetadata: true })) {
      documents.push({
        name: blob.name,
        originalName: blob.metadata?.originalname || blob.name,
        size: blob.properties.contentLength,
        mimeType: blob.properties.contentType,
        uploadDate: blob.metadata?.uploaddate || blob.properties.createdOn,
        lastModified: blob.properties.lastModified,
        url: `${containerClient.url}/${blob.name}`,
        analyst: blob.metadata?.analyst || 'Unknown',
        metadata: {
          documentType: blob.metadata?.documenttype || 'secondary_context'
        }
      });
    }

    console.log(`📋 Found ${documents.length} documents in Azure Blob Storage`);
    return documents;
  } catch (error) {
    console.error('❌ List failed:', error.message);
    throw new Error(`Failed to list documents: ${error.message}`);
  }
}

/**
 * Download a document from Azure Blob Storage
 * @param {string} blobName - Name of the blob to download
 * @returns {Promise<Buffer>} Document content as buffer
 */
export async function downloadDocument(blobName) {
  const blobServiceClient = getBlobServiceClient();
  
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage not configured. Check .env file.');
  }

  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    const downloadResponse = await blockBlobClient.download(0);
    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);
    
    console.log(`📥 Downloaded document: ${blobName}`);
    return buffer;
  } catch (error) {
    console.error('❌ Download failed:', error.message);
    throw new Error(`Failed to download document: ${error.message}`);
  }
}

/**
 * Delete a document from Azure Blob Storage
 * @param {string} blobName - Name of the blob to delete
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteDocument(blobName) {
  const blobServiceClient = getBlobServiceClient();
  
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage not configured. Check .env file.');
  }

  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    await blockBlobClient.delete();
    
    console.log(`🗑️  Deleted document: ${blobName}`);
    return {
      success: true,
      blobName,
      deletedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Delete failed:', error.message);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Get document metadata without downloading
 * @param {string} blobName - Name of the blob
 * @returns {Promise<Object>} Document metadata
 */
export async function getDocumentMetadata(blobName) {
  const blobServiceClient = getBlobServiceClient();
  
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage not configured. Check .env file.');
  }

  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    const properties = await blockBlobClient.getProperties();
    
    return {
      name: blobName,
      originalName: properties.metadata?.originalname || blobName,
      size: properties.contentLength,
      mimeType: properties.contentType,
      uploadDate: properties.metadata?.uploaddate,
      lastModified: properties.lastModified,
      etag: properties.etag,
      url: blockBlobClient.url
    };
  } catch (error) {
    console.error('❌ Get metadata failed:', error.message);
    throw new Error(`Failed to get document metadata: ${error.message}`);
  }
}

/**
 * Update document metadata in Azure Blob Storage
 * @param {string} blobName - Name of the blob
 * @param {Object} metadata - Metadata to update (documentType, etc.)
 * @returns {Promise<Object>} Update result
 */
export async function updateDocumentMetadata(blobName, metadata) {
  const blobServiceClient = getBlobServiceClient();
  
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage not configured. Check .env file.');
  }

  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Get existing metadata first
    const properties = await blockBlobClient.getProperties();
    const existingMetadata = properties.metadata || {};
    
    // Merge with new metadata
    const updatedMetadata = {
      ...existingMetadata,
      ...metadata,
      lastUpdated: new Date().toISOString()
    };
    
    // Update blob metadata
    await blockBlobClient.setMetadata(updatedMetadata);
    
    console.log(`✅ Updated metadata for ${blobName}:`, metadata);
    return {
      success: true,
      blobName,
      metadata: updatedMetadata
    };
  } catch (error) {
    console.error('❌ Update metadata failed:', error.message);
    throw new Error(`Failed to update document metadata: ${error.message}`);
  }
}

/**
 * Helper: Convert stream to buffer
 * @param {ReadableStream} readableStream
 * @returns {Promise<Buffer>}
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
