/**
 * Narrative Transformation Agent
 * Post-processes synthesized content to convert from documentation style → executive briefing style
 * Applies M365 Copilot feedback: remove passive voice, add interpretation, make conversational
 * 
 * This agent transforms content AFTER synthesis but BEFORE validation
 */

import dotenv from 'dotenv';
dotenv.config();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

async function retryWithBackoff(fn, maxRetries = 3, delayMs = 65000) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const is429 = error.message?.includes('429') || error.status === 429;
      
      if (!is429 || attempt === maxRetries - 1) {
        throw error;
      }
      
      console.log(`   ⏳ Rate limit - waiting ${delayMs/1000}s (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

/**
 * Transform slide content from documentation style to executive briefing style
 * 
 * @param {Object} slide - Slide object with content fields
 * @param {Object} context - Context for transformation
 * @param {string} context.arcStage - Narrative arc stage (vision|proof|outcomes|innovation)
 * @param {string} context.sectionName - Section name
 * @param {string} context.analystFirm - Analyst firm (Gartner, Forrester, etc.)
 * @param {number} context.slideNumber - Position in deck
 * @param {Object} context.narrativeSpine - Strategic narrative spine for consistency
 * @returns {Promise<Object>} - Transformed slide with executive narrative style + speaker notes
 */
export async function transformToExecutiveBriefing(slide, context = {}) {
  const { arcStage = 'proof', sectionName = '', analystFirm = 'Gartner', slideNumber = 0, narrativeSpine = null } = context;

  // Determine narrative arc position guidance
  const arcGuidance = {
    vision: "Establish bold POV and differentiation - why IBM's approach is unique",
    proof: "Show HOW capabilities enable better outcomes - scale as enabler, not just metric",
    outcomes: "Business results with metrics - decision rationale and competitive wins",
    innovation: "Future vision backed by proof - what sets IBM apart going forward"
  };

  const systemPrompt = `You are transforming slide content for a ${analystFirm} analyst briefing.

CRITICAL TRANSFORMATION RULES:

1. TONE & VOICE:
   - Convert passive → active voice ("Solutions are provided" → "We deliver")
   - Make CONVERSATIONAL, not formal documentation
   - Use confident, executive-level language
   - Remove meta-references ("This slide shows...", "The following...")

2. INTERPRETATION REQUIREMENT:
   - Don't just state facts - explain WHY THEY MATTER to ${analystFirm}
   - Add "so what?" - how does this score on MQ/Wave criteria?
   - Show differentiation: why IBM, not just what IBM does

3. NARRATIVE FOCUS:
  - For metrics: explain what they enable, not just the number
   - For case studies: lead with why client chose IBM, emphasize outcomes
   - For capabilities: connect to business value and competitive advantage
  - Strategic POV: front-load IBM's differentiated stance on Cloud ERP (AI-augmented operating models, composability, ecosystem orchestration, industry accelerators, risk reduction, time-to-value compression)

4. FORBIDDEN PATTERNS:
   - Generic phrases without proof: "extensive expertise", "comprehensive approach"
   - Listing facts without context: "We have X consultants. We operate in Y countries."
   - Passive constructions: "is provided", "was implemented", "has been achieved"
   - Documentation language: "outlines", "describes", "provides overview of"
  - Hype language: "cutting-edge", "powerhouse", "redefine", "revolutionize" unless backed by explicit evidence

5. REQUIRED STRUCTURE:
   - Hook: Bold statement of capability/differentiation
   - Proof: Specific metric or example that validates
   - Impact: Business outcome or analyst criteria alignment
   - Make it sound like SPOKEN DELIVERY, not written document

6. CURRENT NARRATIVE STAGE: ${arcStage}
   ${arcGuidance[arcStage] || 'Develop key capabilities with proof points'}

7. MQ AXIS MAPPING:
  - Maintain alignment with the declared axis/criteria in the source slide
  - If slide supports Ability to Execute: emphasise delivery quality, repeatability, talent scale, risk mitigation
  - If slide supports Completeness of Vision: emphasise market understanding, innovation roadmap, offering/industry strategy, AI/agentic roadmap

8. NARRATIVE CONSISTENCY:
${narrativeSpine ? `
   Ensure transformed content maintains consistency with the deck's narrative spine:
   
   MARKET TENSION: ${narrativeSpine.market_tension || 'Market evolution'}
   → When establishing context, reference this tension
   
   IBM DIFFERENTIATION: ${narrativeSpine.ibm_differentiation || 'Differentiated approach'}
   → Reinforce this positioning when describing capabilities
   
   MEMORY LINES (use this language pattern):
   - For Ability to Execute content: "${(narrativeSpine.memory_lines?.ae || ['Proven delivery'])[0]}"
   - For Completeness of Vision content: "${(narrativeSpine.memory_lines?.cv || ['Innovation leadership'])[0]}"
   
   CRITICAL: Polished content should feel like part of a cohesive story, not isolated facts.
` : '   No narrative spine available - ensure slide maintains internal coherence.\n'}

EXAMPLES OF GOOD TRANSFORMATION:

❌ BEFORE (Documentation):
"Our Cloud ERP practice has achieved significant growth through strategic investments. We have 160,000 consultants across 65 countries."

✅ AFTER (Executive Briefing):
"We've scaled to 160,000 ERP consultants across 65 countries because clients demand global delivery with local expertise. This scale isn't just reach—it's risk reduction through proven patterns. Our 90% client return rate proves it works."

❌ BEFORE (Project Description):
"Pfizer engaged IBM for a multi-year S/4HANA implementation in the pharmaceutical sector. The project covered multiple business units."

✅ AFTER (Outcome Focus):
"Pfizer chose IBM over three competitors because we guaranteed business continuity during their global ERP transformation. Result: 90% of their business units returned for additional projects—the highest retention in pharma ERP."

Return the transformed slide in the EXACT SAME JSON structure, but with executive narrative style.`;

  const slideContent = JSON.stringify(slide, null, 2);

  const userPrompt = `Transform this slide content from documentation to executive briefing style:

SLIDE TO TRANSFORM:
${slideContent}

CONTEXT:
- Position in deck: Slide #${slideNumber}
- Section: ${sectionName}
- Narrative arc stage: ${arcStage}
- Analyst firm: ${analystFirm}

TRANSFORMATION CHECKLIST:
1. Remove passive voice and meta-references
2. Add interpretation: why each fact matters to analysts
3. Make conversational and confident
4. Show differentiation, not just description
5. Connect to business outcomes
6. Ensure each point has hook→proof→impact structure

Return ONLY valid JSON with the transformed slide in the EXACT SAME structure.
Keep all field names identical, just transform the text content.`;

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
        temperature: 0.4, // Slightly higher for creative transformation
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const transformedSlide = JSON.parse(content);
    
    // Ensure transformed slide has same structure
    return {
      ...slide, // Preserve all original fields
      ...transformedSlide // Apply transformations
    };
  });
}

/**
 * Generate vision statement for Executive Summary slide
 * Per M365 feedback: Must open with 3-minute bold vision statement
 * 
 * @param {Object} input - Input data
 * @param {Object} input.facts - Extracted facts
 * @param {Object} input.narrative - Narrative arc from planningAgent
 * @param {string} input.analystFirm - Analyst firm
 * @returns {Promise<string>} - Vision statement (150-200 words)
 */
export async function generateVisionStatement(input) {
  const { facts, narrative, analystFirm = 'Gartner' } = input;

  const systemPrompt = `You are generating the opening vision statement for a ${analystFirm} analyst briefing.

CRITICAL REQUIREMENTS:

1. MUST INCLUDE (3-minute vision statement):
   - IBM's unique angle on the Cloud ERP market
   - How IBM shapes/leads the market (not just participates)
   - Why IBM's approach differs from competitors (Accenture, Capgemini, Infosys)
   - What ${analystFirm} should remember after this call

2. STRUCTURE:
   - Hook: Bold market POV or insight (what's changing, why it matters)
   - Differentiation: IBM's unique approach (AI-augmented delivery, not just tools)
   - Proof: One compelling metric (scale, retention, productivity improvement)
   - AI Positioning: Brief mention of agentic AI or GenAI advantage (if relevant)
   - Vision: Outcome/impact for client (faster implementations, higher success rates)

3. TONE:
   - Visionary but grounded in proof
   - Confident, not defensive
   - Memorable and quotable
   - Conversational (written for spoken delivery)

4. LENGTH: 150-200 words (exactly 3 minutes when spoken)

5. MANDATORY AI/PRODUCTIVITY ELEMENTS (if available):
   - "We're operationalizing AI-augmented delivery—our clients see 55% faster implementations"
   - "Our agentic AI pilots are validating 62% productivity improvements across ERP operations"
   - "GenAI/agentic AI isn't future vision for us—it's live with customers today"
   
6. COMPETITIVE DIFFERENTIATION:
   - Why IBM vs Accenture/Capgemini/Infosys
   - What we've proved (90% return rate, global scale)
   - What's only IBM (specific AI operating model, outcomes guarantee)

7. EXAMPLE STRUCTURE:
"[Market insight about Cloud ERP inflection]. IBM's advantage is [specific AI approach + outcomes]. [Proof: metric + customer pilot results]. That's why [memorable outcome tied to analyst criteria]."

Return ONLY the vision statement text, no JSON or markdown.`;

  const userPrompt = `Generate the opening vision statement for IBM's Cloud ERP briefing to ${analystFirm}.

NARRATIVE ARC:
${JSON.stringify(narrative, null, 2)}

KEY FACTS TO WEAVE IN:
${JSON.stringify({
  scale: facts.scale?.slice(0, 3) || [],
  capabilities: facts.capabilities?.slice(0, 3) || [],
  partnerships: facts.partnerships?.slice(0, 2) || [],
  recent_wins: facts.case_studies?.slice(0, 2) || []
}, null, 2)}

Generate a 150-200 word vision statement that opens the briefing powerfully.
Make it memorable, differentiated, and backed by proof.`;

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
        temperature: 0.5, // Higher for creative vision
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  });
}

export default {
  transformToExecutiveBriefing,
  generateVisionStatement
};
