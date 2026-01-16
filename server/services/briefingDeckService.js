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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Azure OpenAI configuration
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

/**
 * Retry helper for Azure OpenAI calls with exponential backoff
 * Handles 429 rate limits automatically
 * Azure OpenAI S0 tier resets quotas every 60 seconds
 */
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
 * @returns {Promise<Object>} Deck structure with slides, traceability, gaps, Q&A
 */
export const generateBriefingDeck = async (
  briefingPack,
  briefingInstructions,
  vendorResponse,
  analystFirm = 'Gartner',
  aiModel = null,  // Deprecated - using Azure OpenAI
  onProgress = null
) => {
  console.log('📊 [BRIEFING DECK] Starting multi-pass deck generation...');
  console.log(`   Analyst firm: ${analystFirm}`);
  console.log(`   Using: Azure OpenAI (${AZURE_OPENAI_DEPLOYMENT}) + Azure AI Search`);
  console.log(`   Briefing pack length: ${briefingPack.length} chars`);
  console.log(`   Instructions length: ${briefingInstructions.length} chars`);
  console.log(`   Vendor response: Using Azure AI Search (512 indexed chunks)`);

  // Validate input content is not extraction error strings
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
    emitProgress(0, 6, 'Extracting structured facts...');
    const baseFacts = await extractFacts(briefingPack, briefingInstructions, analystFirm, vendorResponse);
    const enrichedFacts = await enrichFacts(baseFacts, briefingPack, briefingInstructions, vendorResponse);

    // STEP 1: Parse briefing pack to extract structure
    emitProgress(1, 6, 'Parsing briefing pack structure...');
    const structure = await parseBriefingStructure(briefingPack, briefingInstructions, analystFirm, aiModel);
    emitProgress(1, 6, `✅ Extracted ${structure.sections.length} sections with ${structure.totalSlides} slides`);

    // STEP 2: Generate narrative/story with golden thread
    emitProgress(2, 6, 'Generating narrative arc and golden thread...');
    const narrative = await generateNarrative(briefingPack, briefingInstructions, structure, analystFirm, aiModel);
    emitProgress(2, 6, `✅ Generated narrative framework connecting all sections`);

    // STEP 3: Generate title slide
    emitProgress(3, 6, 'Generating title slide...');
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
    emitProgress(4, 6, 'Generating slides for each section...');
    for (let i = 0; i < structure.sections.length; i++) {
      const section = structure.sections[i];
      
      // Add throttling delay between sections to avoid rate limits
      if (i > 0) {
        console.log(`   ⏱️  Throttling 3s before section ${i + 1}/${structure.sections.length}...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Add section divider slide
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
      
      // Skip slide generation for Q&A sections - they are just dividers
      const isQASection = section.name?.toLowerCase().includes('q&a') || section.name?.toLowerCase().includes('questions');
      if (isQASection) {
        console.log(`   ℹ️  Skipping slide generation for Q&A section "${section.name}" - using section divider only`);
        continue;
      }
      
      // Generate content slides for this section using narrative context
      const sectionSlides = await generateSectionSlides(section, briefingPack, briefingInstructions, analystFirm, aiModel, narrative, vendorResponse);
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
 * PASS 1: Generate narrative arc and golden thread connecting all sections
 */
async function generateNarrative(briefingPack, briefingInstructions, structure, analystFirm, aiModel) {
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
Return ONLY valid JSON with no markdown formatting.`;

  const userPrompt = `Create the narrative arc and golden thread for this briefing:

**Briefing Structure**:
${structure.sections.map(s => `- ${s.name} (${s.duration})`).join('\n')}

**Briefing Content**:
${briefingPack.substring(0, 10000)}

**Analyst Expectations**:
${briefingInstructions.substring(0, 2000)}

Generate a JSON narrative framework with:
{
  "overarchingTheme": "One sentence theme that connects all sections",
  "narrative": "2-3 paragraph narrative arc that flows across sections",
  "sectionTransitions": {
    "Section Name": "How this section advances the narrative"
  },
  "keyMessages": [
    "Message 1 - core value proposition",
    "Message 2 - strategic positioning",
    "Message 3 - differentiation"
  ],
  "analystCriteria": "How narrative maps to analyst evaluation framework",
  "recommendedDemoScenarios": ["Scenario 1", "Scenario 2"]
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
Pay special attention to constraints - some sections specify max slides, others specify time duration:

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
      "slideTopics": ["Executive Summary", "Centers of Excellence", "Recent Acquisitions", "Cloud ERP Strategy"],
      "keyPoints": ["Extract 3-5 key facts that must be covered in this section"]
    },
    {
      "name": "Scenario Demos",
      "duration": "30 minutes",
      "constraintType": "slides",
      "timeInMinutes": 30,
      "maxSlides": 5,
      "slideTopics": ["Demo 1", "Demo 2", "Demo 3"],
      "keyPoints": ["Max 5 slides for demos regardless of time"]
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
async function generateSectionSlides(section, briefingPack, briefingInstructions, analystFirm, aiModel, narrative, vendorResponse) {
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
  
  for (let i = 0; i < sectionQueries.length; i++) {
    const query = sectionQueries[i];
    try {
      console.log(`   🔍 Search ${i + 1}/${sectionQueries.length}: "${query}"`);
      const searchResults = await searchDocuments(query, 25);
      if (searchResults && searchResults.length > 100) {
        requirementContexts[`search_${i + 1}`] = searchResults;
        console.log(`   ✅ Retrieved ${searchResults.length} characters`);
      } else {
        console.warn(`   ⚠️  No results for: "${query}"`);
        requirementContexts[`search_${i + 1}`] = '[No data found]';
      }
      // Small throttle between searches to avoid rate limits
      if (i < sectionQueries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (searchErr) {
      console.warn(`   ⚠️  Search error for "${query}":`, searchErr.message);
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
  sectionQueries.forEach((query, i) => {
    relevantContext += `\n---\nTarget ${i + 1}: "${query}"\n---\n`;
    relevantContext += (requirementContexts[`search_${i + 1}`] || '[No data found]');
    relevantContext += '\n';
  });

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

  const systemPrompt = `You are an expert Analyst Relations briefing deck builder for ${analystFirm}.
Generate ${targetSlides} slides that fit approved layout IDs and advance the narrative arc.
Use ONLY these layouts: L1_Executive_Header, L2_TwoColumn_Proof, L5_Metric_Tiles_3x1. For case sections, also use L3_Case_Card_Grid (overview) and L4_OneCase_DeepDive (5 placeholders). For capability comparisons/roadmaps/risks/partners, use L6_Table_2xN, L7_Roadmap_Timeline, L8_Risk_Mitigation, L9_Partner_Ecosystem.

**CRITICAL**: DO NOT generate any Q&A slides (L10_QA_Bank) within sections. Q&A is handled separately as a section divider only.

**QUALITY STANDARD**: The 2024 submission deck examples provided show the EXPECTED quality level. Match that depth of detail, specificity, and evidence-based content for 2026 slides.

${deck2024Examples}

Slide JSON contract per slide:
{
  "layout": "L1_Executive_Header | L2_TwoColumn_Proof | L5_Metric_Tiles_3x1 | L3_Case_Card_Grid | L4_OneCase_DeepDive | L6_Table_2xN | L7_Roadmap_Timeline | L8_Risk_Mitigation | L9_Partner_Ecosystem | L10_QA_Bank",
  "title": "...",
  "subtitle": "...",
  "intro": "2-3 sentences providing context (REQUIRED for all slides)",
  "content": { layout-specific fields },
  "evidence": "RFI § refs; KB paths; public URLs",
  "mq_mapping": ["Ability to Execute: ...", "Completeness of Vision: ..."],
  "gap_flag": true/false
}

Layout field rules:
- L1: title, subtitle (one line), intro (2-3 sentences), bullets (MINIMUM 6, maximum 8) in content.key_bullets[], evidence.
- L2: title, intro (2-3 sentences), content.left_bullets[MINIMUM 3, max 4], content.right_bullets[MINIMUM 3, max 4], content.metric_strip[3 objects {label,value,context,source}], evidence.
- L7: content.milestones[MINIMUM 4] with {quarter, initiative, outcome, status, evidence_ref}.
- L9: content.partners[MINIMUM 6] with {tier, partner_name, role, region, proof_point}.
- L5: content.tiles[<=3 {label,value,context,source}].
- L3 (case grid placeholder): content.cards array of 5 with fields {case_title, use_case, industry, region, outcome_kpi, timeframe, reference_status}; if unknown -> "{TO_FILL}" and gap_flag=true.
- L4 (case deep dive placeholder): same fields but single case narrative; if unknown -> "{TO_FILL}" and gap_flag=true.
- L6 (table 2xN): content.rows[] with {left_label, left_value, right_label, right_value}; use for capability/feature vs proof; if unknown -> "{TO_FILL}" and gap_flag=true.
- L7 (roadmap timeline): content.milestones[] with {quarter, initiative, outcome, status, evidence_ref}; quarter format "2025Q3"; if unknown -> "{TO_FILL}" and gap_flag=true.
- L8 (risk + mitigation): content.risks[] with {risk, impact, likelihood, mitigation, owner, timeline}; impact/likelihood must be High/Med/Low from evidence; if unknown -> "{TO_FILL}" and gap_flag=true.
- L9 (partner ecosystem): content.partners[] with {tier, partner_name, role, region, proof_point}; tier in {Global SI, ISV, Hyperscaler}; if unknown -> "{TO_FILL}" and gap_flag=true.
- L10: content.items[] with {question, answer, evidence}; answers may be "{TO_FILL}".

Gap policy: If any required field is missing, set value to "{TO_FILL}" and gap_flag=true. Do NOT invent data. Prefer RFI over KB when conflict; if conflict, keep RFI value and set gap_flag=true with note in evidence.

NARRATIVE CONTEXT:
Theme: "${narrative.overarchingTheme}"
Story: ${narrative.narrative}
Key Messages: ${narrative.keyMessages.join('; ')}
Section Role: ${narrative.sectionTransitions[section.name] || 'Further develop the narrative'}

${firmGuidance}

${criteria.framework.toUpperCase()} EVALUATION CRITERIA - Your content MUST address these dimensions:
${criteriaList}

🚨 CRITICAL MANDATORY RULES - VIOLATION = REJECTION:
1. **EVERY slide MUST have an "intro" field (2-3 sentences providing context)**
2. **EVERY slide MUST have MINIMUM 6 bullets (L1) or 6+ total bullets (L2 split across left/right)**
3. **EVERY single bullet MUST be backed by data from the search results below - NO EXCEPTIONS**
4. **CITE EXACT FACTS: Include specific numbers, dates, customer names, capabilities, products from search results**
5. **NO GENERIC CONTENT - "extensive expertise", "comprehensive capabilities" = AUTOMATIC REJECTION**
6. **Extract SPECIFIC: deployment numbers (10,000+, 6,500+, 3,000+), country counts (65+), certifications (116K), timeline data, product names (Oracle Cloud Garage, IBM Rapid Discovery, Workday HCM)**
7. **Each bullet MUST be SUBSTANTIAL with supporting details - not just a bare fact**
8. **If search results don't cover a topic, write "{TO_FILL}" and gap_flag=true - NEVER invent data**
9. **EVERY bullet MUST include source citation: [From: PDF filename - Page N] or [From: Excel sheet name]**
10. **Map content to MQ dimensions in mq_mapping**
11. **Preferred data order: Azure Search results (highest priority) → then Briefing Pack → then Welcome Packet**

${relevantContext}

Return ONLY valid JSON array with no markdown formatting.`;

  const userPrompt = `Build ${targetSlides} slides for this section using ONLY approved layouts.

**Section**: ${section.name}
**Duration**: ${section.duration}
**${slideConstraint}**
**Narrative Role**: ${narrative.sectionTransitions[section.name] || 'Develop key capabilities'}

MANDATORY - READ THIS FIRST:
Your slides MUST use ONLY data from the search results below. If a data point is not in the search results, write "{TO_FILL}" and set gap_flag=true. 
NEVER invent data. NEVER write generic content like "extensive expertise". EVERY bullet must cite its source: [From: DocumentName - PageNumber].

**REQUIREMENT-SPECIFIC DATA FROM AZURE SEARCH**:
${relevantContext}

**ADDITIONAL CONTEXT**:
Briefing Pack (structure/requirements):
${briefingPack.substring(0, 4000)}

Welcome Packet (context):
${briefingInstructions.substring(0, 2000)}

IBM RFI (vendor response):
${(vendorResponse || '').substring(0, 4000)}

MANDATORY REQUIREMENTS:
1. Each slide MUST have an "intro" field with 2-3 sentences providing context
2. Each slide MUST have MINIMUM 6 bullets (L1) or 6+ total bullets (L2 split across left/right)
3. READ the search results above CAREFULLY; EXTRACT specific numbers, dates, client names, products, capabilities.
4. Each bullet MUST include a source citation: [From: Document Name - Page N]
5. Each bullet must be SUBSTANTIAL with supporting details (not just bare facts)
6. Use layout IDs L1, L2, L5 for general sections; if this section is the case-study part, also produce one L3 grid + five L4 placeholders (with {TO_FILL}).
7. If data missing from search results, set field to "{TO_FILL}" and gap_flag=true. DO NOT INVENT DATA.
8. Include evidence refs per bullet (from search results). Prefer search results; if conflict with other sources, keep search results and set gap_flag=true with note.
9. Map mq_mapping to relevant MQ dimensions (Ability to Execute / Completeness of Vision).
10. NO GENERIC MARKETING CONTENT. Every sentence must reference specific data from search results.

Return ONLY valid JSON array of slides (no markdown). Each slide must follow the contract described in the system prompt.`;

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
        max_tokens: 4500,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`Section slide generation failed: ${response.status}`);
    }

    const data = await response.json();
    let slidesJSON = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

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

  // Attempt to parse JSON with better error handling
  try {
    const parsed = JSON.parse(slidesJSON);
    // Ensure it's an array
    const slides = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' && parsed.slides ? parsed.slides : [parsed]);
    return ensureCasePlaceholders(slides);
  } catch (parseError) {
    console.error('❌ JSON parse error:', parseError.message);
    console.error('First 500 chars of response:', slidesJSON.substring(0, 500));
    console.error('Last 500 chars of response:', slidesJSON.substring(slidesJSON.length - 500));
    
    // Try to find and fix common JSON issues
    // 1. Remove any trailing commas before closing brackets
    slidesJSON = slidesJSON.replace(/,(\s*[}\]])/g, '$1');
    
    // 2. Try parsing again
    try {
      const parsedRetry = JSON.parse(slidesJSON);
      const slides = Array.isArray(parsedRetry) ? parsedRetry : (parsedRetry && typeof parsedRetry === 'object' && parsedRetry.slides ? parsedRetry.slides : [parsedRetry]);
      return ensureCasePlaceholders(slides);
    } catch (secondError) {
      // If still failing, return empty array rather than crashing
      console.error('❌ JSON still invalid after cleanup, returning empty slides for this section');
      return [];
    }
  }
  });
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
 * Create PowerPoint from generated deck structure using IBM template
 */
export const createPresentationFromDeck = async (deckStructure) => {
  console.log('📊 [BRIEFING DECK] Creating PowerPoint from deck structure...');
  console.log('   Deck structure keys:', Object.keys(deckStructure || {}));
  console.log('   Slides count:', deckStructure?.slides?.length || 0);
  console.log('   Deck slides type:', typeof deckStructure?.slides);

  try {
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
            const evidenceText = slide.evidence || (slide.evidenceCitations ? slide.evidenceCitations.join('; ') : '');

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
              pptSlide.addText(slide.title || 'Untitled', {
                x: 0.5, y: 0.6, w: 9.0, h: 0.8,
                fontSize: 28, bold: true, color: ibm.blue, fontFace, align: 'left', wrap: true
              });
              if (slide.subtitle) {
                pptSlide.addText(slide.subtitle, {
                  x: 0.5, y: 1.4, w: 9.0, h: 0.4,
                  fontSize: 14, italic: true, color: ibm.grayMid, fontFace, align: 'left', wrap: true
                });
              }
              const bullets = slide.content?.key_bullets || slide.content || [];
              if (bullets?.length) {
                pptSlide.addText(
                  bullets.map((b) => ({ text: b, options: { bullet: true, fontSize: 16, color: ibm.gray, lineSpacing: 26 } })),
                  { x: 0.5, y: 2.0, w: 9.0, h: 3.5, fontFace, align: 'left' }
                );
              }
              addEvidence(6.5);
            };

            const renderL2 = () => {
              pptSlide.addText(slide.title || 'Untitled', {
                x: 0.5, y: 0.5, w: 9.0, h: 0.7,
                fontSize: 24, bold: true, color: ibm.blue, fontFace, align: 'left', wrap: true
              });
              if (slide.subtitle) {
                pptSlide.addText(slide.subtitle, {
                  x: 0.5, y: 1.2, w: 9.0, h: 0.4,
                  fontSize: 12, italic: true, color: ibm.grayMid, fontFace, align: 'left', wrap: true
                });
              }
              
              // Handle both old format (content as array) and new format (content.left_bullets/right_bullets)
              let left = [];
              let right = [];
              
              if (Array.isArray(slide.content)) {
                // Old format: split array in half
                const mid = Math.ceil(slide.content.length / 2);
                left = slide.content.slice(0, mid);
                right = slide.content.slice(mid);
              } else if (slide.content?.left_bullets && slide.content?.right_bullets) {
                // New format
                left = slide.content.left_bullets;
                right = slide.content.right_bullets;
              } else {
                // Fallback: try to extract something
                left = ['Content structure not recognized'];
                right = ['Please check slide data'];
              }
              
              if (left.length > 0) {
                pptSlide.addText(left.map((b) => ({ text: b, options: { bullet: true, fontSize: 14, color: ibm.gray, lineSpacing: 24 } })), {
                  x: 0.5, y: 1.8, w: 4.4, h: 3.6, fontFace, align: 'left'
                });
              }
              if (right.length > 0) {
                pptSlide.addText(right.map((b) => ({ text: b, options: { bullet: true, fontSize: 14, color: ibm.gray, lineSpacing: 24 } })), {
                  x: 5.0, y: 1.8, w: 4.4, h: 3.6, fontFace, align: 'left'
                });
              }
              
              const tiles = slide.content?.metric_strip || [];
              tiles.slice(0, 3).forEach((t, idx) => {
                pptSlide.addShape('rect', {
                  x: 0.5 + idx * 3.1,
                  y: 5.6,
                  w: 3.0,
                  h: 0.9,
                  fill: { color: 'F4F4F4' },
                  line: { color: ibm.blue, width: 1 }
                });
                pptSlide.addText(`${t.label || '{TO_FILL}'}: ${t.value || '{TO_FILL}'}`, {
                  x: 0.6 + idx * 3.1,
                  y: 5.65,
                  w: 2.8,
                  h: 0.35,
                  fontSize: 12,
                  color: ibm.blue,
                  fontFace,
                  wrap: true
                });
                pptSlide.addText(t.context || '{TO_FILL}', {
                  x: 0.6 + idx * 3.1,
                  y: 6.0,
                  w: 2.8,
                  h: 0.35,
                  fontSize: 10,
                  color: ibm.grayMid,
                  fontFace,
                  wrap: true
                });
                pptSlide.addText(t.source || '', {
                  x: 0.6 + idx * 3.1,
                  y: 6.3,
                  w: 2.8,
                  h: 0.25,
                  fontSize: 9,
                  color: ibm.grayMid,
                  fontFace,
                  wrap: true
                });
              });
              addEvidence(6.9);
            };

            const renderL5 = () => {
              pptSlide.addText(slide.title || 'Headline Metrics', {
                x: 0.5, y: 0.5, w: 9.0, h: 0.7,
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
                pptSlide.addText(t.label || '{TO_FILL}', { x: 0.6 + idx * 3.1, y: 1.6, w: 2.8, h: 0.4, fontSize: 12, color: ibm.grayMid, fontFace, wrap: true });
                pptSlide.addText(t.value || '{TO_FILL}', { x: 0.6 + idx * 3.1, y: 2.0, w: 2.8, h: 0.6, fontSize: 24, bold: true, color: ibm.blue, fontFace, align: 'left' });
                pptSlide.addText(t.context || '', { x: 0.6 + idx * 3.1, y: 2.7, w: 2.8, h: 0.4, fontSize: 10, color: ibm.grayMid, fontFace, wrap: true });
                pptSlide.addText(t.source || '', { x: 0.6 + idx * 3.1, y: 3.1, w: 2.8, h: 0.3, fontSize: 9, color: ibm.grayMid, fontFace, wrap: true });
              });
              addEvidence(6.9);
            };

            const renderL3 = () => {
              pptSlide.addText(slide.title || 'Case Study Overview', {
                x: 0.5, y: 0.5, w: 9.0, h: 0.7,
                fontSize: 24, bold: true, color: ibm.blue, fontFace, align: 'left', wrap: true
              });
              const cards = slide.content?.cards || [];
              const positions = [
                { x: 0.5, y: 1.5 }, { x: 4.9, y: 1.5 }, { x: 0.5, y: 3.3 }, { x: 4.9, y: 3.3 }, { x: 2.7, y: 5.1 }
              ];
              cards.slice(0, positions.length).forEach((c, idx) => {
                const pos = positions[idx];
                pptSlide.addShape('rect', {
                  x: pos.x, y: pos.y, w: 3.8, h: 1.6,
                  fill: { color: 'F4F4F4' }, line: { color: ibm.blue, width: 1 }
                });
                pptSlide.addText(c.case_title || `Case ${idx + 1}`, { x: pos.x + 0.1, y: pos.y + 0.05, w: 3.6, h: 0.3, fontSize: 12, bold: true, color: ibm.blue, fontFace, wrap: true });
                const lines = [
                  `Use case: ${c.use_case || '{TO_FILL}'}`,
                  `Industry/Region: ${c.industry || '{TO_FILL}'} / ${c.region || '{TO_FILL}'}`,
                  `Outcome: ${c.outcome_kpi || '{TO_FILL}'} (${c.timeframe || '{TO_FILL}'})`,
                  `Reference: ${c.reference_status || '{TO_FILL}'}`
                ];
                pptSlide.addText(lines.join('\n'), { x: pos.x + 0.1, y: pos.y + 0.4, w: 3.6, h: 1.1, fontSize: 10, color: ibm.gray, fontFace, wrap: true });
              });
              addEvidence(6.9);
            };

            const renderL4 = () => {
              pptSlide.addText(slide.title || slide.content?.case_title || 'Case Study', {
                x: 0.5, y: 0.5, w: 9.0, h: 0.7,
                fontSize: 24, bold: true, color: ibm.blue, fontFace, align: 'left', wrap: true
              });
              const lines = [
                `Use case: ${slide.content?.use_case || '{TO_FILL}'}`,
                `Industry/Region: ${slide.content?.industry || '{TO_FILL}'} / ${slide.content?.region || '{TO_FILL}'}`,
                `Challenge: ${slide.content?.challenge || '{TO_FILL}'}`,
                `Approach: ${slide.content?.approach || '{TO_FILL}'}`,
                `Capabilities/IP: ${slide.content?.capabilities || '{TO_FILL}'}`,
                `Outcomes: ${slide.content?.outcome_kpi || '{TO_FILL}'} (${slide.content?.timeframe || '{TO_FILL}'})`,
                `Reference: ${slide.content?.reference_status || '{TO_FILL}'}`
              ];
              pptSlide.addText(lines.join('\n\n'), {
                x: 0.5, y: 1.4, w: 9.0, h: 5.0,
                fontSize: 12, color: ibm.gray, fontFace, wrap: true
              });
              addEvidence(6.9);
            };

            const renderL10 = () => {
              pptSlide.addText(slide.title || 'Q&A Bank', {
                x: 0.5, y: 0.5, w: 9.0, h: 0.7,
                fontSize: 24, bold: true, color: ibm.blue, fontFace, align: 'left', wrap: true
              });
              const items = slide.content?.items || [];
              pptSlide.addText(items.map((qa, idx) => ({
                text: `${idx + 1}. ${qa.question || '{TO_FILL}'}\n${qa.answer || '{TO_FILL}'}`,
                options: { bullet: false, fontSize: 12, color: ibm.gray, lineSpacing: 22 }
              })), {
                x: 0.5, y: 1.3, w: 9.0, h: 5.2, fontFace, align: 'left'
              });
              addEvidence(6.9);
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
  } catch (error) {
    console.error('❌ [BRIEFING DECK] Error creating PowerPoint:', error);
    throw error;
  }
};

export default {
  generateBriefingDeck,
  createPresentationFromDeck
};
