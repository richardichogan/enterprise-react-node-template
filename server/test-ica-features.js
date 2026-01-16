/**
 * Test script to explore ICA API and discover available features/endpoints
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
const EXTENSION_APP_ID = process.env.IBM_ICA_API;

console.log('🔍 Exploring ICA API features and permissions\n');

// Endpoints to try (based on common API patterns)
const endpointsToTest = [
  { path: '/apis/v1/user', description: 'User profile' },
  { path: '/apis/v1/user/permissions', description: 'User permissions' },
  { path: '/apis/v1/user/features', description: 'User features' },
  { path: '/apis/v1/account', description: 'Account info' },
  { path: '/apis/v1/extensions', description: 'Extension apps' },
  { path: '/apis/v1/extensions/' + EXTENSION_APP_ID, description: 'Specific extension' },
  { path: '/apis/v1/token/validate', description: 'Token validation' },
  { path: '/apis/v1/token/scopes', description: 'Token scopes' },
  { path: '/apis/v3/assistants', description: 'Available assistants' },
  { path: '/apis/v1/sidekick-ai', description: 'Sidekick AI info' },
];

async function testEndpoint(path, description, token) {
  try {
    console.log(`\n📤 Testing: ${path}`);
    console.log(`   Description: ${description}`);
    
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-security-key': token,
        'x-extension-app-id': EXTENSION_APP_ID
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Response:', JSON.stringify(data, null, 2).substring(0, 500));
      return { path, status: response.status, success: true, data };
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Error: ${errorText.substring(0, 200)}`);
      return { path, status: response.status, success: false };
    }
  } catch (error) {
    console.log(`   ❌ Exception: ${error.message}`);
    return { path, status: 'error', success: false, error: error.message };
  }
}

async function exploreAPI() {
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const token = ROO_TOKEN || SERVICE_TOKEN;
  console.log('🔑 Using token:', token ? token.substring(0, 20) + '...' : 'NONE');
  console.log('🔑 Extension App ID:', EXTENSION_APP_ID);
  
  const results = [];
  
  for (const endpoint of endpointsToTest) {
    const result = await testEndpoint(endpoint.path, endpoint.description, token);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }
  
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    console.log(`✅ Successful endpoints (${successful.length}):`);
    successful.forEach(r => console.log(`   ${r.path} (${r.status})`));
  }
  
  console.log(`\n❌ Failed endpoints (${failed.length}):`);
  failed.forEach(r => console.log(`   ${r.path} (${r.status})`));
  
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

exploreAPI().catch(console.error);
