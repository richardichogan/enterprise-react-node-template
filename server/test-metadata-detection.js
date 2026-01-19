/**
 * Phase 1 Testing: Metadata Auto-Detection Service
 * Tests filename pattern matching + content analysis
 * Target: >90% accuracy across test cases
 */

import { detectDocumentMetadata, getAvailableMetadataTypes } from './services/metadataDetectionService.js';

const TEST_CASES = [
  // RFI Response test cases
  {
    filename: 'IBM RFI Response 2026.docx',
    content: 'Question: What is your approach to cloud ERP? Response: We provide comprehensive...',
    expectedType: 'rfi_response',
    expectedConfidence: 'high',
    description: 'RFI Response (high filename match)'
  },
  {
    filename: 'Vendor Response.pdf',
    content: 'Our approach to implementation includes methodology and support...',
    expectedType: 'rfi_response',
    expectedConfidence: 'high',
    description: 'Vendor Response (clear filename)'
  },
  {
    filename: '2026 Submission.docx',
    content: 'Question 1: Describe your capabilities. Answer: We have expertise in...',
    expectedType: 'rfi_response',
    expectedConfidence: 'high',
    description: '2026 Submission (RFI pattern)'
  },
  
  // Briefing Deck test cases
  {
    filename: 'Gartner Briefing Deck.pptx',
    content: 'Agenda\nPart One: Vision and Execution (15 minutes)\nPart Two: Case Studies (45 minutes)',
    expectedType: 'briefing_deck',
    expectedConfidence: 'high',
    description: 'Briefing Deck (clear pattern)'
  },
  {
    filename: 'Analyst Briefing Agenda.pdf',
    content: 'Structure and Agenda for presentation to Gartner analysts...',
    expectedType: 'briefing_deck',
    expectedConfidence: 'high',
    description: 'Briefing Agenda (high confidence match)'
  },
  
  // Welcome Pack test cases
  {
    filename: 'Welcome Pack.docx',
    content: 'Evaluation Criteria and Assessment Framework. Key Metrics: Ability to Execute, Completeness of Vision',
    expectedType: 'welcome_pack',
    expectedConfidence: 'high',
    description: 'Welcome Pack (clear pattern)'
  },
  {
    filename: 'Gartner Kick-off Guidelines.pdf',
    content: 'Welcome to the Gartner briefing. Evaluation dimensions include...',
    expectedType: 'welcome_pack',
    expectedConfidence: 'high',
    description: 'Kick-off Guidelines (alternate pattern)'
  },
  
  // Exemplar Submission test cases
  {
    filename: '2024 Briefing Submission.pptx',
    content: 'Title slide with company logo and brief overview...',
    expectedType: 'exemplar_submission',
    expectedConfidence: 'high',
    description: 'Previous year submission (year pattern)'
  },
  {
    filename: 'Last Years MQ Submission.pdf',
    content: 'Exemplar content from previous analyst briefing...',
    expectedType: 'exemplar_submission',
    expectedConfidence: 'high',
    description: 'Last year submission (alternate pattern)'
  },
  
  // Fact Source test cases
  {
    filename: 'Case Study - Pfizer ERP Implementation.docx',
    content: 'Client: Pfizer. Challenge: Complex ERP transformation. Solution: Implemented SAP... Results: 40% faster deployment',
    expectedType: 'fact_source',
    expectedConfidence: 'high',
    description: 'Case Study (clear pattern + content)'
  },
  {
    filename: 'Oracle Cloud Capabilities.pdf',
    content: 'Capability: Cloud-native architecture. Deployment: 500+ instances. Metric: 99.99% uptime',
    expectedType: 'fact_source',
    expectedConfidence: 'medium',
    description: 'Capability datasheet (moderate match)'
  },
  
  // Unknown/ambiguous test cases
  {
    filename: 'document.txt',
    content: 'Lorem ipsum dolor sit amet consectetur adipiscing elit...',
    expectedType: 'unknown',
    expectedConfidence: 'low',
    description: 'Unknown document (no clear pattern)'
  },
  {
    filename: 'misc-data.xlsx',
    content: null,
    expectedType: 'unknown',
    expectedConfidence: 'low',
    description: 'Unknown spreadsheet (no analysis)'
  }
];

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('PHASE 1 TESTING: Metadata Auto-Detection Service');
  console.log('═══════════════════════════════════════════════════════════\n');

  let passedTests = 0;
  let failedTests = 0;
  const failures = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    
    try {
      const result = await detectDocumentMetadata(testCase.filename, testCase.content);
      
      const typeMatch = result.type === testCase.expectedType;
      const confidenceMatch = result.confidence === testCase.expectedConfidence;
      const testPassed = typeMatch && confidenceMatch;
      
      const status = testPassed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} | Test ${i + 1}/${TEST_CASES.length}: ${testCase.description}`);
      
      if (testPassed) {
        passedTests++;
        console.log(`      Type: ${result.type} (${result.confidence})`);
        console.log(`      Method: ${result.method}`);
      } else {
        failedTests++;
        console.log(`      ❌ Expected: ${testCase.expectedType} (${testCase.expectedConfidence})`);
        console.log(`      ❌ Got:      ${result.type} (${result.confidence})`);
        console.log(`      Analysis: ${result.analysis}`);
        failures.push({
          test: testCase.description,
          expected: `${testCase.expectedType} (${testCase.expectedConfidence})`,
          got: `${result.type} (${result.confidence})`,
          method: result.method
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

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${passedTests}/${TEST_CASES.length}`);
  console.log(`❌ Failed: ${failedTests}/${TEST_CASES.length}`);
  
  const passRate = ((passedTests / TEST_CASES.length) * 100).toFixed(1);
  console.log(`📊 Pass Rate: ${passRate}%\n`);

  if (failedTests > 0) {
    console.log('FAILED TESTS:');
    failures.forEach((f, idx) => {
      console.log(`\n${idx + 1}. ${f.test}`);
      if (f.error) {
        console.log(`   Error: ${f.error}`);
      } else {
        console.log(`   Expected: ${f.expected}`);
        console.log(`   Got: ${f.got}`);
        console.log(`   Method: ${f.method}`);
      }
    });
  }

  // Pass/Fail criteria
  console.log('\n═══════════════════════════════════════════════════════════');
  if (passRate >= 90) {
    console.log('✅ PHASE 1 PASSED - Ready to proceed to Phase 2');
    console.log('   Accuracy: ' + passRate + '% (target: >90%)');
  } else {
    console.log('❌ PHASE 1 FAILED - Needs fixes before Phase 2');
    console.log('   Accuracy: ' + passRate + '% (target: >90%)');
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
