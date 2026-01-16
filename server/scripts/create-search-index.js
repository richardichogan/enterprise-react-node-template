/**
 * Create Azure AI Search Index
 * Run this after creating your Azure AI Search resource
 */

import { SearchIndexClient, AzureKeyCredential } from '@azure/search-documents';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const SEARCH_ENDPOINT = process.env.AZURE_SEARCH_ENDPOINT;
const SEARCH_API_KEY = process.env.AZURE_SEARCH_API_KEY;
const INDEX_NAME = process.env.AZURE_SEARCH_INDEX_NAME || 'rfi-documents';

if (!SEARCH_ENDPOINT || !SEARCH_API_KEY) {
  console.error('❌ Missing Azure Search configuration');
  console.error('Please set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY in .env file');
  console.error('See docs/AZURE-FOUNDRY-SETUP.md for instructions');
  process.exit(1);
}

console.log('🔧 Creating Azure AI Search index...\n');
console.log('Endpoint:', SEARCH_ENDPOINT);
console.log('Index Name:', INDEX_NAME);
console.log('');

const indexClient = new SearchIndexClient(
  SEARCH_ENDPOINT,
  new AzureKeyCredential(SEARCH_API_KEY)
);

const indexDefinition = {
  name: INDEX_NAME,
  fields: [
    {
      name: 'id',
      type: 'Edm.String',
      key: true,
      searchable: false,
      filterable: true
    },
    {
      name: 'content',
      type: 'Edm.String',
      searchable: true,
      filterable: false,
      sortable: false,
      facetable: false
    },
    {
      name: 'contentVector',
      type: 'Collection(Edm.Single)',
      searchable: true,
      vectorSearchDimensions: 1536,
      vectorSearchProfileName: 'vector-profile'
    },
    {
      name: 'fileName',
      type: 'Edm.String',
      searchable: true,
      filterable: true,
      sortable: true,
      facetable: true
    },
    {
      name: 'title',
      type: 'Edm.String',
      searchable: true,
      filterable: false,
      sortable: false,
      facetable: false
    },
    {
      name: 'pageNumber',
      type: 'Edm.Int32',
      searchable: false,
      filterable: true,
      sortable: true,
      facetable: true
    },
    {
      name: 'indexedAt',
      type: 'Edm.DateTimeOffset',
      searchable: false,
      filterable: true,
      sortable: true,
      facetable: false
    }
  ],
  vectorSearch: {
    algorithms: [
      {
        name: 'hnsw-config',
        kind: 'hnsw',
        hnswParameters: {
          metric: 'cosine',
          m: 4,
          efConstruction: 400,
          efSearch: 500
        }
      }
    ],
    profiles: [
      {
        name: 'vector-profile',
        algorithmConfigurationName: 'hnsw-config'
      }
    ]
  }
};

async function createIndex() {
  try {
    console.log('📋 Creating index schema...');
    
    const result = await indexClient.createOrUpdateIndex(indexDefinition);
    
    console.log('\n✅ Index created successfully!');
    console.log('');
    console.log('Index details:');
    console.log('  Name:', result.name);
    console.log('  Fields:', result.fields.length);
    console.log('  Vector search enabled: YES');
    console.log('');
    console.log('🎉 Your search index is ready!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run: node scripts/index-existing-documents.js');
    console.log('     (to index documents already in blob storage)');
    console.log('  2. Or just upload new documents - they will auto-index');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Failed to create index');
    console.error('Error:', error.message);
    
    if (error.statusCode === 401) {
      console.error('\n💡 Check that your AZURE_SEARCH_API_KEY is correct');
    } else if (error.statusCode === 404) {
      console.error('\n💡 Check that your AZURE_SEARCH_ENDPOINT is correct');
    }
    
    process.exit(1);
  }
}

createIndex();
