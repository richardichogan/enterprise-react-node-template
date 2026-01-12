/**
 * IBM ICA Document Collections Test
 * Tests vector stores (document collections) functionality
 */

const fs = require('fs');
const path = require('path');

// Read from .env file
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const API_BASE = envVars.IBM_ICA_API_URL || 'https://servicesessentials.ibm.com';
const SERVICE_TOKEN = envVars.IBM_ICA_SERVICE_TOKEN;

console.log('🔍 Testing IBM ICA Document Collections (Vector Stores)...\n');
console.log('API Base URL:', API_BASE);
console.log('Token format:', SERVICE_TOKEN ? `${SERVICE_TOKEN.substring(0, 10)}...` : 'N/A');
console.log('\n' + '='.repeat(60) + '\n');

async function testEndpoint(method, path, body = null) {
  const url = `${API_BASE}${path}`;
  console.log(`\n📡 Testing: ${method} ${path}`);
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${SERVICE_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const status = response.status;
    const statusText = response.statusText;
    
    console.log(`   Status: ${status} ${statusText}`);
    
    if (response.ok) {
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      console.log('   ✅ Success!');
      
      // Pretty print the full response for document collections
      if (typeof data === 'object') {
        console.log('   Response:', JSON.stringify(data, null, 2));
      } else {
        console.log('   Response:', data.substring(0, 500));
      }
      return { success: true, status, data };
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Failed: ${errorText.substring(0, 300)}`);
      return { success: false, status, error: errorText };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('📋 TEST 1: List Vector Stores (Document Collections)');
  const vectorStoresTest = await testEndpoint('GET', '/apis/v3/vector_stores');
  
  console.log('\n📋 TEST 2: List Files');
  const filesTest = await testEndpoint('GET', '/apis/v3/files');
  
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 DOCUMENT COLLECTIONS SUMMARY');
  console.log('='.repeat(60));
  
  if (vectorStoresTest.success && vectorStoresTest.data.data) {
    console.log(`\n✅ Found ${vectorStoresTest.data.data.length} document collection(s):`);
    vectorStoresTest.data.data.forEach((collection, idx) => {
      console.log(`\n${idx + 1}. ${collection.name || collection.id}`);
      console.log(`   ID: ${collection.id}`);
      console.log(`   File Count: ${collection.file_counts?.total || 'N/A'}`);
      console.log(`   Created: ${collection.created_at ? new Date(collection.created_at * 1000).toISOString() : 'N/A'}`);
    });
  }
  
  if (filesTest.success && filesTest.data.data) {
    console.log(`\n\n📄 Found ${filesTest.data.data.length} file(s):`);
    filesTest.data.data.forEach((file, idx) => {
      console.log(`\n${idx + 1}. ${file.filename}`);
      console.log(`   ID: ${file.id}`);
      console.log(`   Purpose: ${file.purpose}`);
      console.log(`   Size: ${(file.bytes / 1024).toFixed(2)} KB`);
    });
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

runTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
