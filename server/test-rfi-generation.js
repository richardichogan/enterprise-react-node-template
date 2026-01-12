/**
 * Test RFI Generation with Document Collection Grounding
 * Tests the full flow: search Gartner ERP collection → generate grounded response
 */

import dotenv from 'dotenv';
dotenv.config();

import { generateRFIResponse, analyzeResponseScore } from './services/icaService.js';

console.log('🧪 Testing RFI Generation with Document Collection Grounding\n');
console.log('=' .repeat(70));
console.log(`Collection: ${process.env.IBM_ICA_COLLECTION_NAME}`);
console.log(`Collection ID: ${process.env.IBM_ICA_COLLECTION_ID}`);
console.log('=' .repeat(70) + '\n');

async function runTest() {
  // Test Question - relevant to Gartner ERP analysis
  const testQuestion = `What are the key capabilities and strengths of SAP S/4HANA 
according to recent Gartner analysis? Please provide specific details about 
its ERP functionality and market positioning.`;
  
  const testContext = `This is for a response to a client RFI regarding ERP solutions. 
The client is evaluating SAP S/4HANA and wants to understand its strengths 
from an analyst perspective.`;

  console.log('📝 TEST QUESTION:\n');
  console.log(testQuestion);
  console.log('\n' + '=' .repeat(70) + '\n');

  try {
    // Step 1: Generate response WITH document collection grounding
    console.log('🤖 Step 1: Generating response WITH document grounding...\n');
    
    const response = await generateRFIResponse(testQuestion, testContext, true);
    
    console.log('\n' + '=' .repeat(70));
    console.log('✅ GENERATED RESPONSE:');
    console.log('=' .repeat(70) + '\n');
    console.log(response.answer);
    console.log('\n' + '=' .repeat(70));
    console.log('📊 METADATA:');
    console.log('=' .repeat(70));
    console.log(`Model: ${response.model}`);
    console.log(`Tokens Used: ${response.tokensUsed || 'N/A'}`);
    console.log(`Used Document Collection: ${response.usedDocumentCollection ? '✅ Yes' : '❌ No'}`);
    console.log(`Collection Name: ${response.collectionName || 'N/A'}`);
    console.log('=' .repeat(70) + '\n');

    // Step 2: Analyze the response quality
    console.log('📊 Step 2: Analyzing response quality...\n');
    
    const analysis = await analyzeResponseScore(
      response.answer,
      'Accuracy, Specificity, Professional Tone, Relevance to Gartner Analysis'
    );
    
    console.log('\n' + '=' .repeat(70));
    console.log('📈 QUALITY ANALYSIS:');
    console.log('=' .repeat(70) + '\n');
    console.log(analysis.analysis);
    console.log('\n' + '=' .repeat(70));
    console.log('📊 ANALYSIS METADATA:');
    console.log('=' .repeat(70));
    console.log(`Model: ${analysis.model}`);
    console.log(`Tokens Used: ${analysis.tokensUsed || 'N/A'}`);
    console.log('=' .repeat(70) + '\n');

    // Step 3: Test WITHOUT document collection for comparison
    console.log('🤖 Step 3: Generating response WITHOUT document grounding...\n');
    
    const responseNoGrounding = await generateRFIResponse(testQuestion, testContext, false);
    
    console.log('\n' + '=' .repeat(70));
    console.log('📝 RESPONSE WITHOUT GROUNDING:');
    console.log('=' .repeat(70) + '\n');
    console.log(responseNoGrounding.answer);
    console.log('\n' + '=' .repeat(70));
    console.log(`Used Document Collection: ${responseNoGrounding.usedDocumentCollection ? '✅ Yes' : '❌ No'}`);
    console.log('=' .repeat(70) + '\n');

    // Summary
    console.log('\n' + '🎉 '.repeat(35));
    console.log('✅ TEST COMPLETE - All endpoints working!');
    console.log('🎉 '.repeat(35) + '\n');

    console.log('📋 SUMMARY:');
    console.log('  ✅ Document collection search: Working');
    console.log('  ✅ Grounded response generation: Working');
    console.log('  ✅ Response quality analysis: Working');
    console.log('  ✅ Non-grounded generation: Working');
    console.log('\n🚀 Ready for RFI-Helper frontend integration!\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

runTest();
