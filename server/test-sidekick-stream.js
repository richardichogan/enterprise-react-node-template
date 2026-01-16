/**
 * Test script for ICA Sidekick AI executePromptStream endpoint
 * Tests document collection search using the streaming endpoint
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const API_BASE = process.env.IBM_ICA_API_URL || 'https://servicesessentials.ibm.com';
const SERVICE_TOKEN = process.env.IBM_ICA_SERVICE_TOKEN;
const ROO_TOKEN = process.env.IBM_ICA_ROO_TOKEN;
const COLLECTION_ID = process.env.IBM_ICA_COLLECTION_ID;
const COLLECTION_NAME = process.env.IBM_ICA_COLLECTION_NAME;
const EXTENSION_APP_ID = process.env.IBM_ICA_API;

console.log('🧪 Testing ICA Sidekick AI executePromptStream endpoint\n');
console.log('Configuration:');
console.log('  API_BASE:', API_BASE);
console.log('  SERVICE_TOKEN:', SERVICE_TOKEN ? `${SERVICE_TOKEN.substring(0, 20)}...` : 'MISSING');
console.log('  ROO_TOKEN:', ROO_TOKEN ? `${ROO_TOKEN.substring(0, 20)}...` : 'MISSING');
console.log('  COLLECTION_ID:', COLLECTION_ID || 'MISSING');
console.log('  COLLECTION_NAME:', COLLECTION_NAME || 'MISSING');
console.log('  EXTENSION_APP_ID:', EXTENSION_APP_ID || 'MISSING');
console.log('');

async function testExecutePromptStream() {
  try {
    console.log('📤 Testing: POST /apis/v1/sidekick-ai/executePromptStream');
    console.log('');
    
    const testQuery = 'What is IBM Consulting\'s approach to Dynamics 365 implementations?';
    console.log(`🔍 Query: ${testQuery}`);
    console.log('');
    
    const requestBody = {
      prompt: testQuery,
      collectionId: COLLECTION_ID,
      model: 'global/gpt-4o'
    };
    
    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));
    console.log('');
    
    // Try with ROO_TOKEN first, fallback to SERVICE_TOKEN
    const token = ROO_TOKEN || SERVICE_TOKEN;
    console.log('🔑 Using token:', token ? token.substring(0, 20) + '...' : 'NONE');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-security-key': token,  // Required by Sidekick AI endpoint
      'x-extension-app-id': EXTENSION_APP_ID  // Required application ID
    };
    
    console.log('📋 Request headers:', JSON.stringify({
      'Authorization': headers['Authorization'].substring(0, 30) + '...',
      'Content-Type': headers['Content-Type'],
      'x-security-key': headers['x-security-key'] ? headers['x-security-key'].substring(0, 20) + '...' : undefined,
      'x-extension-app-id': headers['x-extension-app-id']
    }, null, 2));
    console.log('');
    
    const response = await fetch(`${API_BASE}/apis/v1/sidekick-ai/executePromptStream`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    console.log('📋 Response headers:');
    response.headers.forEach((value, key) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log('');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response body:', errorText);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }
    
    // Parse streaming response
    console.log('📖 Reading stream...');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    let chunkCount = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      result += chunk;
      chunkCount++;
      
      // Show progress
      if (chunkCount % 10 === 0) {
        process.stdout.write('.');
      }
    }
    console.log('');
    
    console.log('');
    console.log('✅ Stream completed successfully');
    console.log(`📊 Chunks received: ${chunkCount}`);
    console.log(`📏 Total length: ${result.length} characters`);
    console.log('');
    console.log('📄 Response preview (first 500 chars):');
    console.log('─'.repeat(80));
    console.log(result.substring(0, 500) + (result.length > 500 ? '...' : ''));
    console.log('─'.repeat(80));
    console.log('');
    
    if (result.length > 500) {
      console.log('📄 Response preview (last 200 chars):');
      console.log('─'.repeat(80));
      console.log('...' + result.substring(result.length - 200));
      console.log('─'.repeat(80));
    }
    
    return { success: true, result, chunkCount };
    
  } catch (error) {
    console.error('');
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

// Run the test
console.log('🚀 Starting test...');
console.log('═'.repeat(80));
console.log('');

testExecutePromptStream().then(result => {
  console.log('');
  console.log('═'.repeat(80));
  console.log('🏁 Test Summary:');
  console.log(`   Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  if (result.success) {
    console.log(`   Chunks: ${result.chunkCount}`);
    console.log(`   Length: ${result.result?.length || 0} characters`);
  } else {
    console.log(`   Error: ${result.error}`);
  }
  console.log('═'.repeat(80));
  
  process.exit(result.success ? 0 : 1);
});
