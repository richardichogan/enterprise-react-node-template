/**
 * IBM ICA API Connection Test
 * Tests basic connectivity and available endpoints
 */

// Read from .env file
const fs = require('fs');
const path = require('path');

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

console.log('🔍 Testing IBM ICA API Connection...\n');
console.log('API Base URL:', API_BASE);
console.log('Token configured:', SERVICE_TOKEN ? '✓ Yes' : '✗ No');
console.log('Token format:', SERVICE_TOKEN ? `${SERVICE_TOKEN.substring(0, 8)}...` : 'N/A');
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
      const data = await response.json();
      console.log('   ✅ Success!');
      console.log('   Response:', JSON.stringify(data, null, 2).split('\n').slice(0, 5).join('\n'));
      return { success: true, status, data };
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Failed: ${errorText.substring(0, 200)}`);
      return { success: false, status, error: errorText };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Test 1: Get Models
  console.log('\n📋 TEST 1: Get Available Models');
  const modelsTest = await testEndpoint('GET', '/apis/v3/models/');
  results.tests.push({ name: 'Get Models', ...modelsTest });
  if (modelsTest.success) results.passed++; else results.failed++;
  
  // Test 2: Get Assistants
  console.log('\n📋 TEST 2: Get Available Assistants');
  const assistantsTest = await testEndpoint('GET', '/apis/v3/assistants');
  results.tests.push({ name: 'Get Assistants', ...assistantsTest });
  if (assistantsTest.success) results.passed++; else results.failed++;
  
  // Test 3: Chat Completion (simple test)
  console.log('\n📋 TEST 3: Chat Completion API');
  const chatTest = await testEndpoint('POST', '/apis/v3/chat/completions', {
    messages: [
      { role: 'user', content: 'Say "Hello from IBM ICA!" and nothing else.' }
    ],
    max_tokens: 50
  });
  results.tests.push({ name: 'Chat Completion', ...chatTest });
  if (chatTest.success) results.passed++; else results.failed++;
  
  // Test 4: Get Sidekick AI Models
  console.log('\n📋 TEST 4: Get Sidekick AI Models');
  const sidekickModelsTest = await testEndpoint('GET', '/apis/v1/sidekick-ai/getModels');
  results.tests.push({ name: 'Sidekick AI Models', ...sidekickModelsTest });
  if (sidekickModelsTest.success) results.passed++; else results.failed++;
  
  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total:  ${results.tests.length}`);
  
  if (results.passed === results.tests.length) {
    console.log('\n🎉 All tests passed! IBM ICA API is working correctly.');
    console.log('✅ You can proceed with integrating IBM ICA into RFI-Helper.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    console.log('Common issues:');
    console.log('  • Token may be invalid or expired');
    console.log('  • Token may not have the required scope');
    console.log('  • Some endpoints may not be available to your team');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

runTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
