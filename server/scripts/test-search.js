/**
 * Test Azure AI Search Integration
 * Quick test to verify search is working
 */

import { searchDocuments, isSearchAvailable } from '../services/azureSearchService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('🧪 Testing Azure AI Search Integration\n');
console.log('═══════════════════════════════════════════════════════════\n');

// Check configuration
console.log('📋 Configuration Check:');
console.log('  AZURE_SEARCH_ENDPOINT:', process.env.AZURE_SEARCH_ENDPOINT || '❌ NOT SET');
console.log('  AZURE_SEARCH_API_KEY:', process.env.AZURE_SEARCH_API_KEY ? '✅ SET' : '❌ NOT SET');
console.log('  AZURE_OPENAI_ENDPOINT:', process.env.AZURE_OPENAI_ENDPOINT ? '✅ SET' : '❌ NOT SET');
console.log('  AZURE_OPENAI_API_KEY:', process.env.AZURE_OPENAI_API_KEY ? '✅ SET' : '❌ NOT SET');
console.log('');

const searchAvailable = isSearchAvailable();
console.log('🔍 Search Status:', searchAvailable ? '✅ AVAILABLE' : '❌ NOT CONFIGURED');
console.log('');

if (!searchAvailable) {
  console.log('⚠️  Azure Search is not configured');
  console.log('');
  console.log('To set up Azure Search:');
  console.log('  1. Read: docs/AZURE-FOUNDRY-SETUP.md');
  console.log('  2. Create Azure AI Search resource in Azure Portal');
  console.log('  3. Add AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY to .env');
  console.log('  4. Run: node scripts/create-search-index.js');
  console.log('');
  console.log('Your application will fall back to blob storage chunking (existing behavior)');
  process.exit(0);
}

console.log('═══════════════════════════════════════════════════════════\n');
console.log('🚀 Running search test...\n');

async function testSearch() {
  try {
    const testQuery = 'IBM Consulting Dynamics 365 implementation approach';
    console.log(`Query: "${testQuery}"`);
    console.log('');
    
    const results = await searchDocuments(testQuery, 3);
    
    if (results) {
      console.log('\n✅ Search successful!');
      console.log('\nResults preview:');
      console.log(results.substring(0, 500) + '...');
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('✅ Azure AI Search is working correctly!');
      console.log('Your RFI Helper will now use AI Search for better retrieval quality');
    } else {
      console.log('\n⚠️  Search returned no results');
      console.log('This might mean:');
      console.log('  - Index is empty (no documents indexed yet)');
      console.log('  - Run: node scripts/index-existing-documents.js');
      console.log('  - Or upload documents through the UI');
    }
    
  } catch (error) {
    console.error('\n❌ Search test failed');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    
    if (error.message.includes('404')) {
      console.error('\n💡 Index may not exist. Run: node scripts/create-search-index.js');
    }
  }
}

testSearch();
