/**
 * Test search for Gartner Q&A content
 */

import { searchDocuments } from '../services/azureSearchService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testGartnerSearch() {
  console.log('🔍 Testing Gartner Q&A Search\n');
  console.log('═'.repeat(70));
  
  const queries = [
    'How many FTEs does IBM have for cloud ERP services?',
    'What is IBM\'s approach to customer experience?',
    'What are IBM\'s innovation strategies for cloud ERP?',
    'IBM geographic strategy and market coverage'
  ];
  
  for (const query of queries) {
    console.log(`\n\nQuery: "${query}"\n`);
    console.log('─'.repeat(70));
    
    try {
      const results = await searchDocuments(query, 3);
      
      if (results && results.length > 0) {
        console.log(`✅ Found ${results.length} relevant results:\n`);
        
        results.forEach((result, idx) => {
          console.log(`${idx + 1}. ${result.title || 'Untitled'}`);
          console.log(`   Source: ${result.fileName}`);
          console.log(`   Preview: ${result.content.substring(0, 200).replace(/\n/g, ' ')}...`);
          console.log('');
        });
      } else {
        console.log('❌ No results found');
      }
    } catch (error) {
      console.log(`❌ Search error: ${error.message}`);
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('✅ Gartner search test complete!');
}

testGartnerSearch().catch(console.error);
