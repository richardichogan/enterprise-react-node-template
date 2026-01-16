/**
 * Structure Planning Agent
 * Takes extracted facts and creates a slide blueprint (layout decisions + content distribution)
 * This agent ONLY plans structure - it does NOT write content
 * 
 * Reusable across any project that needs to plan presentation structure
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
 * Plan slide structure based on extracted facts
 * 
 * @param {Object} input - Input data
 * @param {Object} input.facts - Extracted facts from dataExtractionAgent
 * @param {string} input.sectionName - Section name (e.g., "Part One: Vision and Execution")
 * @param {number} input.targetSlides - Number of slides to generate
 * @param {string} input.referenceExamples - Optional 2024 deck examples for structure guidance
 * @param {Object} options - Agent options
 * @param {Array<string>} options.availableLayouts - Approved slide layouts (default: L1, L2, L5)
 * @returns {Promise<Array>} - Slide blueprint (array of slide plans)
 */
export async function planStructure(input, options = {}) {
  const { facts, sectionName, targetSlides, referenceExamples = '' } = input;
  const { availableLayouts = ['L1_Executive_Header', 'L2_TwoColumn_Proof', 'L5_Metric_Tiles_3x1'] } = options;

  const systemPrompt = `You are a presentation structure planning agent.
Your ONLY job is to plan slide structure - decide layouts and fact distribution.

AVAILABLE LAYOUTS:
- L1_Executive_Header: Executive summary with 6-8 key bullets
- L2_TwoColumn_Proof: Two columns (3-4 bullets each) + metric strip (3 metrics)
- L5_Metric_Tiles_3x1: Up to 3 large metric tiles with context
- L3_Case_Card_Grid: Case study overview (5 cards)
- L4_OneCase_DeepDive: Single case study deep dive
- L6_Table_2xN: Comparison table (capabilities vs proof)
- L7_Roadmap_Timeline: Timeline with milestones
- L8_Risk_Mitigation: Risk assessment with mitigations
- L9_Partner_Ecosystem: Partner showcase

RULES:
1. Assign one layout per slide
2. Distribute facts across slides logically (group related facts)
3. Specify which facts go on which slide (by fact ID or category)
4. DO NOT write content - only plan structure
5. Ensure ${targetSlides} slides total
6. Match approved layouts only
7. Consider narrative flow (opening → details → closing)

If reference examples provided, match their structural patterns.`;

  const userPrompt = `Plan ${targetSlides} slides for: ${sectionName}

EXTRACTED FACTS:
${JSON.stringify(facts, null, 2).substring(0, 15000)}

${referenceExamples ? `\nREFERENCE EXAMPLES (2024 DECK):\n${referenceExamples.substring(0, 5000)}` : ''}

CRITICAL: Return a JSON object with "slides" array containing ${targetSlides} slide plans.

Return this exact structure:
{
  "slides": [
    {
      "slideNumber": 1,
      "layout": "L1_Executive_Header",
      "topic": "Global Scale and Presence",
      "factsToInclude": ["scale[0]", "scale[1]", "scale[2]"],
      "rationale": "Opening slide showcasing breadth of capabilities"
    },
    {
      "slideNumber": 2,
      "layout": "L2_TwoColumn_Proof",
      "topic": "Innovation Assets",
      "factsToInclude": ["capabilities[0]", "capabilities[1]", "capabilities[2]", "outcomes[0]"],
      "rationale": "Detail accelerators with proof points"
    }
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
        temperature: 0.3, // Moderate temperature for creative planning
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Structure Planning Agent failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    if (!content) {
      console.error('   ❌ Structure Planning Agent returned empty content');
      console.error('   Response data:', JSON.stringify(data, null, 2).substring(0, 500));
      return [];
    }
    
    // Debug output
    console.log('   📋 Structure Planning Agent response preview:', content.substring(0, 200));
    
    const parsed = JSON.parse(content);
    
    // Handle both array and object with "slides" property
    const result = Array.isArray(parsed) ? parsed : (parsed.slides || []);
    console.log(`   📋 Returning ${result.length} slide plans`);
    return result;
  });
}
