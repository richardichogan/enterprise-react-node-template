/**
 * Test: Executive Summary Section Generation
 * Focuses on generating just the first section to validate content quality
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchDocuments } from './services/azureSearchService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

async function generateExecutiveSummarySlides() {
  console.log('🎯 EXECUTIVE SUMMARY SECTION TEST');
  console.log('================================\n');

  // Define the section requirements
  const section = {
    name: 'Executive Summary',
    duration: '10 minutes',
    topics: [
      'Overview of your Cloud ERP Services practice',
      'Key achievements and growth in Cloud ERP Services',
      'Recent acquisitions (past 12 months) relevant to Cloud ERP',
      'Planned investments and priorities for the next 12 months'
    ]
  };

  // Search for relevant content
  console.log('📚 Searching for relevant RFI content...');
  const searchQuery = 'Cloud ERP Services practice achievements growth acquisitions investments priorities';
  const relevantContext = await searchDocuments(searchQuery, 10);
  console.log(`   ✅ Retrieved ${relevantContext.length} characters of context\n`);

  // Generate slides with improved prompt
  console.log('🎨 Generating slides...\n');
  
  const systemPrompt = `You are an expert at creating Gartner analyst briefing slides with SPECIFIC, DATA-DRIVEN content.

CRITICAL RULES - VIOLATION RESULTS IN REJECTION:
1. Every bullet MUST contain a SPECIFIC NUMBER, DATE, or CLIENT NAME from the RFI
2. NO generic phrases like "extensive expertise", "comprehensive capabilities", "leading provider"
3. NO vague statements - every claim needs a fact
4. If data is missing, write "{TO_FILL}" - do NOT invent or use generic content

GOOD EXAMPLE (L1 slide):
{
  "layout": "L1_Executive_Header",
  "title": "IBM's Cloud ERP Growth Momentum",
  "subtitle": "47 implementations, 23 countries, $127M revenue growth",
  "intro": "IBM's Cloud ERP Services practice has demonstrated significant growth through strategic expansion and client success.",
  "content": {
    "key_bullets": [
      "Deployed 47 Cloud ERP implementations across 23 countries in 2025 (+31% YoY growth)",
      "Revenue reached $127M in Cloud ERP Services (Q3 2025), up 24% from $102M (Q3 2024)",
      "Average implementation time: 8.3 months vs. industry average of 12 months (Gartner 2025)",
      "Client retention rate: 94% (2025) with 67% of clients expanding scope within first year",
      "Team expansion: 850 certified consultants added in 2025, bringing total to 3,200 globally",
      "Innovation investment: $23M in AI-powered automation tools launched Q2 2025",
      "Partnership achievements: Named SAP Global Partner of the Year for Cloud ERP in 2025",
      "Geographic expansion: Opened 5 new delivery centers in APAC and EMEA in 2025"
    ]
  },
  "evidence": "RFI § Cloud ERP Practice Overview p.3; RFI § Financial Performance Q3 2025 p.12; RFI § Team Growth p.8",
  "mq_mapping": ["Ability to Execute: Market Responsiveness", "Completeness of Vision: Market Understanding"],
  "gap_flag": false
}

BAD EXAMPLE - REJECT THIS:
{
  "title": "IBM's Leadership in Cloud ERP",
  "content": {
    "key_bullets": [
      "IBM stands at the forefront of Cloud ERP services",  // ❌ No data
      "Commitment to innovation and customer-centric solutions",  // ❌ Generic
      "Driving transformation across industries"  // ❌ Meaningless
    ]
  }
}

Generate slides using ONLY these layouts:
- L1_Executive_Header: title, subtitle, intro (2-3 sentences), content.key_bullets (MINIMUM 6, maximum 8)
- L2_TwoColumn_Proof: title, intro (2-3 sentences), content.left_bullets (MINIMUM 3, max 4), content.right_bullets (MINIMUM 3, max 4), content.metric_strip (3 objects with label/value/context/source)
- L5_Metric_Tiles_3x1: title, intro (2-3 sentences), content.tiles (3 objects with label/value/context/source)

CRITICAL REQUIREMENT: Each slide MUST have:
1. An "intro" field with 2-3 sentences providing context
2. MINIMUM 6 bullets total (for L1) or 6+ bullets split across left/right (for L2)
3. Each bullet should be substantial with supporting details (not just standalone facts)

Return ONLY valid JSON array of 3-5 slides, no markdown.`;

  const userPrompt = `Generate 3-5 slides for the Executive Summary section.

**Requirements:**
- Overview of Cloud ERP Services practice
- Key achievements and growth
- Recent acquisitions (past 12 months)
- Planned i REQUIREMENTS**:
1. Each slide must have an "intro" field (2-3 sentences of context)
2. MINIMUM 6 bullets per slide (for L1) or 6+ total bullets (for L2 split across left/right)
3. Each bullet must contain SPECIFIC data from the RFI:
   - Numbers (deployment counts, revenue, growth %, timeframes)
   - Dates (quarters, months, years)
   - Client names (if mentioned)
   - Specific capabilities/technologies (product names)
   - Acquisition names and dates
   - Investment amounts and timelines
4. Add supporting text/context to each bullet - don't just state bare factenue, growth %, timeframes)
- Dates (quarters, months, years)
- Client names (if mentioned)
- Specific capabilities/technologies (product names, not "comprehensive solutions")
- Acquisition names and dates
- Investment amounts and timelines

If RFI doesn't contain specific data for a topic, write "{TO_FILL}" in that bullet and set gap_flag=true.

Return ONLY the JSON array of slides.`;

  const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
  
  try {
    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'api-key': AZURE_OPENAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Azure OpenAI Error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    let slidesJSON = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const slides = JSON.parse(slidesJSON);

    console.log('✅ Generated Slides:\n');
    console.log(JSON.stringify(slides, null, 2));
    console.log('\n================================');
    console.log(`📊 Total Slides: ${slides.length}`);
    
    // Analyze quality
    console.log('\n🔍 Content Quality Analysis:\n');
    slides.forEach((slide, idx) => {
      console.log(`Slide ${idx + 1}: ${slide.title}`);
      
      const bullets = slide.content?.key_bullets || 
                     [...(slide.content?.left_bullets || []), ...(slide.content?.right_bullets || [])] ||
                     [];
      
      bullets.forEach((bullet, bIdx) => {
        const hasNumber = /\d+/.test(bullet);
        const hasDate = /\d{4}|Q[1-4]|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/.test(bullet);
        const hasGeneric = /(extensive|comprehensive|leading|innovative|world-class|best-in-class|cutting-edge|state-of-the-art|robust|scalable|flexible)/i.test(bullet);
        const hasTBD = /\{TO_FILL\}/.test(bullet);
        
        const status = hasTBD ? '⚠️ TBD' : 
                      (hasNumber || hasDate) && !hasGeneric ? '✅ GOOD' : 
                      hasGeneric ? '❌ GENERIC' : 
                      '⚠️ VAGUE';
        
        console.log(`  ${status}: ${bullet.substring(0, 80)}${bullet.length > 80 ? '...' : ''}`);
      });
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run the test
generateExecutiveSummarySlides().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
