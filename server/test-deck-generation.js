/**
 * Test briefing deck generation with REAL documents
 * This properly tests the endpoint without going through the browser
 */

import { generateBriefingDeck } from './services/briefingDeckService.js';

const briefingPack = `Live Briefing Guidelines for Cloud ERP Services, 2026

PART ONE: VISION AND EXECUTION
- Maximum 10 slides
- Includes: Executive Summary, Centers of Excellence, Key Messages, Strengths & Areas for Improvement, Sweet Spots & Square Pegs, Key Risks and Mitigation, Strategy & Differentiators

PART TWO: FIVE CASE STUDIES
- Maximum 25 slides total
- Required: Financial Management, HR/Payroll, Supply Chain, Sourcing & Procurement, Manufacturing

PART THREE: QUESTIONS AND ANSWERS
- 15 minutes allocated

PART FOUR: MQ AND CC SUBMISSION
- MQ Evaluation Criteria (max 16 slides)
- Use Cases (max 3 slides)
- Critical Capabilities (max 11 slides)`;

const briefingInstructions = `Welcome Packet for Cloud ERP Services, 2026

AGENDA TIMINGS:
- Part One (Vision and Execution): 15 minutes
- Part Two (Case Studies): 45 minutes
- Part Three (Q&A): 15 minutes
- Part Four: Submission only, not presented

KEY REQUIREMENTS:
- Provide company overview with growth metrics
- Detail Centers of Excellence and proprietary tools
- Clear value proposition and differentiation
- Honest assessment of strengths and areas for improvement
- Identify sweet spots and square pegs
- Describe key risks and mitigation strategies
- Five detailed case studies with client problems and solutions
- Evidence-based claims with metrics
- Prepared Q&A responses`;

const vendorResponse = ''; // EMPTY - strawman mode

console.log('🧪 Testing Briefing Deck Generation');
console.log('=====================================\n');
console.log('📋 Input Summary:');
console.log(`   Briefing Pack: ${briefingPack.length} chars`);
console.log(`   Instructions: ${briefingInstructions.length} chars`);
console.log(`   Vendor Response: ${vendorResponse.length} chars (EMPTY - STRAWMAN MODE)\n`);

try {
  console.log('📤 Calling generateBriefingDeck...\n');
  
  const result = await generateBriefingDeck(
    briefingPack,
    briefingInstructions,
    vendorResponse,
    'Gartner'
  );

  console.log('\n✅ SUCCESS! Deck generated:\n');
  console.log('Response structure:');
  console.log(`  - firm: ${result.deck.firm}`);
  console.log(`  - slides: ${result.deck.slides?.length || 0} slides`);
  console.log(`  - gaps: ${result.deck.gaps?.length || 0} gaps`);
  console.log(`  - qaBank: ${result.deck.qaBank?.length || 0} Q&A items`);
  console.log(`  - tokens used: ${result.tokensUsed}`);
  
  // Print first slide as sample
  if (result.deck.slides && result.deck.slides.length > 0) {
    console.log('\n📄 First slide sample:');
    console.log(JSON.stringify(result.deck.slides[0], null, 2));
  }

} catch (error) {
  console.error('\n❌ FAILED!');
  console.error('Error:', error.message);
  if (error.message.includes('JSON parse')) {
    console.error('\n⚠️  JSON PARSE ERROR - Response is still being truncated');
    console.error('This means the token limit is STILL too low or the response format is still too verbose');
  }
}
