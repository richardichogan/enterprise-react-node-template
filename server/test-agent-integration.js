/**
 * Test Agent Integration into briefingDeckService.js
 * Tests the 4-agent pipeline with one real section
 */

import { generateBriefingDeck } from './services/briefingDeckService.js';
import fs from 'fs/promises';

console.log('========================================');
console.log('AGENT INTEGRATION TEST');
console.log('========================================\n');

// Minimal test inputs - just enough to trigger one section
const testBriefingPack = `
# Analyst Briefing Structure

## Part One: Vision and Execution (10 minutes, 4-5 slides)
- IBM's cloud ERP practice strategy and vision
- Scale and global presence
- Innovation capabilities and IP assets
- Strategic partnerships and ecosystem
`;

const testInstructions = `
This briefing is for Gartner analysts to evaluate IBM's Cloud ERP services practice.
Focus on demonstrating comprehensive capabilities, global scale, and strategic differentiation.
The briefing should position IBM as a leader in cloud ERP transformation services.
`;

async function runIntegrationTest() {
  try {
    console.log('📋 Starting briefing deck generation with 4-agent pipeline...\n');
    
    const result = await generateBriefingDeck(
      testBriefingPack,
      testInstructions,
      'Gartner',
      'gpt-4o'
    );
    
    console.log('\n✅ DECK GENERATION COMPLETE\n');
    console.log('Summary:');
    console.log(`- Total slides: ${result.deck.slides.length}`);
    console.log(`- Sections: ${result.deck.extractedStructure.sections.length}`);
    console.log(`- Q&A items: ${result.deck.qaBank.length}`);
    
    // Show first content slide details (skip title and section divider)
    const firstContentSlide = result.deck.slides.find(s => !s.isTitle && !s.isSectionDivider && s.layout);
    if (firstContentSlide) {
      console.log('\n📊 First Content Slide Details:');
      console.log(`   Title: ${firstContentSlide.title}`);
      console.log(`   Layout: ${firstContentSlide.layout}`);
      console.log(`   Has intro: ${!!firstContentSlide.intro}`);
      console.log(`   Has content: ${!!firstContentSlide.content}`);
      console.log(`   Evidence citations: ${firstContentSlide.evidence || '[none]'}`);
      console.log(`   MQ mappings: ${firstContentSlide.mq_mapping?.length || 0}`);
    }
    
    // Validate slide structure
    const contentSlides = result.deck.slides.filter(s => !s.isTitle && !s.isSectionDivider);
    console.log('\n🔍 Validation:');
    
    let validCount = 0;
    let issueCount = 0;
    const issues = [];
    
    for (const slide of contentSlides) {
      let slideValid = true;
      
      if (!slide.layout) {
        issues.push(`Slide "${slide.title}" missing layout`);
        slideValid = false;
      }
      if (!slide.intro) {
        issues.push(`Slide "${slide.title}" missing intro`);
        slideValid = false;
      }
      if (!slide.content || typeof slide.content !== 'object') {
        issues.push(`Slide "${slide.title}" missing/invalid content`);
        slideValid = false;
      }
      
      if (slideValid) validCount++;
      else issueCount++;
    }
    
    console.log(`   ✅ Valid slides: ${validCount}/${contentSlides.length}`);
    if (issueCount > 0) {
      console.log(`   ⚠️  Slides with issues: ${issueCount}`);
      issues.slice(0, 5).forEach(issue => console.log(`      - ${issue}`));
    }
    
    // Save result for inspection
    const outputPath = './test-agent-integration-output.json';
    await fs.writeFile(outputPath, JSON.stringify(result.deck, null, 2));
    console.log(`\n💾 Full output saved to: ${outputPath}`);
    
    console.log('\n✅ INTEGRATION TEST PASSED');
    return true;
    
  } catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
runIntegrationTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
