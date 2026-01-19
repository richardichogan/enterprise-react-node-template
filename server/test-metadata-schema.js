/**
 * Phase 2 Testing: Azure Search Metadata Schema
 * Tests metadata enrichment and Azure Search schema compatibility
 * Target: >90% accuracy in metadata assignment
 */

import {
  enrichDocumentMetadata,
  formatForAzureSearch,
  getAzureSearchFields,
  buildMetadataFilter,
  formatRetrievalResults
} from './services/metadataSchemaService.js';

const TEST_CASES = [
  // RFI Response cases
  {
    filename: 'IBM RFI Response 2026.docx',
    content: 'Question: What is your approach? Response: We provide...',
    userOverride: null,
    expectedType: 'rfi_response',
    expectedPriority: 'CRITICAL',
    expectedCategory: 'fact_sources',
    expectedPrimary: true,
    expectedWeight: 1.5,
    description: 'RFI Response with auto-detection'
  },
  {
    filename: 'document.pdf',
    content: null,
    userOverride: 'rfi_response',
    expectedType: 'rfi_response',
    expectedPriority: 'CRITICAL',
    expectedCategory: 'fact_sources',
    expectedPrimary: true,
    expectedWeight: 1.5,
    description: 'RFI Response with user override'
  },

  // Briefing Deck cases
  {
    filename: 'Gartner Briefing Deck.pptx',
    content: 'Agenda\nPart One: Vision',
    userOverride: null,
    expectedType: 'briefing_deck',
    expectedPriority: 'HIGH',
    expectedCategory: 'primary_signposts',
    expectedPrimary: false,
    expectedWeight: 1.0,
    description: 'Briefing Deck'
  },

  // Welcome Pack cases
  {
    filename: 'Welcome Pack.docx',
    content: 'Evaluation Criteria',
    userOverride: null,
    expectedType: 'welcome_pack',
    expectedPriority: 'HIGH',
    expectedCategory: 'primary_signposts',
    expectedPrimary: false,
    expectedWeight: 1.0,
    description: 'Welcome Pack'
  },

  // Case Study cases
  {
    filename: 'Case Study - Acme.pdf',
    content: 'Client: Acme. Challenge: Complex. Solution: Implemented.',
    userOverride: null,
    expectedType: 'fact_source',
    expectedPriority: 'HIGH',
    expectedCategory: 'fact_sources',
    expectedPrimary: true,
    expectedWeight: 1.2,
    description: 'Case Study (Fact Source)'
  },

  // Unknown cases
  {
    filename: 'document.txt',
    content: 'Lorem ipsum',
    userOverride: null,
    expectedType: 'unknown',
    expectedPriority: 'LOW',
    expectedCategory: 'secondary_context',
    expectedPrimary: false,
    expectedWeight: 0.5,
    description: 'Unknown document'
  }
];

const SCHEMA_TESTS = [
  {
    name: 'Schema fields are defined',
    test: () => {
      const fields = getAzureSearchFields();
      return Array.isArray(fields) && fields.length > 0;
    }
  },
  {
    name: 'Schema includes documentType field',
    test: () => {
      const fields = getAzureSearchFields();
      return fields.some(f => f.name === 'documentType');
    }
  },
  {
    name: 'Schema includes priority field',
    test: () => {
      const fields = getAzureSearchFields();
      return fields.some(f => f.name === 'priority');
    }
  },
  {
    name: 'Schema includes retrievalWeight field',
    test: () => {
      const fields = getAzureSearchFields();
      return fields.some(f => f.name === 'retrievalWeight');
    }
  },
  {
    name: 'documentType field is filterable',
    test: () => {
      const fields = getAzureSearchFields();
      const field = fields.find(f => f.name === 'documentType');
      return field && field.filterable === true;
    }
  },
  {
    name: 'priority field is facetable',
    test: () => {
      const fields = getAzureSearchFields();
      const field = fields.find(f => f.name === 'priority');
      return field && field.facetable === true;
    }
  }
];

const FILTER_TESTS = [
  {
    name: 'Build filter for fact_sources category',
    test: () => {
      const filter = buildMetadataFilter({ sourceCategory: 'fact_sources' });
      return filter === `sourceCategory eq 'fact_sources'`;
    }
  },
  {
    name: 'Build filter for HIGH priority and above',
    test: () => {
      const filter = buildMetadataFilter({ priority: 'HIGH' });
      return filter && filter.includes('HIGH') && filter.includes('CRITICAL');
    }
  },
  {
    name: 'Build filter for primary content only',
    test: () => {
      const filter = buildMetadataFilter({ primaryOnly: true });
      return filter === 'isPrimaryContent eq true';
    }
  },
  {
    name: 'Build combined filter',
    test: () => {
      const filter = buildMetadataFilter({
        sourceCategory: 'fact_sources',
        primaryOnly: true
      });
      return filter && filter.includes('sourceCategory') && filter.includes('isPrimaryContent');
    }
  }
];

async function runMetadataTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('PHASE 2 TESTING: Azure Search Metadata Schema');
  console.log('═══════════════════════════════════════════════════════════\n');

  let passedTests = 0;
  let failedTests = 0;
  const failures = [];

  console.log('### Enrichment Tests (Metadata Auto-Detection)\n');

  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    
    try {
      const fileBuffer = Buffer.from(testCase.content || '');
      const metadata = await enrichDocumentMetadata(
        fileBuffer,
        testCase.filename,
        'application/pdf',
        testCase.userOverride
      );

      const typeMatch = metadata.documentType === testCase.expectedType;
      const priorityMatch = metadata.priority === testCase.expectedPriority;
      const categoryMatch = metadata.sourceCategory === testCase.expectedCategory;
      const primaryMatch = metadata.isPrimaryContent === testCase.expectedPrimary;
      const weightMatch = metadata.retrievalWeight === testCase.expectedWeight;

      const testPassed = typeMatch && priorityMatch && categoryMatch && primaryMatch && weightMatch;
      const status = testPassed ? '✅ PASS' : '❌ FAIL';

      console.log(`${status} | Test ${i + 1}/${TEST_CASES.length}: ${testCase.description}`);

      if (testPassed) {
        passedTests++;
        console.log(`      Type: ${metadata.documentType}`);
        console.log(`      Priority: ${metadata.priority}`);
        console.log(`      Weight: ${metadata.retrievalWeight}`);
      } else {
        failedTests++;
        if (!typeMatch) console.log(`      ❌ Type: expected ${testCase.expectedType}, got ${metadata.documentType}`);
        if (!priorityMatch) console.log(`      ❌ Priority: expected ${testCase.expectedPriority}, got ${metadata.priority}`);
        if (!categoryMatch) console.log(`      ❌ Category: expected ${testCase.expectedCategory}, got ${metadata.sourceCategory}`);
        if (!primaryMatch) console.log(`      ❌ Primary: expected ${testCase.expectedPrimary}, got ${metadata.isPrimaryContent}`);
        if (!weightMatch) console.log(`      ❌ Weight: expected ${testCase.expectedWeight}, got ${metadata.retrievalWeight}`);
        
        failures.push({
          test: testCase.description,
          issues: {
            type: typeMatch,
            priority: priorityMatch,
            category: categoryMatch,
            primary: primaryMatch,
            weight: weightMatch
          }
        });
      }
      console.log();
    } catch (error) {
      failedTests++;
      console.log(`❌ CRASH | Test ${i + 1}/${TEST_CASES.length}: ${testCase.description}`);
      console.log(`      Error: ${error.message}`);
      console.log();
      failures.push({
        test: testCase.description,
        error: error.message
      });
    }
  }

  // Schema tests
  console.log('### Schema Definition Tests\n');
  let schemaPassedTests = 0;
  let schemaFailedTests = 0;

  for (const schemaTest of SCHEMA_TESTS) {
    try {
      const result = schemaTest.test();
      if (result) {
        console.log(`✅ PASS | ${schemaTest.name}`);
        schemaPassedTests++;
      } else {
        console.log(`❌ FAIL | ${schemaTest.name}`);
        schemaFailedTests++;
      }
    } catch (error) {
      console.log(`❌ ERROR | ${schemaTest.name}: ${error.message}`);
      schemaFailedTests++;
    }
  }
  console.log();

  // Filter tests
  console.log('### Filter Expression Tests\n');
  let filterPassedTests = 0;
  let filterFailedTests = 0;

  for (const filterTest of FILTER_TESTS) {
    try {
      const result = filterTest.test();
      if (result) {
        console.log(`✅ PASS | ${filterTest.name}`);
        filterPassedTests++;
      } else {
        console.log(`❌ FAIL | ${filterTest.name}`);
        filterFailedTests++;
      }
    } catch (error) {
      console.log(`❌ ERROR | ${filterTest.name}: ${error.message}`);
      filterFailedTests++;
    }
  }
  console.log();

  // Format tests
  console.log('### Format Conversion Tests\n');
  try {
    const sampleMetadata = {
      originalName: 'test.pdf',
      uploadDate: new Date().toISOString(),
      size: 1024,
      documentType: 'rfi_response',
      confidence: 'high',
      priority: 'CRITICAL',
      sourceCategory: 'fact_sources',
      isPrimaryContent: true,
      retrievalWeight: 1.5,
      detectionMethod: 'filename_pattern',
      analysis: 'test'
    };

    const azureSearchDoc = formatForAzureSearch(sampleMetadata, 'blob-2024-test.pdf', 'Sample content...');
    const hasRequiredFields = 
      azureSearchDoc.id &&
      azureSearchDoc.fileName &&
      azureSearchDoc.documentType &&
      azureSearchDoc.priority &&
      azureSearchDoc.retrievalWeight;

    if (hasRequiredFields) {
      console.log(`✅ PASS | Format for Azure Search works correctly`);
      filterPassedTests++;
    } else {
      console.log(`❌ FAIL | Format for Azure Search missing required fields`);
      filterFailedTests++;
    }
  } catch (error) {
    console.log(`❌ ERROR | Format for Azure Search: ${error.message}`);
    filterFailedTests++;
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Enrichment Tests:    ${passedTests}/${TEST_CASES.length} passed`);
  console.log(`Schema Tests:        ${schemaPassedTests}/${SCHEMA_TESTS.length} passed`);
  console.log(`Filter Tests:        ${filterPassedTests}/${FILTER_TESTS.length} passed`);

  const totalTests = TEST_CASES.length + SCHEMA_TESTS.length + FILTER_TESTS.length + 1;
  const totalPassed = passedTests + schemaPassedTests + filterPassedTests + (filterPassedTests > 0 ? 1 : 0);
  const passRate = ((totalPassed / totalTests) * 100).toFixed(1);
  
  console.log(`\n📊 Overall Pass Rate: ${passRate}% (target: >90%)\n`);

  if (failedTests > 0) {
    console.log('FAILED TESTS:');
    failures.forEach((f, idx) => {
      console.log(`\n${idx + 1}. ${f.test}`);
      if (f.error) {
        console.log(`   Error: ${f.error}`);
      } else {
        console.log(`   Issues:`, f.issues);
      }
    });
  }

  // Pass/Fail criteria
  console.log('\n═══════════════════════════════════════════════════════════');
  if (passRate >= 90) {
    console.log('✅ PHASE 2 PASSED - Ready to proceed to Phase 3');
    console.log('   Accuracy: ' + passRate + '% (target: >90%)');
  } else {
    console.log('❌ PHASE 2 FAILED - Needs fixes before Phase 3');
    console.log('   Accuracy: ' + passRate + '% (target: >90%)');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  return passRate >= 90;
}

// Run tests
runMetadataTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
