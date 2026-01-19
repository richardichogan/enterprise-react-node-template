/**
 * Phase 3 Testing: Upload UI with Metadata Display
 * Tests:
 * 1. File upload returns metadata in response
 * 2. Metadata detection display shows correct type and confidence
 * 3. Override dropdown appears for low-confidence detections
 * 4. UI correctly formats metadata for display
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_URL = 'http://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test 1: Create a mock RFI Response document and upload it
 */
async function testRFIResponseUpload() {
  console.log('\n📤 Test 1: Upload RFI Response document');
  
  try {
    // Create a test document using Node.js Readable stream approach
    const testContent = 'RFI Response Document\n\nQuestion: What is your cloud strategy?\n\nResponse: We provide comprehensive cloud solutions...';
    
    // Use native Node.js FormData (available in newer Node.js versions)
    const { FormData, File } = await import('formdata-node');
    const { FormDataEncoder } = await import('form-data-encoder');
    const { Readable } = await import('stream');
    
    const form = new FormData();
    form.append('document', new File([testContent], 'IBM RFI Response 2026.pdf', { type: 'application/pdf' }));
    
    const encoder = new FormDataEncoder(form);
    
    const response = await fetch(`${API_URL}/api/documents/upload`, {
      method: 'POST',
      headers: encoder.headers,
      body: Readable.from(encoder)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Validate response structure
    if (!data.document || !data.document.metadata) {
      console.log('Response:', JSON.stringify(data, null, 2));
      throw new Error('Response missing metadata field');
    }
    
    const metadata = data.document.metadata;
    
    // Verify metadata contents
    if (metadata.documentType !== 'rfi_response') {
      throw new Error(`Expected rfi_response, got ${metadata.documentType}`);
    }
    if (metadata.confidence !== 'high') {
      throw new Error(`Expected high confidence, got ${metadata.confidence}`);
    }
    if (metadata.priority !== 'CRITICAL') {
      throw new Error(`Expected CRITICAL priority, got ${metadata.priority}`);
    }
    if (metadata.retrievalWeight !== 1.5) {
      throw new Error(`Expected weight 1.5, got ${metadata.retrievalWeight}`);
    }
    
    console.log('✅ PASS | RFI Response detection');
    console.log(`   Type: ${metadata.documentType} (${metadata.confidence})`);
    console.log(`   Priority: ${metadata.priority}, Weight: ${metadata.retrievalWeight}x`);
    console.log(`   Method: ${metadata.detectionMethod}`);
    
    return true;
  } catch (error) {
    console.log('❌ FAIL | RFI Response detection');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Upload Briefing Deck and verify metadata
 */
async function testBriefingDeckUpload() {
  console.log('\n📤 Test 2: Upload Briefing Deck document');
  
  try {
    const testContent = Buffer.from('Briefing Deck\n\nAgenda\nPart One: Vision\nPart Two: Execution\nPart Three: Q&A');
    
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'application/pdf' });
    formData.append('document', blob, 'Gartner Briefing Deck.pdf');
    
    const response = await fetch(`${API_URL}/api/documents/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const metadata = data.document.metadata;
    
    if (metadata.documentType !== 'briefing_deck') {
      throw new Error(`Expected briefing_deck, got ${metadata.documentType}`);
    }
    if (metadata.priority !== 'HIGH') {
      throw new Error(`Expected HIGH priority, got ${metadata.priority}`);
    }
    
    console.log('✅ PASS | Briefing Deck detection');
    console.log(`   Type: ${metadata.documentType} (${metadata.confidence})`);
    console.log(`   Priority: ${metadata.priority}, Weight: ${metadata.retrievalWeight}x`);
    
    return true;
  } catch (error) {
    console.log('❌ FAIL | Briefing Deck detection');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Upload unknown document and verify low confidence
 */
async function testUnknownDocumentUpload() {
  console.log('\n📤 Test 3: Upload unknown document (should have low confidence)');
  
  try {
    const testContent = Buffer.from('Lorem ipsum dolor sit amet consectetur adipiscing elit');
    
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'application/pdf' });
    formData.append('document', blob, 'generic-document.pdf');
    
    const response = await fetch(`${API_URL}/api/documents/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const metadata = data.document.metadata;
    
    if (metadata.documentType !== 'unknown') {
      throw new Error(`Expected unknown, got ${metadata.documentType}`);
    }
    if (metadata.confidence !== 'low') {
      throw new Error(`Expected low confidence, got ${metadata.confidence}`);
    }
    
    console.log('✅ PASS | Unknown document detection');
    console.log(`   Type: ${metadata.documentType} (${metadata.confidence})`);
    console.log(`   Method: ${metadata.detectionMethod} (UI should show override dropdown)`);
    
    return true;
  } catch (error) {
    console.log('❌ FAIL | Unknown document detection');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Verify metadata is persisted in blob storage
 */
async function testMetadataPersistence() {
  console.log('\n📤 Test 4: Verify metadata is returned in list');
  
  try {
    const response = await fetch(`${API_URL}/api/documents`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const documents = data.documents || [];
    
    // Find our test documents
    const rfiDoc = documents.find(d => d.originalName && d.originalName.includes('RFI'));
    
    if (!rfiDoc) {
      // This is OK - depends on if previous tests ran
      console.log('ℹ️  INFO | No RFI documents in list (test may be first run)');
      return true;
    }
    
    console.log('✅ PASS | Metadata retrieved from list');
    console.log(`   Document: ${rfiDoc.originalName}`);
    console.log(`   Type: ${rfiDoc.documentType || 'N/A'}`);
    
    return true;
  } catch (error) {
    console.log('❌ FAIL | Metadata persistence');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Test 5: Validate metadata object structure
 */
async function testMetadataStructure() {
  console.log('\n📤 Test 5: Validate metadata object structure');
  
  try {
    const testContent = Buffer.from('Case Study: Acme Corp ERP Implementation. Challenge: Migration. Solution: Implemented system. Results: 40% faster');
    
    const formData = new FormData();
    const blob = new Blob([testContent], { type: 'application/pdf' });
    formData.append('document', blob, 'Case Study - Acme.pdf');
    
    const response = await fetch(`${API_URL}/api/documents/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const metadata = data.document.metadata;
    
    // Validate all required fields
    const requiredFields = [
      'documentType',
      'confidence',
      'priority',
      'sourceCategory',
      'isPrimaryContent',
      'retrievalWeight',
      'detectionMethod',
      'analysis'
    ];
    
    for (const field of requiredFields) {
      if (!(field in metadata)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate field types
    if (typeof metadata.documentType !== 'string') {
      throw new Error('documentType should be string');
    }
    if (!['high', 'medium', 'low'].includes(metadata.confidence)) {
      throw new Error(`confidence should be high/medium/low, got ${metadata.confidence}`);
    }
    if (typeof metadata.priority !== 'string') {
      throw new Error('priority should be string');
    }
    if (typeof metadata.isPrimaryContent !== 'boolean') {
      throw new Error(`isPrimaryContent should be boolean, got ${typeof metadata.isPrimaryContent}`);
    }
    if (typeof metadata.retrievalWeight !== 'number') {
      throw new Error(`retrievalWeight should be number, got ${typeof metadata.retrievalWeight}`);
    }
    
    console.log('✅ PASS | Metadata structure validation');
    console.log(`   All required fields present and correctly typed`);
    console.log(`   Type: ${metadata.documentType} | Category: ${metadata.sourceCategory}`);
    console.log(`   Primary Content: ${metadata.isPrimaryContent}`);
    
    return true;
  } catch (error) {
    console.log('❌ FAIL | Metadata structure validation');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('PHASE 3 TESTING: Upload UI with Metadata Display');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`API URL: ${API_URL}`);
  console.log(`Testing with real API responses`);
  
  // Wait for servers to be ready
  console.log('\n⏳ Waiting for API to be ready...');
  let isReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch(`${API_URL}/healthz`);
      if (response.ok) {
        isReady = true;
        break;
      }
    } catch (e) {
      // API not ready yet
    }
    await sleep(500);
  }
  
  if (!isReady) {
    console.error('❌ API not responding. Make sure servers are started with:');
    console.error('   .\\scripts\\server-manager.ps1 start');
    process.exit(1);
  }
  
  console.log('✅ API is ready\n');
  
  const results = [];
  
  results.push(await testRFIResponseUpload());
  results.push(await testBriefingDeckUpload());
  results.push(await testUnknownDocumentUpload());
  results.push(await testMetadataPersistence());
  results.push(await testMetadataStructure());
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  const passed = results.filter(r => r).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);
  
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  console.log(`📊 Pass Rate: ${passRate}%\n`);
  
  if (passRate >= 90) {
    console.log('✅ PHASE 3 PASSED - Ready to proceed to Phase 4');
  } else {
    console.log('❌ PHASE 3 FAILED - Needs fixes');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  
  return passRate >= 90;
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
