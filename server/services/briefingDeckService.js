/**
 * Briefing Deck Service
 * Generates analyst briefing presentations driven by briefing pack structure
 * Maps slides to vendor response with evidence citations and gap analysis
 * Now uses Azure OpenAI + Azure AI Search for enhanced content retrieval
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import pptxAutomizer from 'pptx-automizer';
const Automizer = pptxAutomizer.default || pptxAutomizer;
import { searchDocuments } from './azureSearchService.js';
import { getFrameworkCriteria } from './analystEvaluatorService.js';

// Import modular agents for slide generation pipeline
import { extractFacts as agentExtractFacts } from '../agents/dataExtractionAgent.js';
import { generateNarrativeSpine as agentGenerateSpine, validateSpineCompleteness } from '../agents/narrativeSpineAgent.js';
import { planStructure as agentPlanStructure } from '../agents/structurePlanningAgent.js';
import { synthesizeContent as agentSynthesizeContent } from '../agents/contentSynthesisAgent.js';
import { transformToExecutiveBriefing as agentTransformNarrative, generateVisionStatement as agentGenerateVision } from '../agents/narrativeTransformationAgent.js';
import { validateBatch as agentValidateBatch } from '../agents/qualityValidationAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Azure OpenAI configuration
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
const FOUNDRY_RESPONSES_URL = `${AZURE_OPENAI_ENDPOINT}/openai/v1/responses`;

// Helper: Load strategic positioning document
async function getStrategicPositioning(analystFirm = 'Gartner') {
  try {
    const positioningPath = path.join(__dirname, '..', 'docs', 'STRATEGIC-POSITIONING.md');
    const content = await fs.readFile(positioningPath, 'utf-8');
    
    // Parse markdown into structured format
    return {
      source: 'STRATEGIC-POSITIONING.md',
      content: content,
      analystFirm: analystFirm,
      lastUpdated: new Date().toISOString(),
      ready: true
    };
  } catch (err) {
    console.warn(`⚠️  Strategic positioning document not found or error reading:`, err.message);
    return null;
  }
}

// Helper: call Foundry agent with web_search_preview for web-grounded content
async function queryFoundryAgent(prompt) {
  if (!FOUNDRY_RESPONSES_URL || !AZURE_OPENAI_API_KEY) return '';
  try {
    const response = await fetch(FOUNDRY_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: AZURE_OPENAI_DEPLOYMENT,
        tools: [{ type: 'web_search_preview' }],
        input: prompt
      })
    });
    if (!response.ok) {
      console.warn(`⚠️  Foundry responses API call failed: ${response.status}`);
      return '';
    }
    const data = await response.json();
    // Responses API may return output_text or output array; fall back to chat-style choices
    const outputText = data.output_text
      || (Array.isArray(data.output)
        ? data.output
            .map(item =>
              Array.isArray(item.content)
                ? item.content.map(c => c.text || '').join('\n')
                : '')
            .join('\n')
        : '')
      || data.choices?.[0]?.message?.content
      || '';
    return outputText.trim();
  } catch (err) {
    console.warn(`⚠️  Foundry agent error: ${err.message}`);
    return '';
  }
}

/**
 * Retry helper for Azure OpenAI calls with exponential backoff
 * Handles 429 rate limits automatically
 * Azure OpenAI S0 tier resets quotas every 60 seconds
 */
/**
 * Helper: Extract all text from a slide for de-duplication analysis
 */
function extractSlideText(slide) {
  const texts = [];
  if (slide.title) texts.push(slide.title);
  if (slide.subtitle) texts.push(slide.subtitle);
  if (slide.intro) texts.push(slide.intro);
  
  const c = slide.content || {};
  const collectBullets = arr => {
    if (Array.isArray(arr)) {
      arr.forEach(b => {
        if (b && typeof b === 'object' && b.text) texts.push(b.text);
        else if (typeof b === 'string') texts.push(b);
      });
    }
  };
  
  collectBullets(c.key_bullets);
  collectBullets(c.left_bullets);
  collectBullets(c.right_bullets);
  collectBullets(c.challenges);
  collectBullets(c.solutions);
  
  if (Array.isArray(c.tiles)) {
    c.tiles.forEach(t => {
      if (t) {
        if (t.label) texts.push(t.label);
        if (t.value) texts.push(String(t.value));
        if (t.context) texts.push(t.context);
      }
    });
  }
  
  return texts.join(' ');
}

async function retryWithBackoff(fn, maxRetries = 3, delayMs = 65000) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const is429 = error.message?.includes('429') || error.status === 429;
      
      if (!is429 || attempt === maxRetries - 1) {
        if (attempt === maxRetries - 1) {
          console.error(`❌ Max retries (${maxRetries}) exceeded after ${(delayMs * maxRetries)/1000}s total wait`);
        }
        throw error;
      }
      
      console.log(`⏳ Rate limit (429) - waiting ${delayMs/1000}s for quota reset (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

/**
 * Extract structured facts from the RFI / briefing content
 */
async function extractFacts(briefingPack, briefingInstructions, analystFirm, vendorResponse) {
  const systemPrompt = `Extract atomic facts relevant to ${analystFirm} MQ/Wave/MarketScape evaluation.
Return JSON with arrays: capabilities, case_studies, ip_assets, operating_model, wins. Include source_ref for each.
Do not invent; if not present, omit field.`;

  const userPrompt = `Briefing (RFI) content:
${briefingPack.substring(0, 8000)}

Briefing instructions:
${briefingInstructions.substring(0, 2000)}

IBM RFI (vendor response) extracted text:
${(vendorResponse || '').substring(0, 8000)}

Return JSON:
{
  "capabilities": [{"name":"","description":"","metrics":[],"source_ref":""}],
  "case_studies": [{"client":"","industry":"","region":"","challenge":"","approach":"","outcomes":[{"metric":"","value":"","timeframe":""}],"reference_status":"","source_ref":""}],
  "ip_assets": [{"name":"","purpose":"","maturity":"","usage_count":"","industries":[],"source_ref":""}],
  "operating_model": [{"topic":"","detail":"","source_ref":""}],
  "wins": [{"client":"","industry":"","deal_size":"","buyer_roles":[],"sourcing_approach":"","pricing":"","competitors":[],"reason_for_win":"","source_ref":""}]
}`;

  const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
  try {
    return await retryWithBackoff(async () => {
      const response = await fetch(azureUrl, {
        method: 'POST',
        headers: { 'api-key': AZURE_OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 4000
        })
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const data = await response.json();
      const content = data.choices[0].message.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(content);
    });
  } catch (err) {
    console.warn('⚠️ extractFacts fallback:', err.message);
    return { capabilities: [], case_studies: [], ip_assets: [], operating_model: [], wins: [] };
  }
}

/**
 * Enrich facts with KB/public data without overriding RFI values
 */
async function enrichFacts(facts, briefingPack, briefingInstructions, vendorResponse) {
  const systemPrompt = `Enrich missing fields ONLY. Do not override existing values. Add added_from:["FoundryKB"|"Public"] when used.`;
  const userPrompt = `Base facts:
${JSON.stringify(facts).substring(0, 6000)}

Additional context (KB/public snippets if available):
${briefingInstructions.substring(0, 1500)}

IBM RFI (vendor response) extracted text:
${(vendorResponse || '').substring(0, 2000)}

Return same JSON structure with missing fields filled; do not invent new rows.`;
  const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
  try {
    return await retryWithBackoff(async () => {
      const response = await fetch(azureUrl, {
        method: 'POST',
        headers: { 'api-key': AZURE_OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 4000
        })
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const data = await response.json();
      const content = data.choices[0].message.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(content);
    });
  } catch (err) {
    console.warn('⚠️ enrichFacts fallback:', err.message);
    return facts;
  }
}

/**
 * Generate briefing deck from briefing pack
 * Uses multi-pass approach: parse structure, generate each section separately, assemble final deck
 * @param {string} briefingPack - Full text of briefing pack/PDF
 * @param {string} briefingInstructions - Full text of briefing instructions
 * @param {string} vendorResponse - Full text of vendor's written response (NOT USED - we use Azure AI Search instead)
 * @param {string} analystFirm - Gartner | Forrester | IDC | Everest Group
 * @param {string} aiModel - DEPRECATED - now uses Azure OpenAI deployment
 * @param {Function} onProgress - Optional callback for progress updates: (stepNum, totalSteps, message) => void
 * @param {Object} sectionConfig - Optional configuration for section generation actions ('content', 'break', 'skip')
 * @returns {Promise<Object>} Deck structure with slides, traceability, gaps, Q&A
 */
export const generateBriefingDeck = async (
  briefingPack,
  briefingInstructions,
  vendorResponse,
  analystFirm = 'Gartner',
  aiModel = null,  // Deprecated - using Azure OpenAI
  onProgress = null,
  sectionConfig = {} // New parameter: { "Section Name": "content" | "break" | "skip" }
) => {
  console.log('📊 [BRIEFING DECK] Starting multi-pass deck generation...');
  console.log(`   Analyst firm: ${analystFirm}`);
  console.log(`   Using: Azure OpenAI (${AZURE_OPENAI_DEPLOYMENT}) + Azure AI Search`);
  console.log(`   Briefing pack length: ${briefingPack.length} chars`);
  console.log(`   Instructions length: ${briefingInstructions.length} chars`);
  console.log(`   Section config keys: ${Object.keys(sectionConfig).join(', ')}`);

  // Validate input content
  if (briefingPack.startsWith('[PDF file') || briefingPack.startsWith('[Word document') || briefingPack.startsWith('[PowerPoint')) {
    throw new Error(`Document extraction failed: ${briefingPack.substring(0, 200)}`);
  }
  if (briefingInstructions.startsWith('[PDF file') || briefingInstructions.startsWith('[Word document') || briefingInstructions.startsWith('[PowerPoint')) {
    throw new Error(`Document extraction failed: ${briefingInstructions.substring(0, 200)}`);
  }

  try {
    // Helper to emit progress messages with consistent logging
    const emitProgress = (step, total, message) => {
      if (onProgress) onProgress(step, total, message);
      console.log(`[STEP ${step}/${total}] ${message}`);
    };

    // STEP 0: Extract and enrich facts for structured layouts
    emitProgress(0, 6, '📊 Initialization|||Extracting structured facts from briefing documents');
    const baseFacts = await extractFacts(briefingPack, briefingInstructions, analystFirm, vendorResponse);
    const enrichedFacts = await enrichFacts(baseFacts, briefingPack, briefingInstructions, vendorResponse);

    // STEP 1: Parse briefing pack to extract structure
    emitProgress(1, 6, '📋 Structure Analysis|||Parsing briefing pack to identify sections and timing');
    const structure = await parseBriefingStructure(briefingPack, briefingInstructions, analystFirm, aiModel);
    emitProgress(1, 6, `📋 Structure Analysis|||Found ${structure.sections.length} sections with ${structure.totalSlides} total slides`);

    // STEP 2: Generate narrative/story with golden thread
    emitProgress(2, 6, '📝 Narrative Framework|||Generating narrative arc and golden thread across sections');
    
    // Load strategic positioning to guide narrative generation
    const strategicPositioning = await getStrategicPositioning(analystFirm);
    if (strategicPositioning) {
      console.log(`   📋 Strategic positioning loaded: ${analystFirm}`);
    } else {
      console.warn(`   ⚠️  No strategic positioning found - narrative will be auto-generated`);
    }
    
    const narrative = await generateNarrative(briefingPack, briefingInstructions, structure, analystFirm, aiModel, strategicPositioning?.content);
    emitProgress(2, 6, '📝 Narrative Framework|||Created narrative framework connecting all sections');

    // STEP 3: Generate title slide
    emitProgress(3, 6, '🎭 Title Slide|||Creating briefing title slide');
    const titleSlide = {
      number: 1,
      section: 'Title',
      title: `${analystFirm} Analyst Briefing`,
      purpose: briefingInstructions.substring(0, 200).match(/briefing on (.+?)[\.\n]/)?.[1] || 'IBM Cloud ERP Services',
      content: [],
      evidenceCitations: [],
      speakerNotes: 'Welcome and introduction to the briefing session',
      complianceFlags: [],
      visualSuggestion: 'IBM logo and analyst firm logo',
      isTitle: true
    };
    const allSlides = [titleSlide];

    // STEP 4: Generate slides for each section with section dividers
    emitProgress(4, 6, '📄 Section Generation|||Processing all briefing sections');
    for (let i = 0; i < structure.sections.length; i++) {
      const section = structure.sections[i];
      // Determine action for this section based on user config
      // Default to 'content' if not specified
      const action = sectionConfig[section.name] || 'content';
      
      if (action === 'skip') {
        console.log(`   ⏩ Skipping section "${section.name}" (User requested skip)`);
        continue;
      }

      // Add throttling delay between sections if generating content
      if (i > 0 && action === 'content') {
        console.log(`   ⏱️  Throttling 3s before section ${i + 1}/${structure.sections.length}...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Add section divider slide (for both 'break' and 'content' actions)
      const sectionDivider = {
        number: allSlides.length + 1,
        section: section.name,
        title: section.name,
        purpose: `Duration: ${section.duration || 'TBD'}`,
        content: section.slideTopics || [],
        evidenceCitations: [],
        speakerNotes: `Section overview: ${section.name}`,
        complianceFlags: [],
        visualSuggestion: 'Section title with agenda items',
        isSectionDivider: true
      };
      allSlides.push(sectionDivider);
      
      if (action === 'break') {
        console.log(`   🛑 Section break only for "${section.name}" (User requested break)`);
        continue;
      }
      
      // Implicit check: action === 'content'
      
      // Auto-fallback: Q&A sections default to skipping content if not explicitly configured to 'content'
      const isQASection = section.name?.toLowerCase().includes('q&a') || section.name?.toLowerCase().includes('questions');
      if (isQASection && (!sectionConfig[section.name] || sectionConfig[section.name] !== 'content')) {
        console.log(`   ℹ️  Skipping slide generation for Q&A section "${section.name}" (Auto-fallback)`);
        continue;
      }
      
      // Auto-fallback: If Part Four has no slideTopics, provide default MQ/CC topics
      const isPartFour = section.name?.toLowerCase().includes('part four') || section.name?.toLowerCase().includes('mq and cc');
      console.log(`   🔍 DEBUG: Section "${section.name}" - isPartFour: ${isPartFour}, slideTopics: ${JSON.stringify(section.slideTopics)}`);
      
      if (isPartFour && (!section.slideTopics || section.slideTopics.length === 0)) {
        console.log(`   ℹ️  Part Four detected with no slideTopics - adding default MQ/CC topics`);
        section.slideTopics = [
          'Ability to Execute: Product/Service',
          'Ability to Execute: Overall Viability',
          'Ability to Execute: Sales Execution/Pricing',
          'Ability to Execute: Market Responsiveness/Record',
          'Ability to Execute: Marketing Execution',
          'Ability to Execute: Customer Experience',
          'Ability to Execute: Operations',
          'Completeness of Vision: Market Understanding',
          'Completeness of Vision: Marketing Strategy',
          'Completeness of Vision: Sales Strategy',
          'Completeness of Vision: Offering (Product) Strategy',
          'Completeness of Vision: Business Model',
          'Completeness of Vision: Vertical/Industry Strategy',
          'Completeness of Vision: Innovation',
          'Completeness of Vision: Geographic Strategy'
        ];
        console.log(`   ✅ Added ${section.slideTopics.length} default MQ topics to Part Four`);
      }
      
      console.log(`   🚀 Calling generateSectionSlides for "${section.name}" with ${section.slideTopics?.length || 0} slideTopics`);
      
      // Generate content slides for this section using narrative context
      const sectionSlides = await generateSectionSlides(section, briefingPack, briefingInstructions, analystFirm, aiModel, narrative, vendorResponse, emitProgress);
      allSlides.push(...sectionSlides);
      emitProgress(4, 6, `Generated ${sectionSlides.length} slides for "${section.name}" (${i + 1}/${structure.sections.length})`);
    }

    // STEP 5: Q&A bank is for reference only - not added to slides
    emitProgress(5, 6, 'Generating Q&A reference bank...');
    const qaBank = await generateQABank(briefingInstructions, analystFirm, aiModel);
    emitProgress(5, 6, `✅ Generated ${qaBank.length} Q&A reference items (not added to deck)`);

    // STEP 6: Assemble final deck
    emitProgress(6, 6, 'Assembling final deck structure...');
    const deck = {
      analystFirm,
      extractedStructure: {
        agendaTimings: structure.agendaTimings,
        sections: structure.sections,
        constraints: structure.constraints
      },
      facts: enrichedFacts,
      slides: allSlides,
      traceabilityMatrix: allSlides.map((slide, idx) => ({
        slideNumber: idx + 1,
        slideTitle: slide.title,
        briefingPackRequirement: slide.section,
        vendorResponseSections: [],
        mappingStatus: 'Awaiting vendor response'
      })),
      gapAnalysis: computeGaps(allSlides),
      qaBank
    };

    emitProgress(6, 6, `✅ Multi-pass generation complete (${deck.slides.length} slides, ${deck.qaBank.length} Q&A items)`);

    return {
      deck,
      model: aiModel,
      tokensUsed: 0 // Aggregate from multiple calls
    };
  } catch (error) {
    console.error('❌ [BRIEFING DECK] Error in multi-pass generation:', error);
    throw error;
  }
};

/**
 * Analyze briefing structure WITHOUT generating content
 * Used for the "Review Structure" phase of deck generation
 */
export const analyzeBriefingStructure = async (briefingPack, briefingInstructions, analystFirm = 'Gartner') => {
  console.log('🔍 [BRIEFING DECK] Analyzing structure only...');
  
  // Reuse the existing parsing logic
  const structure = await parseBriefingStructure(briefingPack, briefingInstructions, analystFirm, null);
  
  return {
    sections: structure.sections,
    totalSlides: structure.totalSlides,
    agendaTimings: structure.agendaTimings,
    constraints: structure.constraints
  };
}

/**
 * PASS 1: Generate narrative arc and golden thread connecting all sections
 * @param {string} briefingPack - Briefing pack content
 * @param {string} briefingInstructions - Briefing instructions/guidelines
 * @param {Object} structure - Parsed briefing structure
 * @param {string} analystFirm - Analyst firm name (Gartner, Forrester, etc.)
 * @param {string} aiModel - AI model to use
 * @param {Object} strategicPositioning - (Optional) Pre-defined strategic positioning with key differentiators
 */
async function generateNarrative(briefingPack, briefingInstructions, structure, analystFirm, aiModel, strategicPositioning = null) {
  // Get evaluation criteria for this analyst firm
  const criteria = getFrameworkCriteria(analystFirm);
  const criteriaList = criteria.dimensions
    .map((d, idx) => `${idx + 1}. ${d.name} - ${d.description}`)
    .join('\n');

  const systemPrompt = `You are an expert analyst relations strategist specializing in ${analystFirm} briefings.
Create a compelling narrative arc that connects IBM's capabilities to analyst evaluation criteria.
The narrative must have a "golden thread" - a consistent theme that ties all sections together.

${criteria.framework.toUpperCase()} EVALUATION FRAMEWORK:
This briefing will be scored across ${criteria.dimensions.length} dimensions:
${criteriaList}

Your narrative arc MUST position IBM strongly across ALL these dimensions.
Analyze IBM's positioning and create a coherent story framework that flows across all sections.

${strategicPositioning ? `STRATEGIC POSITIONING GUIDANCE:
These are IBM's approved key differentiators for this briefing. Weave them into the narrative:
${JSON.stringify(strategicPositioning, null, 2).substring(0, 2000)}
` : ''}

Return ONLY valid JSON with no markdown formatting.`;

  const userPrompt = `Create the narrative arc and golden thread for this briefing:

**Briefing Structure**:
${structure.sections.map(s => `- ${s.name} (${s.duration})`).join('\n')}

**Briefing Content**:
${briefingPack.substring(0, 15000)}

**Analyst Expectations**:
${briefingInstructions.substring(0, 3000)}

CRITICAL: Develop IBM's UNIQUE competitive positioning, not generic ERP capabilities.

Focus on:
1. **IBM's Specific Differentiation**: What makes IBM uniquely positioned vs. competitors (not just features)?
2. **Quantified Proof**: Use actual metrics from briefing pack (e.g., timeline compression, productivity gains, delivery scale)
3. **Strategic Narrative**: How does IBM's offering address the analyst firm's evaluation framework?
4. **Market Context**: Position IBM as solution to current market dynamics and buyer challenges
5. **Forward Vision**: What is IBM's strategic direction (AI roadmap, ecosystem, innovation)?

Generate a JSON narrative framework with:
{
  "overarchingTheme": "One compelling sentence that captures IBM's unique market position",
  "narrative": "3-4 paragraph narrative that: (1) establishes market context, (2) articulates IBM's differentiation vs. competitors, (3) proves it with scale/execution/innovation, (4) positions for future",
  "competitiveContext": "How IBM differs from top 2-3 competitors in this space",
  "ibmDifferentiators": [
    "Differentiator 1 with proof point/metric",
    "Differentiator 2 with proof point/metric",
    "Differentiator 3 with proof point/metric"
  ],
  "sectionTransitions": {
    "Section Name": "How this section advances the narrative and proves IBM's positioning"
  },
  "keyMessages": [
    "Message 1 - core value proposition unique to IBM",
    "Message 2 - strategic positioning vs. market",
    "Message 3 - IBM's forward vision/roadmap"
  ],
  "analystCriteria": "How narrative maps to ${analystFirm} evaluation framework (AE and CV positioning)",
  "marketTension": "The key buyer challenge or market dynamic this briefing addresses",
  "recommendedDemoScenarios": [
    "Scenario 1 - demonstrates IBM's differentiation",
    "Scenario 2 - shows AI/automation advantage"
  ]
}`;

  const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
  
  return await retryWithBackoff(async () => {
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
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    return JSON.parse(content);
  });
}

/**
 * Parse briefing structure from briefing pack
 */
async function parseBriefingStructure(briefingPack, briefingInstructions, analystFirm, aiModel) {
  const systemPrompt = `You are an expert at parsing analyst briefing documents.
Extract the presentation structure including all sections, slide titles, timings, and constraints.

CRITICAL: Some sections have SLIDE LIMITS (e.g., "max 3 slides"), others have TIME LIMITS (e.g., "15 minutes").
You MUST identify which constraint type applies to each section and extract it accurately.

Return ONLY valid JSON with no markdown formatting.`;

  const userPrompt = `Read this briefing document THOROUGHLY and extract the complete presentation structure.
Pay special attention to constraints - some sections specify max slides, others specify time duration.

**CRITICAL RULE FOR slideTopics:**
- Extract slideTopics ONLY if they are EXPLICITLY LISTED in the source document
- EXPLICIT LISTS include: numbered lists (1. 2. 3.), bulleted lists (• •), or named sections with clear headings
- Examples of EXPLICIT: "1. Executive Summary ○ Overview of...", "2. Centers of Excellence", "3. Key Messages"
- Examples of NOT EXPLICIT: "Please present five case studies" (no specific titles listed)
- If a section describes activities WITHOUT listing specific slide titles, return slideTopics as EMPTY ARRAY []
- For example: "Part Two: Five Case Studies" with no specific slide titles → slideTopics: []
- DO NOT invent, infer, or generate plausible topics

**CRITICAL FOR MQ/CC SECTIONS (Part Four):**
If a section mentions "MQ Evaluation Criteria" or "Critical Capabilities" AND lists them individually, extract EACH INDIVIDUAL CRITERION as a separate slideTopics entry.
For example, if the document lists:
  1. Customer Experience
  2. Operations  
  3. Offering Strategy
  4. Product/Service
  
Then slideTopics should be: ["Customer Experience", "Operations", "Offering Strategy", "Product/Service"]

DO NOT summarize multiple criteria into generic categories like "MQ Evaluation Criteria".
EXTRACT EACH SPECIFIC CRITERION INDIVIDUALLY - but ONLY if explicitly listed in the document.

${briefingPack.substring(0, 30000)}

${briefingInstructions.substring(0, 8000)}

Return JSON in this format:
{
  "agendaTimings": ["Part One (15min)", "Part Two (45min)", ...],
  "sections": [
    {
      "name": "Part One: Vision and Execution",
      "duration": "15 minutes",
      "constraintType": "time",
      "timeInMinutes": 15,
      "maxSlides": null,
      "slideTopics": ["Executive Summary", "Centers of Excellence & Innovation", "Key Messages", "Strengths & Areas for Improvement", "Sweet Spots & Square Pegs", "Key Risks and Mitigation", "Strategy, Value Proposition, and Key Differentiators"],
      "keyPoints": ["Extract 3-5 key facts that must be covered in this section"]
    },
    {
      "name": "Part Two: Five Case Studies",
      "duration": "45 minutes",
      "constraintType": "time",
      "timeInMinutes": 45,
      "maxSlides": null,
      "slideTopics": [],
      "keyPoints": ["Extract key requirements for case studies if specified"]
    },
    {
      "name": "Part Four: MQ and CC Submission",
      "duration": "30 minutes",
      "constraintType": "slides",
      "timeInMinutes": 30,
      "maxSlides": 16,
      "slideTopics": ["Customer Experience", "Operations", "Offering Strategy", "Product/Service", "Sales Execution", "Sales Strategy", "Business Model", "Viability", "Innovation", "Vertical/Industry Strategy", "Geographic Strategy", "Marketing Strategy", "Marketing Execution"],
      "keyPoints": ["Extract each individual MQ criterion from the document - do not summarize into categories"]
    }
  ],
  "constraints": {
    "totalTimeMinutes": 75,
    "evidenceRequirements": "..."
  },
  "totalSlides": 45
}

CRITICAL: 
- If section says "15 minutes" with NO slide limit → constraintType: "time", maxSlides: null
- If section says "max 3 slides" → constraintType: "slides", maxSlides: 3
- If section has BOTH time AND slide limit → use the STRICTER constraint`;

  const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
  
  return await retryWithBackoff(async () => {
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
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ Azure OpenAI Error ${response.status}:`, errorBody.substring(0, 500));
      throw new Error(`${response.status}`);
    }

    const data = await response.json();
    let structureJSON = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      return JSON.parse(structureJSON);
    } catch (parseError) {
      console.error('❌ Structure JSON parse error:', parseError.message);
      structureJSON = structureJSON.replace(/,(\s*[}\]])/g, '$1');
      try {
        return JSON.parse(structureJSON);
      } catch (secondError) {
        throw new Error('Failed to parse briefing structure: ' + secondError.message);
      }
    }
  });
}

/**
 * STEP 2: Generate slides for a specific section using narrative context
 * CRITICAL: Maps each briefing requirement to specific search queries to pull real data
 */
async function generateSectionSlides(section, briefingPack, briefingInstructions, analystFirm, aiModel, narrative, vendorResponse, onProgress = null) {
  const firmGuidance = getFirmGuidance(analystFirm);
  
  // Get evaluation criteria for this analyst firm
  const criteria = getFrameworkCriteria(analystFirm);
  const criteriaList = criteria.dimensions
    .map((d, idx) => `${idx + 1}. ${d.name} - ${d.description}`)
    .join('\n');

  // COMPREHENSIVE SEARCH QUERIES BY SECTION
  // Uses broader semantic queries to capture all relevant context across documents
  // Retrieves 25 results per query (vs previous 10) for comprehensive coverage
  // 2024 deck examples loaded separately as few-shot learning templates
  const sectionSearchQueries = {
    'Part One: Vision and Execution': [
      // Broader query 1: Strategic positioning and scale
      'IBM Cloud ERP practice vision strategy differentiation scale consultants countries global presence leadership achievements growth investments acquisitions',
      // Broader query 2: Innovation and capabilities
      'IBM Cloud ERP capabilities methodologies frameworks accelerators platforms innovation centers excellence Garage Rapid Discovery IDCP technical expertise',
      // Broader query 3: Partnerships and ecosystem
      'IBM Cloud ERP partnerships ecosystem alliances SAP Oracle Microsoft Workday certifications partner programs collaboration',
      // Broader query 4: Market positioning and results
      'IBM Cloud ERP market position competitive advantage client success outcomes benefits ROI business value transformation'
    ],
    'Part Two: Five Case Studies': [
      // Broader query 1: Financial Management implementations
      'IBM Cloud ERP financial management FM accounting case study customer implementation outcomes results ROI benefits industry transformation',
      // Broader query 2: HCM and Talent implementations
      'IBM Cloud ERP HCM human capital talent payroll workforce case study customer implementation results benefits outcomes employee experience',
      // Broader query 3: Supply Chain implementations
      'IBM Cloud ERP supply chain SCM logistics procurement sourcing manufacturing case study customer implementation results outcomes efficiency',
      // Broader query 4: Cross-functional transformations
      'IBM Cloud ERP customer success case study client results outcomes implementation approach methodology timeline project business value',
      // Broader query 5: Industry-specific examples
      'IBM Cloud ERP case study industry vertical manufacturing retail healthcare financial services public sector customer reference implementation'
    ],
    'Part Three: Questions and Answers': [
      // Single comprehensive query for Q&A
      'IBM Cloud ERP capabilities features benefits competitive advantage differentiation approach methodology accelerators platforms innovation technical expertise'
    ],
    'Part Four: Slides on MQ and CC Submission': [
      // Broader query 1: Execution capabilities
      'IBM Cloud ERP Magic Quadrant Ability to Execute market understanding sales delivery operational excellence customer satisfaction implementation',
      // Broader query 2: Vision and strategy
      'IBM Cloud ERP Completeness of Vision strategy roadmap innovation platform differentiation market positioning future direction',
      // Broader query 3: Critical capabilities assessment
      'IBM Cloud ERP Critical Capabilities evaluation criteria assessment implementation governance change management risk mitigation customer success'
    ]
  };

  // Retrieve requirement-specific data from Azure AI Search
  console.log(`   🔍 Running targeted searches for: "${section.name}"`);
  let requirementContexts = {};
  
  const sectionQueries = sectionSearchQueries[section.name] || [`${section.name} IBM Cloud ERP`];
  
  // Build document type filter based on section and retrieval strategy
  // Strategy: RFI Response is always primary; Fact Source only for Part One
  // See docs/DOCUMENT-RETRIEVAL-STRATEGY.md for details
  let searchFilter;
  if (section.name === 'Part One: Vision and Execution') {
    // Part One: Include RFI Response + Fact Source for supplemental data
    searchFilter = `documentType eq 'rfi_response' OR documentType eq 'fact_source'`;
  } else {
    // Other sections: RFI Response only
    searchFilter = `documentType eq 'rfi_response'`;
  }
  
  // Search queries with document type filtering
  const allQueries = sectionQueries.map(q => ({ query: q, filter: searchFilter, label: `${section.name}` }));
  
  for (let i = 0; i < allQueries.length; i++) {
    const { query, filter, label } = allQueries[i];
    try {
      console.log(`   🔍 Search ${i + 1}/${allQueries.length}${label ? ` (${label})` : ''}: "${query.substring(0, 80)}..."`);
      const searchResults = await searchDocuments(query, 25, filter);
      if (searchResults && searchResults.length > 100) {
        requirementContexts[`search_${i + 1}`] = searchResults;
        console.log(`   ✅ Retrieved ${searchResults.length} characters${label ? ` from ${label}` : ''}`);
      } else {
        console.warn(`   ⚠️  No results for: "${query.substring(0, 80)}..."`);
        requirementContexts[`search_${i + 1}`] = '[No data found]';
      }
      // Small throttle between searches to avoid rate limits
      if (i < allQueries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (searchErr) {
      console.warn(`   ⚠️  Search error for "${query.substring(0, 80)}...":`, searchErr.message);
      requirementContexts[`search_${i + 1}`] = '[Search failed]';
    }
  }

  // Extract 2024 examples for this section as few-shot learning templates
  let deck2024Examples = '';
  try {
    const query2024 = `2024 Cloud ERP Services Submission ${section.name}`;
    console.log(`   📚 Retrieving 2024 deck examples for "${section.name}"...`);
    const examples2024 = await searchDocuments(query2024, 5);
    if (examples2024 && examples2024.length > 100) {
      deck2024Examples = `\n\n2024 DECK EXAMPLES (USE AS QUALITY/STYLE REFERENCE):\n`;
      deck2024Examples += `These examples show the EXPECTED quality, depth, and style.\n`;
      deck2024Examples += `Match this level of detail and evidence-based content for 2026 slides.\n`;
      deck2024Examples += `---\n${examples2024}\n---\n`;
      console.log(`   ✅ Retrieved ${examples2024.length} chars from 2024 deck`);
    }
  } catch (err) {
    console.warn(`   ⚠️  Could not retrieve 2024 examples:`, err.message);
  }

  // Build requirement context string with all search results
  let relevantContext = '\n\nTARGETED DATA FROM AZURE SEARCH (2026 SOURCES):\n';
  relevantContext += '(These search results are the PRIMARY SOURCE for slide content. Use ONLY data from these results.)\n';
  allQueries.forEach((query, i) => {
    relevantContext += `\n---\nSearch ${i + 1}: "${query.query}"\n---\n`;
    relevantContext += (requirementContexts[`search_${i + 1}`] || '[No data found]');
    relevantContext += '\n';
  });

  // Optional: augment Part One with Foundry agent (web knowledge source) for official IBM/newsroom data
  let foundryWebContext = '';
  if (section.name === 'Part One: Vision and Execution') {
    console.log('   🌐 Querying Foundry agent for official IBM/newsroom context...');
    const foundryPrompt = `Provide factual, citation-ready bullets from IBM official and newsroom sources about Cloud ERP: vision, differentiation, scale, geographic footprint, partnership posture, innovation investments, and recent announcements. Avoid marketing fluff; prefer measurable facts, dated announcements, partner designations, and platform innovations. Return concise bullets only.`;
    foundryWebContext = await queryFoundryAgent(foundryPrompt);
    if (foundryWebContext) {
      console.log('   ✅ Foundry agent returned web-grounded context');
      relevantContext += '\n---\nFOUNDRY WEB-GROUNDED CONTEXT (ibm.com/newsroom)\n---\n';
      relevantContext += foundryWebContext;
      relevantContext += '\n';
    } else {
      console.warn('   ⚠️  Foundry agent returned no web context (continuing with Azure Search only)');
    }
  }

  // Calculate slide count based on constraint type
  let slideConstraint = '';
  let targetSlides = 10;
  
  if (section.constraintType === 'slides' && section.maxSlides) {
    // Hard slide limit
    slideConstraint = `HARD LIMIT: Generate EXACTLY ${section.maxSlides} slides (no more, no less)`;
    targetSlides = section.maxSlides;
  } else if (section.constraintType === 'time' && section.timeInMinutes) {
    // Time-based: calculate slides using 1.5 min per slide
    targetSlides = Math.ceil(section.timeInMinutes / 1.5);
    slideConstraint = `TIME CONSTRAINT: ${section.duration} = approximately ${targetSlides} slides (~1.5 min per slide)`;
  } else if (section.maxSlides) {
    // Fallback to maxSlides if present
    slideConstraint = `SLIDE LIMIT: Up to ${section.maxSlides} slides maximum`;
    targetSlides = section.maxSlides;
  }

  // ============================================================================
  // 4-AGENT PIPELINE FOR SLIDE GENERATION (Modular Architecture)
  // ============================================================================
  console.log(`\n   🤖 Using 4-agent pipeline for "${section.name}"...`);
  
  try {
    // STEP 1: Data Extraction Agent - Extract atomic facts from search results
    console.log(`   [1/4] Data Extraction Agent - extracting facts...`);
    const extractionInput = {
      searchResults: relevantContext,
      context: {
        sectionName: section.name,
        analystFirm: analystFirm,
        narrative: {
          theme: narrative.overarchingTheme,
          story: narrative.narrative,
          keyMessages: narrative.keyMessages,
          sectionRole: narrative.sectionTransitions[section.name] || 'Develop key capabilities'
        },
        evaluationCriteria: {
          framework: criteria.framework,
          dimensions: criteria.dimensions.map(d => ({ name: d.name, description: d.description }))
        },
        briefingContext: briefingPack.substring(0, 2000),
        vendorContext: (vendorResponse || '').substring(0, 2000)
      }
    };
    
    const extractedFacts = await agentExtractFacts(extractionInput);
    console.log(`   ✅ Extracted: ${extractedFacts.scale?.length || 0} scale metrics, ${extractedFacts.capabilities?.length || 0} capabilities, ${extractedFacts.partnerships?.length || 0} partnerships`);
    
    // Check source diversity (ensure ibm.com and newsroom represented)
    const checkSourceDiversity = (facts) => {
      const sources = new Set();
      Object.values(facts).forEach(factArray => {
        if (Array.isArray(factArray)) {
          factArray.forEach(fact => {
            if (fact.source) {
              const domain = fact.source.match(/https?:\/\/([^\/]+)/)?.[1];
              if (domain) sources.add(domain);
            }
          });
        }
      });
      
      const hasIbmCom = Array.from(sources).some(s => s.includes('ibm.com'));
      const hasNewsroom = Array.from(sources).some(s => s.includes('newsroom'));
      
      console.log(`   🔍 Source diversity: ${sources.size} unique domains`);
      if (sources.size > 0) {
        console.log(`      - Domains: ${Array.from(sources).slice(0, 5).join(', ')}${sources.size > 5 ? '...' : ''}`);
      }
      if (!hasIbmCom) console.warn(`      ⚠️  No ibm.com sources found - may be missing official content`);
      if (!hasNewsroom) console.warn(`      ⚠️  No newsroom sources found - may be missing press releases`);
      
      return { hasIbmCom, hasNewsroom, totalDomains: sources.size };
    };
    
    checkSourceDiversity(extractedFacts);
    
    if (onProgress) onProgress(4, 6, `📊 STAGE 1: Data Extraction|||Extracted ${extractedFacts.scale?.length || 0} metrics, ${extractedFacts.capabilities?.length || 0} capabilities, ${extractedFacts.partnerships?.length || 0} partnerships`);
    
    // STEP 1.5: Narrative Spine Agent - Generate hidden narrative spine to guide structure/content
    console.log(`   [1.5/5] Narrative Spine Agent - generating hidden narrative spine...`);
    if (onProgress) onProgress(4, 6, `📖 STAGE 2: Strategic Narrative|||Generating narrative spine to guide slide structure and content`);
    let narrativeSpine = null;
    try {
      const rfiContext = {
        sectionName: section.name,
        briefingTheme: narrative.overarchingTheme,
        extractedFacts: extractedFacts,
        evaluationCriteria: criteriaList
      };
      const briefingStructure = {
        duration: section.duration,
        targetSlides: targetSlides,
        requiredTopics: section.slideTopics || [],
        keyMessages: narrative.keyMessages || []
      };
      const spineResult = await agentGenerateSpine(rfiContext, briefingStructure);
      narrativeSpine = spineResult.spine;
      
      // Validate spine completeness
      const spineValidation = await validateSpineCompleteness(narrativeSpine);
      if (!spineValidation.is_complete) {
        console.warn(`   ⚠️  Narrative spine has gaps: ${spineValidation.missing_fields.join(', ')}`);
        if (spineValidation.gaps_count > 0) {
          console.warn(`   ⚠️  ${spineValidation.gaps_count} unconfirmed theses flagged for AR/Offering validation`);
        }
      } else {
        console.log(`   ✅ Narrative spine complete with ${spineValidation.gaps_count} gaps flagged`);
      }
      if (onProgress) onProgress(4, 6, `📖 STAGE 2: Strategic Narrative|||Spine ready (${spineValidation.gaps_count} gaps flagged for validation)`);
    } catch (spineErr) {
      console.error(`   ❌ CRITICAL: Narrative spine generation FAILED`);
      console.error(`   Error: ${spineErr.message}`);
      console.error(`   Stack: ${spineErr.stack}`);
      if (onProgress) onProgress(4, 6, `❌ CRITICAL: Spine generation failed - stopping deck generation`);
      throw new Error(`Narrative spine generation is REQUIRED but failed: ${spineErr.message}`);
    }
    
    // STEP 2: Structure Planning Agent - Plan slide structure and layout distribution
    console.log(`   [2/4] Structure Planning Agent - planning ${targetSlides} slides...`);
    if (onProgress) onProgress(4, 6, `📐 STAGE 3: Structure Planning|||Planning ${targetSlides} slides with layouts and axis alignment`);
    const planningInput = {
      facts: extractedFacts,
      sectionName: section.name,
      targetSlides: targetSlides,
      referenceExamples: deck2024Examples, // Pass as text context for now
      narrativeSpine: narrativeSpine, // Pass hidden spine to guide structure
      narrative: {
        theme: narrative.overarchingTheme,
        sectionRole: narrative.sectionTransitions[section.name] || 'Develop key capabilities'
      },
      evaluationCriteria: criteriaList,
      requiredTopics: section.slideTopics || [],
      keyPoints: section.keyPoints || [],
      constraints: {
        slideConstraint: slideConstraint,
        duration: section.duration
      }
    };
    
    console.log(`   🔍 DEBUG: Planning input for "${section.name}":`, {
      targetSlides,
      requiredTopicsCount: (section.slideTopics || []).length,
      requiredTopics: section.slideTopics || [],
      factsCount: Object.keys(extractedFacts || {}).length
    });
    
    const structurePlan = await agentPlanStructure(planningInput);
    console.log(`   🔍 DEBUG: Structure plan result for "${section.name}": ${structurePlan?.length || 0} slides`);
    
    if (!structurePlan || structurePlan.length === 0) {
      console.warn(`   ⚠️  Structure planning returned empty for "${section.name}"`);
      console.warn(`   📊 Input had: ${(section.slideTopics || []).length} required topics, ${targetSlides} target slides`);
      console.warn(`   ⚠️  This should NOT happen for Part Four - check structure planning agent logic!`);
      return [];
    }
    console.log(`   ✅ Planned ${structurePlan.length} slides with layouts`);
    if (onProgress) onProgress(4, 6, `� STAGE 3: Structure Planning|||Planned ${structurePlan.length} slides with layouts and fact distribution`);
    
    // STEP 3: Content Synthesis Agent - Generate content for each slide
    console.log(`   [3/4] Content Synthesis Agent - generating content for ${structurePlan.length} slides...`);
    if (onProgress) onProgress(4, 6, `📝 STAGE 4: Content Generation|||Synthesizing compelling narratives for ${structurePlan.length} slides`);
    
    // Track used facts AND key phrases to prevent duplication
    const usedFactIds = new Set();
    const factUsageCount = {};
    const usedKeyPhrases = new Map(); // phrase -> { slideIndex, count }
    
    const generatedSlides = [];
    for (let i = 0; i < structurePlan.length; i++) {
      const slidePlan = structurePlan[i];
      console.log(`      - Generating slide ${i + 1}/${structurePlan.length}: "${slidePlan.topic}"`);
      if (onProgress) onProgress(4, 6, `📝 STAGE 4: Content Generation|||Slide ${i + 1} of ${structurePlan.length}: "${slidePlan.topic}"`);
      
      const synthesisInput = {
        slidePlan: slidePlan,
        facts: extractedFacts,
        narrativeSpine: narrativeSpine, // Pass spine for narrative consistency
        referenceExamples: deck2024Examples, // Pass as text context
        narrative: {
          theme: narrative.overarchingTheme,
          keyMessages: narrative.keyMessages
        },
        evaluationCriteria: criteriaList,
        usedFactIds: Array.from(usedFactIds), // Pass already-used facts
        factUsageCount: factUsageCount, // Pass usage statistics
        usedKeyPhrases: Array.from(usedKeyPhrases.keys()) // Pass repeated phrases to AVOID
      };
      
      const generatedSlide = await agentSynthesizeContent(synthesisInput);
      
      // Track facts used in this slide to prevent repetition
      if (generatedSlide.evidence) {
        const factIds = generatedSlide.evidence.match(/\[(\w+)\[(\d+)\]\]/g) || [];
        factIds.forEach(id => {
          usedFactIds.add(id);
          factUsageCount[id] = (factUsageCount[id] || 0) + 1;
        });
        
        // Warn if facts heavily reused
        const overusedFacts = Object.entries(factUsageCount)
          .filter(([_, count]) => count >= 3)
          .map(([id]) => id);
        if (overusedFacts.length > 0) {
          console.warn(`      ⚠️  Facts reused 3+ times: ${overusedFacts.join(', ')}`);
        }
      }
      
      // CRITICAL: Track key metric phrases to detect duplication
      const slideText = extractSlideText(generatedSlide);
      const keyMetrics = slideText.match(/\b\d+\s*(?:%|percent)\b/gi) || [];
      const keyPhrases = [
        ...keyMetrics,
        ...slideText.match(/\b(?:implementation|timeline|productivity|return rate|consultants|countries|reduction|improvement|increase|gain)[s]?\s+(?:by|of|across)?\s*\d+\s*(?:%|percent|countries|consultants)?\b/gi) || []
      ];
      
      keyPhrases.forEach(phrase => {
        const normalized = phrase.toLowerCase().trim();
        if (usedKeyPhrases.has(normalized)) {
          const existing = usedKeyPhrases.get(normalized);
          existing.count++;
          existing.slides.push(i + 1);
          if (existing.count >= 3) {
            console.warn(`      ⚠️  REPEATED PHRASE (${existing.count}x): "${phrase}" on slides ${existing.slides.join(', ')}`);
          }
        } else {
          usedKeyPhrases.set(normalized, { count: 1, slides: [i + 1] });
        }
      });
      
      generatedSlides.push(generatedSlide);
      
      // Throttle generation to prevent TPM rate limits (3s delay)
      if (i < structurePlan.length - 1) {
        process.stdout.write('.'); // Show activity during wait
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    console.log(`\n   ✅ Generated ${generatedSlides.length} complete slides`);
    if (onProgress) onProgress(4, 6, `📝 STAGE 4: Content Generation|||Completed ${generatedSlides.length} slides with evidence citations`);
    
    // STEP 3.5: Narrative Transformation Agent - Transform to executive briefing style
    console.log(`   [3.5/5] Narrative Transformation Agent - transforming to executive briefing style...`);
    if (onProgress) onProgress(4, 6, `✨ STAGE 5: Executive Polish|||Transforming ${generatedSlides.length} slides to executive briefing style`);
    const transformedSlides = [];
    for (let i = 0; i < generatedSlides.length; i++) {
      const slide = generatedSlides[i];
      
      // Determine narrative arc stage based on section
      let arcStage = 'proof'; // Default
      if (section.name?.toLowerCase().includes('vision') || section.name?.toLowerCase().includes('executive summary')) {
        arcStage = 'vision';
      } else if (section.name?.toLowerCase().includes('case') || section.name?.toLowerCase().includes('use case')) {
        arcStage = 'outcomes';
      } else if (section.name?.toLowerCase().includes('innovation') || section.name?.toLowerCase().includes('roadmap') || section.name?.toLowerCase().includes('future')) {
        arcStage = 'innovation';
      }
      
      const transformContext = {
        arcStage,
        sectionName: section.name,
        analystFirm,
        slideNumber: i + 1,
        narrativeSpine: narrativeSpine // Pass spine for narrative consistency
      };
      
      if (onProgress) onProgress(4, 6, `✨ STAGE 5: Executive Polish|||Polishing slide ${i + 1} of ${generatedSlides.length}`);
      const transformedSlide = await agentTransformNarrative(slide, transformContext);
      transformedSlides.push(transformedSlide);
      
      // Throttle transformation (3s delay)
      if (i < generatedSlides.length - 1) {
        process.stdout.write('.'); // Show activity
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    console.log(`\n   ✅ Transformed ${transformedSlides.length} slides to executive briefing style`);
    if (onProgress) onProgress(4, 6, `✅ Transformed ${transformedSlides.length} slides to executive briefing style...`);
    
    // STEP 4: Quality Validation Agent - Validate all slides
    console.log(`   [4/5] Quality Validation Agent - validating ${transformedSlides.length} slides...`);
    if (onProgress) onProgress(4, 6, `🔍 STAGE 6: Quality Validation|||Validating ${transformedSlides.length} slides for evidence and compliance`);
    const validationResult = await agentValidateBatch(transformedSlides, deck2024Examples, extractedFacts, narrativeSpine);
    
    const passCount = validationResult.slideResults.filter(r => r.overallPass).length;
    const avgScore = parseFloat(validationResult.averageScore);
    const passRate = parseFloat(validationResult.passRate);
    console.log(`   ✅ Validation: ${passCount}/${transformedSlides.length} passed (${passRate.toFixed(1)}%), avg score: ${avgScore}/100`);
    if (onProgress) onProgress(4, 6, `🔍 STAGE 6: Quality Validation|||Completed - ${passCount} of ${transformedSlides.length} slides passed (${passRate.toFixed(1)}% avg: ${avgScore.toFixed(0)}/100)`);
    
    // Show sample issues from validation
    const allIssues = validationResult.slideResults.flatMap(r => r.issues || []);
    if (allIssues.length > 0) {
      console.log(`   ⚠️  Common issues detected:`);
      allIssues.slice(0, 3).forEach(issue => {
        console.log(`      - ${issue}`);
      });
    }
    
    // Apply case study placeholders if needed
    const ensureCasePlaceholders = (parsedSlides) => {
    const isCaseSection = section.name?.toLowerCase().includes('case');
    if (!isCaseSection) return parsedSlides;

    const useCases = section.slideTopics && section.slideTopics.length >= 5
      ? section.slideTopics
      : [
          'Financial Management (ERP)',
          'HR/Payroll Implementation',
          'Supply Chain Management',
          'Sourcing & Procurement',
          'Manufacturing'
        ];

    const gridSlide = {
      layout: 'L3_Case_Card_Grid',
      title: 'Case Study Overview',
      subtitle: 'Required five cases',
      content: {
        cards: useCases.map((uc, idx) => ({
          case_title: `Case Study ${idx + 1}`,
          use_case: uc,
          industry: '{TO_FILL}',
          region: '{TO_FILL}',
          outcome_kpi: '{TO_FILL}',
          timeframe: '{TO_FILL}',
          reference_status: '{TO_FILL}'
        }))
      },
      evidence: '',
      mq_mapping: [],
      gap_flag: true
    };

    const deepDives = useCases.map((uc, idx) => ({
      layout: 'L4_OneCase_DeepDive',
      title: `Case Study ${idx + 1}: ${uc}`,
      subtitle: uc,
      content: {
        case_title: `Case Study ${idx + 1}`,
        use_case: uc,
        industry: '{TO_FILL}',
        region: '{TO_FILL}',
        challenge: '{TO_FILL}',
        approach: '{TO_FILL}',
        capabilities: '{TO_FILL}',
        outcome_kpi: '{TO_FILL}',
        timeframe: '{TO_FILL}',
        reference_status: '{TO_FILL}'
      },
      evidence: '',
      mq_mapping: [],
      gap_flag: true
    }));

    // Ensure overview + five deep dives exist
    const retained = parsedSlides.filter(s => s.layout && !s.layout.startsWith('L4_'));
    return [gridSlide, ...deepDives, ...retained];
  };

    // Return agent-generated slides with case study placeholders if needed
    const finalSlides = ensureCasePlaceholders(transformedSlides);
    return finalSlides;
    
  } catch (agentError) {
    console.error('❌ 4-agent pipeline failed:', agentError.message);
    console.error('   Stack:', agentError.stack);
    // Return empty array on error rather than crashing entire deck generation
    return [];
  }
}

/**
 * STEP 3: Generate Q&A bank from briefing instructions
 */
async function generateQABank(briefingInstructions, analystFirm, aiModel) {
  // Get evaluation criteria for this analyst firm
  const criteria = getFrameworkCriteria(analystFirm);
  const focusAreas = criteria.dimensions
    .map((d, idx) => `${idx + 1}. ${d.name} - ${d.evaluationFocus}`)
    .join('\n');

  const systemPrompt = `You are an expert at anticipating analyst questions for ${analystFirm} briefings.
Generate a Q&A bank with questions analysts are likely to ask based on the briefing requirements.
Return slides in layout L10_QA_Bank using the JSON contract:
{
  "layout": "L10_QA_Bank",
  "title": "Q&A Bank",
  "content": {
    "items": [ {"question": "...", "answer": "{TO_FILL}" or grounded answer, "evidence": "RFI §..."} ]
  },
  "evidence": "RFI § refs",
  "mq_mapping": ["..."],
  "gap_flag": true/false
}

${criteria.framework.toUpperCase()} FOCUS AREAS:
Analysts will probe these dimensions during Q&A:
${focusAreas}

Anticipate tough questions that test IBM's claims and positioning.
Return ONLY valid JSON array with no markdown formatting.`;

  const userPrompt = `Generate anticipated Q&A based on these briefing requirements:

${briefingInstructions.substring(0, 2000)}

Generate 10-15 high-impact Q&A items mapped to ${criteria.framework} dimensions.
Return JSON array where each element is a slide in layout L10_QA_Bank with content.items[] as described in the system prompt. Use {TO_FILL} when no grounded answer is available and set gap_flag=true for that slide.`;

  const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
  
  return await retryWithBackoff(async () => {
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
        temperature: 0.4,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      throw new Error(`Q&A generation failed: ${response.status}`);
    }

    const data = await response.json();
    let qaJSON = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      return JSON.parse(qaJSON);
    } catch (parseError) {
      console.error('❌ Q&A JSON parse error:', parseError.message);
      qaJSON = qaJSON.replace(/,(\s*[}\]])/g, '$1');
      try {
        return JSON.parse(qaJSON);
      } catch (secondError) {
        console.error('❌ Returning empty Q&A bank');
        return [];
      }
    }
  });
}

/**
 * Get firm-specific guidance
 */
function getFirmGuidance(firm) {
  const guidance = {
    'Gartner': `**Gartner Magic Quadrant Guidance:**
Structure content to demonstrate Ability to Execute and Completeness of Vision.
Keep Cloud ERP services competencies explicit: assessment → implementation → change management → data transformation → run/evolve.`,

    'Forrester': `**Forrester Wave Guidance:**
Follow scenario-driven demo mindset with weighted criteria.
Split Current Offering (today's capabilities) vs Strategy (future direction).
Emphasize business outcomes and customer experience.`,

    'IDC': `**IDC MarketScape Guidance:**
Keep Capabilities (today) separate from Strategies (future).
Follow format/PR constraints from the pack.
Emphasize market understanding and vertical/geographic coverage.`,

    'Everest Group': `**Everest PEAK Matrix Guidance:**
Emphasize Delivery Capability and Market Success.
Include buyer satisfaction evidence if requested.
Focus on service delivery excellence and customer outcomes.`
  };

  return guidance[firm] || guidance['Gartner'];
}

/**
 * Compute gap stats from slides (gap_flag or {TO_FILL})
 */
function computeGaps(slides) {
  const total = slides.length;
  const gaps = slides.filter((s) => s.gap_flag || JSON.stringify(s).includes('{TO_FILL}'));
  return {
    totalRequirements: total,
    metRequirements: total - gaps.length,
    gaps: gaps.map((g, idx) => `Gap ${idx + 1}: ${g.title || g.section || 'Slide'} has missing content`)
  };
}

/**
 * Convert deck structure to markdown (TEMPORARY BYPASS for testing)
 */
export const createMarkdownFromDeck = async (deckStructure) => {
  console.log('📝 [BRIEFING DECK] Creating Markdown from deck structure (TEMPORARY BYPASS)...');
  
  try {
    let markdown = '# Briefing Deck\n\n';
    
    // Add metadata if present
    if (deckStructure.title) {
      markdown += `**Title:** ${deckStructure.title}\n\n`;
    }
    if (deckStructure.subtitle) {
      markdown += `**Subtitle:** ${deckStructure.subtitle}\n\n`;
    }
    
    // Add slides
    if (deckStructure.slides && deckStructure.slides.length > 0) {
      markdown += `## Slides (${deckStructure.slides.length} total)\n\n`;
      
      deckStructure.slides.forEach((slide, idx) => {
        markdown += `### Slide ${idx + 1}: ${slide.title || 'Untitled'}\n\n`;
        
        if (slide.layout) {
          markdown += `**Layout:** ${slide.layout}\n\n`;
        }
        
        if (slide.intro) {
          markdown += `**Intro:** ${slide.intro}\n\n`;
        }
        
        // Handle various content formats
        if (slide.content) {
          const c = slide.content;
          
          if (c.key_bullets && Array.isArray(c.key_bullets)) {
            markdown += '**Key Points:**\n';
            c.key_bullets.forEach(bullet => {
              const text = typeof bullet === 'object' ? bullet.text : bullet;
              // NO SOURCE IN MAIN CONTENT - moved to speaker notes
              markdown += `- ${text}\n`;
            });
            markdown += '\n';
          }
          
          if (c.left_bullets && Array.isArray(c.left_bullets)) {
            markdown += '**Left Column:**\n';
            c.left_bullets.forEach(bullet => {
              const text = typeof bullet === 'object' ? bullet.text : bullet;
              // NO SOURCE IN MAIN CONTENT
              markdown += `- ${text}\n`;
            });
            markdown += '\n';
          }
          
          if (c.right_bullets && Array.isArray(c.right_bullets)) {
            markdown += '**Right Column:**\n';
            c.right_bullets.forEach(bullet => {
              const text = typeof bullet === 'object' ? bullet.text : bullet;
              // NO SOURCE IN MAIN CONTENT
              markdown += `- ${text}\n`;
            });
            markdown += '\n';
          }
          
          if (c.cards && Array.isArray(c.cards)) {
            markdown += '**Case Studies/Cards:**\n';
            c.cards.forEach((card, cardIdx) => {
              markdown += `${cardIdx + 1}. ${card.case_title || `Card ${cardIdx + 1}`}\n`;
              if (card.use_case) markdown += `   - Use case: ${card.use_case}\n`;
              if (card.industry) markdown += `   - Industry: ${card.industry}\n`;
              if (card.region) markdown += `   - Region: ${card.region}\n`;
              if (card.outcome_kpi) markdown += `   - Outcome: ${card.outcome_kpi}\n`;
              if (card.reference_status) markdown += `   - Reference: ${card.reference_status}\n`;
            });
            markdown += '\n';
          }
          
          if (c.items && Array.isArray(c.items)) {
            markdown += '**Items/Q&A:**\n';
            c.items.forEach((item, itemIdx) => {
              if (typeof item === 'object') {
                markdown += `${itemIdx + 1}. ${item.question || item.title || 'Item'}\n`;
                if (item.answer) markdown += `   Answer: ${item.answer}\n`;
                if (item.evidence) markdown += `   Evidence: ${item.evidence}\n`;
              } else {
                markdown += `${itemIdx + 1}. ${item}\n`;
              }
            });
            markdown += '\n';
          }
          
          if (c.tiles && Array.isArray(c.tiles)) {
            markdown += '**Tiles:**\n';
            c.tiles.forEach((tile, tileIdx) => {
              markdown += `${tileIdx + 1}. ${tile.title || tile.label || `Tile ${tileIdx + 1}`}\n`;
              if (tile.value) markdown += `   Value: ${tile.value}\n`;
              if (tile.content) markdown += `   ${tile.content}\n`;
              if (tile.context) markdown += `   Context: ${tile.context}\n`;
            });
            markdown += '\n';
          }
        }
        
        // SPEAKER NOTES SECTION (moved from inline citations)
        markdown += '**Speaker Notes:**\n';
        
        // Add evidence/citations to speaker notes
        if (slide.evidence) {
          markdown += `- Evidence: ${slide.evidence}\n`;
        }
        if (slide.evidenceCitations && Array.isArray(slide.evidenceCitations)) {
          slide.evidenceCitations.forEach(citation => {
            markdown += `- Source: ${citation}\n`;
          });
        }
        
        // Add source references from bullets to speaker notes
        if (slide.content) {
          const c = slide.content;
          let sources = [];
          
          // Collect sources from bullets
          if (c.key_bullets && Array.isArray(c.key_bullets)) {
            c.key_bullets.forEach(bullet => {
              if (typeof bullet === 'object' && bullet.source) {
                sources.push(bullet.source);
              }
            });
          }
          if (c.left_bullets && Array.isArray(c.left_bullets)) {
            c.left_bullets.forEach(bullet => {
              if (typeof bullet === 'object' && bullet.source) {
                sources.push(bullet.source);
              }
            });
          }
          if (c.right_bullets && Array.isArray(c.right_bullets)) {
            c.right_bullets.forEach(bullet => {
              if (typeof bullet === 'object' && bullet.source) {
                sources.push(bullet.source);
              }
            });
          }
          if (c.tiles && Array.isArray(c.tiles)) {
            c.tiles.forEach(tile => {
              if (tile.source) {
                sources.push(tile.source);
              }
            });
          }
          
          // Remove duplicates and add to speaker notes
          sources = [...new Set(sources)];
          if (sources.length > 0) {
            markdown += `- Source references: ${sources.join('; ')}\n`;
          }
        }
        
        // Add MQ mapping to speaker notes
        if (slide.mq_mapping && Array.isArray(slide.mq_mapping)) {
          markdown += `- MQ Criteria Mapping: ${slide.mq_mapping.join('; ')}\n`;
        }
        
        // Add talking points if present
        if (slide.speakerNotes) {
          markdown += `- Talking point: ${slide.speakerNotes}\n`;
        }
        
        markdown += '\n---\n\n';
      });
    }
    
    // Convert markdown to buffer
    const buffer = Buffer.from(markdown, 'utf-8');
    
    console.log('✅ [BRIEFING DECK] Markdown created (TEMPORARY BYPASS)');
    console.log(`   Size: ${(buffer.length / 1024).toFixed(2)} KB`);
    
    return { markdown, buffer };
  } catch (error) {
    console.error('❌ [BRIEFING DECK] Error creating markdown:', error);
    throw error;
  }
};

/**
 * Create PowerPoint from generated deck structure using IBM template
 * TEMPORARILY DISABLED - using markdown instead
 */
export const createPresentationFromDeck = async (deckStructure) => {
  console.log('📊 [BRIEFING DECK] Creating PowerPoint from deck structure (USING MARKDOWN BYPASS)...');
  console.log('   Deck structure keys:', Object.keys(deckStructure || {}));
  console.log('   Slides count:', deckStructure?.slides?.length || 0);
  console.log('   Deck slides type:', typeof deckStructure?.slides);

  try {
    // TEMPORARY: Use markdown instead of PowerPoint
    const { buffer } = await createMarkdownFromDeck(deckStructure);
    return buffer;
    
    /* ORIGINAL POWERPOINT CODE - COMMENTED OUT FOR TESTING
    const templateDir = path.join(__dirname, '..', 'templates');
    const outputDir = path.join(__dirname, '..', 'output');
    
    // Ensure output directory exists
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (mkdirErr) {
      // Directory might already exist, that's OK
    }

    // Initialize pptx-automizer
    const automizer = new Automizer({
      templateDir,
      outputDir,
      removeExistingSlides: true,
      cleanup: true,
      compression: 0,
      verbosity: 0
    });

    console.log('   ✅ Automizer initialized');
    console.log('   📋 Loading IBM template: ibm-template.pptx');

    // Load IBM template (now with clean blank slide)
    const pres = automizer.loadRoot('ibm-template.pptx');
    automizer.load('ibm-template.pptx', 'ibm-template.pptx');

    console.log('   ✅ IBM template loaded');
    console.log(`   📄 Adding ${deckStructure.slides?.length || 0} slides...`);

    // IBM styling constants
    const ibm = {
      blue: '002D9C',
      gray: '262626',
      grayMid: '525252',
      green: '24A148',
      warn: 'DD1100',
      warnFill: 'FFF3E0',
      evidenceFill: 'E8F5E9'
    };
    const fontFace = 'Arial';

    // Add slides from deck structure
    if (deckStructure.slides && deckStructure.slides.length > 0) {
      deckStructure.slides.forEach((slide, slideIdx) => {
        // Use blank slide template from IBM template
        pres.addSlide('ibm-template.pptx', 1, (targetSlide) => {
          targetSlide.generate((pptSlide) => {
            console.log(`      Rendering slide ${slideIdx + 1}: ${slide.title} (${slide.layout || 'L2'})`);
            const layout = slide.layout || (slide.isSectionDivider ? 'L1_Executive_Header' : 'L2_TwoColumn_Proof');
            // Collect sources from content objects to ensure evidence is captured
            let collectedSources = [];
            const c = slide.content || {};
            
            if (Array.isArray(c.key_bullets)) {
                collectedSources = c.key_bullets.map(b => typeof b === 'object' ? b.source : null);
            } else if (c.left_bullets || c.right_bullets) {
                const l = c.left_bullets || [];
                const r = c.right_bullets || [];
                collectedSources = [...l, ...r].map(b => typeof b === 'object' ? b.source : null);
            } else if (c.tiles) { // L5
                collectedSources = c.tiles.map(t => t.source);
            } else if (c.cards) { // L3
                collectedSources = c.cards.map(t => t.reference_status || t.source); // Fallback to ref status if source missing
            } else if (c.items) { // L10
                collectedSources = c.items.map(i => i.evidence || i.source); // Q&A might have evidence field
            }
            
            // Filter empty and unique
            const uniqueSources = [...new Set(collectedSources.filter(s => s && s.length > 0 && s !== '{TO_FILL}'))];
            
            const evidenceText = slide.evidence || (slide.evidenceCitations ? slide.evidenceCitations.join('; ') : '') || uniqueSources.join('; ');

            const addEvidence = (yPos) => {
              if (!evidenceText) return;
              pptSlide.addShape('rect', {
                x: 0.5,
                y: yPos,
                w: 9.0,
                h: 0.5,
                fill: { color: ibm.evidenceFill },
                line: { color: ibm.green, width: 1 }
              });
              pptSlide.addText(`📌 Evidence: ${evidenceText}`, {
                x: 0.6,
                y: yPos + 0.05,
                w: 8.8,
                h: 0.4,
                fontSize: 10,
                color: ibm.green,
                fontFace,
                align: 'left',
                valign: 'middle'
              });
            };

            const renderL1 = () => {
              // Layout optimized for 16:9 (10x5.625)
              pptSlide.addText(slide.title || 'Untitled', {
                x: 0.5, y: 0.3, w: 9.0, h: 0.6,
                fontSize: 24, bold: true, color: ibm.blue, fontFace, align: 'left', wrap: true
              });
              if (slide.intro) {
                 pptSlide.addText(slide.intro, {
                  x: 0.5, y: 1.0, w: 9.0, h: 0.7, // Narrative intro
                  fontSize: 14, color: ibm.gray, fontFace, align: 'left', wrap: true
                });
              }
              const bullets = slide.content?.key_bullets || slide.content || [];
              if (bullets?.length) {
                pptSlide.addText(
                  bullets.map((b) => ({ 
                    text: typeof b === 'object' ? b.text : b, 
                    options: { bullet: true, fontSize: 13, color: ibm.gray, lineSpacing: 20, breakLine: true } 
                  })),
                  { x: 0.5, y: 1.8, w: 9.0, h: 3.2, fontFace, align: 'left' }
                );
              }
              addEvidence(5.1);
            };

            const renderL2 = () => {
              pptSlide.addText(slide.title || 'Untitled', {
                x: 0.5, y: 0.3, w: 9.0, h: 0.6,
                fontSize: 22, bold: true, color: ibm.blue, fontFace, align: 'left', wrap: true
              });
              if (slide.intro) {
                pptSlide.addText(slide.intro, {
                  x: 0.5, y: 0.9, w: 9.0, h: 0.6,
                  fontSize: 12, italic: true, color: ibm.grayMid, fontFace, align: 'left', wrap: true
                });
              }
              
              // Handle both old format (content as array) and new format (content.left_bullets/right_bullets)
              let left = [];
              let right = [];
              
              if (Array.isArray(slide.content)) {
                const mid = Math.ceil(slide.content.length / 2);
                left = slide.content.slice(0, mid);
                right = slide.content.slice(mid);
              } else if (slide.content?.left_bullets || slide.content?.right_bullets) {
                left = slide.content.left_bullets || [];
                right = slide.content.right_bullets || [];
              }
              
              const mapBullet = (b) => ({ 
                text: typeof b === 'object' ? b.text : b, 
                options: { bullet: true, fontSize: 11, color: ibm.gray, lineSpacing: 18, breakLine: true } 
              });

              if (left.length > 0) {
                pptSlide.addText(left.map(mapBullet), {
                  x: 0.5, y: 1.6, w: 4.4, h: 2.8, fontFace, align: 'left', valign: 'top'
                });
              }
              if (right.length > 0) {
                pptSlide.addText(right.map(mapBullet), {
                  x: 5.0, y: 1.6, w: 4.4, h: 2.8, fontFace, align: 'left', valign: 'top'
                });
              }
              
              // Only render metric strip if explicitly provided
              const tiles = slide.content?.metric_strip || [];
              if (tiles.length > 0) {
                tiles.slice(0, 3).forEach((t, idx) => {
                  pptSlide.addShape('rect', {
                    x: 0.5 + idx * 3.1,
                    y: 4.5,
                    w: 3.0,
                    h: 0.8,
                    fill: { color: 'F4F4F4' },
                    line: { color: ibm.blue, width: 1 }
                  });
                  pptSlide.addText(`${t.label || ''}: ${t.value || ''}`, {
                    x: 0.6 + idx * 3.1,
                    y: 4.55,
                    w: 2.8,
                    h: 0.3,
                    fontSize: 10,
                    color: ibm.blue,
                    fontFace,
                    wrap: true
                  });
                  if (t.context) {
                    pptSlide.addText(t.context, {
                      x: 0.6 + idx * 3.1,
                      y: 4.85,
                      w: 2.8,
                      h: 0.3,
                      fontSize: 9,
                      color: ibm.grayMid,
                      fontFace,
                      wrap: true
                    });
                  }
                });
              }
              addEvidence(5.4);
            };

            const renderL5 = () => {
              pptSlide.addText(slide.title || 'Headline Metrics', {
                x: 0.5, y: 0.3, w: 9.0, h: 0.6,
                fontSize: 24, bold: true, color: ibm.blue, fontFace, align: 'left', wrap: true
              });
              const tiles = slide.content?.tiles || [];
              tiles.slice(0, 3).forEach((t, idx) => {
                pptSlide.addShape('rect', {
                  x: 0.5 + idx * 3.1,
                  y: 1.5,
                  w: 3.0,
                  h: 2.0,
                  fill: { color: 'F4F4F4' },
                  line: { color: ibm.blue, width: 1 }
                });
                const label = t.label || '';
                const value = t.value || '';
                
                if (label) {
                   pptSlide.addText(label, { x: 0.6 + idx * 3.1, y: 1.6, w: 2.8, h: 0.4, fontSize: 12, color: ibm.grayMid, fontFace, wrap: true });
                }
                if (value) {
                   pptSlide.addText(value, { x: 0.6 + idx * 3.1, y: 2.0, w: 2.8, h: 0.6, fontSize: 24, bold: true, color: ibm.blue, fontFace, align: 'left' });
                }
                
                pptSlide.addText(t.context || '', { x: 0.6 + idx * 3.1, y: 2.7, w: 2.8, h: 0.4, fontSize: 10, color: ibm.grayMid, fontFace, wrap: true });
                pptSlide.addText(t.source || '', { x: 0.6 + idx * 3.1, y: 3.1, w: 2.8, h: 0.3, fontSize: 9, color: ibm.grayMid, fontFace, wrap: true });
              });
              addEvidence(5.1);
            };

            const renderL3 = () => {
              pptSlide.addText(slide.title || 'Case Study Overview', {
                x: 0.5, y: 0.3, w: 9.0, h: 0.6,
                fontSize: 24, bold: true, color: ibm.blue, fontFace, align: 'left', wrap: true
              });
              const cards = slide.content?.cards || [];
              // Optimized coordinates for 16:9 (5.625 height)
              const positions = [
                { x: 0.5, y: 1.1 }, { x: 4.9, y: 1.1 }, 
                { x: 0.5, y: 2.5 }, { x: 4.9, y: 2.5 }, 
                { x: 2.7, y: 3.9 }
              ];
              cards.slice(0, positions.length).forEach((c, idx) => {
                const pos = positions[idx];
                pptSlide.addShape('rect', {
                  x: pos.x, y: pos.y, w: 3.8, h: 1.3,
                  fill: { color: 'F4F4F4' }, line: { color: ibm.blue, width: 1 }
                });
                pptSlide.addText(c.case_title || `Case ${idx + 1}`, { x: pos.x + 0.1, y: pos.y + 0.05, w: 3.6, h: 0.3, fontSize: 11, bold: true, color: ibm.blue, fontFace, wrap: true });
                
                const lines = [];
                if (c.use_case) lines.push(`Use case: ${c.use_case}`);
                if (c.industry || c.region) lines.push(`Industry: ${c.industry || ''} ${c.region ? '/ ' + c.region : ''}`);
                if (c.outcome_kpi) lines.push(`Outcome: ${c.outcome_kpi}`);
                if (c.reference_status) lines.push(`Ref: ${c.reference_status}`);

                pptSlide.addText(lines.join('\n'), { x: pos.x + 0.1, y: pos.y + 0.35, w: 3.6, h: 0.9, fontSize: 9, color: ibm.gray, fontFace, wrap: true });
              });
              addEvidence(5.4);
            };

            const renderL4 = () => {
              pptSlide.addText(slide.title || slide.content?.case_title || 'Case Study', {
                x: 0.5, y: 0.3, w: 9.0, h: 0.6,
                fontSize: 24, bold: true, color: ibm.blue, fontFace, align: 'left', wrap: true
              });
              
              const lines = [];
              if (slide.content?.use_case) lines.push(`Use case: ${slide.content.use_case}`);
              if (slide.content?.industry || slide.content?.region) lines.push(`Industry/Region: ${slide.content.industry || ''} / ${slide.content.region || ''}`);
              if (slide.content?.challenge) lines.push(`Challenge: ${slide.content.challenge}`);
              if (slide.content?.approach) lines.push(`Approach: ${slide.content.approach}`);
              if (slide.content?.capabilities) lines.push(`Capabilities: ${slide.content.capabilities}`);
              if (slide.content?.outcome_kpi) lines.push(`Outcomes: ${slide.content.outcome_kpi} ${slide.content.timeframe ? '(' + slide.content.timeframe + ')' : ''}`);
              if (slide.content?.reference_status) lines.push(`Reference: ${slide.content.reference_status}`);
              
              pptSlide.addText(lines.join('\n\n'), {
                x: 0.5, y: 1.1, w: 9.0, h: 4.0,
                fontSize: 12, color: ibm.gray, fontFace, wrap: true
              });
              addEvidence(5.2);
            };

            const renderL10 = () => {
              pptSlide.addText(slide.title || 'Q&A Bank', {
                x: 0.5, y: 0.3, w: 9.0, h: 0.6,
                fontSize: 24, bold: true, color: ibm.blue, fontFace, align: 'left', wrap: true
              });
              const items = slide.content?.items || [];
              const qaText = items.map((qa, idx) => {
                 const q = qa.question ? `${idx + 1}. ${qa.question}` : '';
                 const a = qa.answer ? qa.answer : '';
                 return q && a ? `${q}\n${a}` : (q || a);
              }).filter(t => t).join('\n\n');
              
              if (qaText) {
                pptSlide.addText(qaText, {
                    x: 0.5, y: 1.1, w: 9.0, h: 4.0, fontFace, align: 'left',
                    fontSize: 11, color: ibm.gray
                });
              }
              addEvidence(5.2);
            };

            switch (layout) {
              case 'L1_Executive_Header':
                renderL1();
                break;
              case 'L2_TwoColumn_Proof':
                renderL2();
                break;
              case 'L5_Metric_Tiles_3x1':
                renderL5();
                break;
              case 'L3_Case_Card_Grid':
                renderL3();
                break;
              case 'L4_OneCase_DeepDive':
                renderL4();
                break;
              case 'L10_QA_Bank':
                renderL10();
                break;
              default:
                renderL2();
                break;
            }
          });
        });
      });
    }

    console.log('   💾 Writing presentation file...');
    
    // Write to buffer
    const outputFilename = `briefing-${Date.now()}.pptx`;
    await pres.write(outputFilename);
    
    // Read the file back as buffer
    const outputPath = path.join(outputDir, outputFilename);
    const buffer = await fs.readFile(outputPath);
    
    // Clean up the file (we only need the buffer)
    await fs.unlink(outputPath);

    console.log('✅ [BRIEFING DECK] PowerPoint created with IBM template');
    console.log(`   Size: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Content rendered on clean IBM template`);

    return buffer;
    */
  } catch (error) {
    console.error('❌ [BRIEFING DECK] Error creating PowerPoint:', error);
    throw error;
  }
};

export default {
  generateBriefingDeck,
  createPresentationFromDeck,
  createMarkdownFromDeck
};
