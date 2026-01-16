/**
 * Test script for multi-pass briefing deck generation
 * Usage: node server/test-multipass-deck.js
 */

import { config } from 'dotenv';
import { generateBriefingDeck } from './services/briefingDeckService.js';
import { loadDocumentContent } from './services/documentProcessor.js';
import fs from 'fs';

config();

async function testMultiPassDeck() {
  console.log('🧪 Testing Multi-Pass Briefing Deck Generation...\n');

  try {
    // 1. Load test documents
    console.log('📥 Loading test documents...');
    
    const briefingPackName = 'Gartner Briefing Pack.pdf';
    const instructionsName = 'Briefing Instructions.docx';
    
    // Load documents (downloads and extracts automatically)
    const briefingPack = await loadDocumentContent(briefingPackName);
    const briefingInstructions = await loadDocumentContent(instructionsName);
    
    if (!briefingPack || !briefingInstructions) {
      throw new Error('Failed to load documents');
    }
    
    console.log(`✅ Loaded briefing pack: ${briefingPack.length} characters`);
    console.log(`✅ Loaded instructions: ${briefingInstructions.length} characters\n`);
    
    // 2. Generate deck using multi-pass approach
    console.log('🚀 Starting multi-pass generation...\n');
    
    const result = await generateBriefingDeck(
      briefingPack,
      briefingInstructions,
      '', // No vendor response (strawman mode)
      'Gartner',
      'global/gpt-4o'
    );
    
    console.log('\n✅ MULTI-PASS GENERATION COMPLETE!\n');
    
    // 3. Display results
    const { deck } = result;
    
    console.log('📊 RESULTS SUMMARY:');
    console.log('══════════════════════════════════════════');
    console.log(`Analyst Firm: ${deck.analystFirm}`);
    console.log(`Total Sections: ${deck.extractedStructure.sections.length}`);
    console.log(`Total Slides: ${deck.slides.length}`);
    console.log(`Q&A Items: ${deck.qaBank.length}`);
    console.log(`Gap Analysis Items: ${deck.gapAnalysis.gaps.length}`);
    console.log('══════════════════════════════════════════\n');
    
    console.log('📋 EXTRACTED STRUCTURE:');
    console.log('──────────────────────────────────────────');
    deck.extractedStructure.sections.forEach((section, idx) => {
      console.log(`${idx + 1}. ${section.name} (${section.duration})`);
      console.log(`   Max Slides: ${section.maxSlides}`);
      console.log(`   Topics: ${section.slideTopics.slice(0, 3).join(', ')}${section.slideTopics.length > 3 ? '...' : ''}`);
    });
    console.log('');
    
    console.log('📝 SAMPLE SLIDES:');
    console.log('──────────────────────────────────────────');
    deck.slides.slice(0, 5).forEach((slide, idx) => {
      console.log(`Slide ${slide.slideNumber}: ${slide.title}`);
      console.log(`   Section: ${slide.section}`);
      console.log(`   Purpose: ${slide.purpose}`);
      if (slide.contentNeeded) {
        console.log(`   Content Needed: ${slide.contentNeeded.slice(0, 2).join(', ')}`);
      }
      console.log('');
    });
    
    if (deck.slides.length > 5) {
      console.log(`   ... and ${deck.slides.length - 5} more slides\n`);
    }
    
    console.log('💬 SAMPLE Q&A:');
    console.log('──────────────────────────────────────────');
    deck.qaBank.slice(0, 3).forEach((qa, idx) => {
      console.log(`Q${idx + 1}: ${qa.question}`);
      console.log(`A: ${qa.suggestedAnswer}`);
      console.log('');
    });
    
    if (deck.qaBank.length > 3) {
      console.log(`   ... and ${deck.qaBank.length - 3} more Q&A items\n`);
    }
    
    // 4. Save full results to file
    const outputPath = 'test-multipass-output.json';
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`💾 Full results saved to: ${outputPath}\n`);
    
    console.log('✅ TEST COMPLETE!');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run test
testMultiPassDeck();
