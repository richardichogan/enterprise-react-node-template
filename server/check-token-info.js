/**
 * Quick check of what the token can access
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const API_BASE = process.env.IBM_ICA_API_URL || 'https://servicesessentials.ibm.com';
const TOKEN = process.env.IBM_ICA_ROO_TOKEN || process.env.IBM_ICA_SERVICE_TOKEN;
const EXTENSION_APP_ID = process.env.IBM_ICA_API;

console.log('🔍 Checking ICA Token Information\n');
console.log('Token:', TOKEN ? TOKEN.substring(0, 30) + '...' : 'MISSING');
console.log('Extension App ID:', EXTENSION_APP_ID);
console.log('\n' + '='.repeat(70) + '\n');

// The token format is: 7:xxx:userId:apiKey:pluginId
// Let's parse it to understand what we have
const tokenParts = TOKEN.split(':');
console.log('📋 Token Structure Analysis:');
console.log('  Format version:', tokenParts[0]);
console.log('  Marker:', tokenParts[1]);
console.log('  User ID:', tokenParts[2]);
console.log('  API Key:', tokenParts[3]);
console.log('  Plugin/Extension ID:', tokenParts[4]);
console.log('\n' + '='.repeat(70) + '\n');

// Based on OpenAPI spec, let's try some basic endpoints
async function testEndpoint(method, path, headers = {}) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'x-security-key': TOKEN,
        'x-extension-app-id': EXTENSION_APP_ID,
        ...headers
      }
    });
    
    const contentType = response.headers.get('content-type');
    let body = '';
    
    if (contentType && contentType.includes('application/json')) {
      body = JSON.stringify(await response.json(), null, 2);
    } else {
      body = await response.text();
    }
    
    return {
      status: response.status,
      statusText: response.statusText,
      body: body.substring(0, 1000)
    };
  } catch (error) {
    return {
      status: 'ERROR',
      statusText: error.message,
      body: ''
    };
  }
}

console.log('Testing endpoints that might show features/permissions:\n');

// Test a few key endpoints
const tests = [
  { method: 'GET', path: '/apis/v3/assistants', desc: 'List available assistants' },
  { method: 'GET', path: '/apis/v1/sidekick-ai', desc: 'Sidekick AI info' },
  { method: 'GET', path: '/apis/v1/collections', desc: 'Document collections' },
];

for (const test of tests) {
  console.log(`\n📤 ${test.method} ${test.path}`);
  console.log(`   (${test.desc})`);
  const result = await testEndpoint(test.method, test.path);
  console.log(`   Status: ${result.status} ${result.statusText}`);
  if (result.body) {
    console.log(`   Response:\n${result.body.split('\n').map(l => '     ' + l).join('\n')}`);
  }
  await new Promise(r => setTimeout(r, 500));
}

console.log('\n' + '='.repeat(70));
console.log('\n💡 Recommendation: Ask your colleague:');
console.log('   1. What features/scopes are enabled for API key:', tokenParts[3]);
console.log('   2. What permissions does Plugin ID', tokenParts[4], 'have?');
console.log('   3. Is there an admin console where you can view enabled features?');
console.log('\n' + '='.repeat(70) + '\n');
