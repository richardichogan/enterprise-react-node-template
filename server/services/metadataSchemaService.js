/**
 * Phase 2: Azure Search Metadata Schema Service
 * Updates blob metadata to include auto-detected document type
 * Enables metadata-aware retrieval for agents
 */

import { detectDocumentMetadata } from './metadataDetectionService.js';

/**
 * Enhanced metadata object with detection info
 * @typedef {Object} DocumentMetadata
 * @property {string} originalName - Original filename
 * @property {string} uploadDate - ISO timestamp
 * @property {number} size - File size in bytes
 * @property {string} documentType - Auto-detected type (rfi_response, briefing_deck, etc.)
 * @property {string} confidence - Detection confidence (high/medium/low)
 * @property {string} priority - CRITICAL | HIGH | MEDIUM | LOW
 * @property {string} sourceCategory - fact_sources | primary_signposts | secondary_context
 * @property {boolean} isPrimaryContent - Whether this is critical for content generation
 * @property {number} retrievalWeight - 1.5 (CRITICAL) | 1.2 (HIGH) | 1.0 (others)
 * @property {string} detectionMethod - filename_pattern | content_analysis | user_override_required
 * @property {string} analysis - Human-readable explanation of detection
 */

/**
 * Enriched blob metadata with detection results
 * Call this when uploading a document to Azure Blob Storage
 * @param {Buffer} fileBuffer - File content
 * @param {string} fileName - Original filename
 * @param {string} mimeType - MIME type of file
 * @param {string|null} userOverride - Optional user-provided document type override
 * @returns {Promise<DocumentMetadata>} Enhanced metadata object
 */
export async function enrichDocumentMetadata(fileBuffer, fileName, mimeType, userOverride = null) {
  try {
    // Convert buffer to string for content analysis (first 2000 chars)
    let content = null;
    if (fileBuffer && fileBuffer.length > 0) {
      try {
        // Try UTF-8 decoding for text content (will fail gracefully for binary)
        content = fileBuffer.toString('utf-8', 0, Math.min(2000, fileBuffer.length));
      } catch (e) {
        // Binary file - only use filename for detection
        content = null;
      }
    }

    // If user provided override, use it instead of auto-detection
    if (userOverride) {
      return {
        originalName: fileName,
        uploadDate: new Date().toISOString(),
        size: fileBuffer.length,
        documentType: userOverride,
        confidence: 'high', // User selection is always high confidence
        priority: getPriority(userOverride),
        sourceCategory: getSourceCategory(userOverride),
        isPrimaryContent: isPrimary(userOverride),
        retrievalWeight: getRetrievalWeight(userOverride),
        detectionMethod: 'user_override',
        analysis: `User-provided document type: ${userOverride}`
      };
    }

    // Auto-detect document type
    const detectionResult = await detectDocumentMetadata(fileName, content);

    // Build enhanced metadata
    const metadata = {
      originalName: fileName,
      uploadDate: new Date().toISOString(),
      size: fileBuffer.length,
      documentType: detectionResult.type,
      confidence: detectionResult.confidence,
      priority: getPriority(detectionResult.type),
      sourceCategory: getSourceCategory(detectionResult.type),
      isPrimaryContent: isPrimary(detectionResult.type),
      retrievalWeight: getRetrievalWeight(detectionResult.type),
      detectionMethod: detectionResult.method,
      analysis: detectionResult.analysis
    };

    console.log(`✅ Metadata enriched for ${fileName}:`, {
      type: metadata.documentType,
      confidence: metadata.confidence,
      priority: metadata.priority,
      method: metadata.detectionMethod
    });

    return metadata;
  } catch (error) {
    console.error('❌ Error enriching metadata:', error.message);
    throw new Error(`Metadata enrichment failed: ${error.message}`);
  }
}

/**
 * Get priority level for document type
 */
function getPriority(documentType) {
  const priorityMap = {
    'rfi_response': 'CRITICAL',
    'briefing_deck': 'HIGH',
    'welcome_pack': 'HIGH',
    'exemplar_submission': 'MEDIUM',
    'fact_source': 'HIGH',
    'secondary_context': 'LOW',
    'unknown': 'LOW'
  };
  return priorityMap[documentType] || 'LOW';
}

/**
 * Get source category for document type
 */
function getSourceCategory(documentType) {
  const categoryMap = {
    'rfi_response': 'fact_sources',
    'briefing_deck': 'primary_signposts',
    'welcome_pack': 'primary_signposts',
    'exemplar_submission': 'primary_signposts',
    'fact_source': 'fact_sources',
    'secondary_context': 'secondary_context',
    'unknown': 'secondary_context'
  };
  return categoryMap[documentType] || 'secondary_context';
}

/**
 * Determine if document is primary content (critical for generation)
 */
function isPrimary(documentType) {
  const primaryTypes = ['rfi_response', 'fact_source'];
  return primaryTypes.includes(documentType);
}

/**
 * Get retrieval weight for Azure Search (affects ranking)
 */
function getRetrievalWeight(documentType) {
  const weightMap = {
    'rfi_response': 1.5,    // Highest priority
    'fact_source': 1.2,     // High priority
    'briefing_deck': 1.0,   // Normal
    'welcome_pack': 1.0,    // Normal
    'exemplar_submission': 1.0,  // Normal
    'secondary_context': 0.8,    // Lower priority
    'unknown': 0.5          // Lowest priority
  };
  return weightMap[documentType] || 1.0;
}

/**
 * Format metadata for Azure Search indexing
 * Converts DocumentMetadata to Azure Search document format
 * @param {DocumentMetadata} metadata - Enriched metadata
 * @param {string} blobName - Azure Blob Storage blob name
 * @param {string} content - Extracted document content (first N chars)
 * @returns {Object} Azure Search document
 */
export function formatForAzureSearch(metadata, blobName, content = '') {
  return {
    id: blobName.replace(/[^a-zA-Z0-9_-]/g, '_'),  // Valid Azure Search ID
    fileName: metadata.originalName,
    blobName: blobName,
    documentType: metadata.documentType,
    priority: metadata.priority,
    sourceCategory: metadata.sourceCategory,
    isPrimaryContent: metadata.isPrimaryContent,
    retrievalWeight: metadata.retrievalWeight,
    confidence: metadata.confidence,
    uploadDate: metadata.uploadDate,
    fileSize: metadata.size,
    content: content || '', // First N chars of document content
    metadata_originalName: metadata.originalName,
    metadata_uploadDate: metadata.uploadDate,
    metadata_detectionMethod: metadata.detectionMethod
  };
}

/**
 * Get Azure Search index schema for metadata
 * Returns field definitions for createIndex operation
 * @returns {Object} Field definitions
 */
export function getAzureSearchFields() {
  return [
    {
      name: 'id',
      type: 'Edm.String',
      key: true,
      searchable: false
    },
    {
      name: 'fileName',
      type: 'Edm.String',
      searchable: true,
      filterable: true
    },
    {
      name: 'blobName',
      type: 'Edm.String',
      searchable: false,
      filterable: true
    },
    {
      name: 'documentType',
      type: 'Edm.String',
      searchable: false,
      filterable: true,
      facetable: true
    },
    {
      name: 'priority',
      type: 'Edm.String',
      searchable: false,
      filterable: true,
      facetable: true
    },
    {
      name: 'sourceCategory',
      type: 'Edm.String',
      searchable: false,
      filterable: true,
      facetable: true
    },
    {
      name: 'isPrimaryContent',
      type: 'Edm.Boolean',
      searchable: false,
      filterable: true,
      facetable: true
    },
    {
      name: 'retrievalWeight',
      type: 'Edm.Double',
      searchable: false,
      filterable: true,
      sortable: true
    },
    {
      name: 'confidence',
      type: 'Edm.String',
      searchable: false,
      filterable: true,
      facetable: true
    },
    {
      name: 'uploadDate',
      type: 'Edm.DateTimeOffset',
      searchable: false,
      filterable: true,
      sortable: true
    },
    {
      name: 'fileSize',
      type: 'Edm.Int64',
      searchable: false,
      filterable: true,
      sortable: true
    },
    {
      name: 'content',
      type: 'Edm.String',
      searchable: true
    },
    {
      name: 'metadata_originalName',
      type: 'Edm.String',
      searchable: false,
      filterable: false
    },
    {
      name: 'metadata_uploadDate',
      type: 'Edm.String',
      searchable: false,
      filterable: false
    },
    {
      name: 'metadata_detectionMethod',
      type: 'Edm.String',
      searchable: false,
      filterable: false
    }
  ];
}

/**
 * Build OData filter expression for metadata-aware retrieval
 * @param {Object} options - Filter options
 * @param {string} options.sourceCategory - 'fact_sources', 'primary_signposts', or 'secondary_context'
 * @param {string} options.priority - 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
 * @param {boolean} options.primaryOnly - Only fetch primary content
 * @returns {string} OData filter expression
 */
export function buildMetadataFilter(options) {
  const filters = [];

  if (options.sourceCategory) {
    filters.push(`sourceCategory eq '${options.sourceCategory}'`);
  }

  if (options.priority) {
    // Handle priority levels - include this and higher
    const priorityOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const priorityIndex = priorityOrder.indexOf(options.priority);
    if (priorityIndex >= 0) {
      const includePriorities = priorityOrder.slice(priorityIndex);
      filters.push(`(${includePriorities.map(p => `priority eq '${p}'`).join(' or ')})`);
    }
  }

  if (options.primaryOnly === true) {
    filters.push('isPrimaryContent eq true');
  }

  return filters.length > 0 ? filters.join(' and ') : null;
}

/**
 * Format retrieval results with metadata context
 * Adds source attribution and confidence info to retrieved content
 * @param {Array} searchResults - Results from Azure Search
 * @returns {Array} Formatted results with metadata
 */
export function formatRetrievalResults(searchResults) {
  if (!searchResults || !Array.isArray(searchResults)) {
    return [];
  }

  return searchResults.map(result => ({
    content: result.content || '',
    source: result.fileName,
    documentType: result.documentType,
    priority: result.priority,
    confidence: result.confidence,
    score: result['@search.score'],
    uploadDate: result.uploadDate,
    isPrimary: result.isPrimaryContent,
    retrievalWeight: result.retrievalWeight,
    analysis: `Source: ${result.fileName} (${result.documentType}, ${result.confidence} confidence, ${result.priority} priority)`
  }));
}

export default {
  enrichDocumentMetadata,
  formatForAzureSearch,
  getAzureSearchFields,
  buildMetadataFilter,
  formatRetrievalResults
};
