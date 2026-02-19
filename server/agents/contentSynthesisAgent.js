/**
 * Content Synthesis Agent
 * Takes slide blueprint and extracted facts, writes compelling narratives with citations
 * This agent ONLY writes content - structure and facts are already decided
 * 
 * Reusable across any project that needs to synthesize narratives from structured data
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
 * Synthesize slide content from blueprint and facts
 * 
 * @param {Object} input - Input data
 * @param {Object} input.slidePlan - Single slide plan from structurePlanningAgent
 * @param {Object} input.facts - All extracted facts (for reference resolution)
 * @param {Object} input.narrativeSpine - Strategic narrative spine (market_tension, ibm_differentiation, etc.)
 * @param {string} input.referenceExamples - Optional 2024 deck examples for quality standard
 * @param {Object} options - Agent options
 * @param {string} options.writingStyle - Style guide (default: "professional, data-driven, specific")
 * @param {Array<string>} options.mqDimensions - MQ evaluation dimensions to map content to
 * @returns {Promise<Object>} - Complete slide with content, citations, and metadata
 */
export async function synthesizeContent(input, options = {}) {
  const { slidePlan, facts, narrativeSpine = null, referenceExamples = '', usedFactIds = [], factUsageCount = {}, usedKeyPhrases = [] } = input;
  const { 
    writingStyle = "professional, data-driven, specific",
    mqDimensions = []
  } = options;

  const systemPrompt = `You are generating content for a Gartner/Forrester analyst briefing presentation.

CRITICAL: Write for SPOKEN DELIVERY in an EXECUTIVE BRIEFING, not documentation.

MANDATORY RULES:

1. TONE & VOICE:
   - Use ACTIVE VOICE: "We deliver" not "Solutions are provided"
   - Write CONVERSATIONALLY for spoken delivery
   - Be CONFIDENT, not defensive
   - NO meta-references: Never say "This slide shows..." or "The following outlines..."

2. CONTENT REQUIREMENTS:
   - Use ONLY facts explicitly provided in the facts object
   - Every statement must answer "WHY DOES THIS MATTER TO GARTNER?"
   - Show DIFFERENTIATION: why IBM, not just what IBM does
   - INTERPRET facts, don't just list them
   - Each bullet: Hook (claim) → Proof (fact/metric) → Impact (business outcome)

3. FORBIDDEN PATTERNS:
   - Generic phrases: "extensive expertise", "comprehensive approach", "strategic capabilities"
   - Listing facts without context: "We have X consultants. We operate in Y countries."
   - Passive voice: "is provided", "was implemented", "has been achieved"
   - Documentation language: "outlines", "describes", "provides overview"
  - Citations in text: NO [Source] references - use 'evidence' field only
  - Anti-hype: Avoid adjectives like "cutting-edge", "powerhouse", "redefine", "revolutionize" unless directly supported by evidence

4. REQUIRED QUALITY:
   - Each bullet: minimum 100 characters, 2-3 sentences with narrative flow
   - Metrics: explain what they ENABLE, not just the number
   - Case studies: lead with WHY CLIENT CHOSE IBM, then outcomes
   - Capabilities: connect to BUSINESS VALUE and competitive advantage

5. EXAMPLES OF CORRECT STYLE:

   ❌ WRONG (Documentation):
   "Our Cloud ERP practice has achieved significant growth through strategic investments. We have 160,000 consultants across 65 countries."

   ✅ CORRECT (Executive Briefing):
   "We've scaled to 160,000 ERP consultants across 65 countries because clients demand global delivery with local expertise. This scale isn't just reach—it's risk reduction through proven patterns, evidenced by our 90% client return rate."

   ❌ WRONG (Project Description):
   "Pfizer engaged IBM for a multi-year S/4HANA implementation covering multiple business units."

   ✅ CORRECT (Outcome Focus):
   "Pfizer chose IBM over three competitors because we guaranteed business continuity during their global ERP transformation. Result: 90% of their business units returned for additional projects—the highest retention rate in pharma ERP."

6. STYLE GUIDE: ${writingStyle}

7. NARRATIVE SPINE GUIDANCE:
${narrativeSpine ? `
   The entire deck follows this strategic narrative framework:
   
   MARKET TENSION: ${narrativeSpine.market_tension || 'Standard ERP market dynamics'}
   → Frame challenges and opportunities in this context
   
   IBM DIFFERENTIATION: ${narrativeSpine.ibm_differentiation || 'Enterprise-grade delivery at scale'}
   → Position IBM capabilities against this thesis
   
   PROOF THEMES (Priority Order):
   ${(narrativeSpine.proof_themes || []).map((theme, i) => `${i + 1}. ${theme.theme} (${theme.axis_alignment}) - Confidence: ${theme.confidence}`).join('\n   ')}
   → Select evidence that supports these themes
   
   MEMORY LINES FOR BUYERS:
   - AE (Ability to Execute): "${(narrativeSpine.memory_lines?.ae || ['Proven global delivery'])[0]}"
   - CV (Completeness of Vision): "${(narrativeSpine.memory_lines?.cv || ['AI-driven innovation'])[0]}"
   → Use this language pattern when writing bullets
   
   KEY INSIGHT: This slide contributes to the overall narrative arc. Ensure content:
   - References market_tension when establishing context
   - Reinforces ibm_differentiation when showing capabilities
   - Draws from proof_themes when selecting evidence
   - Uses memory_line patterns for buyer-resonant language
` : '   No narrative spine provided - generate content based on facts and slide plan only.\n'}

8. MANDATORY: If specific data is missing, **OMIT** that point. NEVER use "{TO_FILL}" or placeholders.

9. IBM SIGNATURE POSITIONING (CRITICAL):
   For ANY capability discussion, weave in ONE of these differentiators:
   - AI-augmented delivery: "Our AI-augmented delivery model reduces implementation timelines by X%"
   - GenAI/Agentic AI: "We're operationalizing agentic AI across our ERP practice—our clients are already seeing 55% productivity gains"
   - Outcome-based: "Unlike competitors, we guarantee outcomes, not just implementations"
   - Risk reduction: "We eliminate risk through [specific proof], which is why 90% of clients return"
   
   Example: "We've scaled to 160,000 ERP consultants across 65 countries because clients demand global delivery with local expertise. Our AI-augmented delivery model is cutting implementation timelines by 40%, which is why we're seeing 90% client return rates—the highest in the industry."

LAYOUT-SPECIFIC REQUIREMENTS:
- L1_Executive_Header: Bold narrative paragraph (3-4 sentences) + 4-6 high-impact bullets
- L2_TwoColumn_Proof: Balanced narrative points showing proof of capability
- L5_Metric_Tiles_3x1: 3 metric tiles with ACTUAL VALUES (not "Tile 1"), each with context explaining significance
- L7_Roadmap_Timeline (SPECIAL): Must include:
  * Specific dates (2025, 2026, etc.) or quarters
  * AI/GenAI/Agentic AI milestones
  * Productivity metrics (55%, 62%, improvement percentages)
  * Business impact of each milestone
  * Example: "By Q3 2025, AI-augmented tools will drive 55% faster SAP implementations; by Q4 2025, agentic AI pilots with customers will validate 62% productivity improvements"
  
10. FOR ROADMAP/FUTURE VISION SLIDES:
   - NEVER write single thin bullets like "By 2025, we're integrating AI..."
   - ALWAYS expand with: what the capability is, how it works, what the impact is, timeline
   - ALWAYS tie to Gartner MQ dimensions: Ability to Execute, Completeness of Vision
   - USE ai_roadmap_12m from narrative spine if provided
   - Example roadmap structure:
     * "By Q2 2025: Launch AI-augmented delivery framework for SAP S/4HANA. Impact: Reduce implementation cycles by 40%, improving customer ROI timelines. This strengthens our 'Ability to Execute' positioning."
     * "By Q4 2025: Deploy agentic AI for ERP operations. Pilots with select customers show 55% efficiency gains. Scale to all practices by 2026. This proves our 'Completeness of Vision' for AI-led transformation."

11. EVIDENCE & CLAIMS (DISCIPLINE):
    - Never generalise a metric from a case study into an IBM-wide claim unless explicitly sourced for analyst briefing
    - Do not imply retention, productivity, or win rates unless provided in the facts object
    - Avoid referencing specific client names unless facts include sanctioned cases; otherwise use category-level evidence
    - Provide a concise 'evidence_notes' summary of sources used per slide

12. MQ AXIS TAGGING:
    - Explicitly map content to MQ axes
    - Include 'axis' set to "Execute" or "Vision" and 'criteria' listing the supported criteria

13. FACT REPETITION AVOIDANCE (CRITICAL):
${usedFactIds.length > 0 ? `    - AVOID REUSING these already-used facts: ${usedFactIds.slice(0, 10).join(', ')}${usedFactIds.length > 10 ? '...' : ''}
    - Prioritize FRESH facts from the provided list
    - If a fact has been used ${Math.max(...Object.values(factUsageCount).concat([0]))}+ times, find alternatives
    - Vary evidence sources across slides for richer narrative` : '    - No fact usage restrictions yet (first slides)'}

14. PHRASE REPETITION ENFORCEMENT (MANDATORY):
${usedKeyPhrases.length > 0 ? `    - **FORBIDDEN PHRASES** (already used in previous slides - DO NOT REPEAT):
${usedKeyPhrases.slice(0, 20).map(p => `      • "${p}"`).join('\n')}
    - If you write ANY of these phrases verbatim, the slide will be REJECTED
    - Rephrase metrics in different ways:
      * Instead of "40% reduction", say "cut timelines nearly in half"
      * Instead of "55% productivity gains", say "delivered productivity improvements exceeding 50%"
      * Instead of "90% return rate", say "nine out of ten clients engage us for subsequent projects"
      * Instead of "160,000 consultants across 65 countries", say "global practice spanning six continents with over 150,000 practitioners"
    - Use DIFFERENT EVIDENCE and DIFFERENT METRICS for each slide
    - Vary your phrasing - Gartner will reject decks that repeat the same claims verbatim` : '    - No phrase restrictions yet (first slides)'}
`;

  // Resolve fact references from slide plan
  const resolvedFacts = resolveFactReferences(slidePlan.factsToInclude, facts);
  
  // Filter out heavily reused facts if alternatives exist
  const freshFacts = {};
  const overusedThreshold = 3;
  Object.keys(resolvedFacts).forEach(category => {
    if (Array.isArray(resolvedFacts[category])) {
      freshFacts[category] = resolvedFacts[category].map((fact, idx) => {
        const factId = `${category}[${idx}]`;
        const usageCount = factUsageCount[factId] || 0;
        if (usageCount >= overusedThreshold) {
          return { ...fact, _overused: true, _usageCount: usageCount };
        }
        return fact;
      });
    }
  });

  const userPrompt = `Write content for this slide:

SLIDE PLAN:
Layout: ${slidePlan.layout}
Topic: ${slidePlan.topic}
Rationale: ${slidePlan.rationale}
Axis Tag: ${slidePlan.axis || 'auto'}
Criteria: ${(slidePlan.criteria || []).join(', ') || 'auto'}

FACTS TO USE (use ALL of these, prioritizing fresh facts over overused ones):
${JSON.stringify(freshFacts, null, 2).replace(/"_overused":\s*true/g, '"NOTE": "OVERUSED - find alternative if possible"').replace(/"_usageCount":\s*(\d+)/g, '"usage_count": $1')}

${referenceExamples ? `\nQUALITY STANDARD (match this depth and style):\n${referenceExamples.substring(0, 3000)}` : ''}

Return ONLY valid JSON for this slide:
{
  "layout": "${slidePlan.layout}",
  "title": "...",
  "subtitle": "...",
  "intro": "3-4 sentence narrative introduction setting the context (REQUIRED)",
  "content": {
    // Layout-specific fields
    // L1: "key_bullets": [{ "text": "Compelling narrative point...", "source": "Doc Name" }, ...]
    // L2: "left_bullets": [{ "text": "...", "source": "..." }], "right_bullets": [{ "text": "...", "source": "..." }]
    // L5: "tiles": [{label, value, context, source}]
  },
  "evidence": "Source references summary",
  "axis": "Execute|Vision",
  "criteria": ["..."],
  "mq_mapping": ["Ability to Execute: ...", "Completeness of Vision: ..."],
  "evidence_notes": "Concise sourcing notes",
  "tone_check": { "ok": true, "bannedTermsFound": [] },
  "gap_flag": false
}

MANDATORY:
- Bullets should be objects with 'text' and 'source' properties.
- Do NOT put [From: ...] in the 'text' property.
- If data is missing for a point, omit it.
`;

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
        temperature: 0.4, // Moderate creativity for engaging writing
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Content Synthesis Agent failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const slide = JSON.parse(content);

    // Apply governance checks (tone, roadmap completeness, axis presence)
    const governed = applyGovernanceChecks(slide, slidePlan);
    return governed;
  });
}

/**
 * Helper: Resolve fact references from slide plan to actual facts
 * @param {Array<string>} references - Fact references like ["scale[0]", "capabilities[1]"]
 * @param {Object} facts - All extracted facts
 * @returns {Array<Object>} - Resolved facts
 */
function resolveFactReferences(references, facts) {
  const resolved = [];
  
  for (const ref of references) {
    // Parse reference like "scale[0]" or "capabilities[1]"
    const match = ref.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      const [, category, index] = match;
      const fact = facts[category]?.[parseInt(index)];
      if (fact) {
        resolved.push({ category, ...fact });
      }
    }
  }
  
  return resolved;
}

/**
 * Governance checks: enforce anti-hype, roadmap completeness, and axis tagging presence
 * @param {Object} slide - Generated slide content
 * @param {Object} slidePlan - Original slide plan (may include axis/criteria)
 * @returns {Object} - Slide with updated tone_check/gap_flag and ensured axis/criteria fields
 */
function applyGovernanceChecks(slide, slidePlan) {
  const banned = [
    'cutting-edge', 'powerhouse', 'redefine', 'revolutionize',
    'global powerhouse', 'industry-leading' // commonly penalised hype
  ];

  const texts = [];
  if (typeof slide.intro === 'string') texts.push(slide.intro);
  const c = slide.content || {};
  const collectBullets = arr => Array.isArray(arr) ? arr.forEach(b => { if (b && b.text) texts.push(b.text); }) : null;
  collectBullets(c.key_bullets);
  collectBullets(c.left_bullets);
  collectBullets(c.right_bullets);
  if (Array.isArray(c.tiles)) c.tiles.forEach(t => { if (t && t.context) texts.push(t.context); });

  const found = [];
  for (const term of banned) {
    const re = new RegExp(`\\b${term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    if (texts.some(txt => re.test(txt))) found.push(term);
  }

  slide.tone_check = { ok: found.length === 0, bannedTermsFound: found };

  // Roadmap completeness check for L7: require dates/quarters and productivity numbers
  if (slidePlan.layout === 'L7_Roadmap_Timeline') {
    const hasDate = texts.some(t => /(Q[1-4]\s*20\d{2}|20\d{2})/i.test(t));
    const hasProductivity = texts.some(t => /(\b\d{2}\s*%\b)/.test(t));
    if (!hasDate || !hasProductivity) slide.gap_flag = true;
  }

  // Ensure axis/criteria present; if missing, fallback from plan or set defaults
  if (!slide.axis) slide.axis = slidePlan.axis || 'Execute';
  if (!Array.isArray(slide.criteria) || slide.criteria.length === 0) {
    slide.criteria = Array.isArray(slidePlan.criteria) && slidePlan.criteria.length > 0 ? slidePlan.criteria : [
      slide.axis === 'Execute' ? 'Repeatability & industrialisation' : 'Innovation roadmap'
    ];
  }

  return slide;
}
