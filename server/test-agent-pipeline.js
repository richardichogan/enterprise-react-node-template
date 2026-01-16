/**
 * Test Agent Pipeline
 * Demonstrates the 4-agent sequential pipeline for one section
 */

import 'dotenv/config';
import { extractFacts } from './agents/dataExtractionAgent.js';
import { planStructure } from './agents/structurePlanningAgent.js';
import { synthesizeContent } from './agents/contentSynthesisAgent.js';
import { validateQuality, validateBatch } from './agents/qualityValidationAgent.js';
import { searchDocuments } from './services/azureSearchService.js';

async function testAgentPipeline() {
  console.log('🤖 TESTING 4-AGENT PIPELINE');
  console.log('==========================\n');

  try {
    // STEP 1: Get comprehensive search results
    console.log('STEP 1: Retrieving search results from Azure AI Search...');
    const query = 'IBM Cloud ERP practice vision strategy differentiation scale consultants countries global presence';
    const searchResults = await searchDocuments(query, 25);
    console.log(`✅ Retrieved ${searchResults?.length || 0} characters of context\n`);

    // STEP 2: Extract facts using Data Extraction Agent
    console.log('STEP 2: Data Extraction Agent - extracting atomic facts...');
    const facts = await extractFacts({
      searchResults: searchResults || 'No search results available',
      context: 'Part One: Vision and Execution - IBM Cloud ERP Services'
    }, {
      focusAreas: 'scale metrics, capabilities, partnerships'
    });
    console.log(`✅ Extracted facts:
   - Scale metrics: ${facts.scale?.length || 0}
   - Capabilities: ${facts.capabilities?.length || 0}
   - Partnerships: ${facts.partnerships?.length || 0}
   - Customers: ${facts.customers?.length || 0}\n`);

    // STEP 3: Plan structure using Structure Planning Agent
    console.log('STEP 3: Structure Planning Agent - creating slide blueprint...');
    const slideBlueprint = await planStructure({
      facts,
      sectionName: 'Part One: Vision and Execution',
      targetSlides: 3,
      referenceExamples: '' // Could add 2024 examples here
    });
    console.log(`✅ Planned ${slideBlueprint.length} slides:`);
    slideBlueprint.forEach(slide => {
      console.log(`   - Slide ${slide.slideNumber}: ${slide.topic} (${slide.layout})`);
    });
    console.log();

    // STEP 4: Synthesize content using Content Synthesis Agent
    console.log('STEP 4: Content Synthesis Agent - writing slide narratives...');
    const slides = [];
    for (const plan of slideBlueprint) {
      const slide = await synthesizeContent({
        slidePlan: plan,
        facts,
        referenceExamples: ''
      }, {
        mqDimensions: ['Ability to Execute', 'Completeness of Vision']
      });
      slides.push(slide);
      console.log(`   ✅ Synthesized: "${slide.title}"`);
    }
    console.log();

    // STEP 5: Validate quality using Quality Validation Agent
    console.log('STEP 5: Quality Validation Agent - checking content quality...');
    const validationReport = await validateBatch(slides, '', facts);
    console.log(`✅ Validation Complete:
   - Pass Rate: ${validationReport.passRate}
   - Average Score: ${validationReport.averageScore}/100
   - Passed: ${validationReport.passedSlides}/${validationReport.totalSlides} slides\n`);

    console.log('DETAILED VALIDATION RESULTS:');
    validationReport.slideResults.forEach((result, idx) => {
      console.log(`\n📊 Slide ${idx + 1}: ${result.slideTitle}`);
      console.log(`   Status: ${result.overallPass ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Score: ${result.score}/100`);
      
      if (result.issues && result.issues.length > 0) {
        console.log(`   Issues Found (${result.issues.length}):`);
        result.issues.forEach(issue => {
          console.log(`      - [${issue.severity.toUpperCase()}] ${issue.problem}`);
          console.log(`        Location: ${issue.location}`);
          console.log(`        Fix: ${issue.suggestedFix}`);
        });
      }
      
      if (result.strengths && result.strengths.length > 0) {
        console.log(`   Strengths:`);
        result.strengths.forEach(strength => {
          console.log(`      + ${strength}`);
        });
      }
    });

    console.log('\n\n✅ AGENT PIPELINE TEST COMPLETE');
    console.log('================================');
    console.log(`Final Quality: ${validationReport.passRate} pass rate`);

  } catch (error) {
    console.error('❌ Pipeline test failed:', error.message);
    console.error(error.stack);
  }
}

testAgentPipeline();
