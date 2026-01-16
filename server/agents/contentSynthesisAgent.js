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
 * @param {string} input.referenceExamples - Optional 2024 deck examples for quality standard
 * @param {Object} options - Agent options
 * @param {string} options.writingStyle - Style guide (default: "professional, data-driven, specific")
 * @param {Array<string>} options.mqDimensions - MQ evaluation dimensions to map content to
 * @returns {Promise<Object>} - Complete slide with content, citations, and metadata
 */
export async function synthesizeContent(input, options = {}) {
  const { slidePlan, facts, referenceExamples = '' } = input;
  const { 
    writingStyle = "professional, data-driven, specific",
    mqDimensions = []
  } = options;

  const systemPrompt = `You are a content synthesis agent specializing in analyst briefing decks.
Your ONLY job is to write compelling slide content using PROVIDED FACTS.

CRITICAL RULES:
1. Use ONLY facts explicitly provided in the facts object
2. Each bullet MUST include specific data (numbers, dates, names)
3. Each bullet MUST have a source citation [From: document name]
4. Write in this style: ${writingStyle}
5. NO GENERIC CONTENT - "extensive expertise" = REJECTION
6. NO INVENTED DATA - if fact missing, write "{TO_FILL}"
7. Match the quality and depth of reference examples if provided
8. Each bullet should be substantial (not just bare facts)

LAYOUT-SPECIFIC REQUIREMENTS:
- L1_Executive_Header: 6-8 key bullets, each with supporting detail
- L2_TwoColumn_Proof: 3-4 bullets per column + 3 metric tiles
- L5_Metric_Tiles_3x1: Up to 3 metric tiles with context
- Each bullet = 1-2 sentences with specific facts + citation`;

  // Resolve fact references from slide plan
  const resolvedFacts = resolveFactReferences(slidePlan.factsToInclude, facts);

  const userPrompt = `Write content for this slide:

SLIDE PLAN:
Layout: ${slidePlan.layout}
Topic: ${slidePlan.topic}
Rationale: ${slidePlan.rationale}

FACTS TO USE (use ALL of these):
${JSON.stringify(resolvedFacts, null, 2)}

${referenceExamples ? `\nQUALITY STANDARD (match this depth and style):\n${referenceExamples.substring(0, 3000)}` : ''}

Return ONLY valid JSON for this slide:
{
  "layout": "${slidePlan.layout}",
  "title": "...",
  "subtitle": "...",
  "intro": "2-3 sentences providing context (REQUIRED)",
  "content": {
    // Layout-specific fields
    // L1: "key_bullets": ["Bullet 1 [From: source]", "Bullet 2 [From: source]", ...]
    // L2: "left_bullets": [...], "right_bullets": [...], "metric_strip": [{label, value, context, source}]
    // L5: "tiles": [{label, value, context, source}]
  },
  "evidence": "Source references summary",
  "mq_mapping": ["Ability to Execute: ...", "Completeness of Vision: ..."],
  "gap_flag": false
}

MANDATORY:
- Every bullet MUST cite source: [From: document name]
- Every bullet MUST include specific data from facts
- NO generic content allowed
- If fact missing, write "{TO_FILL}" and set gap_flag=true`;

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
    return JSON.parse(content);
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
