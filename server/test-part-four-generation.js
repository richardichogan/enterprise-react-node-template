/**
 * Test Part Four slide generation specifically
 * Verifies slideTopics fallback and content generation
 */

import { generateBriefingDeck } from './services/briefingDeckService.js';
import fs from 'fs/promises';

const testBriefingPack = `
Gartner Magic Quadrant for Cloud ERP Services - 2026

BRIEFING STRUCTURE:
- Part One: Vision and Execution (15 minutes)
- Part Two: Five Case Studies (20 minutes)  
- Part Three: Questions and Answers (10 minutes)
- Part Four: Slides on MQ and CC Submission (30 minutes)
  → Detailed slides covering all 15 MQ evaluation criteria
  → Maps vendor response to Ability to Execute and Completeness of Vision axes
`;

const testInstructions = `
Generate a comprehensive analyst briefing deck following Gartner Magic Quadrant structure.
Part Four must include detailed slides for each MQ criterion with evidence from vendor response.
`;

const testVendorResponse = `
IBM Cloud ERP Services - Magic Quadrant Response 2026

ABILITY TO EXECUTE:
- Product/Service: 160,000 Cloud ERP consultants across 65 countries
- Overall Viability: 90% client return rate demonstrates financial stability
- Sales Execution/Pricing: Competitive pricing with outcome-based models
- Market Responsiveness: AI-augmented delivery cuts timelines 40%
- Marketing Execution: Strategic partnerships with SAP, Oracle, Microsoft
- Customer Experience: IBM Garage co-creation methodology
- Operations: IBM Delivery Central Platform (IDCP) with AI/ML automation

COMPLETENESS OF VISION:
- Market Understanding: Deep industry expertise across 12 verticals
- Marketing Strategy: Focus on AI-driven transformation and risk reduction
- Sales Strategy: Enterprise-first approach with outcome guarantees
- Offering Strategy: Platform-agnostic with multi-cloud capabilities
- Business Model: Outcome-based pricing and risk-sharing models
- Vertical/Industry Strategy: Industry-specific accelerators and frameworks
- Innovation: 55% productivity gains with agentic AI deployment
- Geographic Strategy: Global delivery with local expertise in 65 countries
`;

console.log('🧪 Testing Part Four Generation...\n');

try {
  // Track progress
  const progressLog = [];
  const onProgress = (step, total, message) => {
    progressLog.push(`[${step}/${total}] ${message}`);
    console.log(`   ${message}`);
  };

  // Generate deck with explicit Part Four content request
  const sectionConfig = {
    'Part One: Vision and Execution': 'content',
    'Part Two: Five Case Studies': 'skip',
    'Part Three: Questions and Answers': 'skip',
    'Part Four: Slides on MQ and CC Submission': 'content' // Explicitly request content
  };

  console.log('📊 Section Configuration:');
  Object.entries(sectionConfig).forEach(([name, action]) => {
    console.log(`   - ${name}: ${action}`);
  });
  console.log('');

  const result = await generateBriefingDeck(
    testBriefingPack,
    testInstructions,
    testVendorResponse,
    'Gartner',
    'gpt-4o',
    onProgress,
    sectionConfig
  );

  console.log('\n\n✅ GENERATION COMPLETE\n');
  console.log('📊 Deck Summary:');
  console.log(`   Total slides: ${result.deck.slides.length}`);
  
  // Find Part Four slides
  const partFourSlides = result.deck.slides.filter(s => 
    s.section?.toLowerCase().includes('part four') || 
    s.section?.toLowerCase().includes('mq and cc')
  );
  
  console.log(`   Part Four slides: ${partFourSlides.length}`);
  
  if (partFourSlides.length === 0) {
    console.log('\n❌ FAILURE: No Part Four slides generated!');
    console.log('\n📋 All slides generated:');
    result.deck.slides.forEach((slide, idx) => {
      console.log(`   ${idx + 1}. ${slide.title || 'Untitled'} (${slide.section || 'No section'})`);
    });
  } else {
    console.log('\n✅ SUCCESS: Part Four slides generated!');
    console.log('\n📋 Part Four Content:');
    partFourSlides.forEach((slide, idx) => {
      console.log(`\n   Slide ${idx + 1}: ${slide.title}`);
      console.log(`   Purpose: ${slide.purpose || 'N/A'}`);
      if (slide.content && Array.isArray(slide.content)) {
        console.log(`   Bullets: ${slide.content.length} items`);
      }
      if (slide.speakerNotes) {
        console.log(`   Speaker Notes: ${slide.speakerNotes.substring(0, 100)}...`);
      }
    });
  }

  // Save result for inspection
  const outputPath = './test-part-four-output.json';
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 Full result saved to: ${outputPath}`);

} catch (error) {
  console.error('\n❌ TEST FAILED:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
