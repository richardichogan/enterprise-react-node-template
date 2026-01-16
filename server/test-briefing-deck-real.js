import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const API_URL = 'http://localhost:3001';

async function testBriefingDeck() {
  console.log('🧪 Testing Briefing Deck Generation...\n');

  const testData = {
    briefingPack: `Gartner Live Briefing Guidelines

AGENDA
Part One: Vision and Execution (15 minutes)
Part Two: Five Case Studies (45 minutes)
Part Three: Questions and Answers (15 minutes)
Part Four: MQ and CC Submission Slides (submission only, not presented)

PART ONE REQUIREMENTS
- Executive Summary: Company overview, achievements, acquisitions, investments
- Centers of Excellence: Innovation hubs, proprietary tools, partnerships
- Key Messages: Unique ability, value proposition
- Strengths & Areas for Improvement: Self-assessment
- Sweet Spots & Square Pegs: Ideal clients vs poor fits
- Key Risks and Mitigation: Risk management strategies
- Strategy: Market differentiation and roadmap

Maximum 10 slides for Part One.`,

    briefingInstructions: `Welcome to the Gartner Live Briefing for Cloud ERP Services

OVERVIEW
This briefing is designed to showcase your Cloud ERP Services practice to Gartner analysts.

STRUCTURE
- Part 1: Your vision, execution capabilities, and differentiators
- Part 2: Five detailed case studies demonstrating your expertise
- Part 3: Q&A session with analysts
- Part 4: Supporting slides for MQ evaluation

SUBMISSION REQUIREMENTS
1. Executive Summary slide with company overview
2. Five case studies covering FM, HR/Payroll, SCM, Sourcing & Procurement, Manufacturing
3. MQ evaluation criteria evidence (16 slides max)
4. Critical capabilities proof points (11 slides max)
5. Use cases and proof points (3 slides max)

ALL CONTENT MUST BE FACTUAL AND DEFENSIBLE.
Do not invent client names, metrics, or capabilities.`,

    vendorResponse: '',  // Empty = strawman mode
    model: 'global/gpt-4o'
  };

  try {
    console.log('📤 Sending request to /api/presentations/generate-briefing-deck...');
    console.log(`   Briefing pack length: ${testData.briefingPack.length} chars`);
    console.log(`   Instructions length: ${testData.briefingInstructions.length} chars`);
    console.log(`   Vendor response: ${testData.vendorResponse ? 'PROVIDED' : 'EMPTY (strawman mode)'}`);
    console.log();

    const response = await fetch(`${API_URL}/api/presentations/generate-briefing-deck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ERROR RESPONSE:');
      console.error(errorText);
      return;
    }

    const result = await response.json();

    if (result.error) {
      console.error('❌ ERROR FROM API:');
      console.error(result.error);
      if (result.details) {
        console.error('Details:', result.details);
      }
      return;
    }

    console.log('✅ SUCCESS!\n');
    console.log('📊 Deck structure:');
    console.log(JSON.stringify(result.deck, null, 2).substring(0, 1000));
    console.log('\n... (truncated for display)\n');
    
    if (result.deck.slides) {
      console.log(`✅ Generated ${result.deck.slides.length} slides`);
    }
    if (result.deck.gaps) {
      console.log(`✅ Identified ${result.deck.gaps.length} gaps`);
    }
    if (result.deck.qaBank) {
      console.log(`✅ Generated ${result.deck.qaBank.length} Q&A items`);
    }

  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
  }
}

testBriefingDeck();
