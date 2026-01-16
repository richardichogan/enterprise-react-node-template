/**
 * Azure AI Search Service
 * Provides vector search and hybrid retrieval for document context
 */

import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Azure AI Search configuration
const SEARCH_ENDPOINT = process.env.AZURE_SEARCH_ENDPOINT;
const SEARCH_API_KEY = process.env.AZURE_SEARCH_API_KEY;
const SEARCH_INDEX_NAME = process.env.AZURE_SEARCH_INDEX_NAME || 'rfi-documents';

// Azure OpenAI configuration for embeddings
const OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
const EMBEDDING_DEPLOYMENT = process.env.AZURE_EMBEDDING_DEPLOYMENT || 'text-embedding-ada-002';

console.log('🔧 Azure Search Service initialized');
console.log('🔍 SEARCH_ENDPOINT:', SEARCH_ENDPOINT || 'NOT CONFIGURED');
console.log('📊 SEARCH_INDEX_NAME:', SEARCH_INDEX_NAME);
console.log('🤖 OPENAI_ENDPOINT:', OPENAI_ENDPOINT?.substring(0, 50) + '...' || 'NOT CONFIGURED');

let searchClient;

// Initialize clients
function initializeClients() {
  if (!SEARCH_ENDPOINT || !SEARCH_API_KEY) {
    console.warn('⚠️ Azure Search not configured, search functionality will be limited');
    return false;
  }

  try {
    searchClient = new SearchClient(
      SEARCH_ENDPOINT,
      SEARCH_INDEX_NAME,
      new AzureKeyCredential(SEARCH_API_KEY)
    );

    console.log('✅ Azure Search clients initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Azure Search clients:', error.message);
    return false;
  }
}

/**
 * Generate embeddings for text using Azure OpenAI (native fetch)
 */
async function generateEmbedding(text) {
  try {
    const response = await fetch(
      `${OPENAI_ENDPOINT}/openai/deployments/${EMBEDDING_DEPLOYMENT}/embeddings?api-version=${OPENAI_API_VERSION}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': OPENAI_API_KEY
        },
        body: JSON.stringify({
          input: text
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding API error: ${error}`);
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('❌ Embedding generation error:', error.message);
    throw error;
  }
}

/**
 * Search documents using hybrid search (vector + keyword)
 * @param {string} query - User's search query
 * @param {number} topK - Number of results to return
 * @returns {Promise<string>} - Combined context from search results
 */
export async function searchDocuments(query, topK = 5) {
  const isInitialized = searchClient || initializeClients();
  
  if (!isInitialized) {
    console.warn('⚠️ Azure Search not available, falling back to blob storage');
    return null;
  }

  try {
    console.log(`🔍 Searching Azure AI Search for: "${query.substring(0, 100)}..."`);
    
    // Generate query embedding for vector search
    const queryVector = await generateEmbedding(query);
    
    // Perform hybrid search (vector + keyword)
    const searchResults = await searchClient.search(query, {
      vectorSearchOptions: {
        queries: [
          {
            kind: 'vector',
            vector: queryVector,
            kNearestNeighborsCount: topK,
            fields: ['contentVector']
          }
        ]
      },
      select: ['content', 'title', 'fileName', 'pageNumber'],
      top: topK,
      includeTotalCount: true
    });

    // Collect results
    const results = [];
    
    // Ensure searchResults.results exists and is iterable
    if (!searchResults || !searchResults.results) {
      console.warn('⚠️ Search returned no results object');
      return null;
    }
    
    for await (const result of searchResults.results) {
      results.push({
        content: result.document.content,
        title: result.document.title || result.document.fileName,
        fileName: result.document.fileName,
        pageNumber: result.document.pageNumber,
        score: result.score
      });
    }

    if (results.length === 0) {
      console.warn('⚠️ No search results found');
      return null;
    }

    console.log(`✅ Found ${results.length} relevant document chunks`);
    
    // Combine results into context
    const context = results
      .map((r, i) => {
        const source = r.fileName ? `[${r.fileName}${r.pageNumber ? ` - Page ${r.pageNumber}` : ''}]` : '[Document]';
        return `${source}\n${r.content}`;
      })
      .join('\n\n---\n\n');

    console.log(`📝 Retrieved ${context.length} characters of context`);
    
    return context;

  } catch (error) {
    console.error('❌ Azure Search error:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

/**
 * Index a document in Azure AI Search
 * @param {Object} document - Document to index
 * @param {string} document.id - Unique document ID
 * @param {string} document.content - Document content
 * @param {string} document.fileName - Original file name
 * @param {string} document.title - Document title
 * @param {number} document.pageNumber - Page number (for PDFs)
 */
export async function indexDocument(document) {
  const isInitialized = searchClient || initializeClients();
  
  if (!isInitialized) {
    console.warn('⚠️ Azure Search not available, skipping indexing');
    return false;
  }

  try {
    console.log(`📥 Indexing document: ${document.fileName}`);
    
    // Generate embedding for content
    const contentVector = await generateEmbedding(document.content);
    
    // Upload document to search index
    const indexDoc = {
      id: document.id,
      content: document.content,
      contentVector: contentVector,
      fileName: document.fileName,
      title: document.title || document.fileName,
      pageNumber: document.pageNumber || null,
      indexedAt: new Date().toISOString()
    };

    const result = await searchClient.uploadDocuments([indexDoc]);
    
    if (result.results[0].succeeded) {
      console.log(`✅ Successfully indexed: ${document.fileName}`);
      return true;
    } else {
      console.error(`❌ Failed to index: ${document.fileName}`, result.results[0].errorMessage);
      return false;
    }

  } catch (error) {
    console.error('❌ Indexing error:', error.message);
    return false;
  }
}

/**
 * Check if Azure Search is configured and ready
 */
export function isSearchAvailable() {
  return !!(SEARCH_ENDPOINT && SEARCH_API_KEY && OPENAI_ENDPOINT && OPENAI_API_KEY);
}
