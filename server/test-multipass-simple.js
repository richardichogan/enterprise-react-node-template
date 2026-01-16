/**
 * Simple test for multi-pass briefing deck generation (mock data)
 * Usage: node server/test-multipass-simple.js
 */

import { config } from 'dotenv';
import { generateBriefingDeck } from './services/briefingDeckService.js';
import fs from 'fs';

config();

// Mock briefing pack with structure
const mockBriefingPack = `
GARTNER MAGIC QUADRANT BRIEFING REQUIREMENTS

AGENDA & TIMING
- Total briefing: 75 minutes
- Part One: Vision and Execution (15 minutes, max 10 slides)
- Part Two: Five Case Studies (45 minutes, max 25 slides)
- Part Three: Q&A (10 minutes)
- Part Four: MQ Evaluation Criteria (5 minutes, max 5 slides)

PART ONE: VISION AND EXECUTION (15 MINUTES)
Required slides:
- Executive Summary
- Centers of Excellence (geographic coverage)
- Key Messages and Value Proposition
- Strengths and Sweet Spots
- Risks and Challenges
- Strategy and Roadmap (next 12-18 months)

PART TWO: FIVE CASE STUDIES (45 MINUTES)
Must include FIVE detailed client case studies demonstrating:
1. Financial Management (ERP)
2. HR/Payroll Implementation
3. Supply Chain Management
4. Sourcing & Procurement
5. Manufacturing

Each case study MUST include:
- Client name and industry
- Business challenge
- Solution implemented
- Quantified outcomes (ROI, cost savings, efficiency gains)
- Timeline
- Team size

PART THREE: Q&A BANK
Prepare for analyst questions on:
- Competitive differentiation
- Cloud ERP market positioning
- Partner ecosystem
- Client satisfaction metrics

PART FOUR: MQ EVALUATION CRITERIA
- Use Cases overview
- Critical Capabilities matrix
- MQ positioning rationale

CONSTRAINTS:
- Maximum 45 slides total
- Each slide must have evidence citations
- All metrics must be verifiable
- Case studies must be from past 24 months
`;

const mockInstructions = `
BRIEFING INSTRUCTIONS

Market Definition:
Cloud ERP Services includes assessment, implementation, change management, 
data transformation, and managed services for cloud-based ERP platforms 
(Oracle Cloud, SAP S/4HANA Cloud, Microsoft Dynamics 365, Workday, etc.)

Evaluation Criteria:
1. Geographic coverage (global delivery)
2. Vertical expertise (industry-specific solutions)
3. Technology partnerships (strategic alliances with vendors)
4. Innovation capabilities (automation, AI/ML integration)
5. Client outcomes (measurable business value)

Evidence Requirements:
- 3+ client references per use case
- Quantified ROI metrics
- Quality assurance certifications
- Analyst recognition (awards, reports)

Presentation Guidelines:
- Clear, concise messaging
- Visual aids (charts, diagrams)
- No marketing fluff
- Focus on business outcomes
`;

async function testMultiPassSimple() {
  console.log('🧪 Testing Multi-Pass Briefing Deck Generation (Mock Data)...\n');

  try {
    console.log('🚀 Starting multi-pass generation...\n');
    
    const result = await generateBriefingDeck(
      mockBriefingPack,
      mockInstructions,
      '', // No vendor response (strawman mode)
      'Gartner',
      'global/gpt-4o'
    );
    
    console.log('\n✅ MULTI-PASS GENERATION COMPLETE!\n');
    
    // Display results
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
    deck.slides.slice(0, 5).forEach((slide) => {
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
    
    // Save full results
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
testMultiPassSimple();
